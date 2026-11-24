// Origem de uma visita (Instagram, Google, campanha…), a partir da URL de entrada e do referrer.
// Sem dados pessoais: só o canal. Usado no beacon /api/t e no BI.

export interface Attribution {
  source: string;
  medium: string | null;
  campaign: string | null;
}

const clean = (v: string | null | undefined, max: number) => (v ? v.trim().toLowerCase().replace(/[^\w.\-+ ]/g, "").slice(0, max) || null : null);

const HOSTS: [RegExp, string, string][] = [
  [/(^|\.)instagram\.com$/, "instagram", "social"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook", "social"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp", "social"],
  [/(^|\.)(tiktok\.com)$/, "tiktok", "social"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube", "social"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin", "social"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x", "social"],
  [/(^|\.)google\.[a-z.]+$/, "google", "organic"],
  [/(^|\.)bing\.com$/, "bing", "organic"],
  [/(^|\.)(duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z]+)$/, "outras buscas", "organic"],
];

/**
 * Origem da visita, ou null quando é visita direta ou interna (aí vale a origem já guardada no cookie).
 */
export function detectAttribution(pageUrl: URL, referrer: string | null, userAgent: string | null, siteHost: string): Attribution | null {
  const q = pageUrl.searchParams;
  const utm = clean(q.get("utm_source"), 60);
  if (utm) return { source: utm, medium: clean(q.get("utm_medium"), 60), campaign: clean(q.get("utm_campaign"), 120) };
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid")) return { source: "google", medium: "cpc", campaign: null };
  if (q.get("fbclid")) {
    const ua = userAgent || "";
    return { source: /Instagram/i.test(ua) ? "instagram" : "facebook", medium: "social", campaign: null };
  }
  // Navegadores dentro dos apps costumam não mandar referrer
  if (userAgent && /Instagram/i.test(userAgent)) return { source: "instagram", medium: "social", campaign: null };
  if (userAgent && /FBAN|FBAV/i.test(userAgent)) return { source: "facebook", medium: "social", campaign: null };

  if (!referrer) return null;
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host || host === siteHost.replace(/^www\./, "")) return null;
  for (const [re, source, medium] of HOSTS) if (re.test(host)) return { source, medium, campaign: null };
  return { source: host.slice(0, 60), medium: "referral", campaign: null };
}

export const DIRECT: Attribution = { source: "direto", medium: null, campaign: null };

export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python|headless|lighthouse/i;

/** Rótulo amigável no BI. */
export function sourceLabel(source: string): string {
  const map: Record<string, string> = { direto: "Direto", instagram: "Instagram", facebook: "Facebook", google: "Google", whatsapp: "WhatsApp", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", x: "X (Twitter)", bing: "Bing" };
  return map[source] ?? source;
}
