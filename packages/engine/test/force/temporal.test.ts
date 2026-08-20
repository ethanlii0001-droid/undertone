/**
 * Tests for force/temporal.ts — SPEC.md §9 temporal reasoning: the rung
 * ladder (LEXICON.md §4), highest-rung-wins / earliest-span tiebreak,
 * dynamic today/EOD/COB resolution, past-due handling, and the
 * deterministic proximityBonus curve.
 */
import { describe, it, expect } from "vitest";
import { scoreTemporal, proximityBonus, PROXIMITY_MAX, PROXIMITY_TAU_HOURS, PROXIMITY_HORIZON_HOURS } from "../../src/force/temporal.js";
import type { Config, MaskedMessage } from "../../src/types.js";

const TIMESTAMP = "2026-08-17T09:00:00-04:00"; // Monday 09:00 -04:00

function buildMasked(text: string, timestamp: string = TIMESTAMP): MaskedMessage {
  return {
    messageId: "m1",
    maskedText: text,
    maskedSpans: [],
    requestClauseSpan: { start: 0, end: text.length },
    requestSignature: [],
    timestamp,
    senderId: "a@example.com",
    recipientIds: ["b@example.com"],
  };
}

function rungOf(text: string, config?: Config, timestamp?: string) {
  const ev = scoreTemporal(buildMasked(text, timestamp), config);
  return ev.find((e) => e.category === "temporal" && e.subcategory !== "temporal.proximity");
}

describe("force/temporal: every rung", () => {
  it("none: explicit absence marker", () => {
    const e = rungOf("No hard deadline on this.");
    expect(e?.subcategory).toBe("none.explicit");
    expect(e?.rawWeight).toBe(0);
  });

  it("vague", () => {
    const e = rungOf("We can look at this sometime.");
    expect(e?.subcategory).toBe("vague");
    expect(e?.rawWeight).toBe(0.5);
    expect(e?.weight).toBeCloseTo(0.3, 9);
  });

  it("relative", () => {
    const e = rungOf("Could you send this over this week?");
    expect(e?.subcategory).toBe("relative");
    expect(e?.rawWeight).toBe(1.5);
    expect(e?.weight).toBeCloseTo(0.9, 9);
  });

  it("named_day", () => {
    const e = rungOf("Send it by Friday.");
    expect(e?.subcategory).toBe("named_day");
    expect(e?.rawWeight).toBe(3.0);
    expect(e?.weight).toBeCloseTo(1.8, 9);
  });

  it("date_time", () => {
    const e = rungOf("Send it by 5pm.");
    expect(e?.subcategory).toBe("date_time");
    expect(e?.rawWeight).toBe(4.0);
    expect(e?.weight).toBeCloseTo(2.4, 9);
  });

  it("immediate", () => {
    const e = rungOf("Send it ASAP.");
    expect(e?.subcategory).toBe("immediate");
    expect(e?.rawWeight).toBe(5.0);
    expect(e?.weight).toBeCloseTo(3.0, 9);
  });
});

describe("force/temporal: highest-rung-wins, not first-hit", () => {
  it("picks the higher rung when a lower one appears earlier in the text", () => {
    const e = rungOf("This week, but really by Friday at 3pm.");
    expect(e?.subcategory).toBe("date_time");
  });

  it("same-rung ties break on earliest source span", () => {
    const ev = scoreTemporal(buildMasked("Send it by Friday, not by Monday."));
    const rung = ev.find((e) => e.subcategory === "named_day");
    expect(rung?.trigger.toLowerCase()).toBe("by friday");
  });

  it("does not match across a sentence boundary", () => {
    // "Friday" and "EOD" are in different sentences — must not combine into the weekday+EOD date_time pattern.
    const e = rungOf("The report is about Friday. EOD updates are welcome.");
    expect(e?.subcategory).not.toBe("date_time");
  });
});

