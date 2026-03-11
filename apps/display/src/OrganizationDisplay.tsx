import React from "react";

export function OrganizationDisplay() {
  return (
    <div
      style={{
        padding: 24,
        color: "white",
        background: "#0b0b0c",
        minHeight: "100vh",
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <h2 style={{ marginTop: 0 }}>Scoreboard Display</h2>

      <p>
        URL publique attendue : <code>?teamSlug=&lt;slug-equipe&gt;</code>
      </p>

      <p>
        Le mode public par token de match a été supprimé. L’écran public repose désormais sur une URL
        stable par équipe.
      </p>
    </div>
  );
}
