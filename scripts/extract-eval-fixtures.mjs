// Mechanically extracts the fixture JSON blocks EVAL.md already contains
// (six 20-pair family blocks, negative controls, hard cases) and writes
// them into packages/engine/test/fixtures/*.json unchanged. This exists so
// the TypeScript fixture loaders never require hand-transcribing EVAL.md's
// content — EVAL.md stays the single fixture source of truth (SPEC.md §2)
// and this script is the only path by which its content reaches the
// engine's test suite. Run after any edit to EVAL.md's fixture blocks:
//
//   node scripts/extract-eval-fixtures.mjs
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evalPath = join(repoRoot, "EVAL.md");
const outDir = join(repoRoot, "packages/engine/test/fixtures");

const src = readFileSync(evalPath, "utf8");

function extractJsonAfter(headerText, expectedLength, label) {
  const headerIdx = src.indexOf(headerText);
  if (headerIdx === -1) throw new Error(`Header not found: ${headerText}`);
  const fenceStart = src.indexOf("```json", headerIdx);
  if (fenceStart === -1) throw new Error(`No json fence after header: ${headerText}`);
  const contentStart = src.indexOf("\n", fenceStart) + 1;
  const fenceEnd = src.indexOf("\n```", contentStart);
  if (fenceEnd === -1) throw new Error(`No closing fence after header: ${headerText}`);
  const raw = src.slice(contentStart, fenceEnd);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON parse failed for ${label}: ${e.message}`);
  }
  if (!Array.isArray(data)) throw new Error(`${label}: expected an array`);
  if (data.length !== expectedLength) {
    throw new Error(`${label}: expected ${expectedLength} entries, got ${data.length}`);
  }
  return data;
}

const families = [
  "head-act-modality",
  "head-act-strategy",
  "internal-modification",
  "external-only",
  "deadline-specificity",
  "escalation",
];

const corePairs = [];
const familyCounts = {};
for (const family of families) {
  const header = `## Family — \`${family}\` (20 pairs)`;
  const data = extractJsonAfter(header, 20, family);
  for (const entry of data) {
    if (entry.family !== family) {
      throw new Error(
        `Mismatched family tag in ${family} block: entry ${entry.id} has family=${entry.family}`,
      );
    }
  }
  familyCounts[family] = data.length;
  corePairs.push(...data);
}

if (corePairs.length !== 120) {
  throw new Error(`Expected 120 total core pairs, got ${corePairs.length}`);
}

const negativeControls = extractJsonAfter("## Negative controls", 10, "negative controls");
const hardCases = extractJsonAfter("## Hard cases and scope guards", 10, "hard cases");

const ids = new Set();
for (const p of corePairs) {
  if (ids.has(p.id)) throw new Error(`Duplicate core pair id: ${p.id}`);
  ids.add(p.id);
}

writeFileSync(join(outDir, "core-pairs.json"), JSON.stringify(corePairs, null, 2) + "\n");
writeFileSync(join(outDir, "negative-controls.json"), JSON.stringify(negativeControls, null, 2) + "\n");
writeFileSync(join(outDir, "hard-cases.json"), JSON.stringify(hardCases, null, 2) + "\n");

console.log("Family counts:", familyCounts);
console.log("Total core pairs:", corePairs.length);
console.log("Negative controls:", negativeControls.length);
console.log("Hard cases:", hardCases.length);
