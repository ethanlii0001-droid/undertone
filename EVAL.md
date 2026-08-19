# UnderTone — EVAL

**Version:** 1.1 (reconciled hackathon scope)

This is the **specification-test suite** for UnderTone. It is designed to test whether the implementation obeys `SPEC.md` and `LEXICON.md`.

It does **not** establish agreement with human pragmatic judgments. Construct validation would require independent readers or an external corpus not authored around UnderTone's own rules.

## Migration from v1.0

The old file contained 40 mitigation-heavy pairs, 10 negative controls, and 8 hard cases. V1.1 reorganizes the core suite into the six families required by the SPEC and tests both directions of the central claim.

The scenario themes of the original 40 pairs were reviewed. Workplace-compatible scenarios were preserved directly or adapted across `head-act-strategy` and `internal-modification`; school/landlord-specific examples were converted to workplace analogues or removed from the normative suite because v1.1 is workplace-only.

Absolute expected force/surface bands from v1.0 are no longer treated as ground truth. Core pairs encode only **direction and invariance**.

---

## Canonical fixture schema

```ts
type Family =
  | "head-act-modality"
  | "head-act-strategy"
  | "internal-modification"
  | "external-only"
  | "deadline-specificity"
  | "escalation";

interface ExpectedSurfaceManipulation {
  surfaceRelation: "a > b" | "b > a";
  minSurfaceDelta: number;
  forceDeltaMax: number;
  claim: string;
}

interface ExpectedForceManipulation {
  surfaceDeltaMax: number;
  forceRelation: "a > b" | "b > a";
  minForceDelta: number;
  claim: string;
}

interface MessagePair {
  id: string;
  family: Family;
  a: string | TestThread;
  b: string | TestThread;
  expected: ExpectedSurfaceManipulation | ExpectedForceManipulation;
  note: string;
}
```

**Required population:** exactly **120 core minimal pairs — 20 per family**. Negative controls and hard cases are separate and do not count toward 120.

### Deterministic fixture clock

Unless a `TestThread` supplies explicit timestamps, the harness wraps each string fixture in a message timestamped **Monday, 2026-08-17 at 09:00:00−04:00** with `businessDayEnd = 17:00` and locale/calendar assumptions fixed by test config. Relative expressions such as `today`, `tomorrow`, and weekdays therefore resolve reproducibly without reading the wall clock. A pair may override the timestamp only when the timing behavior itself is under test.

For families 1–3, the force-bearing context is held constant while surface realization changes. For families 4–6, the request wording is held constant while force-bearing evidence changes.

---

## Family — `head-act-modality` (20 pairs)

