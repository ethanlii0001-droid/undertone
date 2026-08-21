export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl border-t mt-16 py-8" style={{ borderColor: "var(--hairline)" }}>
      <p className="text-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
        UnderTone is an interpretable rule-based engineering instrument. Its scores are internal
        diagnostic measures, not calibrated judgments of human intent or perception.
      </p>
      <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--ink-faint)" }}>
        Analysis runs locally in your browser.
      </p>
    </footer>
  );
}
