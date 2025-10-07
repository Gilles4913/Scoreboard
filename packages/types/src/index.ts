export type Sport = 'basic' | 'football' | 'handball' | 'basket' | 'hockey_ice' | 'hockey_field' | 'volleyball';
export interface ClockState { durationSec: number; remainingMs: number; running: boolean; period: number }
export interface ScoreState { home: number; away: number }
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'archived';
export interface MatchInfo { id: string; org_id: string; org_slug?: string; name: string; sport: Sport; home_name: string; away_name: string; scheduled_at: string; status: MatchStatus; display_token: string; public_display: boolean; }
export interface MatchState { matchId: string; sport: Sport; clock: ClockState; score: ScoreState; meta?: any }
export const SPORTS: Sport[] = ['basic','football','handball','basket','hockey_ice','hockey_field','volleyball'];