```json
[
  {
    "id": "ham-01",
    "family": "head-act-modality",
    "a": "Review the deck before Thursday's client call.",
    "b": "Could you review the deck before Thursday's client call?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-02",
    "family": "head-act-modality",
    "a": "Submit the expense report by Friday EOD. Otherwise Finance cannot reimburse it this cycle.",
    "b": "Could you submit the expense report by Friday EOD? Otherwise Finance cannot reimburse it this cycle.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-03",
    "family": "head-act-modality",
    "a": "Send the Q3 numbers before Monday's executive review.",
    "b": "Could you send the Q3 numbers before Monday's executive review?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-04",
    "family": "head-act-modality",
    "a": "Fix the CI pipeline before the sprint ends. Three pull requests are blocked on it.",
    "b": "Could you fix the CI pipeline before the sprint ends? Three pull requests are blocked on it.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-05",
    "family": "head-act-modality",
    "a": "Approve the PTO request before the payroll cutoff Wednesday at noon.",
    "b": "Could you approve the PTO request before the payroll cutoff Wednesday at noon?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-06",
    "family": "head-act-modality",
    "a": "Confirm the headcount numbers before they go into the board deck tonight.",
    "b": "Could you confirm the headcount numbers before they go into the board deck tonight?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-07",
    "family": "head-act-modality",
    "a": "Swap the standup slot before the 2pm client call.",
    "b": "Could you swap the standup slot before the 2pm client call?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-08",
    "family": "head-act-modality",
    "a": "Confirm on-call coverage for Thursday night before the rota is finalized.",
    "b": "Could you confirm on-call coverage for Thursday night before the rota is finalized?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-09",
    "family": "head-act-modality",
    "a": "Review the debugging notes before the manager demo at 3pm.",
    "b": "Could you review the debugging notes before the manager demo at 3pm?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-10",
    "family": "head-act-modality",
    "a": "Proofread the client email before it is sent in 20 minutes.",
    "b": "Could you proofread the client email before it is sent in 20 minutes?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-11",
    "family": "head-act-modality",
    "a": "Confirm the desk move this week before the project team relocates.",
    "b": "Could you confirm the desk move this week before the project team relocates?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-12",
    "family": "head-act-modality",
    "a": "Review the migration script before it runs against production tonight.",
    "b": "Could you review the migration script before it runs against production tonight?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-13",
    "family": "head-act-modality",
    "a": "Return the signed contract by Friday. Otherwise the launch date slips.",
    "b": "Could you return the signed contract by Friday? Otherwise the launch date slips.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-14",
    "family": "head-act-modality",
    "a": "Send the final logo files before the print deadline Wednesday at 5pm.",
    "b": "Could you send the final logo files before the print deadline Wednesday at 5pm?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-15",
    "family": "head-act-modality",
    "a": "Send the updated invoice before the internal audit closes Friday.",
    "b": "Could you send the updated invoice before the internal audit closes Friday?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-16",
    "family": "head-act-modality",
    "a": "Confirm the SLA remediation before the next review. Another miss escalates to procurement.",
    "b": "Could you confirm the SLA remediation before the next review? Another miss escalates to procurement.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-17",
    "family": "head-act-modality",
    "a": "Call back before the board meeting starts at 9am tomorrow.",
    "b": "Could you call back before the board meeting starts at 9am tomorrow?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-18",
    "family": "head-act-modality",
    "a": "Schedule the renewal conversation before the contract lapses in about two months.",
    "b": "Could you schedule the renewal conversation before the contract lapses in about two months?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-19",
    "family": "head-act-modality",
    "a": "Send the signed purchase order before the pricing lock expires Friday.",
    "b": "Could you send the signed purchase order before the pricing lock expires Friday?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  },
  {
    "id": "ham-20",
    "family": "head-act-modality",
    "a": "Send interview feedback before tomorrow morning's offer-decision meeting.",
    "b": "Could you send interview feedback before tomorrow morning's offer-decision meeting?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes imperative mood to a conventional ability-question request while holding the action and all force-bearing deadline/consequence/dependency wording constant."
  }
]
```

## Family — `head-act-strategy` (20 pairs)

```json
[
  {
    "id": "has-01",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-01 theme preserved/adapted",
    "a": "I'm asking you to review the deck before Thursday's client call.",
    "b": "Might be worth reviewing the deck before Thursday's client call.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-02",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-02 theme preserved/adapted",
    "a": "I need you to submit the expense report by Friday EOD. Otherwise Finance cannot reimburse it this cycle.",
    "b": "How about submitting the expense report by Friday EOD? Otherwise Finance cannot reimburse it this cycle.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-03",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-03 theme preserved/adapted",
    "a": "I'd like you to send the Q3 numbers before Monday's executive review.",
    "b": "Could you send the Q3 numbers before Monday's executive review?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-04",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-04 theme preserved/adapted",
    "a": "I'm asking you to fix the CI pipeline before the sprint ends. Three pull requests are blocked on it.",
    "b": "Could you fix the CI pipeline before the sprint ends? Three pull requests are blocked on it.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-05",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-05 theme preserved/adapted",
    "a": "You need to approve the PTO request before the payroll cutoff Wednesday at noon.",
    "b": "Maybe we could approve the PTO request before the payroll cutoff Wednesday at noon.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-06",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-06 theme preserved/adapted",
    "a": "I'm asking you to confirm the headcount numbers before they go into the board deck tonight.",
    "b": "Might be worth confirming the headcount numbers before they go into the board deck tonight.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-07",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-07 theme preserved/adapted",
    "a": "I need you to swap the standup slot before the 2pm client call.",
    "b": "How about swapping the standup slot before the 2pm client call?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-08",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-08 theme preserved/adapted",
    "a": "I'd like you to confirm on-call coverage for Thursday night before the rota is finalized.",
    "b": "Could you confirm on-call coverage for Thursday night before the rota is finalized?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-09",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-09 theme preserved/adapted",
    "a": "I'm asking you to review the debugging notes before the manager demo at 3pm.",
    "b": "Could you review the debugging notes before the manager demo at 3pm?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-10",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-10 theme preserved/adapted",
    "a": "You need to proofread the client email before it is sent in 20 minutes.",
    "b": "Maybe we could proofread the client email before it is sent in 20 minutes.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-11",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-11 theme preserved/adapted",
    "a": "I'm asking you to confirm the desk move this week before the project team relocates.",
    "b": "Might be worth confirming the desk move this week before the project team relocates.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-12",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-12 theme preserved/adapted",
    "a": "I need you to review the migration script before it runs against production tonight.",
    "b": "How about reviewing the migration script before it runs against production tonight?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-13",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-13 theme preserved/adapted",
    "a": "I'd like you to return the signed contract by Friday. Otherwise the launch date slips.",
    "b": "Could you return the signed contract by Friday? Otherwise the launch date slips.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-14",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-14 theme preserved/adapted",
    "a": "I'm asking you to send the final logo files before the print deadline Wednesday at 5pm.",
    "b": "Could you send the final logo files before the print deadline Wednesday at 5pm?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-15",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-15 theme preserved/adapted",
    "a": "You need to send the updated invoice before the internal audit closes Friday.",
    "b": "Maybe we could send the updated invoice before the internal audit closes Friday.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-16",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-16 theme preserved/adapted",
    "a": "I'm asking you to confirm the SLA remediation before the next review. Another miss escalates to procurement.",
    "b": "Might be worth confirming the SLA remediation before the next review. Another miss escalates to procurement.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-17",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-17 theme preserved/adapted",
    "a": "I need you to call back before the board meeting starts at 9am tomorrow.",
    "b": "How about calling back before the board meeting starts at 9am tomorrow?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-18",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-18 theme preserved/adapted",
    "a": "I'd like you to schedule the renewal conversation before the contract lapses in about two months.",
    "b": "Could you schedule the renewal conversation before the contract lapses in about two months?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-19",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-19 theme preserved/adapted",
    "a": "I'm asking you to send the signed purchase order before the pricing lock expires Friday.",
    "b": "Could you send the signed purchase order before the pricing lock expires Friday?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  },
  {
    "id": "has-20",
    "family": "head-act-strategy",
    "sourceScenario": "v1 mp-20 theme preserved/adapted",
    "a": "You need to send interview feedback before tomorrow morning's offer-decision meeting.",
    "b": "Maybe we could send interview feedback before tomorrow morning's offer-decision meeting.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Changes the CCSARP request strategy while holding the action and all force-bearing context constant."
  }
]
```

