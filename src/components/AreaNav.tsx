"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export interface NavGroup {
  title: string;
  links: { href: string; label: string; icon: string; exact?: boolean }[];
}

/** Menu da área logada. O grupo de Administração só é enviado para quem é admin. */
export function AreaNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <nav className="area-nav" aria-label="Menu">
      {groups.map((g) => (
        <div key={g.title} className="area-nav-group">
          <span className="area-nav-title">{g.title}</span>
          <div className="area-nav-links">
            {g.links.map((l) => (
              <Link key={l.href} href={l.href} className={active(l.href, l.exact) ? "on" : ""} aria-current={active(l.href, l.exact) ? "page" : undefined}>
                <Icon name={l.icon} className="ico sm" />
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
