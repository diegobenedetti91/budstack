"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Conta a visita de cada página pública (anônimo; ver /api/t). */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/admin") || path.startsWith("/conta")) return;
    const body = JSON.stringify({ path, href: location.href, ref: document.referrer || null });
    try {
      if (!navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
        fetch("/api/t", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, [path]);
  return null;
}