## Family — `internal-modification` (20 pairs)

```json
[
  {
    "id": "im-01",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-21 theme preserved or workplace-adapted",
    "a": "Could you send the vendor compliance certificate by Friday? Otherwise the vendor remains non-compliant.",
    "b": "Could you just send the vendor compliance certificate by Friday? No rush. Otherwise the vendor remains non-compliant.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-02",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-22 theme preserved or workplace-adapted",
    "a": "Could you clear the staging storage area before the new equipment arrives on the 1st?",
    "b": "If you get a chance, could you clear the staging storage area before the new equipment arrives on the 1st? No pressure.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-03",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-23 theme preserved or workplace-adapted",
    "a": "Would you return the security keys before the final walkthrough Monday at 9am? Access closure depends on it.",
    "b": "Would you possibly return the security keys before the final walkthrough Monday at 9am? Whenever you get a chance. Access closure depends on it.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-04",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-24 theme preserved or workplace-adapted",
    "a": "Could you send the signed event waiver before Friday's company offsite registration closes?",
    "b": "Sorry to bother you, but could you maybe send the signed event waiver before Friday's company offsite registration closes?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-05",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-25 theme preserved or workplace-adapted",
    "a": "Can you correct the incomplete data entry before reporting closes Monday? Otherwise the record stays incomplete.",
    "b": "Can you perhaps correct the incomplete data entry before reporting closes Monday? If that works. Otherwise the record stays incomplete.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-06",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-26 theme preserved or workplace-adapted",
    "a": "Could you pay the conference registration fee before the seat is released to the waitlist?",
    "b": "Could you just pay the conference registration fee before the seat is released to the waitlist? No rush.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-07",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-27 theme preserved or workplace-adapted",
    "a": "Could you choose a conference slot before scheduling closes Wednesday night?",
    "b": "If you get a chance, could you choose a conference slot before scheduling closes Wednesday night? No pressure.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-08",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-28 theme preserved or workplace-adapted",
    "a": "Would you reset the password before midnight tonight or the account locks?",
    "b": "Would you possibly reset the password before midnight tonight or the account locks? Whenever you get a chance.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-09",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-29 theme preserved or workplace-adapted",
    "a": "Could you complete the compliance module before the audit window closes Friday?",
    "b": "Sorry to bother you, but could you maybe complete the compliance module before the audit window closes Friday?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-10",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-30 theme preserved or workplace-adapted",
    "a": "Can you rotate the exposed API key as soon as possible because the credential is exposed?",
    "b": "Can you perhaps rotate the exposed API key as soon as possible because the credential is exposed? If that works.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-11",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-31 theme preserved or workplace-adapted",
    "a": "Could you complete benefits enrollment before EOD Friday? Re-enrollment is unavailable until next year.",
    "b": "Could you just complete benefits enrollment before EOD Friday? No rush. Re-enrollment is unavailable until next year.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-12",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-32 theme preserved or workplace-adapted",
    "a": "Could you return the company laptop before Thursday's offboarding cutoff?",
    "b": "If you get a chance, could you return the company laptop before Thursday's offboarding cutoff? No pressure.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-13",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-33 theme preserved or workplace-adapted",
    "a": "Would you acknowledge the policy remediation before the case advances to formal review?",
    "b": "Would you possibly acknowledge the policy remediation before the case advances to formal review? Whenever you get a chance.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-14",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-34 theme preserved or workplace-adapted",
    "a": "Could you return the signed NDA before the deal can close?",
    "b": "Sorry to bother you, but could you maybe return the signed NDA before the deal can close?",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-15",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-35 theme preserved or workplace-adapted",
    "a": "Can you send the expense receipts before Finance closes the books Friday?",
    "b": "Can you perhaps send the expense receipts before Finance closes the books Friday? If that works.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-16",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-36 theme preserved or workplace-adapted",
    "a": "Could you confirm contractor availability before the project can be scheduled?",
    "b": "Could you just confirm contractor availability before the project can be scheduled? No rush.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-17",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-37 theme preserved or workplace-adapted",
    "a": "Could you resolve the overdue invoice before the account moves to collections?",
    "b": "If you get a chance, could you resolve the overdue invoice before the account moves to collections? No pressure.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-18",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-38 theme preserved or workplace-adapted",
    "a": "Would you confirm the calendar hold before the executive schedule locks Wednesday?",
    "b": "Would you possibly confirm the calendar hold before the executive schedule locks Wednesday? Whenever you get a chance.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-19",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-39 theme preserved or workplace-adapted",
    "a": "Could you send interview feedback before tomorrow's offer meeting? The panel is waiting on it.",
    "b": "Sorry to bother you, but could you maybe send interview feedback before tomorrow's offer meeting? The panel is waiting on it.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  },
  {
    "id": "im-20",
    "family": "internal-modification",
    "sourceScenario": "v1 mp-40 theme preserved or workplace-adapted",
    "a": "Can you send the signed PO before the pricing lock expires Friday?",
    "b": "Can you perhaps send the signed PO before the pricing lock expires Friday? If that works.",
    "expected": {
      "surfaceRelation": "a > b",
      "minSurfaceDelta": 1.0,
      "forceDeltaMax": 1e-09,
      "claim": "surface changes while force remains invariant, conditional on both variants being detected as the same request"
    },
    "note": "Keeps the request action and CCSARP strategy constant while adding only surface-side mitigation; force-bearing context is unchanged."
  }
]
```

