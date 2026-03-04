function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

function getDisplayBaseUrl() {
  // Prefer VITE_DISPLAY_URL (same naming as apps/home) then VITE_DISPLAY_BASE_URL (legacy)
  const a = (import.meta.env.VITE_DISPLAY_URL as string | undefined)?.trim();
  const b = (import.meta.env.VITE_DISPLAY_BASE_URL as string | undefined)?.trim();
  const base = a || b;

  // fallback local
  return trimSlash(base || "http://localhost:5174");
}

export function buildDisplayUrl(params: { token?: string; org?: string }) {
  const base = getDisplayBaseUrl();

  if (params.token) return `${base}/?token=${encodeURIComponent(params.token)}`;
  if (params.org) return `${base}/?org=${encodeURIComponent(params.org)}`;

  return `${base}/`;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}
