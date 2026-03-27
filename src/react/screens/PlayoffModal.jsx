import React from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';
import { SectionLabel as SectionLabelBase } from '../visualizations/PlayerVisuals.jsx';

export function PlayoffModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;

  const { results, isPromotion, isDivisionPlayoff, msg, userResult, userInvolved } = data;

  const labelColor = isPromotion ? 'var(--color-win)' : isDivisionPlayoff ? 'var(--color-accent)' : 'var(--color-loss)';
  const labelText = isDivisionPlayoff ? 'Division Playoffs'
    : isPromotion ? 'Promotion Playoffs' : 'Relegation Playoffs';

  const continueAction = userInvolved ? userResult : 'not-involved';

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={680} zIndex={1300}>
      <ModalBody style={{ maxHeight: '80vh', overflowY: 'auto', padding: 'var(--space-5)' }}>
        <div>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: labelColor,
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4,
            }}>{labelText}</div>
          </div>

          {/* User result */}
          {userInvolved && msg ? (
            <div style={{
              textAlign: 'center', fontSize: 'var(--text-md)',
              color: msg.color, marginBottom: 24, fontWeight: 700,
            }}>{msg.text}</div>
          ) : (
            <div style={{
              textAlign: 'center', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)', marginBottom: 24,
            }}>Your team did not participate</div>
          )}

          {/* Bracket */}
          {results.isFourTeam ? (
            <FourTeamBracket results={results} />
          ) : (
            <ThreeTeamBracket results={results} isPromotion={isPromotion} />
          )}

          {/* Continue */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button variant="primary" onClick={() => window.advanceToNextSeason?.(continueAction)}>
              Continue to Championship
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

function FourTeamBracket({ results }) {
  return (
    <div>
      <SectionLabel>Semifinals</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <MatchCard
          team1={{ ...results.seed1, label: '#1 Seed' }}
          team2={{ ...results.seed4, label: '#4 Seed' }}
          winnerId={results.semi1.winner.id}
        />
        <MatchCard
          team1={{ ...results.seed2, label: '#2 Seed' }}
          team2={{ ...results.seed3, label: '#3 Seed' }}
          winnerId={results.semi2.winner.id}
        />
      </div>

      <SectionLabel>Championship</SectionLabel>
      <MatchCard
        team1={{ ...results.semi1.winner }}
        team2={{ ...results.semi2.winner }}
        winnerId={results.final.winner.id}
      />

      <ResultBox>
        <strong>Champion:</strong> {results.final.winner.name}
      </ResultBox>
    </div>
  );
}

function ThreeTeamBracket({ results, isPromotion }) {
  return (
    <div>
      <SectionLabel>Play-In Game</SectionLabel>
      <MatchCard
        team1={{ ...results.seed2, label: '#2' }}
        team2={{ ...results.seed3, label: '#3' }}
        winnerId={results.playIn.winner.id}
      />

      <div style={{ marginTop: 20 }}>
        <SectionLabel>Final</SectionLabel>
        <MatchCard
          team1={{ ...results.seed1, label: '#1 — Bye' }}
          team2={{ ...results.playIn.winner }}
          winnerId={results.final.winner.id}
        />
      </div>

      <ResultBox>
        {isPromotion ? (
          <>
            <div><strong>Promoted:</strong> {results.final.winner.name}, {results.final.loser.name}</div>
            <div style={{ marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
              {results.playIn.loser.name} stays in current tier
            </div>
          </>
        ) : (
          <>
            <div><strong>Survived:</strong> {results.final.winner.name}</div>
            <div style={{ marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
              <strong>Relegated:</strong> {results.final.loser.name}, {results.playIn.loser.name}
            </div>
          </>
        )}
      </ResultBox>
    </div>
  );
}

function MatchCard({ team1, team2, winnerId }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', overflow: 'hidden',
    }}>
      <TeamRow team={team1} won={team1.id === winnerId} />
      <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />
      <TeamRow team={team2} won={team2.id === winnerId} />
    </div>
  );
}

function TeamRow({ team, won }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px',
      background: won ? 'var(--color-win)08' : 'transparent',
    }}>
      <div>
        <span style={{
          fontWeight: won ? 600 : 400,
          color: won ? 'var(--color-text)' : 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}>{team.name}</span>
        {team.label && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
            ({team.label})
          </span>
        )}
      </div>
      <span style={{
        fontSize: 'var(--text-xs)', fontWeight: 600,
        color: won ? 'var(--color-win)' : 'var(--color-loss)',
      }}>
        {won ? 'W' : 'L'}
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <SectionLabelBase style={{ color: 'var(--color-text-tertiary)' }}>
      {children}
    </SectionLabelBase>
  );
}

function ResultBox({ children }) {
  return (
    <div style={{
      marginTop: 16, padding: '14px 16px',
      background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)',
      fontSize: 'var(--text-sm)',
    }}>{children}</div>
  );
}
