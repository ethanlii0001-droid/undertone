// Mechanically extracts the fixture JSON blocks EVAL.md already contains
// (six 20-pair family blocks, negative controls, hard cases) and writes
// them, unchanged, to two destinations:
//   - packages/engine/test/fixtures/*.json (pretty-printed arrays, consumed
//     by the TypeScript fixture loaders)
//   - eval/*.jsonl (one JSON object per line — minimal-pairs.jsonl,
//     negative-controls.jsonl, hard-cases.jsonl), the normative JSONL files
//     SPEC.md §17's repo layout already names
// This exists so neither destination ever requires hand-transcribing
// EVAL.md's content — EVAL.md stays the single fixture source of truth
// (SPEC.md §2) and this script is the only path by which its content
// reaches either the engine's test suite or the eval/ directory. Run after
// any edit to EVAL.md's fixture blocks:
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
const jsonlDir = join(repoRoot, "eval");

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

function writeJsonl(path, data) {
  writeFileSync(path, data.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function verifyJsonl(path, sourceData, label) {
  const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.length > 0);
  if (lines.length !== sourceData.length) {
    throw new Error(`${label}: wrote ${sourceData.length} entries but read back ${lines.length} lines from ${path}`);
  }
  const readBack = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`${label}: line ${i + 1} of ${path} is not valid JSON: ${e.message}`);
    }
  });
  const sourceIds = new Set(sourceData.map((entry) => entry.id));
  const readBackIds = new Set(readBack.map((entry) => entry.id));
  if (sourceIds.size !== readBackIds.size) {
    throw new Error(`${label}: id set size mismatch between source (${sourceIds.size}) and ${path} (${readBackIds.size})`);
  }
  for (const id of sourceIds) {
    if (!readBackIds.has(id)) throw new Error(`${label}: id ${id} missing from ${path} after round-trip`);
  }
}

writeJsonl(join(jsonlDir, "minimal-pairs.jsonl"), corePairs);
writeJsonl(join(jsonlDir, "negative-controls.jsonl"), negativeControls);
writeJsonl(join(jsonlDir, "hard-cases.jsonl"), hardCases);

verifyJsonl(join(jsonlDir, "minimal-pairs.jsonl"), corePairs, "minimal-pairs.jsonl");
verifyJsonl(join(jsonlDir, "negative-controls.jsonl"), negativeControls, "negative-controls.jsonl");
verifyJsonl(join(jsonlDir, "hard-cases.jsonl"), hardCases, "hard-cases.jsonl");

console.log("Family counts:", familyCounts);
console.log("Total core pairs:", corePairs.length);
console.log("Negative controls:", negativeControls.length);
console.log("Hard cases:", hardCases.length);
console.log("eval/minimal-pairs.jsonl lines:", corePairs.length, "(verified)");
console.log("eval/negative-controls.jsonl lines:", negativeControls.length, "(verified)");
console.log("eval/hard-cases.jsonl lines:", hardCases.length, "(verified)");