describe("force/temporal: dynamic today", () => {
  const config: Config = { businessDayEnd: "17:00" };

  it("> 6 hours remaining -> named_day", () => {
    const e = rungOf("Could you send this today?", config, "2026-08-17T09:00:00-04:00"); // 8h remaining
    expect(e?.subcategory).toBe("today.dynamic");
    expect(e?.rawWeight).toBe(3.0);
  });

  it("2–6 hours remaining -> date_time", () => {
    const e = rungOf("Could you send this today?", config, "2026-08-17T13:00:00-04:00"); // 4h remaining
    expect(e?.subcategory).toBe("today.dynamic");
    expect(e?.rawWeight).toBe(4.0);
  });

  it("< 2 hours remaining -> immediate", () => {
    const e = rungOf("Could you send this today?", config, "2026-08-17T16:00:00-04:00"); // 1h remaining
    expect(e?.subcategory).toBe("today.dynamic");
    expect(e?.rawWeight).toBe(5.0);
  });

  it("after business-day-end (already past today) -> immediate (negative hours remaining)", () => {
    const e = rungOf("Could you send this today?", config, "2026-08-17T18:00:00-04:00"); // 1h past 17:00
    expect(e?.subcategory).toBe("today.dynamic");
    expect(e?.rawWeight).toBe(5.0);
  });

  it("businessDayEnd omitted falls back to same-offset local 23:59 with a visible assumption note", () => {
    const ev = scoreTemporal(buildMasked("Could you send this today?"), undefined);
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.note).toContain("23:59");
  });
});

describe("force/temporal: businessDayEnd assumption bookkeeping (Prompt 6R-A Task A)", () => {
  it("dynamic 'today': note EXPLICITLY states businessDayEnd was omitted and 23:59 was assumed, on both rung and proximity Evidence", () => {
    const ev = scoreTemporal(buildMasked("Could you send this today?"), undefined);
    const rung = ev.find((e) => e.subcategory === "today.dynamic");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    for (const e of [rung, proximity]) {
      expect(e?.note).toContain("Config.businessDayEnd was omitted");
      expect(e?.note).toContain("23:59");
    }
  });

  it("bare EOD: note explicitly states the same assumption", () => {
    const ev = scoreTemporal(buildMasked("Send it by EOD."), undefined);
    const rung = ev.find((e) => e.subcategory === "eod_cob.dynamic");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    for (const e of [rung, proximity]) {
      expect(e?.note).toContain("Config.businessDayEnd was omitted");
      expect(e?.note).toContain("23:59");
    }
  });

  it("bare COB: note explicitly states the same assumption", () => {
    const ev = scoreTemporal(buildMasked("Send it by COB."), undefined);
    const rung = ev.find((e) => e.subcategory === "eod_cob.dynamic");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    for (const e of [rung, proximity]) {
      expect(e?.note).toContain("Config.businessDayEnd was omitted");
      expect(e?.note).toContain("23:59");
    }
  });

  it("when businessDayEnd IS supplied, no assumption text appears at all", () => {
    const config: Config = { businessDayEnd: "17:00" };
    const ev = scoreTemporal(buildMasked("Could you send this today?", "2026-08-17T09:00:00-04:00"), config);
    for (const e of ev) {
      expect(e.note).not.toContain("Config.businessDayEnd was omitted");
    }
  });

  it("the businessDayEnd assumption is never confused with the unrelated numeric-date locale assumption", () => {
    // Numeric date, no businessDayEnd supplied: both assumption kinds are eligible independently —
    // the numeric-date note must not claim businessDayEnd was omitted, and vice versa where only one applies.
    const numericDateEvidence = scoreTemporal(buildMasked("Send it by 12/25."), undefined);
    const rung = numericDateEvidence.find((e) => e.subcategory === "date_time");
    expect(rung?.note).toContain("locale not supplied");
    expect(rung?.note).not.toContain("Config.businessDayEnd was omitted");

    // Dynamic today, businessDayEnd omitted: must state the businessDayEnd assumption, not the numeric-date one.
    const todayEvidence = scoreTemporal(buildMasked("Could you send this today?"), undefined);
    const todayRung = todayEvidence.find((e) => e.subcategory === "today.dynamic");
    expect(todayRung?.note).toContain("Config.businessDayEnd was omitted");
    expect(todayRung?.note).not.toContain("locale not supplied");
  });
});

