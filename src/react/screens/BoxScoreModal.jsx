import React, { useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

/**
 * BoxScoreModal — full game box score with quarter scoring and player stats.
 * Props:
 *   data: { home, away, date, hasDetailedStats, quarterScores }
 *   isOpen, onClose
 */
export function BoxScoreModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { home, away, date, hasDetailedStats, quarterScores } = data;
  const winner = (home.score || 0) > (away.score || 0) ? 'home' : 'away';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={820}>
      <ModalHeader onClose={onClose}>Box Score</ModalHeader>
      <ModalBody style={{ padding: 'var(--space-5) var(--space-6)' }}>
        {/* Scoreboard */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>{date || ''}</div>

          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 'var(--space-8)',
          }}>
            <ScoreBlock team={away} isWinner={winner === 'away'} />
            <span style={{
              fontSize: 'var(--text-lg)', color: 'var(--color-text-tertiary)', opacity: 0.3,
            }}>@</span>
            <ScoreBlock team={home} isWinner={winner === 'home'} />
          </div>

          {/* Quarter scores */}
          {quarterScores && quarterScores.home && (
            <QuarterTable home={home} away={away} quarterScores={quarterScores} />
          )}
        </div>

        {/* Player stats */}
        {hasDetailedStats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <TeamBoxTable team={away} />
            <TeamBoxTable team={home} />
          </div>
        ) : (
          <div style={{
            textAlign: 'center', color: 'var(--color-text-tertiary)',
            padding: 'var(--space-5)', fontSize: 'var(--text-sm)',
          }}>
            Detailed box score available for your team's games only.
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}


/* ═══════════════════════════════════════════════════════════════ */
function ScoreBlock({ team, isWinner }) {
  const name = teamName(team);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-1)',
      }}>{name}</div>
      <div style={{
        fontSize: '2.5em', fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        color: isWinner ? 'var(--color-win)' : 'var(--color-text)', lineHeight: 1,
      }}>{team.score}</div>
    </div>
  );
}

function QuarterTable({ home, away, quarterScores }) {
  const periods = quarterScores.home.length;
  return (
    <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
      <table style={{
        borderCollapse: 'collapse', fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
      }}>
        <thead>
          <tr style={{ color: 'var(--color-text-tertiary)' }}>
            <th style={qCell}></th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} style={qCell}>{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</th>
            ))}
            <th style={{ ...qCell, fontWeight: 'var(--weight-bold)' }}>F</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...qCell, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{teamName(away)}</td>
            {quarterScores.away.map((q, i) => <td key={i} style={qCell}>{q}</td>)}
            <td style={{ ...qCell, fontWeight: 'var(--weight-bold)' }}>{away.score}</td>
          </tr>
          <tr>
            <td style={{ ...qCell, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{teamName(home)}</td>
            {quarterScores.home.map((q, i) => <td key={i} style={qCell}>{q}</td>)}
            <td style={{ ...qCell, fontWeight: 'var(--weight-bold)' }}>{home.score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const qCell = { padding: '3px 10px', textAlign: 'center' };

function TeamBoxTable({ team }) {
  const players = team.players || [];
  if (players.length === 0) return null;

  const starters = players.filter(p => p.starter);
  const bench = players.filter(p => !p.starter);

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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 'var(--space-2)', borderBottom: '2px solid var(--color-border)',
        marginBottom: 'var(--space-2)',
      }}>
        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>
          {teamName(team)} — {team.score}
        </div>
        <div style={{
          display: 'flex', gap: 'var(--space-4)',
          fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        }}>
          <span>FG: {totals.fgm}–{totals.fga} ({pct(totals.fgm, totals.fga)}%)</span>
          <span>3PT: {totals.tpm}–{totals.tpa} ({pct(totals.tpm, totals.tpa)}%)</span>
          <span>FT: {totals.ftm}–{totals.fta} ({pct(totals.ftm, totals.fta)}%)</span>
          <span>TO: {totals.to}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}>
          <thead>
            <tr style={{
              color: 'var(--color-text-tertiary)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <Th align="left">Player</Th>
              <Th>MIN</Th>
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
            </tr>
          </thead>
          <tbody>
            {starters.map((p, i) => <PlayerRow key={i} p={p} even={i % 2 === 0} />)}
            {bench.length > 0 && (
              <tr>
                <td colSpan={13} style={{
                  padding: '3px 8px', fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}>Bench</td>
              </tr>
            )}
            {bench.map((p, i) => <PlayerRow key={`b${i}`} p={p} even={i % 2 === 0} />)}
            {/* Totals */}
            <tr style={{
              borderTop: '2px solid var(--color-border)',
              fontWeight: 'var(--weight-bold)',
            }}>
              <Td align="left">TOTAL</Td>
              <Td></Td>
              <Td>{totals.pts}</Td>
              <Td>{totals.reb}</Td>
              <Td>{totals.ast}</Td>
              <Td>{totals.stl}</Td>
              <Td>{totals.blk}</Td>
              <Td>{totals.to}</Td>
              <Td>{totals.fgm}–{totals.fga}</Td>
              <Td>{pct(totals.fgm, totals.fga)}</Td>
              <Td>{totals.tpm}–{totals.tpa}</Td>
              <Td>{pct(totals.tpm, totals.tpa)}</Td>
              <Td>{totals.ftm}–{totals.fta}</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({ p, even }) {
  return (
    <tr style={{ background: even ? 'var(--color-bg-sunken)' : 'transparent' }}>
      <Td align="left">
        <strong>{p.name}</strong>{' '}
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.9em' }}>{p.pos}</span>
      </Td>
      <Td>{p.min}</Td>
      <Td bold>{p.pts}</Td>
      <Td>{p.reb}</Td>
      <Td>{p.ast}</Td>
      <Td>{p.stl}</Td>
      <Td>{p.blk}</Td>
      <Td>{p.to}</Td>
      <Td>{p.fgm}–{p.fga}</Td>
      <Td>{pct(p.fgm, p.fga)}</Td>
      <Td>{p.tpm}–{p.tpa}</Td>
      <Td>{pct(p.tpm, p.tpa)}</Td>
      <Td>{p.ftm}–{p.fta}</Td>
    </tr>
  );
}

function Th({ children, align = 'center', bold }) {
  return (
    <th style={{
      padding: '5px 4px', textAlign: align,
      fontWeight: bold ? 'var(--weight-bold)' : 'var(--weight-medium)',
    }}>{children}</th>
  );
}

function Td({ children, align = 'center', bold }) {
  return (
    <td style={{
      padding: '5px 4px', textAlign: align,
      fontWeight: bold ? 'var(--weight-bold)' : undefined,
    }}>{children}</td>
  );
}

function pct(m, a) {
  return a > 0 ? ((m / a) * 100).toFixed(1) : '—';
}

function teamName(team) {
  if (team.city) return `${team.city} ${team.name}`;
  return team.name || '';
}
