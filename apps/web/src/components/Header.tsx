import Link from "next/link";
import { HeroPreview } from "@/components/HeroPreview";

/**
 * Landing page hero (Prompt 10 §2, widened to a two-column editorial layout
 * in Prompt 10B §2) — used only on `/`; SiteNav is the persistent cross-page
 * nav. At desktop widths the left column carries the pitch and CTAs while
 * the right column shows a static, illustrative product preview.
 */
export function Header() {
  return (
    <header className="mx-auto w-full max-w-[1180px] pt-10 pb-8 sm:pt-14 sm:pb-10 lg:pt-20 lg:pb-16">
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-16 lg:items-center">
        <div className="max-w-prose">
          <h1 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl tracking-tight">UnderTone</h1>
          <p
            className="font-serif-display italic text-base sm:text-lg lg:text-xl mt-2"
            style={{ color: "var(--ink-muted)" }}
          >
            &ldquo;When polite doesn&rsquo;t mean optional.&rdquo;
          </p>
          <p className="text-sm sm:text-base lg:text-lg leading-relaxed mt-3" style={{ color: "var(--ink-muted)" }}>
            UnderTone separates how strongly a workplace request is phrased from the observable
            context that makes action expected.
          </p>
          <p className="text-xs uppercase tracking-wide mt-2" style={{ color: "var(--ink-faint)" }}>
            Tuned for workplace English — Slack, Teams, and work email.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/analyze"
              className="transition-editorial text-sm px-4 py-2 rounded-sm font-medium"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              Analyze a thread
            </Link>
            <Link
              href="/compose"
              className="transition-editorial text-sm px-4 py-2 rounded-sm border"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
            >
              Compose a message
            </Link>
          </div>
        </div>

        <div className="mt-10 lg:mt-0">
          <HeroPreview />
        </div>
      </div>
    </header>
  );
}
