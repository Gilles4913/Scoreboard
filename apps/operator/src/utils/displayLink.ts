export function buildDisplayUrl(params: { token: string }) {
  const base = (import.meta.env.VITE_DISPLAY_BASE_URL as string | undefined)?.trim();
  if (!base) {
    // fallback pratique en local
    return `http://localhost:5174/?token=${encodeURIComponent(params.token)}`;
  }

  const url = new URL(base);
  // on force le token-only (Display via Edge Function)
  url.searchParams.set("token", params.token);
  return url.toString();
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback vieux navigateurs
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
