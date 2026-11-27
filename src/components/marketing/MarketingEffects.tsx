"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Efeitos das páginas de marketing: blocos que aparecem ao rolar e a barra fixa
 * do celular (Ver planos + WhatsApp), que surge depois do topo da página.
 */
export function MarketingEffects({ whatsapp, cta = { href: "/planos", label: "Ver planos e assinar" } }: { whatsapp: string; cta?: { href: string; label: string } }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("js");
    document.body.classList.add("mk-has-sticky");
    const els = document.querySelectorAll(".mk-reveal");
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io?.unobserve(e.target);
            }
          }),
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );
      els.forEach((el) => io!.observe(el));
    } else els.forEach((el) => el.classList.add("in"));

    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.body.classList.remove("mk-has-sticky");
    };
  }, []);

  return (
    <div className={`mk-sticky${show ? " show" : ""}`} aria-hidden={!show}>
      <Link href={cta.href} className="mk-btn primary" tabIndex={show ? 0 : -1}>
        {cta.label}
      </Link>
      <a href={whatsapp} className="mk-btn wa" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" tabIndex={show ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
        </svg>
      </a>
    </div>
  );
}
