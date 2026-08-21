export function Header() {
  return (
    <header className="mx-auto w-full max-w-2xl pt-8 pb-6 sm:pt-12 sm:pb-8">
      <h1 className="font-serif-display text-3xl sm:text-4xl tracking-tight">UnderTone</h1>
      <p className="font-serif-display italic text-base sm:text-lg mt-1" style={{ color: "var(--ink-muted)" }}>
        &ldquo;When polite doesn&rsquo;t mean optional.&rdquo;
      </p>
      <p className="text-sm sm:text-base leading-relaxed mt-3 max-w-prose" style={{ color: "var(--ink-muted)" }}>
        UnderTone separates how strongly a workplace request is phrased from the observable
        context that makes action expected.
      </p>
      <p className="text-xs uppercase tracking-wide mt-2" style={{ color: "var(--ink-faint)" }}>
        Tuned for workplace English — Slack, Teams, and work email.
      </p>
    </header>
  );
}
