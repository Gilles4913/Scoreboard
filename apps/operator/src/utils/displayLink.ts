// apps/operator/src/utils/displayLink.ts
import { DISPLAY_APP_URL } from "../config";

export function buildDisplayUrl(params: { token: string; matchId?: string }) {
  const url = new URL(DISPLAY_APP_URL);
  url.searchParams.set("token", params.token);
  if (params.matchId) url.searchParams.set("matchId", params.matchId);
  return url.toString();
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}
