import React, { useState, useCallback, useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function OwnerModeModal({ data, onClose }) {
  if (!data) return null;

  const {
    team, finances, summary, arena, tier, isT1,
    expansionCost, renovationCost, expansionSeats,
    sponsorships, pendingSponsorOffers,
    revFor1Pct, revFor3Pct, revFor5Pct,
    formatCurrency,
  } = data;

  const fc = formatCurrency || ((v) => '$' + (v / 1e6).toFixed(1) + 'M');

  return (
    <Modal isOpen={true} onClose={null} maxWidth={720} zIndex={1350}>
      <ModalHeader>Owner Decisions</ModalHeader>
      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Revenue summary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Available Revenue</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {fc(summary.totalRevenue)}
          </div>
        </div>

        {/* Sponsorships */}
        <Section label="Sponsorship Deals" sub="Sponsors boost your commercial revenue">
          {sponsorships.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SubLabel>Active ({sponsorships.length})</SubLabel>
              {sponsorships.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  <span>{s.name} <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>({s.yearsRemaining}yr left)</span></span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fc(s.annualValue)}/yr</span>
                </div>
              ))}
            </div>
          )}

          <SubLabel>New Offers</SubLabel>
          {pendingSponsorOffers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
              No new offers this offseason.
            </div>
          ) : (
            pendingSponsorOffers.map((offer, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--color-bg-raised)',
                border: '1px solid var(--color-border-subtle)', marginBottom: 6,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{offer.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {offer.years}-year deal
                    {offer.conditionLabel && (
                      <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>{offer.conditionLabel}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                      {fc(offer.annualValue)}/yr
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                      Total: {fc(offer.annualValue * offer.years)}
                    </div>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => window.acceptSponsor?.(idx)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Arena */}
        <ArenaSection
          arena={arena} expansionCost={expansionCost}
          renovationCost={renovationCost} expansionSeats={expansionSeats} fc={fc}
        />

        {/* Ticket Pricing */}
        <TicketPricingSection initialPct={Math.round((finances.ticketPriceMultiplier || 1.0) * 100)} />

        {/* Marketing */}
        <MarketingSection
          currentBudget={finances.marketingBudget || 0}
          revFor1Pct={revFor1Pct} revFor3Pct={revFor3Pct} revFor5Pct={revFor5Pct} fc={fc}
        />

        {/* Spending Strategy (non-T1) */}
        {!isT1 && (
          <SpendingSection
            initialRatio={Math.round(finances.spendingRatio * 100)}
            spendingLimit={summary.spendingLimit} fc={fc}
          />
        )}

        {/* Confirm */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button variant="primary" onClick={() => {
            if (window._ownerModeConfirmCallback) window._ownerModeConfirmCallback();
            if (onClose) onClose();
          }} style={{ padding: '10px 32px' }}>
            Confirm Decisions & Start Season
          </Button>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            Marketing costs are deducted from your spending limit.
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── Shared ── */

function Section({ label, sub, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
      padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: sub ? 2 : 8,
      }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  );
}

function SubLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
    }}>{children}</div>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: 10,
      background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--color-text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ── Arena ── */

function ArenaSection({ arena, expansionCost, renovationCost, expansionSeats, fc }) {
  const condColor = arena.condition > 70 ? 'var(--color-win)'
    : arena.condition > 45 ? 'var(--color-warning)' : 'var(--color-loss)';
  const upgrading = arena.upgradeYearsLeft > 0;

  return (
    <Section label="Arena Management" sub="Larger venues and better condition attract more fans">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricBox value={arena.capacity.toLocaleString()} label="Seats" />
        <MetricBox value={`${arena.condition}%`} label="Condition" color={condColor} />
        <MetricBox value={upgrading ? `${arena.upgradeYearsLeft}yr` : '—'} label="Payments Left" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="sm" disabled={upgrading}
          onClick={() => window.upgradeArena?.('expand')}
          style={{ flex: 1, opacity: upgrading ? 0.4 : 1 }}>
          Expand (+{expansionSeats.toLocaleString()}) · {fc(expansionCost)}/3yr
        </Button>
        <Button variant="secondary" size="sm" disabled={upgrading}
          onClick={() => window.upgradeArena?.('renovate')}
          style={{ flex: 1, opacity: upgrading ? 0.4 : 1 }}>
          Renovate (+25 cond.) · {fc(renovationCost)}/2yr
        </Button>
      </div>
      {upgrading && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginTop: 6 }}>
          Current upgrade in progress.
        </div>
      )}
    </Section>
  );
}

