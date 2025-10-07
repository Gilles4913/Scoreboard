import React from 'react';
import type { MatchState } from '@pkg/types';

export function Scoreboard({ state, homeName, awayName, homeLogo, awayLogo }:{ state: MatchState, homeName: string, awayName: string, homeLogo?:string|null, awayLogo?:string|null }){
  const time = fmt(state.clock.remainingMs);
  const meta:any = (state as any).meta || {};
  const fb = state.sport==='football' ? meta : null;
  const hb = state.sport==='handball' ? meta : null;
  const bb = state.sport==='basket' ? meta : null;
  const hi = state.sport==='hockey_ice' ? meta : null;
  const hf = state.sport==='hockey_field' ? meta : null;
  const vb = state.sport==='volleyball' ? meta : null;

  const hbSuspH = hb ? (hb.suspensions?.home||[]).filter((s:any)=>s.remainingMs>0).length : 0;
  const hbSuspA = hb ? (hb.suspensions?.away||[]).filter((s:any)=>s.remainingMs>0).length : 0;
  const hiPenH = hi ? (hi.penalties?.home||[]).filter((p:any)=>p.remainingMs>0).length : 0;
  const hiPenA = hi ? (hi.penalties?.away||[]).filter((p:any)=>p.remainingMs>0).length : 0;
  const ppHome = hiPenA > hiPenH; const ppAway = hiPenH > hiPenA;
  const shot = bb ? Math.ceil((bb.shotClockMs||0)/1000) : 0;
  const bonusH = bb ? ((bb.teamFouls?.home||0) >= (bb.bonusThreshold||5)) : false;
  const bonusA = bb ? ((bb.teamFouls?.away||0) >= (bb.bonusThreshold||5)) : false;
  const serveHome = vb?.serve === 'home'; const serveAway = vb?.serve === 'away';

  return (
    <div className="scoreboard-container">
      {/* Header avec période et temps */}
      <div className="scoreboard-header">
        <div className="period-info">
          <span className="period-label">
            {state.sport === 'football' && state.clock.period > 2 ? 'PROLONGATION' : 'PÉRIODE'}
          </span>
          <span className="period-number">
            {state.sport === 'football' && state.clock.period > 2 ? 
              (state.clock.period === 3 ? '1' : '2') : 
              state.clock.period
            }
          </span>
        </div>
        
        {state.sport !== 'volleyball' && (
          <div className="time-info">
            <span className="time-display">{time}</span>
            {state.clock.running && <div className="time-indicator running"></div>}
            {!state.clock.running && <div className="time-indicator paused"></div>}
          </div>
        )}
        
        {bb && shot > 0 && (
          <div className="shot-clock">
            <span className="shot-label">TIRS</span>
            <span className="shot-time">{shot}</span>
          </div>
        )}
      </div>

      {/* Score principal */}
      <div className="main-scoreboard">
        <div className="team-section home">
          <div className="team-info">
            <div className="team-name">
              <div className="team-logo-inline">
                {homeLogo ? <img src={homeLogo} alt="Logo" /> : <div className="logo-placeholder-inline">🏟</div>}
              </div>
              {homeName}
            </div>
            <div className="team-indicators">
              {vb && serveHome && <span className="serve-indicator">SERVICE</span>}
              {ppHome && <span className="power-play">POWER PLAY</span>}
              {bonusH && <span className="bonus">BONUS</span>}
            </div>
          </div>
          <div className="score-display">{state.score.home}</div>
        </div>

        <div className="vs-separator">
          <div className="vs-text">VS</div>
        </div>

        <div className="team-section away">
          <div className="team-info">
            <div className="team-name">
              <div className="team-logo-inline">
                {awayLogo ? <img src={awayLogo} alt="Logo" /> : <div className="logo-placeholder-inline">🏟</div>}
              </div>
              {awayName}
            </div>
            <div className="team-indicators">
              {vb && serveAway && <span className="serve-indicator">SERVICE</span>}
              {ppAway && <span className="power-play">POWER PLAY</span>}
              {bonusA && <span className="bonus">BONUS</span>}
            </div>
          </div>
          <div className="score-display">{state.score.away}</div>
        </div>
      </div>

      {/* Statistiques spécifiques au sport */}
      <div className="stats-section">
        {fb && (
          <div className="sport-stats football">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">CARTONS {homeName}</span>
                <span className="stat-value">🟨 {fb.cards?.home?.yellow||0} • 🟥 {fb.cards?.home?.red||0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TEMPS ADD.</span>
                <span className="stat-value highlight">+{fb.stoppageMin||0}'</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CARTONS {awayName}</span>
                <span className="stat-value">🟨 {fb.cards?.away?.yellow||0} • 🟥 {fb.cards?.away?.red||0}</span>
              </div>
            </div>
            {fb.shootout?.inProgress && (
              <div className="shootout-info">
                <span className="shootout-label">TIRS AU BUT</span>
                <span className="shootout-score">
                  {fb.shootout.home.filter((x:string)=>x==='G').length} - {fb.shootout.away.filter((x:string)=>x==='G').length}
                </span>
              </div>
            )}
          </div>
        )}

        {hb && (
          <div className="sport-stats handball">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">TEMPS MORTS {homeName}</span>
                <span className="stat-value">{hb.timeouts?.home||0}/{hb.timeouts?.maxPerTeam||3}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">EXCLUSIONS</span>
                <span className="stat-value">{hbSuspH} - {hbSuspA}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TEMPS MORTS {awayName}</span>
                <span className="stat-value">{hb.timeouts?.away||0}/{hb.timeouts?.maxPerTeam||3}</span>
              </div>
            </div>
          </div>
        )}

        {bb && (
          <div className="sport-stats basketball">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">FAUTES ÉQUIPE {homeName}</span>
                <span className="stat-value">{bb.teamFouls?.home||0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TEMPS MORTS</span>
                <span className="stat-value">{(bb.timeoutsLeft?.home||0)} - {(bb.timeoutsLeft?.away||0)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">FAUTES ÉQUIPE {awayName}</span>
                <span className="stat-value">{bb.teamFouls?.away||0}</span>
              </div>
            </div>
          </div>
        )}

        {hi && (
          <div className="sport-stats hockey-ice">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">PÉNALITÉS {homeName}</span>
                <span className="stat-value">{hiPenH}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">PÉNALITÉS {awayName}</span>
                <span className="stat-value">{hiPenA}</span>
              </div>
            </div>
          </div>
        )}

        {hf && (
          <div className="sport-stats hockey-field">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">CARTES {homeName}</span>
                <span className="stat-value">🟩 {hf.cards?.home?.green||0} 🟨 {hf.cards?.home?.yellow||0} 🟥 {hf.cards?.home?.red||0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CARTES {awayName}</span>
                <span className="stat-value">🟩 {hf.cards?.away?.green||0} 🟨 {hf.cards?.away?.yellow||0} 🟥 {hf.cards?.away?.red||0}</span>
              </div>
            </div>
          </div>
        )}

        {vb && (
          <div className="sport-stats volleyball">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">SETS</span>
                <span className="stat-value highlight">{vb.setsWon?.home||0} - {vb.setsWon?.away||0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TEMPS MORTS</span>
                <span className="stat-value">{vb.timeouts?.home||0}/{vb.maxTimeoutsPerSet||2} - {vb.timeouts?.away||0}/{vb.maxTimeoutsPerSet||2}</span>
              </div>
            </div>
            {vb.technicalTO?.enabled && (
              <div className="technical-timeout">
                <span className="tech-label">TTO aux points: {vb.technicalTO.atPoints?.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(ms:number){ const s = Math.floor(ms/1000); const mm = Math.floor(s/60).toString().padStart(2,'0'); const ss = (s%60).toString().padStart(2,'0'); return `${mm}:${ss}`; }