describe("force/temporal: EOD/COB", () => {
  const config: Config = { businessDayEnd: "17:00" };

  it("bare EOD resolves same-day against businessDayEnd", () => {
    const e = rungOf("Send it by EOD.", config, "2026-08-17T09:00:00-04:00");
    expect(e?.subcategory).toBe("eod_cob.dynamic");
  });

  it("bare COB resolves same-day against businessDayEnd", () => {
    const e = rungOf("Send it by COB.", config, "2026-08-17T09:00:00-04:00");
    expect(e?.subcategory).toBe("eod_cob.dynamic");
  });

  it("'Friday EOD' is date_time for that Friday, NOT same-day immediate, even late in the day", () => {
    const e = rungOf("Send it by Friday EOD.", config, "2026-08-17T16:55:00-04:00");
    expect(e?.subcategory).toBe("date_time");
    expect(e?.rawWeight).toBe(4.0);
  });

  it("'Friday COB' is date_time for that Friday", () => {
    const e = rungOf("Send it by Friday COB.", config, "2026-08-17T16:55:00-04:00");
    expect(e?.subcategory).toBe("date_time");
  });
});

describe("force/temporal: explicit dates and named days", () => {
  it("explicit clock time", () => {
    const e = rungOf("Send it by 3pm.");
    expect(e?.subcategory).toBe("date_time");
  });

  it("tomorrow", () => {
    const e = rungOf("Send it tomorrow.");
    expect(e?.subcategory).toBe("named_day");
  });

  it("named weekday", () => {
    const e = rungOf("Send it on Thursday.");
    expect(e?.subcategory).toBe("named_day");
  });
});

describe("force/temporal: past-due", () => {
  it("due yesterday", () => {
    const e = rungOf("This was due yesterday.");
    expect(e?.subcategory).toBe("already_past");
    const ev = scoreTemporal(buildMasked("This was due yesterday."));
    const proximity = ev.find((x) => x.subcategory === "temporal.proximity");
    expect(proximity?.weight).toBeCloseTo(PROXIMITY_MAX, 9);
  });

  it("already overdue: max rung, but proximity is 0 because no date can be resolved", () => {
    const ev = scoreTemporal(buildMasked("This is already overdue."));
    const rung = ev.find((e) => e.subcategory === "already_past");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no calendar instant could be resolved");
  });
});

describe("force/temporal: proximityBonus (SPEC.md §9.3)", () => {
  it("h <= 0 -> MAX", () => {
    expect(proximityBonus("2026-08-17T08:00:00-04:00", "2026-08-17T09:00:00-04:00")).toBe(PROXIMITY_MAX);
  });

  it("h near 0 -> close to MAX", () => {
    const v = proximityBonus("2026-08-17T09:30:00-04:00", "2026-08-17T09:00:00-04:00");
    expect(v).toBeCloseTo(PROXIMITY_MAX * Math.exp(-0.5 / PROXIMITY_TAU_HOURS), 9);
  });

  it("h = 48 (one TAU)", () => {
    const v = proximityBonus("2026-08-19T09:00:00-04:00", "2026-08-17T09:00:00-04:00");
    expect(v).toBeCloseTo(PROXIMITY_MAX * Math.exp(-1), 9);
  });

  it("h >= 336 -> 0", () => {
    expect(proximityBonus("2026-09-15T09:00:00-04:00", "2026-08-17T09:00:00-04:00")).toBe(0);
  });

  it("unresolved deadline -> 0", () => {
    expect(proximityBonus(null, "2026-08-17T09:00:00-04:00")).toBe(0);
  });
});