/* ── Ticket Pricing ── */

function TicketPricingSection({ initialPct }) {
  const [pct, setPct] = useState(initialPct);

  const handleChange = useCallback((e) => {
    const val = parseInt(e.target.value);
    setPct(val);
    window.updateTicketPrice?.(val);
  }, []);

  return (
    <Section label="Ticket Pricing" sub="Higher prices increase revenue per ticket but reduce attendance">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Discount</span>
        <input type="range" min="70" max="150" value={pct} onChange={handleChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Premium</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
        <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>of base price</span>
        {pct > 110 && (
          <span style={{ color: 'var(--color-warning)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
            +{pct - 100}% rev/ticket · ~{Math.round((pct - 100) * 0.6)}% fewer fans
          </span>
        )}
        {pct < 90 && (
          <span style={{ color: 'var(--color-info)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
            −{100 - pct}% rev/ticket · ~{Math.round((100 - pct) * 0.4)}% more fans
          </span>
        )}
      </div>
    </Section>
  );
}

/* ── Marketing ── */

function MarketingSection({ currentBudget, revFor1Pct, revFor3Pct, revFor5Pct, fc }) {
  const [budget, setBudget] = useState(currentBudget);

  const options = useMemo(() => [
    { amount: 0, label: 'None' },
    { amount: revFor1Pct, label: `Light · ${fc(revFor1Pct)}` },
    { amount: revFor3Pct, label: `Moderate · ${fc(revFor3Pct)}` },
    { amount: revFor5Pct, label: `Aggressive · ${fc(revFor5Pct)}` },
  ], [revFor1Pct, revFor3Pct, revFor5Pct, fc]);

  const isActive = useCallback((amount) => {
    if (amount === 0) return budget === 0;
    if (amount === revFor1Pct) return budget > 0 && budget <= revFor1Pct;
    if (amount === revFor3Pct) return budget >= revFor3Pct * 0.9 && budget < revFor5Pct * 0.9;
    if (amount === revFor5Pct) return budget >= revFor5Pct * 0.9;
    return false;
  }, [budget, revFor1Pct, revFor3Pct, revFor5Pct]);

  const handleClick = useCallback((amount) => {
    setBudget(amount);
    window.setMarketingBudget?.(amount);
  }, []);

  return (
    <Section label="Marketing Investment" sub="Grows fanbase and boosts commercial revenue">
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((opt, i) => (
          <button key={i} onClick={() => handleClick(opt.amount)} style={{
            flex: 1, padding: '7px 8px', border: 'none', fontSize: 'var(--text-xs)',
            background: isActive(opt.amount) ? 'var(--color-accent)' : 'var(--color-bg-sunken)',
            color: isActive(opt.amount) ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            fontWeight: isActive(opt.amount) ? 600 : 400,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            transition: 'all 100ms ease',
          }}>{opt.label}</button>
        ))}
      </div>
    </Section>
  );
}

/* ── Spending Strategy ── */

function SpendingSection({ initialRatio, spendingLimit, fc }) {
  const [ratio, setRatio] = useState(initialRatio);
  const [limit, setLimit] = useState(spendingLimit);

  const handleChange = useCallback((e) => {
    const val = parseInt(e.target.value);
    setRatio(val);
    window.updateOwnerSpendingRatio?.(val);
  }, []);

  React.useEffect(() => {
    window._ownerSpendingLimitUpdate = (newLimit) => setLimit(newLimit);
    return () => { delete window._ownerSpendingLimitUpdate; };
  }, []);

  return (
    <Section label="Spending Strategy">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Conservative</span>
        <input type="range" min="60" max="90" value={ratio} onChange={handleChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Aggressive</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{ratio}%</span>
        <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>→</span>
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
          {fc(limit)}
        </span>
        <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>spending limit</span>
      </div>
    </Section>
  );
}
