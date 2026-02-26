import type { MatchState, Sport, OrgDisplayDefaults, CommonDisplaySettings, FootballDisplaySettings, BasketDisplaySettings, VolleyballDisplaySettings, HandballDisplaySettings, RugbyDisplaySettings } from '@pkg/types';

export function defaultClockForSport(sport: Sport){
  switch(sport){
    case 'football': return { durationSec: 45*60, remainingMs: 45*60*1000, running:false, period:1 };
    case 'handball': return { durationSec: 30*60, remainingMs: 30*60*1000, running:false, period:1 };
    case 'basket': return { durationSec: 10*60, remainingMs: 10*60*1000, running:false, period:1 };
    case 'volleyball': return { durationSec: 0, remainingMs: 0, running:false, period:1 };
    case 'rugby': return { durationSec: 40*60, remainingMs: 40*60*1000, running:false, period:1 };
    default: return { durationSec: 10*60, remainingMs: 10*60*1000, running:false, period:1 };
  }
}

export function initStateForSport(matchKey: string, sport: Sport): MatchState {
  const clock = defaultClockForSport(sport);
  const base: MatchState = { matchId: matchKey, sport, clock, score: {home:0, away:0}, meta:{} };
  if (sport === 'volleyball') base.meta = { currentSet:1, bestOf:5, setsWon:{home:0,away:0}, pointsToWin:25, tieBreakPoints:15, winBy:2, serve:'home', timeouts:{home:0,away:0}, maxTimeoutsPerSet:2, technicalTO:{enabled:false, atPoints:[8,16]} };
  if (sport === 'football') base.meta = { stoppageMin:0, cards:{home:{yellow:0,red:0},away:{yellow:0,red:0}}, shootout:{inProgress:false, home:[], away:[]} };
  if (sport === 'handball') base.meta = { timeouts:{home:0,away:0,maxPerTeam:3}, suspensions:{home:[],away:[]} };
  if (sport === 'basket') base.meta = { foulLimitPerPlayer:5, teamFouls:{home:0,away:0}, bonusThreshold:5, timeoutsLeft:{home:5,away:5}, shotClockMs:24_000, shotRunning:false, roster:{ home:[{num:4,fouls:0},{num:5,fouls:0},{num:6,fouls:0},{num:7,fouls:0},{num:8,fouls:0}], away:[{num:9,fouls:0},{num:10,fouls:0},{num:11,fouls:0},{num:12,fouls:0},{num:13,fouls:0}] } };
  if (sport === 'rugby') base.meta = { cards:{home:{yellow:0,red:0},away:{yellow:0,red:0}}, sinBin:{home:[],away:[]}, tries:{home:0,away:0}, conversions:{home:0,away:0}, penalties:{home:0,away:0}, dropGoals:{home:0,away:0} };
  return base;
}

export const DEFAULT_COMMON_SETTINGS: CommonDisplaySettings = {
  showTeamLogos: true,
  showTeamColors: false,
  showPlayerNames: false,
  showPlayerNumbers: false,
  showEventsFeed: true,
  showAnimations: true,
  showSponsorOverlay: false,
};

export const DEFAULT_FOOTBALL_SETTINGS: FootballDisplaySettings = {
  showCards: true,
  showSubstitutions: false,
  showGoalScorers: true,
  showExtraTime: true,
  showPenaltyShootout: false,
};

export const DEFAULT_BASKET_SETTINGS: BasketDisplaySettings = {
  showQuarter: true,
  showShotClock: true,
  showTeamFouls: true,
  showPlayerFouls: false,
  showTimeouts: true,
  showPossessionArrow: false,
};

export const DEFAULT_VOLLEYBALL_SETTINGS: VolleyballDisplaySettings = {
  showSets: true,
  showCurrentSet: true,
  showServerIndicator: true,
  showTimeouts: true,
  showRotation: false,
  showSetPointMatchPoint: true,
};

export const DEFAULT_HANDBALL_SETTINGS: HandballDisplaySettings = {
  showCards: true,
  showExclusions: true,
  showTimeouts: true,
  show7m: false,
};

export const DEFAULT_RUGBY_SETTINGS: RugbyDisplaySettings = {
  showScoreBreakdown: true,
  showCards: true,
  showSinBinTimer: true,
  showTriesScorers: true,
  showBonusPoints: false,
};

export function getDefaultDisplaySettings(sport: Sport): OrgDisplayDefaults {
  const base: OrgDisplayDefaults = { common: DEFAULT_COMMON_SETTINGS };
  switch(sport) {
    case 'football': base.football = DEFAULT_FOOTBALL_SETTINGS; break;
    case 'basket': base.basket = DEFAULT_BASKET_SETTINGS; break;
    case 'volleyball': base.volleyball = DEFAULT_VOLLEYBALL_SETTINGS; break;
    case 'handball': base.handball = DEFAULT_HANDBALL_SETTINGS; break;
    case 'rugby': base.rugby = DEFAULT_RUGBY_SETTINGS; break;
  }
  return base;
}

export type BroadcastPayload = { info: { name:string; home_name:string; away_name:string }, state: MatchState, t: number };

export { deepMergeDisplaySettings } from './displaySettings';

export function applyTick(state: MatchState): MatchState {
  const s = { ...state, clock: { ...state.clock }, meta: { ...(state.meta||{}) } };
  if (s.clock.running) {
    s.clock.remainingMs = Math.max(0, s.clock.remainingMs - 100);
    if (s.clock.remainingMs === 0) s.clock.running = false;
  }
  if (s.sport === 'basket' && s.meta?.shotRunning) {
    s.meta.shotClockMs = Math.max(0, (s.meta.shotClockMs||0) - 100);
    if (s.meta.shotClockMs === 0) s.meta.shotRunning = false;
  }
  if (s.sport === 'handball' && s.meta?.suspensions) {
    (['home','away'] as const).forEach(side=>{
      s.meta.suspensions[side] = (s.meta.suspensions[side]||[]).map((x:any)=>({ ...x, remainingMs: Math.max(0, (x.remainingMs||0) - 100) })).filter((x:any)=>x.remainingMs>0);
    });
  }
  if (s.sport === 'rugby' && s.meta?.sinBin) {
    (['home','away'] as const).forEach(side=>{
      s.meta.sinBin[side] = (s.meta.sinBin[side]||[]).map((x:any)=>({ ...x, remainingMs: Math.max(0, (x.remainingMs||0) - 100) })).filter((x:any)=>x.remainingMs>0);
    });
  }
  return s;
}
