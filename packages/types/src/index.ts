export type Sport = 'football' | 'basket' | 'volleyball' | 'handball' | 'rugby';

export interface ClockState { durationSec: number; remainingMs: number; running: boolean; period: number }
export interface ScoreState { home: number; away: number }
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'archived';

export interface CommonDisplaySettings {
  showTeamLogos?: boolean;
  showTeamColors?: boolean;
  showPlayerNames?: boolean;
  showPlayerNumbers?: boolean;
  showEventsFeed?: boolean;
  showAnimations?: boolean;
  showSponsorOverlay?: boolean;
}

export interface FootballDisplaySettings {
  showCards?: boolean;
  showSubstitutions?: boolean;
  showGoalScorers?: boolean;
  showExtraTime?: boolean;
  showPenaltyShootout?: boolean;
}

export interface BasketDisplaySettings {
  showQuarter?: boolean;
  showShotClock?: boolean;
  showTeamFouls?: boolean;
  showPlayerFouls?: boolean;
  showTimeouts?: boolean;
  showPossessionArrow?: boolean;
}

export interface VolleyballDisplaySettings {
  showSets?: boolean;
  showCurrentSet?: boolean;
  showServerIndicator?: boolean;
  showTimeouts?: boolean;
  showRotation?: boolean;
  showSetPointMatchPoint?: boolean;
}

export interface HandballDisplaySettings {
  showCards?: boolean;
  showExclusions?: boolean;
  showTimeouts?: boolean;
  show7m?: boolean;
}

export interface RugbyDisplaySettings {
  showScoreBreakdown?: boolean;
  showCards?: boolean;
  showSinBinTimer?: boolean;
  showTriesScorers?: boolean;
  showBonusPoints?: boolean;
}

export type SportDisplaySettings = {
  football?: FootballDisplaySettings;
  basket?: BasketDisplaySettings;
  volleyball?: VolleyballDisplaySettings;
  handball?: HandballDisplaySettings;
  rugby?: RugbyDisplaySettings;
}

export interface OrgDisplayDefaults {
  common: CommonDisplaySettings;
  football?: FootballDisplaySettings;
  basket?: BasketDisplaySettings;
  volleyball?: VolleyballDisplaySettings;
  handball?: HandballDisplaySettings;
  rugby?: RugbyDisplaySettings;
}

export interface TeamDisplayOverrides {
  common?: Partial<CommonDisplaySettings>;
  football?: Partial<FootballDisplaySettings>;
  basket?: Partial<BasketDisplaySettings>;
  volleyball?: Partial<VolleyballDisplaySettings>;
  handball?: Partial<HandballDisplaySettings>;
  rugby?: Partial<RugbyDisplaySettings>;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  short_name?: string;
  logo?: string;
  colors?: { primary?: string; secondary?: string };
  display_overrides: TeamDisplayOverrides;
  created_at: string;
  updated_at: string;
}

export interface Org {
  id: string;
  slug: string;
  name: string;
  sport: Sport;
  display_defaults: OrgDisplayDefaults;
  created_at: string;
}

export interface MatchInfo {
  id: string;
  org_id: string;
  org_slug?: string;
  name: string;
  sport: Sport;
  home_name: string;
  away_name: string;
  home_team_id?: string;
  away_team_id?: string;
  scheduled_at: string;
  status: MatchStatus;
  display_token: string;
  public_display: boolean;
}

export interface MatchState { matchId: string; sport: Sport; clock: ClockState; score: ScoreState; meta?: any }

export const SPORTS: Sport[] = ['football','basket','volleyball','handball','rugby'];
