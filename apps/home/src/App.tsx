async function openOperator(orgSlug: string) {
  setError(null);

  if (!OPERATOR_URL) {
    setError("VITE_OPERATOR_URL non configurée.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) {
    setError("Session absente, reconnecte-toi.");
    return;
  }

  localStorage.setItem("scoreDisplay.activeOrgSlug", orgSlug);

  const base = OPERATOR_URL.replace(/\/$/, "");
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: "bearer",
  }).toString();

  window.location.href = `${base}/?org=${encodeURIComponent(orgSlug)}#${hash}`;
}
