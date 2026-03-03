import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

/**
 * WatchGameModal — native React live game viewer.
 *
 * The game loop in GameSimController runs on a setInterval and needs to
 * update the scoreboard, play-by-play, and leaders every tick (1-800ms).
 * Rather than re-rendering React every possession, we expose DOM refs on
 * window._wgRefs so the game loop can write to them imperatively.
 *
 * React owns the layout, styling, and lifecycle. The game loop owns the
 * per-tick content updates.
 */
export function WatchGameModal({ isOpen, data, onClose }) {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalText, setFinalText] = useState('');

  // Refs for imperative DOM updates from game loop
  const homeScoreRef = useRef(null);
  const awayScoreRef = useRef(null);
  const clockRef = useRef(null);
  const quarterScoresRef = useRef(null);
  const momentumRef = useRef(null);
  const playsRef = useRef(null);
  const leadersRef = useRef(null);

  // Expose refs on window so GameSimController can find them
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
        // Callbacks for state changes that need React re-render
        setGameOver: (text) => { setGameOver(true); setFinalText(text); },
        setSpeed: (s) => setSpeed(s),
        setPaused: (p) => setPaused(p),
      };
    }
    return () => { window._wgRefs = null; };
  }, [isOpen]);

  // Reset state when new game starts
  useEffect(() => {
    if (isOpen && data) {
      setSpeed(1);
      setPaused(false);
      setGameOver(false);
      setFinalText('');
      // Clear plays feed
      if (playsRef.current) playsRef.current.innerHTML = '';
      if (leadersRef.current) leadersRef.current.innerHTML = '';
    }
  }, [isOpen, data?.homeName, data?.awayName]);

  const handleSpeed = useCallback((s) => {
    setSpeed(s);
    window.watchGameSetSpeed?.(s);
  }, []);

  const handlePause = useCallback(() => {
    setPaused(p => !p);
    window.watchGameTogglePause?.();
  }, []);

  if (!isOpen || !data) return null;

  const { homeName, awayName, playoffContext } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1000} zIndex={1400}>
      <ModalBody style={{ maxHeight: '95vh', overflow: 'hidden', padding: 0 }}>
        <div style={S.container}>
          {/* Playoff context banner */}
          {playoffContext && (
            <div style={S.contextBanner}>🏆 {playoffContext}</div>
          )}

          {/* Scoreboard */}
          <div style={S.scoreboard}>
            <div style={S.scoreRow}>
              <div style={S.teamScore}>
                <div style={S.teamName}>{awayName}</div>
                <div ref={awayScoreRef} style={S.score}>0</div>
              </div>
              <div style={S.clockArea}>
                <div ref={clockRef} style={S.clock}>Q1 12:00</div>
                <div ref={quarterScoresRef} style={S.quarterScores} />
              </div>
              <div style={S.teamScore}>
                <div style={S.teamName}>{homeName}</div>
                <div ref={homeScoreRef} style={S.score}>0</div>
              </div>
            </div>
            {/* Momentum bar */}
            <div style={S.momentumRow}>
              <span style={S.momentumLabel}>AWY</span>
              <div style={S.momentumTrack}>
                <div ref={momentumRef} style={S.momentumBar} />
              </div>
              <span style={S.momentumLabel}>HME</span>
            </div>
          </div>

          {/* Controls */}
          <div style={S.controls}>
            {[1, 3, 10, 999].map(s => (
              <button key={s} onClick={() => handleSpeed(s)} style={{
                ...S.controlBtn,
                background: speed === s ? 'var(--color-accent)' : 'var(--color-bg-sunken)',
                color: speed === s ? '#1a1a2e' : 'var(--color-text-secondary)',
                fontWeight: speed === s ? 'var(--weight-bold)' : 'var(--weight-normal)',
              }}>
                {s === 999 ? '⏩ Max' : `${s}x`}
              </button>
            ))}
            <div style={S.controlDivider} />
            <button onClick={handlePause} style={{
              ...S.controlBtn,
              background: paused ? 'var(--color-win, #4ecdc4)' : 'var(--color-bg-sunken)',
              color: paused ? '#1a1a2e' : 'var(--color-text-secondary)',
            }}>
              {paused ? '▶ Play' : '⏸ Pause'}
            </button>
            <button onClick={() => window.watchGameSkip?.()} style={S.controlBtn}>
              ⏭ Skip
            </button>
          </div>

          {/* Main area */}
          <div style={S.mainArea}>
            {/* Play-by-play feed */}
            <div style={S.playsPanel}>
              <div style={S.panelHeader}>PLAY-BY-PLAY</div>
              <div ref={playsRef} style={S.playsFeed} />
            </div>
            {/* Leaders sidebar */}
            <div style={S.leadersPanel}>
              <div style={S.panelHeader}>LEADERS</div>
              <div ref={leadersRef} style={S.leadersFeed} />
            </div>
          </div>

          {/* Game over bar */}
          {gameOver && (
            <div style={S.gameOverBar}>
              <div style={S.finalText} dangerouslySetInnerHTML={{ __html: finalText }} />
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

/* ═══════════════════════════════════════════════════════════════
   STYLES — using CSS vars for theme compatibility
   ═══════════════════════════════════════════════════════════════ */

const S = {
  container: {
    display: 'flex', flexDirection: 'column', height: '90vh',
    background: 'var(--color-bg)', color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
  },
  contextBanner: {
    textAlign: 'center', padding: 'var(--space-2)',
    background: 'rgba(212,168,67,0.1)', color: 'var(--color-accent)',
    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
    borderBottom: '1px solid rgba(212,168,67,0.2)',
  },
  scoreboard: {
    background: 'var(--color-bg-raised)', padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0,
  },
  scoreRow: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-6)',
  },
  teamScore: { textAlign: 'center', minWidth: 180 },
  teamName: {
    fontSize: 'var(--text-sm)', opacity: 0.7, marginBottom: 'var(--space-1)',
  },
  score: {
    fontSize: '3em', fontWeight: 'var(--weight-bold)', lineHeight: 1,
  },
  clockArea: { textAlign: 'center' },
  clock: {
    fontSize: '1.4em', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)',
  },
  quarterScores: {
    fontSize: 'var(--text-xs)', opacity: 0.5, marginTop: 'var(--space-1)',
  },
  momentumRow: {
    marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center',
    gap: 'var(--space-2)', justifyContent: 'center',
  },
  momentumLabel: { fontSize: 'var(--text-xs)', opacity: 0.4 },
  momentumTrack: {
    width: 200, height: 4, background: 'var(--color-bg-sunken)',
    borderRadius: 2, position: 'relative', overflow: 'hidden',
  },
  momentumBar: {
    position: 'absolute', top: 0, height: '100%',
    background: '#4ecdc4', borderRadius: 2,
    transition: 'left 0.3s, width 0.3s',
    left: '50%', width: 0,
  },
  controls: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-bg-sunken)', flexShrink: 0,
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  controlBtn: {
    padding: '6px 14px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-bg-sunken)', color: 'var(--color-text-secondary)',
    cursor: 'pointer', fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)', transition: 'all var(--duration-fast) ease',
  },
  controlDivider: {
    width: 1, height: 20, background: 'var(--color-border)',
    margin: '0 var(--space-1)',
  },
  mainArea: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },
  playsPanel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--color-border-subtle)',
  },
  panelHeader: {
    padding: 'var(--space-2) var(--space-3)',
    fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)',
    opacity: 0.6, borderBottom: '1px solid var(--color-border-subtle)',
    flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  playsFeed: {
    flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-3)',
    display: 'flex', flexDirection: 'column-reverse',
  },
  leadersPanel: {
    width: 320, display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  leadersFeed: {
    flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-3)',
  },
  gameOverBar: {
    padding: 'var(--space-4) var(--space-5)', textAlign: 'center',
    background: 'var(--color-bg-raised)',
    borderTop: '2px solid var(--color-accent)',
    flexShrink: 0,
  },
  finalText: {
    fontSize: '1.3em', fontWeight: 'var(--weight-bold)',
    marginBottom: 'var(--space-3)',
  },
};
