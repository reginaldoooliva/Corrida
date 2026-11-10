"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChartIcon, HomeIcon, SettingsIcon } from "./icons";

const ITEMS = [
  { href: "/dashboard", label: "Início", Icon: HomeIcon },
  { href: "/history", label: "Histórico", Icon: ChartIcon },
  { href: "/settings", label: "Configurações", Icon: SettingsIcon },
] as const;

// The app's top-level sections, fixed at the bottom where a thumb reaches them. Not a list: the
// dashboard's only list items are the week's sessions.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções" className="bottom-nav">
      <div>
        {ITEMS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            <Icon />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