## Family — `external-only` (20 pairs)

```json
[
  {
    "id": "ext-01",
    "family": "external-only",
    "a": "Could you review the deck?",
    "b": "Could you review the deck? The client call is Thursday and the deck must be ready before it.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/accountability evidence."
  },
  {
    "id": "ext-02",
    "family": "external-only",
    "a": "Could you submit the expense report?",
    "b": "Could you submit the expense report? Finance cannot reimburse it this cycle until it is submitted.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent dependency/consequence evidence."
  },
  {
    "id": "ext-03",
    "family": "external-only",
    "a": "Could you send the Q3 numbers?",
    "b": "Could you send the Q3 numbers? The executive review starts Monday morning and the numbers are required beforehand.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/accountability evidence."
  },
  {
    "id": "ext-04",
    "family": "external-only",
    "a": "Could you fix the CI pipeline?",
    "b": "Could you fix the CI pipeline? Three pull requests are blocked on the pipeline.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent dependency evidence."
  },
  {
    "id": "ext-05",
    "family": "external-only",
    "a": "Could you approve the PTO request?",
    "b": "Could you approve the PTO request? Payroll closes on Wednesday at 12pm and cannot process the request afterward.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/consequence evidence."
  },
  {
    "id": "ext-06",
    "family": "external-only",
    "a": "Could you confirm the headcount?",
    "b": "Could you confirm the headcount? The board deck goes out tonight and this is the last missing number.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/dependency evidence."
  },
  {
    "id": "ext-07",
    "family": "external-only",
    "a": "Could you swap the standup slot?",
    "b": "Could you swap the standup slot? The current slot conflicts with the client call at 2pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent dependency evidence."
  },
  {
    "id": "ext-08",
    "family": "external-only",
    "a": "Could you confirm Thursday's on-call coverage?",
    "b": "Could you confirm Thursday's on-call coverage? The rota cannot be published until coverage is confirmed.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent dependency evidence."
  },
  {
    "id": "ext-09",
    "family": "external-only",
    "a": "Could you review the debugging notes?",
    "b": "Could you review the debugging notes? The manager demo begins at 3pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/accountability evidence."
  },
  {
    "id": "ext-10",
    "family": "external-only",
    "a": "Could you proofread the client email?",
    "b": "Could you proofread the client email? It is scheduled to send in 20 minutes.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline evidence."
  },
  {
    "id": "ext-11",
    "family": "external-only",
    "a": "Could you confirm the desk move?",
    "b": "Could you confirm the desk move? Facilities is waiting on the answer before moving the project team.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent accountability/dependency evidence."
  },
  {
    "id": "ext-12",
    "family": "external-only",
    "a": "Could you review the migration script?",
    "b": "Could you review the migration script? The production run is at 8pm tonight and deployment is blocked until review.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/dependency evidence."
  },
  {
    "id": "ext-13",
    "family": "external-only",
    "a": "Could you return the signed contract?",
    "b": "Could you return the signed contract? If it is not back by Friday, the launch date slips.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/consequence evidence."
  },
  {
    "id": "ext-14",
    "family": "external-only",
    "a": "Could you send the final logo files?",
    "b": "Could you send the final logo files? The print deadline is Wednesday at 5pm and printing cannot start without them.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/dependency evidence."
  },
  {
    "id": "ext-15",
    "family": "external-only",
    "a": "Could you send the updated invoice?",
    "b": "Could you send the updated invoice? The internal audit closes on Friday and the file cannot close without it.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/dependency evidence."
  },
  {
    "id": "ext-16",
    "family": "external-only",
    "a": "Could you confirm the SLA remediation?",
    "b": "Could you confirm the SLA remediation? Another miss triggers procurement escalation.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent consequence evidence."
  },
  {
    "id": "ext-17",
    "family": "external-only",
    "a": "Could you call me back?",
    "b": "Could you call me back? The board meeting starts at 9am tomorrow.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline evidence."
  },
  {
    "id": "ext-18",
    "family": "external-only",
    "a": "Could you schedule the renewal conversation?",
    "b": "Could you schedule the renewal conversation? The contract lapses on Friday.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds an explicit named-day deadline; this pair tests external temporal evidence without changing the request wording."
  },
  {
    "id": "ext-19",
    "family": "external-only",
    "a": "Could you send the signed purchase order?",
    "b": "Could you send the signed purchase order? The pricing lock expires on Friday.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/consequence evidence."
  },
  {
    "id": "ext-20",
    "family": "external-only",
    "a": "Could you send interview feedback?",
    "b": "Could you send interview feedback? The offer-decision meeting is tomorrow morning and the panel is waiting on it.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is byte-identical. Variant B adds only independent deadline/dependency evidence."
  }
]
```

