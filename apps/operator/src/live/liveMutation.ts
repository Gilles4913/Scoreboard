import type { MutableRefObject } from "react";
import { sendTvBroadcast } from "../realtime";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppendEventParams = {
  seq: number;
  event_type: string;
  team_side?: "home" | "away" | null;
  player_id?: string | null;
  payload?: Record<string, any>;
};

/**
 * Contexte injecté une seule fois par surface (ControlPage / MobileControlPage).
 * Permet à emitLiveMutation d'opérer sans accès direct aux closures React.
 */
export type LiveMutationCtx = {
  matchId: string;
  /** Séquence dominante unique du match (émission) */
  matchSeqRef: MutableRefObject<number>;
  /** Plancher de réception — mis à jour après chaque émission */
  lastAppliedSeqRef: MutableRefObject<number>;
  /** Ancre chrono courante */
  clockAnchorRef: MutableRefObject<{ epoch: number; ms: number }>;
  /** Fonction de diffusion broadcast (sendTvBroadcast ou équivalent) */
  broadcast: typeof sendTvBroadcast;
  /** Persistance match en DB (sans last_event_seq — ajouté automatiquement) */
  persistMatch: (patch: Record<string, any>) => Promise<void>;
  /** Insertion match_events avec le seq dominant */
  appendEventRow?: (params: AppendEventParams) => Promise<void>;
};

export type LiveMutationArgs = {
  /** Champs à fusionner dans le payload broadcast */
  livePatch: Record<string, any>;
  /** Champs à persister en DB (colonnes modifiées) */
  dbPatch: Record<string, any>;
  /**
   * Si présent → mutation chrono :
   * persiste et diffuse clock_anchor_epoch_ms / clock_anchor_clock_ms
   */
  clock?: { anchorEpochMs: number; anchorClockMs: number };
  /** Si présent → écrit une ligne match_events avec le même seq dominant */
  event?: Omit<AppendEventParams, "seq">;
  /** Si présent → embarqué dans le payload broadcast */
  overlay?: Record<string, any>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Contrat Live Global — pipeline unique
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Point d'entrée unique pour toute mutation live.
 *
 * Pipeline :
 *   1. Incrémente la séquence dominante (matchSeqRef)
 *   2. Diffuse le patch live avec live_seq
 *   3. Persiste le patch DB avec last_event_seq (+ ancre chrono si mutation chrono)
 *   4. Journalise match_events avec le même seq (si event fourni)
 *
 * @returns seq généré
 */
export async function emitLiveMutation(
  ctx: LiveMutationCtx,
  args: LiveMutationArgs,
): Promise<number> {
  // 1 — séquence dominante
  ctx.matchSeqRef.current += 1;
  const seq = ctx.matchSeqRef.current;
  ctx.lastAppliedSeqRef.current = seq;

  // 2 — broadcast live
  const broadcastPayload: Record<string, any> = {
    ...args.livePatch,
    live_seq: seq,
    emitted_at: Date.now(),
  };
  if (args.clock) {
    broadcastPayload.clock_anchor_epoch = args.clock.anchorEpochMs;
    broadcastPayload.clock_anchor_ms    = args.clock.anchorClockMs;
  }
  if (args.overlay) {
    broadcastPayload.overlay = args.overlay;
  }
  void ctx.broadcast(ctx.matchId, broadcastPayload);

  // 3 — persistance DB
  const dbPatch: Record<string, any> = {
    ...args.dbPatch,
    last_event_seq: seq,
  };
  if (args.clock) {
    dbPatch.clock_anchor_epoch_ms = args.clock.anchorEpochMs;
    dbPatch.clock_anchor_clock_ms = args.clock.anchorClockMs;
  }
  await ctx.persistMatch(dbPatch);

  // 4 — journal événement
  if (args.event && ctx.appendEventRow) {
    void ctx.appendEventRow({ seq, ...args.event });
  }

  return seq;
}