describe("force/temporal: determinism and no runtime dependence", () => {
  it("same input always yields the same output", () => {
    const a = scoreTemporal(buildMasked("Send it by Friday at 3pm."), { businessDayEnd: "17:00" });
    const b = scoreTemporal(buildMasked("Send it by Friday at 3pm."), { businessDayEnd: "17:00" });
    expect(a).toEqual(b);
  });

  it("resolved instants carry the message's own UTC offset, not the host machine's local timezone", () => {
    const ev = scoreTemporal(buildMasked("Send it by Friday at 3pm."));
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.note).toContain("-04:00");
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-C Task 1: "first thing" invents no clock time.
// ---------------------------------------------------------------------------

describe("force/temporal: 'first thing' retains the lexical immediate rung but invents no instant (Prompt 6R-C Task 1)", () => {
  it("'first thing tomorrow': immediate rung fires, resolvedAt is null, proximity contributes 0, note explains why", () => {
    const ev = scoreTemporal(buildMasked("Could you send this first thing tomorrow?"));
    const rung = ev.find((e) => e.subcategory === "immediate");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(rung?.weight).toBeCloseTo(3.0, 9);
    expect(proximity).toBeDefined();
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no calendar instant could be resolved");
  });

  it("'FIRST THING Monday' (case-insensitive, weekday-qualified): same behavior — no invented instant even though a weekday is named", () => {
    const ev = scoreTemporal(buildMasked("Could you send this FIRST THING Monday?"));
    const rung = ev.find((e) => e.subcategory === "immediate");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no calendar instant could be resolved");
  });

  it("'first thing in the morning': same behavior", () => {
    const ev = scoreTemporal(buildMasked("Could you send this first thing in the morning?"));
    const rung = ev.find((e) => e.subcategory === "immediate");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.weight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-C Task 2: corrected "at Npm" clock-time regex.
// ---------------------------------------------------------------------------

describe("force/temporal: 'at Npm' clock time (Prompt 6R-C Task 2 authoring correction)", () => {
  for (const text of ["The client call is at 2pm.", "The client call is at 2 pm.", "The client call is at 2:30pm.", "The client call is at 2:30 pm."]) {
    it(`${JSON.stringify(text)} matches date_time`, () => {
      const e = rungOf(text);
      expect(e?.subcategory).toBe("date_time");
      expect(e?.rawWeight).toBe(4.0);
    });
  }

  it("a bare hour with no meridiem does not match (still rejects malformed clock strings)", () => {
    const e = rungOf("The client call is at 2.");
    expect(e?.subcategory).not.toBe("date_time");
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-C Task 3: "in N minutes" reconciled with "within N minutes".
// ---------------------------------------------------------------------------

describe("force/temporal: 'in N minutes' / 'within N minutes' (Prompt 6R-C Task 3)", () => {
  it("'within 20 minutes' matches immediate", () => {
    const e = rungOf("Deadline: within 20 minutes.");
    expect(e?.subcategory).toBe("immediate");
    expect(e?.rawWeight).toBe(5.0);
  });

  it("'in 20 minutes' matches immediate at the same raw weight", () => {
    const e = rungOf("It is scheduled to send in 20 minutes.");
    expect(e?.subcategory).toBe("immediate");
    expect(e?.rawWeight).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-F Task 1: resolveInstant() itself must recognize "in N minutes"
// identically to "within N minutes" — the lexical rung already matched both
// (6R-C Task 3 above), but the resolver only resolved the "within" form.
// ---------------------------------------------------------------------------

describe("force/temporal: resolver treats 'in N minutes' and 'within N minutes' identically (Prompt 6R-F Task 1)", () => {
  it("full temporal Evidence (rung + resolved instant + proximity) matches between the two surface forms", () => {
    const withinEv = scoreTemporal(buildMasked("Deadline: within 20 minutes."));
    const inEv = scoreTemporal(buildMasked("Deadline: in 20 minutes."));

    const withinRung = withinEv.find((e) => e.subcategory === "immediate");
    const inRung = inEv.find((e) => e.subcategory === "immediate");
    expect(inRung?.rawWeight).toBe(withinRung?.rawWeight);
    expect(inRung?.weight).toBeCloseTo(withinRung?.weight as number, 9);

    const withinProximity = withinEv.find((e) => e.subcategory === "temporal.proximity");
    const inProximity = inEv.find((e) => e.subcategory === "temporal.proximity");
    // Both resolve to messageInstant + 20 minutes, so proximity bonuses must be identical.
    expect(inProximity?.weight).toBeCloseTo(withinProximity?.weight as number, 9);
    expect(inProximity?.weight).toBeGreaterThan(0);
    expect(inProximity?.note).toContain("0.33h after this message");
    expect(withinProximity?.note).toContain("0.33h after this message");
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-C Task 4: "within the next N hours" reconciled with "within N hours".
// ---------------------------------------------------------------------------

describe("force/temporal: 'within the next N hours' (Prompt 6R-C Task 4)", () => {
  it("'within 2 hours' (existing form) still matches relative", () => {
    const e = rungOf("Deadline: within 2 hours.");
    expect(e?.subcategory).toBe("relative");
    expect(e?.rawWeight).toBe(1.5);
  });

  it("'within two hours' (existing number-word form) still matches relative", () => {
    const e = rungOf("Deadline: within two hours.");
    expect(e?.subcategory).toBe("relative");
    expect(e?.rawWeight).toBe(1.5);
  });

  it("'within the next 2 hours' matches relative at the same raw weight", () => {
    const e = rungOf("Deadline: within the next 2 hours.");
    expect(e?.subcategory).toBe("relative");
    expect(e?.rawWeight).toBe(1.5);
  });

  it("'within the next two hours' matches relative at the same raw weight", () => {
    const e = rungOf("Deadline: within the next two hours.");
    expect(e?.subcategory).toBe("relative");
    expect(e?.rawWeight).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-C Task 6: confirm unrelated temporal behavior is unaffected.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prompt 6R-F Task 2: past-due resolution for "needed an hour ago" and
// "overdue since <month day>", while "already overdue" stays unresolved.
// ---------------------------------------------------------------------------

describe("force/temporal: past-due resolution (Prompt 6R-F Task 2)", () => {
  it("'needed an hour ago' resolves to messageInstant - 1h and receives PROXIMITY_MAX (h <= 0)", () => {
    const ev = scoreTemporal(buildMasked("This was needed an hour ago."));
    const rung = ev.find((e) => e.subcategory === "already_past");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.note).toContain("2026-08-17T08:00:00-04:00");
    expect(proximity?.weight).toBeCloseTo(PROXIMITY_MAX, 9);
  });

  it("'overdue since Aug 15' resolves the stated month/day in the message's own offset, using the current calendar year when that date is already in the past", () => {
    const ev = scoreTemporal(buildMasked("This is overdue since Aug 15.", "2026-08-17T09:00:00-04:00"));
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.note).toContain("2026-08-15T23:59:00-04:00");
    expect(proximity?.weight).toBeCloseTo(PROXIMITY_MAX, 9);
  });

  it("'overdue since Dec 25' rolls back to the PREVIOUS year when the current-year date would be in the future", () => {
    const ev = scoreTemporal(buildMasked("This is overdue since Dec 25.", "2026-08-17T09:00:00-04:00"));
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.note).toContain("2025-12-25T23:59:00-04:00");
    expect(proximity?.weight).toBeCloseTo(PROXIMITY_MAX, 9);
  });

  it("'already overdue' still names no specific date — resolvedAt stays null, proximity stays 0", () => {
    const ev = scoreTemporal(buildMasked("This is already overdue."));
    const rung = ev.find((e) => e.subcategory === "already_past");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no calendar instant could be resolved");
  });
});

// ---------------------------------------------------------------------------
// Prompt 6R-F Task 3: "start of business/play <weekday>" must not resolve to
// that weekday's business-day END — Config has no business-day-START field.
// ---------------------------------------------------------------------------

describe("force/temporal: 'start of business/play <weekday>' invents no instant (Prompt 6R-F Task 3)", () => {
  const config: Config = { businessDayEnd: "17:00" };

  it("'start of business Monday': date_time rung fires, resolvedAt is null, proximity is 0, note explains no business-start field exists", () => {
    const ev = scoreTemporal(buildMasked("Send it at the start of business Monday."), config);
    const rung = ev.find((e) => e.subcategory === "date_time");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(4.0);
    expect(rung?.weight).toBeCloseTo(2.4, 9);
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no business-day-start field");
    expect(proximity?.note).not.toContain("businessDayEnd");
  });

  it("'start of play Monday': same behavior for the 'play' variant", () => {
    const ev = scoreTemporal(buildMasked("Send it at the start of play Monday."), config);
    const rung = ev.find((e) => e.subcategory === "date_time");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(4.0);
    expect(proximity?.weight).toBe(0);
    expect(proximity?.note).toContain("no business-day-start field");
  });
});

describe("force/temporal: unaffected behaviors (Prompt 6R-C Task 6 regression sweep)", () => {
  const config: Config = { businessDayEnd: "17:00" };

  it("dynamic today still resolves normally", () => {
    const e = rungOf("Could you send this today?", config, "2026-08-17T09:00:00-04:00");
    expect(e?.subcategory).toBe("today.dynamic");
  });

  it("tomorrow still resolves to a concrete instant", () => {
    const ev = scoreTemporal(buildMasked("Send it tomorrow."));
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.weight).toBeGreaterThan(0);
  });

  it("named weekday still matches named_day", () => {
    const e = rungOf("Send it on Thursday.");
    expect(e?.subcategory).toBe("named_day");
  });

  it("bare EOD/COB still resolve same-day", () => {
    expect(rungOf("Send it by EOD.", config)?.subcategory).toBe("eod_cob.dynamic");
    expect(rungOf("Send it by COB.", config)?.subcategory).toBe("eod_cob.dynamic");
  });

  it("'Friday EOD'/'Friday COB' still resolve date_time, not same-day immediate", () => {
    expect(rungOf("Send it by Friday EOD.", config, "2026-08-17T16:55:00-04:00")?.subcategory).toBe("date_time");
    expect(rungOf("Send it by Friday COB.", config, "2026-08-17T16:55:00-04:00")?.subcategory).toBe("date_time");
  });

  it("'due yesterday' still resolves past-due with max proximity", () => {
    const ev = scoreTemporal(buildMasked("This was due yesterday."));
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(proximity?.weight).toBeCloseTo(PROXIMITY_MAX, 9);
  });

  it("'already overdue' still resolves max rung with unresolved (null) proximity", () => {
    const ev = scoreTemporal(buildMasked("This is already overdue."));
    const rung = ev.find((e) => e.subcategory === "already_past");
    const proximity = ev.find((e) => e.subcategory === "temporal.proximity");
    expect(rung?.rawWeight).toBe(5.0);
    expect(proximity?.weight).toBe(0);
  });

  it("proximity curve boundaries are unaffected: h<=0 -> MAX, h>=336 -> 0", () => {
    expect(proximityBonus("2026-08-17T08:00:00-04:00", "2026-08-17T09:00:00-04:00")).toBe(PROXIMITY_MAX);
    expect(proximityBonus("2026-09-15T09:00:00-04:00", "2026-08-17T09:00:00-04:00")).toBe(0);
  });
});