## Family — `deadline-specificity` (20 pairs)

```json
[
  {
    "id": "ddl-01",
    "family": "deadline-specificity",
    "a": "Could you send the deck?",
    "b": "Could you send the deck? Deadline: by Thursday at 3pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-02",
    "family": "deadline-specificity",
    "a": "Could you submit the expense report? Timing: sometime.",
    "b": "Could you submit the expense report? Deadline: by Friday EOD.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-03",
    "family": "deadline-specificity",
    "a": "Could you send the Q3 numbers? Timing: this week.",
    "b": "Could you send the Q3 numbers? Deadline: before Monday at 9am.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-04",
    "family": "deadline-specificity",
    "a": "Could you fix the CI pipeline? Timing: when there is time.",
    "b": "Could you fix the CI pipeline? Deadline: within the next two hours.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-05",
    "family": "deadline-specificity",
    "a": "Could you approve the PTO request? Timing: later this week.",
    "b": "Could you approve the PTO request? Deadline: by Wednesday at 12pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-06",
    "family": "deadline-specificity",
    "a": "Could you confirm the headcount? Timing: soon.",
    "b": "Could you confirm the headcount? Deadline: before 5pm today.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-07",
    "family": "deadline-specificity",
    "a": "Could you swap the standup slot?",
    "b": "Could you swap the standup slot? Deadline: before the 2pm client call today.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-08",
    "family": "deadline-specificity",
    "a": "Could you confirm on-call coverage? Timing: at some point.",
    "b": "Could you confirm on-call coverage? Deadline: by Thursday at noon.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-09",
    "family": "deadline-specificity",
    "a": "Could you review the debugging notes? Timing: this week.",
    "b": "Could you review the debugging notes? Deadline: before 3pm today.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-10",
    "family": "deadline-specificity",
    "a": "Could you proofread the client email? Timing: soon.",
    "b": "Could you proofread the client email? Deadline: within 20 minutes.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-11",
    "family": "deadline-specificity",
    "a": "Could you confirm the desk move?",
    "b": "Could you confirm the desk move? Deadline: by Friday.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-12",
    "family": "deadline-specificity",
    "a": "Could you review the migration script? Timing: later.",
    "b": "Could you review the migration script? Deadline: before the production run at 8pm tonight.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-13",
    "family": "deadline-specificity",
    "a": "Could you return the signed contract? Timing: this month.",
    "b": "Could you return the signed contract? Deadline: by Friday.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-14",
    "family": "deadline-specificity",
    "a": "Could you send the final logo files? Timing: soon.",
    "b": "Could you send the final logo files? Deadline: by Wednesday at 5pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-15",
    "family": "deadline-specificity",
    "a": "Could you send the updated invoice? Timing: this week.",
    "b": "Could you send the updated invoice? Deadline: by Friday at 5pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-16",
    "family": "deadline-specificity",
    "a": "Could you confirm the SLA remediation?",
    "b": "Could you confirm the SLA remediation? Deadline: before tomorrow's review at 10am.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-17",
    "family": "deadline-specificity",
    "a": "Could you call me back? Timing: when you have time.",
    "b": "Could you call me back? Deadline: before 9am tomorrow.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-18",
    "family": "deadline-specificity",
    "a": "Could you schedule the renewal conversation? Timing: at some point this quarter.",
    "b": "Could you schedule the renewal conversation? Deadline: by September 30.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-19",
    "family": "deadline-specificity",
    "a": "Could you send the signed PO? Timing: soon.",
    "b": "Could you send the signed PO? Deadline: by Friday at 12pm.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  },
  {
    "id": "ddl-20",
    "family": "deadline-specificity",
    "a": "Could you send interview feedback? Timing: this week.",
    "b": "Could you send interview feedback? Deadline: before tomorrow at 9am.",
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Request wording is identical; only temporal specificity/proximity changes. Timing phrases are force-only under v1.1."
  }
]
```

