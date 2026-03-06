import React, { useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

export function BoxScoreModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { home, away, date, hasDetailedStats, quarterScores } = data;
  const winner = (home.score || 0) > (away.score || 0) ? 'home' : 'away';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={820} zIndex={1400}>
      <ModalHeader onClose={onClose}>Box Score</ModalHeader>
      <ModalBody style={{ padding: 'var(--space-4) var(--space-5)' }}>
        {/* Scoreboard */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          {date && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
              {date}
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48,
          }}>
            <ScoreBlock team={away} isWinner={winner === 'away'} />
            <ScoreBlock team={home} isWinner={winner === 'home'} />
          </div>

          {quarterScores && quarterScores.home && (
            <QuarterTable home={home} away={away} quarterScores={quarterScores} />
          )}
        </div>

        {/* Player stats */}
        {hasDetailedStats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <TeamBoxTable team={away} />
            <TeamBoxTable team={home} />
          </div>
        ) : (
          <div style={{
            textAlign: 'center', color: 'var(--color-text-tertiary)',
            padding: 'var(--space-5)', fontSize: 'var(--text-sm)',
          }}>
            Detailed stats available for your team's games only.
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

function ScoreBlock({ team, isWinner }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        {teamName(team)}
      </div>
      <div style={{
        fontSize: 42, fontWeight: 700, fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        color: isWinner ? 'var(--color-text)' : 'var(--color-text-tertiary)',
      }}>{team.score}</div>
    </div>
  );
}

function QuarterTable({ home, away, quarterScores }) {
  const periods = quarterScores.home.length;
  return (
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ color: 'var(--color-text-tertiary)' }}>
            <th style={qCell}></th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} style={qCell}>{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</th>
            ))}
            <th style={{ ...qCell, fontWeight: 700 }}>F</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...qCell, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{teamName(away)}</td>
            {quarterScores.away.map((q, i) => <td key={i} style={qCell}>{q}</td>)}
            <td style={{ ...qCell, fontWeight: 700 }}>{away.score}</td>
          </tr>
          <tr>
            <td style={{ ...qCell, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{teamName(home)}</td>
            {quarterScores.home.map((q, i) => <td key={i} style={qCell}>{q}</td>)}
            <td style={{ ...qCell, fontWeight: 700 }}>{home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const qCell = { padding: '3px 10px', textAlign: 'center' };

// ── Game Score (Hollinger) ────────────────────────────────────────
// ORB estimated by position since box score doesn't split ORB/DRB
const ORB_RATE = { PG: 0.06, SG: 0.08, SF: 0.12, PF: 0.22, C: 0.28 };
function calcGameScore(p) {
  const orbRate = ORB_RATE[p.pos] || 0.10;
  const orb = Math.round((p.reb || 0) * orbRate);
  const drb = (p.reb || 0) - orb;
  return (
    (p.pts  || 0) * 1.0 +
    (p.fgm  || 0) * 0.4 -
    (p.fga  || 0) * 0.7 -
    ((p.fta || 0) - (p.ftm || 0)) * 0.4 +
    orb            * 0.7 +
    drb            * 0.3 +
    (p.stl  || 0) * 1.0 +
    (p.ast  || 0) * 0.7 +
    (p.blk  || 0) * 0.7 -
    (p.pf   || 0) * 0.4 -
    (p.to   || 0) * 1.0
  );
}
function gmScColor(score) {
  if (score >= 25) return 'var(--color-rating-elite)';
  if (score >= 15) return 'var(--color-rating-good)';
  if (score >= 8)  return 'var(--color-rating-avg)';
  if (score >= 3)  return 'var(--color-text-tertiary)';
  return 'var(--color-rating-below)';
}

function TeamBoxTable({ team }) {
  const players = team.players || [];
  if (players.length === 0) return null;

  const starters = players.filter(p => p.starter);
  const bench = players.filter(p => !p.starter);

  // Identify player of the game (highest pts in this team)
  const topPlayerId = players.reduce((best, p) =>
    (p.pts || 0) > (best.pts || 0) ? p : best, { pts: -1 }
  );
  const topPlayerName = topPlayerId.name;

  const totals = useMemo(() =>
    players.reduce((t, p) => ({
      pts: t.pts + (p.pts || 0), reb: t.reb + (p.reb || 0), ast: t.ast + (p.ast || 0),
      stl: t.stl + (p.stl || 0), blk: t.blk + (p.blk || 0), to: t.to + (p.to || 0),
      fgm: t.fgm + (p.fgm || 0), fga: t.fga + (p.fga || 0),
      tpm: t.tpm + (p.tpm || 0), tpa: t.tpa + (p.tpa || 0),
      ftm: t.ftm + (p.ftm || 0), fta: t.fta + (p.fta || 0),
    }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 }),
    [players]
  );

  return (
    <div>
      {/* Team header with shooting splits */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        paddingBottom: 8, borderBottom: '2px solid var(--color-border)', marginBottom: 4,
      }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
          {teamName(team)} — {team.score}
        </div>
        <div style={{
          display: 'flex', gap: 16,
          fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>FG {totals.fgm}–{totals.fga} ({pctFmt(totals.fgm, totals.fga)})</span>
          <span>3P {totals.tpm}–{totals.tpa} ({pctFmt(totals.tpm, totals.tpa)})</span>
          <span>FT {totals.ftm}–{totals.fta} ({pctFmt(totals.ftm, totals.fta)})</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
        }}>
          <thead>
            <tr style={{
              color: 'var(--color-text-tertiary)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <Th left>Player</Th>
              <Th>MIN</Th>
              <Th gmsc>GmSc</Th>
              <Th bold>PTS</Th>
              <Th>REB</Th>
              <Th>AST</Th>
              <Th>STL</Th>
              <Th>BLK</Th>
              <Th>TO</Th>
              <Th>FG</Th>
              <Th>FG%</Th>
              <Th>3PT</Th>
              <Th>3P%</Th>
              <Th>FT</Th>
              <Th>+/-</Th>
            </tr>
          </thead>
          <tbody>
            {starters.map((p, i) => <PRow key={i} p={p} highlight={p.name === topPlayerName} />)}
            {bench.length > 0 && (
              <tr>
                <td colSpan={15} style={{
                  padding: '4px 6px', fontSize: 10, fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)', letterSpacing: '0.04em',
                  borderTop: '1px solid var(--color-border-subtle)',
                  textTransform: 'uppercase',
                }}>Bench</td>
              </tr>
            )}
            {bench.map((p, i) => <PRow key={`b${i}`} p={p} highlight={p.name === topPlayerName} />)}
            <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
              <Td left>TOTAL</Td>
              <Td></Td>
              <Td></Td>
              <Td>{totals.pts}</Td>
              <Td>{totals.reb}</Td>
              <Td>{totals.ast}</Td>
              <Td>{totals.stl}</Td>
              <Td>{totals.blk}</Td>
              <Td>{totals.to}</Td>
              <Td>{totals.fgm}–{totals.fga}</Td>
              <Td>{pctFmt(totals.fgm, totals.fga)}</Td>
              <Td>{totals.tpm}–{totals.tpa}</Td>
              <Td>{pctFmt(totals.tpm, totals.tpa)}</Td>
              <Td>{totals.ftm}–{totals.fta}</Td>
              <Td></Td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PRow({ p, highlight }) {
  return (
    <tr style={{
      borderBottom: '1px solid var(--color-border-subtle)',
      background: highlight ? 'var(--color-accent-bg)' : 'transparent',
    }}>
      <Td left>
        <span style={{ fontWeight: 500, fontFamily: 'var(--font-body)' }}>{p.name}</span>
        {' '}
        <span style={{ color: 'var(--color-text-tertiary)' }}>{p.pos}</span>
      </Td>
      <Td>{p.min}</Td>
      <Td><GmScCell p={p} /></Td>
      <Td bold>{p.pts}</Td>
      <Td>{p.reb}</Td>
      <Td>{p.ast}</Td>
      <Td>{p.stl}</Td>
      <Td>{p.blk}</Td>
      <Td>{p.to}</Td>
      <Td>{p.fgm}–{p.fga}</Td>
      <Td>{pctFmt(p.fgm, p.fga)}</Td>
      <Td>{p.tpm}–{p.tpa}</Td>
      <Td>{pctFmt(p.tpm, p.tpa)}</Td>
      <Td>{p.ftm}–{p.fta}</Td>
      <Td><PlusMinus value={p.pm} /></Td>
    </tr>
  );
}

function PlusMinus({ value }) {
  const v = value || 0;
  const color = v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';
  const label = v > 0 ? `+${v}` : `${v}`;
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color }}>
      {label}
    </span>
  );
}

function GmScCell({ p }) {
  const score = calcGameScore(p);
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      color: gmScColor(score),
    }}>
      {score.toFixed(1)}
    </span>
  );
}

function Th({ children, left, bold, gmsc }) {
  return (
    <th style={{
      padding: '5px 4px', textAlign: left ? 'left' : 'center',
      fontWeight: bold ? 700 : 600,
      color: gmsc ? 'var(--color-rating-good)' : undefined,
    }}>{children}</th>
  );
}

function Td({ children, left, bold }) {
  return (
    <td style={{
      padding: '5px 4px', textAlign: left ? 'left' : 'center',
      fontWeight: bold ? 700 : undefined,
    }}>{children}</td>
  );
}

function pctFmt(m, a) {
  if (!a || a === 0) return '—';
  return ((m / a) * 100).toFixed(1);
}

function teamName(team) {
  const n = team.teamName || team.name || '';
  if (team.city) return `${team.city} ${n}`;
  return n;
}
