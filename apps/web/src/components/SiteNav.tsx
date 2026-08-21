"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/analyze", label: "Analyze" },
  { href: "/compose", label: "Compose" },
  { href: "/methodology", label: "Methodology" },
] as const;

/**
 * Shared site navigation (Prompt 10 §1). Deliberately restrained — a
 * wordmark plus three text links, not a SaaS product navbar. Wraps on
 * narrow viewports rather than collapsing into a menu, keeping the
 * accessible link structure identical at every width.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b" style={{ borderColor: "var(--hairline)" }}>
      <nav
        aria-label="Primary"
        className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2"
      >
        <Link
          href="/"
          className="font-serif-display text-lg sm:text-xl tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          UnderTone
        </Link>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 sm:ml-auto text-sm sm:text-base">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="transition-editorial inline-block pb-0.5 border-b-2"
                  style={{
                    color: active ? "var(--ink)" : "var(--ink-muted)",
                    borderColor: active ? "var(--accent)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