## Family — `escalation` (20 pairs)

```json
[
  {
    "id": "esc-01",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the deck?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the deck?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the deck?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-02",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you submit the expense report?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you submit the expense report?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you submit the expense report?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you submit the expense report?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-03",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the Q3 numbers?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the Q3 numbers?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the Q3 numbers?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-04",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you fix the CI pipeline?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you fix the CI pipeline?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you fix the CI pipeline?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you fix the CI pipeline?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-05",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you approve the PTO request?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you approve the PTO request?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you approve the PTO request?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-06",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the headcount?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the headcount?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you confirm the headcount?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the headcount?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-07",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm on-call coverage?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm on-call coverage?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm on-call coverage?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-08",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the debugging notes?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the debugging notes?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you review the debugging notes?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the debugging notes?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-09",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you proofread the client email?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you proofread the client email?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you proofread the client email?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-10",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the migration script?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the migration script?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you review the migration script?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you review the migration script?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-11",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed contract?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed contract?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed contract?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-12",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the final logo files?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the final logo files?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you send the final logo files?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the final logo files?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-13",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the updated invoice?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the updated invoice?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the updated invoice?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-14",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the SLA remediation?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the SLA remediation?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you confirm the SLA remediation?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the SLA remediation?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-15",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed NDA?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed NDA?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you return the signed NDA?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-16",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the expense receipts?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the expense receipts?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you send the expense receipts?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send the expense receipts?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-17",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm contractor availability?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm contractor availability?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm contractor availability?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-18",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you resolve the overdue invoice?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you resolve the overdue invoice?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you resolve the overdue invoice?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you resolve the overdue invoice?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  },
  {
    "id": "esc-19",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the calendar hold?"
      }
    ],
    "b": [
      {
        "minutesBefore": 1440,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the calendar hold?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you confirm the calendar hold?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains a verified second mention with no completion signal; final request wording is identical to A."
  },
  {
    "id": "esc-20",
    "family": "escalation",
    "a": [
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send interview feedback?"
      }
    ],
    "b": [
      {
        "minutesBefore": 2880,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send interview feedback?"
      },
      {
        "minutesBefore": 480,
        "sender": "A",
        "recipient": "B",
        "text": "Following up: could you send interview feedback?"
      },
      {
        "minutesBefore": 0,
        "sender": "A",
        "recipient": "B",
        "text": "Could you send interview feedback?"
      }
    ],
    "expected": {
      "surfaceDeltaMax": 1e-09,
      "forceRelation": "b > a",
      "minForceDelta": 1.0,
      "claim": "force changes while the request wording remains fixed"
    },
    "note": "Variant B contains verified repeated mentions with shrinking intervals; final request wording is identical to A."
  }
]
```

