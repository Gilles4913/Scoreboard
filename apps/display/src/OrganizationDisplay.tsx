// apps/display/src/OrganizationDisplay.tsx
import React from "react";

/**
 * Deprecated: le Display SB2 est maintenant piloté par:
 *   ?matchId=<uuid>&token=<display_token>
 * et le contexte est chargé via Edge Function.
 */
export function OrganizationDisplay() {
  return (
    <div style={{ padding: 24, color: "white", background: "#0b0b0c", minHeight: "100vh" }}>
      <h2>Scoreboard Display</h2>
      <p>
        URL requise: <code>?matchId=&lt;uuid&gt;&amp;token=&lt;display_token&gt;</code>
      </p>
    </div>
  );
}
