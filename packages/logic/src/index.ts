import type { MatchState, Sport } from '@pkg/types';

export function defaultClockForSport(sport: Sport){
  switch(sport){
    case 'football': return { durationSec: 45*60, remainingMs: 45*60*1000, running:false, period:1 };
    case 'handball': return { durationSec: 30*60, remainingMs: 30*60*1000, running:false, period:1 };
    case 'basket': return { durationSec: 10*60, remainingMs: 10*60*1000, running:false, period:1 };
    case 'hockey_ice': return { durationSec: 20*60, remainingMs: 20*60*1000, running:false, period:1 };
    case 'hockey_field': return { durationSec: 15*60, remainingMs: 15*60*1000, running:false, period:1 };
    case 'volleyball': return { durationSec: 0, remainingMs: 0, running:false, period:1 };
    case 'basic':
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
  if (sport === 'hockey_ice') base.meta = { penalties:{home:[],away:[]} };
  if (sport === 'hockey_field') base.meta = { cards:{ home:{green:0,yellow:0,red:0}, away:{green:0,yellow:0,red:0} }, suspensions:{home:[],away:[]} };
  return base;
}

export type BroadcastPayload = { info: { name:string; home_name:string; away_name:string }, state: MatchState, t: number };

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
  if (s.sport === 'hockey_ice' && s.meta?.penalties) {
    (['home','away'] as const).forEach(side=>{
      s.meta.penalties[side] = (s.meta.penalties[side]||[]).map((x:any)=>({ ...x, remainingMs: Math.max(0, (x.remainingMs||0) - 100) })).filter((x:any)=>x.remainingMs>0);
    });
  }
  if (s.sport === 'hockey_field' && s.meta?.suspensions) {
    (['home','away'] as const).forEach(side=>{
      s.meta.suspensions[side] = (s.meta.suspensions[side]||[]).map((x:any)=>({ ...x, remainingMs: Math.max(0, (x.remainingMs||0) - 100) })).filter((x:any)=>x.remainingMs>0);
    });
  }
  return s;
}