---

## Negative controls

These are not part of the 120 minimal-pair count.

```json
[
  {
    "id": "nc-01",
    "message": "If you ever have spare time, feel free to try the new dashboard theme — totally optional, no pressure.",
    "expected": "low surface; force at baseline or suppressed if no request is detected",
    "note": "Optional experiment with no deadline, consequence, dependency, accountability, or repetition."
  },
  {
    "id": "nc-02",
    "message": "You can send any thoughts on the onboarding draft whenever you have time; genuinely fine if you skip it.",
    "expected": "low surface; low force",
    "note": "Tests explicit optionality without independent pressure evidence."
  },
  {
    "id": "nc-03",
    "message": "I am REALLY curious what you think of the mockup — message me whenever, zero rush.",
    "expected": "affective/caps intensity must not raise force",
    "note": "Tests emotional emphasis vs expected action; single exclamation is not scored."
  },
  {
    "id": "nc-04",
    "message": "If you want, you can join the optional beta test next week; no obligation.",
    "expected": "low surface; low force",
    "note": "A future date describing availability is not a deadline on the addressee."
  },
  {
    "id": "nc-05",
    "message": "Feel free to ignore this if you're busy — I just wanted an extra opinion on the icon.",
    "expected": "low surface; force near baseline",
    "note": "Strong refusal permission with no external force event."
  },
  {
    "id": "nc-06",
    "message": "Nice to have, not required: could you suggest a name for the internal demo?",
    "expected": "low force",
    "note": "Requirements-register optionality should not become positive temporal force."
  },
  {
    "id": "nc-07",
    "message": "When you're free, could you look at the alternate color palette? No timeline on this.",
    "expected": "low surface; force near baseline",
    "note": "`when you're free` is surface deferral in v1.1, not a force-side vague deadline."
  },
  {
    "id": "nc-08",
    "message": "Quick question: would you be interested in presenting the optional lunch-and-learn? Totally your call.",
    "expected": "low surface; force near baseline",
    "note": "`Quick question` is not positive force merely because it is external to the request."
  },
  {
    "id": "nc-09",
    "message": "At your earliest convenience, could you tell me whether you want access to the beta? No deadline.",
    "expected": "low surface; force near baseline",
    "note": "Hearer-deferral formula remains surface-only even though it can sound formal."
  },
  {
    "id": "nc-10",
    "message": "Could you add a fun fact to your profile if you feel like it? Completely optional.",
    "expected": "low surface; force near baseline",
    "note": "Imperative-like action with explicit optionality and no force-side event."
  }
]
```

---

## Hard cases and scope guards

These are not part of the 120 minimal-pair count.

```json
[
  {
    "id": "hc-01",
    "message": "Oh sure, NO rush at all, only had this on my calendar for THREE WEEKS.",
    "challenge": "sarcasm/irony",
    "v1_1_behavior": "out_of_scope",
    "expected": "Do not claim to recover the sarcastic meaning; lower confidence or suppress if no request is detected.",
    "note": "Sarcasm is explicitly out of scope because recovering the opposite of literal wording would require an intent-like inference."
  },
  {
    "id": "hc-02",
    "message": "Do you know if the deck's supposed to be ready before Thursday, or is that not until next week?",
    "challenge": "information-seeking question containing deadline language",
    "v1_1_behavior": "fixed_by_request_guard",
    "expected": "suppressed:no_head_act",
    "note": "The temporal phrases are inside a question about a deadline, not attached to an issued action request."
  },
  {
    "id": "hc-03",
    "message": "If you have a sec, could you review the migration script before I run it tonight? Seriously, ignore this if you're busy — I mean it, no guilt at all.",
    "challenge": "sincere repeated permission to decline",
    "v1_1_behavior": "supported_with_new_surface_entries",
    "expected": "surface strongly mitigated; force may remain elevated only from the actual deadline/dependency evidence",
    "note": "`I mean it` and `no guilt` now have surface-side coverage."
  },
  {
    "id": "hc-04",
    "message": "Can you send that report over? It was due yesterday.",
    "challenge": "already-past deadline",
    "v1_1_behavior": "fixed_by_already_past_temporal",
    "expected": "past-due temporal evidence with maximum proximity",
    "note": "V1.1 adds `already_past` patterns and resolves the past point when possible."
  },
  {
    "id": "hc-05",
    "message": "The Johnson file?",
    "challenge": "verbless implicit request",
    "v1_1_behavior": "suppressed",
    "expected": "suppressed:no_head_act unless a future contextual rule can recover it reproducibly",
    "note": "Conservative suppression is preferable to pretending a fragment was parsed reliably."
  },
  {
    "id": "hc-06",
    "message": "I know this is short notice, and I'm sorry to ask — but I need the signed authorization back within the hour. The filing can't go through without it.",
    "challenge": "polite and genuinely urgent",
    "v1_1_behavior": "supported",
    "expected": "high surface and high force; gap relatively small",
    "note": "Checks that mitigation caps do not automatically turn every polite urgent request into a large positive gap."
  },
  {
    "id": "hc-07",
    "message": "If you get a chance today, the filing can't go out until this is signed.",
    "challenge": "adjacent mitigation and force evidence",
    "v1_1_behavior": "supported_by_span_partition",
    "expected": "surface consumes the deferral phrase; dynamic `today` and filing blockage remain force events without overlapping spans",
    "note": "Regression test for greedy regexes and event partitioning."
  },
  {
    "id": "hc-08",
    "message": "Can someone take a look at this before EOD?",
    "challenge": "broadcast request with no resolvable addressee",
    "v1_1_behavior": "suppressed",
    "expected": "suppressed:unresolved_addressee",
    "note": "A deliberate scope cost; common Slack broadcast asks remain unsupported in v1.1."
  },
  {
    "id": "hc-09",
    "message": "Alex wrote, “Could you send the figures by Friday?” I think that request is outdated.",
    "challenge": "quoted request being discussed rather than issued",
    "v1_1_behavior": "fixed_by_quote_guard",
    "expected": "the quoted request is not scored as the current speaker's directive",
    "note": "Request-like text inside quotations must not create a head act."
  },
  {
    "id": "hc-10",
    "message": "Could you review this today?",
    "challenge": "dynamic same-day timing",
    "v1_1_behavior": "supported_with_assumption_visibility",
    "expected": "force contribution depends on supplied message timestamp/business-day end rather than static `today = max`",
    "note": "Test at 09:00 and 16:55 with identical text to ensure dynamic temporal behavior."
  }
]
```

---

## Assertions derived from this file

1. **Conditional mask invariance:** for all `head-act-modality`, `head-act-strategy`, and `internal-modification` pairs that preserve request detection, force must satisfy the pair's `forceDeltaMax`.
2. **Surface sensitivity:** every surface-manipulation pair must meet `minSurfaceDelta`.
3. **Force sensitivity:** every `external-only`, `deadline-specificity`, and `escalation` pair must meet `minForceDelta`.
4. **Surface invariance in force families:** the request wording is fixed and surface must satisfy `surfaceDeltaMax`.
5. **Evidence integrity:** every score reconstructs from emitted evidence and every trigger matches its exact source span.
6. **Partition:** no character offset contributes to both scorers.
7. **Event deduplication:** one underlying deadline, blockage, consequence, accountability commitment, or repetition event cannot contribute twice outside an explicit capped component rule.
8. **Request guards:** information questions, quoted requests, unresolved broadcasts, and unsupported verbless fragments behave as documented in hard cases.
9. **Determinism:** identical input/config produces byte-identical analysis.

## What passing proves

Passing proves that the implementation behaves consistently with the architecture we specified: surface manipulations can move surface without moving force, and independent contextual pressure can move force without changing request wording.

## What passing does not prove

Passing does **not** prove that a human reader would assign the same 0–10 values, agree with the gap bands, or interpret every workplace message the same way. The fixtures were designed with knowledge of the model. They are specification tests, not an independent human validation study.

A later construct-validation study would use blinded human ratings on messages not authored around these rules and compare those judgments with UnderTone's outputs.
