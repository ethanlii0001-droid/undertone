import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/analyze", label: "Analyze" },
  { href: "/compose", label: "Compose" },
  { href: "/methodology", label: "Methodology" },
] as const;

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1180px] border-t mt-20 sm:mt-24 py-8" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <p className="font-serif-display text-sm" style={{ color: "var(--ink)" }}>
            UnderTone
          </p>
          <p className="text-xs italic mt-0.5" style={{ color: "var(--ink-muted)" }}>
            An interpretable computational pragmatics instrument.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          {FOOTER_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="transition-editorial hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs leading-relaxed mt-5" style={{ color: "var(--ink-faint)" }}>
        UnderTone is an interpretable rule-based engineering instrument. Its scores are internal
        diagnostic measures, not calibrated judgments of human intent or perception.
      </p>
      <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--ink-faint)" }}>
        Analysis runs locally in your browser.
      </p>
    </footer>
  );
}
