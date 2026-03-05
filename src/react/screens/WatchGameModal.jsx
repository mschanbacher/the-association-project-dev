import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';
import { TEAM_COLORS } from '../styles/TeamColors.js';

/**
 * WatchGameModal — native React live game viewer.
 *
 * The game loop runs on setInterval and updates DOM refs imperatively
 * for performance. React owns layout/styling/lifecycle.
 */
export function WatchGameModal({ isOpen, data, onClose }) {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalData, setFinalData] = useState(null);

  const homeScoreRef = useRef(null);
  const awayScoreRef = useRef(null);
  const clockRef = useRef(null);
  const quarterScoresRef = useRef(null);
  const momentumRef = useRef(null);
  const playsRef = useRef(null);
  const leadersRef = useRef(null);

  // Apply opponent team color as CSS variable for the away side
  useEffect(() => {
    if (isOpen && data) {
      const root = document.documentElement;
      // Home team color is already --color-accent (user's team)
      // Set away team color from their team data
      const awayColors = data.awayTeamFullName ? TEAM_COLORS[data.awayTeamFullName] : null;
      if (awayColors) {
        root.style.setProperty('--color-away', awayColors.primary);
      } else {
        root.style.setProperty('--color-away', '#B5403A');
      }
      // Home color matches user accent
      root.style.setProperty('--color-home', getComputedStyle(root).getPropertyValue('--color-accent').trim() || '#1B4D3E');
    }
  }, [isOpen, data?.awayTeamFullName]);

  useEffect(() => {
    if (isOpen) {
      window._wgRefs = {
        homeScore: homeScoreRef.current,
        awayScore: awayScoreRef.current,
        clock: clockRef.current,
        quarterScores: quarterScoresRef.current,
        momentum: momentumRef.current,
        plays: playsRef.current,
        leaders: leadersRef.current,
        setGameOver: (resultData) => { setGameOver(true); setFinalData(resultData); },
        setSpeed: (s) => setSpeed(s),
        setPaused: (p) => setPaused(p),
      };
    }
    return () => { window._wgRefs = null; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && data) {
      setSpeed(1); setPaused(false); setGameOver(false); setFinalData(null);
      if (playsRef.current) playsRef.current.innerHTML = '';
      if (leadersRef.current) leadersRef.current.innerHTML = '';
    }
  }, [isOpen, data?.homeName, data?.awayName]);

  const handleSpeed = useCallback((s) => { setSpeed(s); window.watchGameSetSpeed?.(s); }, []);
  const handlePause = useCallback(() => { setPaused(p => !p); window.watchGameTogglePause?.(); }, []);

  if (!isOpen || !data) return null;
  const { homeName, awayName, playoffContext } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1000} zIndex={1400}>
      <ModalBody style={{ maxHeight: '95vh', overflow: 'hidden', padding: 0 }}>
        <div style={S.container}>
          {/* Playoff context */}
          {playoffContext && (
            <div style={S.contextBanner}>{playoffContext}</div>
          )}

          {/* Scoreboard */}
          <div style={S.scoreboard}>
            <div style={S.scoreRow}>
              <div style={S.teamScore}>
                <div style={{ ...S.teamLabel, color: 'var(--color-away)' }}>AWAY</div>
                <div style={S.teamName}>{awayName}</div>
                <div ref={awayScoreRef} style={S.score}>0</div>
              </div>
              <div style={S.clockArea}>
                <div ref={clockRef} style={S.clock}>Q1 12:00</div>
                <div ref={quarterScoresRef} style={S.quarterScores} />
              </div>
              <div style={S.teamScore}>
                <div style={{ ...S.teamLabel, color: 'var(--color-home)' }}>HOME</div>
                <div style={S.teamName}>{homeName}</div>
                <div ref={homeScoreRef} style={{ ...S.score, color: 'var(--color-home)' }}>0</div>
              </div>
            </div>
            {/* Momentum */}
            <div style={S.momentumRow}>
              <span style={S.momentumLabel}>AWY</span>
              <div style={S.momentumTrack}>
                <div ref={momentumRef} style={S.momentumBar} />
              </div>
              <span style={S.momentumLabel}>HME</span>
            </div>
          </div>

          {/* Speed controls — flat text, no containers */}
          <div style={S.controls}>
            <span style={S.controlLabel}>Speed</span>
            {[1, 3, 10, 999].map(s => (
              <button key={s} onClick={() => handleSpeed(s)} style={{
                ...S.controlBtn,
                background: speed === s ? 'var(--color-accent)' : 'transparent',
                color: speed === s ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: speed === s ? 600 : 400,
              }}>
                {s === 999 ? 'Max' : `${s}x`}
              </button>
            ))}
            <div style={S.controlDivider} />
            <button onClick={handlePause} style={{
              ...S.controlBtn,
              background: paused ? 'var(--color-win)' : 'transparent',
              color: paused ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}>
              {paused ? 'Play' : 'Pause'}
            </button>
            <button onClick={() => window.watchGameSkip?.()} style={S.controlBtn}>
              Skip
            </button>
          </div>

          {/* Main: play-by-play + leaders */}
          <div style={S.mainArea}>
            <div style={S.playsPanel}>
              <div style={S.panelHeader}>Play-by-Play</div>
              <div ref={playsRef} style={S.playsFeed} />
            </div>
            <div style={S.leadersPanel}>
              <div style={S.panelHeader}>Leaders</div>
              <div ref={leadersRef} style={S.leadersFeed} />
            </div>
          </div>

          {/* Game over */}
          {gameOver && (
            <div style={S.gameOverBar}>
              {finalData && (
                <div style={S.finalText}>
                  <span style={{ color: finalData.won ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {finalData.won ? 'VICTORY' : 'DEFEAT'}
                  </span>
                  {' — FINAL'}{finalData.isOvertime ? ' (OT)' : ''}: {finalData.awayScore} – {finalData.homeScore}
                </div>
              )}
              <Button variant="primary" onClick={() => window.watchGameClose?.()}>
                Continue
              </Button>
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}

const S = {
  container: {
    display: 'flex', flexDirection: 'column', height: '90vh',
    background: 'var(--color-bg)', color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
  },
  contextBanner: {
    textAlign: 'center', padding: '6px',
    background: 'var(--color-accent-bg)', color: 'var(--color-accent)',
    fontSize: 'var(--text-xs)', fontWeight: 600,
    borderBottom: '1px solid var(--color-accent-border)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  scoreboard: {
    background: 'var(--color-bg-raised)', padding: '20px 24px 16px',
    borderBottom: '1px solid var(--color-border)', flexShrink: 0,
  },
  scoreRow: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48,
  },
  teamScore: { textAlign: 'center', minWidth: 160 },
  teamLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 2,
  },
  teamName: {
    fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 4,
  },
  score: {
    fontSize: 48, fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)',
  },
  clockArea: { textAlign: 'center' },
  clock: {
    fontSize: 18, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)',
  },
  quarterScores: {
    fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4,
  },
  momentumRow: {
    marginTop: 12, display: 'flex', alignItems: 'center',
    gap: 8, justifyContent: 'center',
  },
  momentumLabel: { fontSize: 10, color: 'var(--color-text-tertiary)' },
  momentumTrack: {
    width: 200, height: 3, background: 'var(--color-bg-sunken)',
    position: 'relative', overflow: 'hidden',
  },
  momentumBar: {
    position: 'absolute', top: 0, height: '100%',
    background: 'var(--color-accent)',
    transition: 'left 0.3s, width 0.3s',
    left: '50%', width: 0,
  },
  controls: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: 4, padding: '8px 24px',
    borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0,
  },
  controlLabel: {
    fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginRight: 8,
  },
  controlBtn: {
    padding: '4px 12px', border: 'none',
    background: 'transparent', color: 'var(--color-text-secondary)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)',
    transition: 'all 100ms ease',
  },
  controlDivider: {
    width: 1, height: 14, background: 'var(--color-border)', margin: '0 6px',
  },
  mainArea: {
    flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px', overflow: 'hidden',
  },
  playsPanel: {
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    borderRight: '1px solid var(--color-border-subtle)',
  },
  panelHeader: {
    padding: '8px 12px', fontWeight: 600, fontSize: 10,
    color: 'var(--color-text-tertiary)',
    borderBottom: '1px solid var(--color-border-subtle)',
    flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  playsFeed: {
    flex: 1, overflowY: 'auto', padding: '4px 0',
  },
  leadersPanel: {
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  leadersFeed: {
    flex: 1, overflowY: 'auto', padding: '8px 12px',
  },
  gameOverBar: {
    padding: '16px 20px', textAlign: 'center',
    background: 'var(--color-bg-raised)',
    borderTop: '2px solid var(--color-accent)', flexShrink: 0,
  },
  finalText: {
    fontSize: 18, fontWeight: 700, marginBottom: 12,
    fontFamily: 'var(--font-mono)',
  },
};
