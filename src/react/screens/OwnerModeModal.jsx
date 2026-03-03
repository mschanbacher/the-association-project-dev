import React, { useState, useCallback, useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

/**
 * OwnerModeModal — native React replacement for the legacy HTML owner mode.
 *
 * All interactive controls (sliders, sponsor accept, arena upgrade, marketing
 * buttons) are managed through React state and call window globals that route
 * to FinanceController methods.
 */
export function OwnerModeModal({ data, onClose }) {
  if (!data) return null;

  const {
    team, finances, summary, arena, tier, isT1,
    expansionCost, renovationCost, expansionSeats,
    sponsorships, pendingSponsorOffers,
    revFor1Pct, revFor3Pct, revFor5Pct,
    formatCurrency,
  } = data;

  return (
    <Modal isOpen={true} onClose={null} maxWidth={1100} zIndex={1350}>
      <ModalHeader>🏢 Offseason — Owner Decisions</ModalHeader>
      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Header */}
        <HeaderSection summary={summary} fc={formatCurrency} />

        {/* Sponsorships */}
        <SponsorshipsSection
          sponsorships={sponsorships}
          offers={pendingSponsorOffers}
          fc={formatCurrency}
        />

        {/* Arena */}
        <ArenaSection
          arena={arena} tier={tier}
          expansionCost={expansionCost}
          renovationCost={renovationCost}
          expansionSeats={expansionSeats}
          fc={formatCurrency}
        />

        {/* Ticket Pricing */}
        <TicketPricingSection
          initialPct={Math.round((finances.ticketPriceMultiplier || 1.0) * 100)}
        />

        {/* Marketing */}
        <MarketingSection
          currentBudget={finances.marketingBudget || 0}
          revFor1Pct={revFor1Pct}
          revFor3Pct={revFor3Pct}
          revFor5Pct={revFor5Pct}
          fc={formatCurrency}
        />

        {/* Spending Strategy (non-T1) */}
        {!isT1 && (
          <SpendingSection
            initialRatio={Math.round(finances.spendingRatio * 100)}
            spendingLimit={summary.spendingLimit}
            fc={formatCurrency}
          />
        )}

        {/* Confirm */}
        <div style={{
          marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <Button variant="primary" onClick={() => {
            if (window._ownerModeConfirmCallback) window._ownerModeConfirmCallback();
            if (onClose) onClose();
          }} style={{ padding: '12px 40px', fontSize: 'var(--text-base)' }}>
            Confirm Decisions & Start Season →
          </Button>
          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.5, marginTop: 'var(--space-2)' }}>
            Marketing costs are deducted from your spending limit.
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function SectionBox({ children, style }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)', marginBottom: 'var(--space-4)', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <>
      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)', marginBottom: 2 }}>
        {icon} {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.5, marginBottom: 'var(--space-3)' }}>
          {subtitle}
        </div>
      )}
    </>
  );
}

/* ── Header ── */
function HeaderSection({ summary, fc }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
      background: 'var(--color-accent-subtle, rgba(102,126,234,0.1))',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>⚙️ Offseason Management</div>
        <div style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginTop: 2 }}>
          Make financial decisions for the upcoming season
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>Available Revenue</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-win, #2ecc71)' }}>
          {fc(summary.totalRevenue)}
        </div>
      </div>
    </div>
  );
}

/* ── Sponsorships ── */
function SponsorshipsSection({ sponsorships, offers, fc }) {
  return (
    <SectionBox>
      <SectionTitle icon="🤝" title="Sponsorship Deals"
        subtitle="Sponsors boost your commercial revenue. Longer deals offer stability; conditions carry risk/reward." />

      {sponsorships.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', opacity: 0.8, marginBottom: 'var(--space-2)' }}>
            Active Deals
          </div>
          {sponsorships.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(46,204,113,0.08)', borderRadius: 'var(--radius-sm)',
              marginBottom: 3, fontSize: 'var(--text-sm)',
            }}>
              <span>{s.name} <span style={{ opacity: 0.6 }}>({s.yearsRemaining}yr left)</span></span>
              <span style={{ color: 'var(--color-win, #2ecc71)', fontWeight: 'var(--weight-bold)' }}>
                {fc(s.annualValue)}/yr
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', opacity: 0.8, marginBottom: 'var(--space-2)' }}>
        New Offers
      </div>
      {offers.length === 0 ? (
        <div style={{ opacity: 0.5, textAlign: 'center', padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          No new sponsorship offers this offseason.
        </div>
      ) : (
        offers.map((offer, idx) => (
          <div key={idx} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-3)', background: 'var(--color-bg-active)',
            borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)',
          }}>
            <div>
              <strong>{offer.name}</strong>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                {offer.years}-year deal
                {offer.conditionLabel && (
                  <> · <span style={{ color: 'var(--color-warning, #fbbc04)' }}>{offer.conditionLabel}</span></>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-win, #2ecc71)' }}>
                  {fc(offer.annualValue)}/yr
                </div>
                <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                  Total: {fc(offer.annualValue * offer.years)}
                </div>
              </div>
              <Button variant="primary" onClick={() => window.acceptSponsor?.(idx)}
                style={{ padding: '6px 14px', fontSize: 'var(--text-sm)' }}>
                Accept
              </Button>
            </div>
          </div>
        ))
      )}
    </SectionBox>
  );
}

/* ── Arena ── */
function ArenaSection({ arena, tier, expansionCost, renovationCost, expansionSeats, fc }) {
  const condColor = arena.condition > 70 ? 'var(--color-win, #34a853)'
    : arena.condition > 45 ? 'var(--color-warning, #fbbc04)' : 'var(--color-loss, #ea4335)';
  const upgrading = arena.upgradeYearsLeft > 0;

  return (
    <SectionBox>
      <SectionTitle icon="🏟️" title="Arena Management"
        subtitle="Your arena affects matchday revenue. Larger venues and better conditions attract more fans." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <StatCard value={arena.capacity.toLocaleString()} label="Seats" />
        <StatCard value={`${arena.condition}%`} label="Condition" color={condColor} />
        <StatCard value={upgrading ? `${arena.upgradeYearsLeft}yr` : '—'} label="Payments Left" />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={upgrading}
          onClick={() => window.upgradeArena?.('expand')}
          style={{ opacity: upgrading ? 0.4 : 1, fontSize: 'var(--text-sm)' }}>
          📐 Expand (+{expansionSeats.toLocaleString()} seats) · {fc(expansionCost)} over 3yr
        </Button>
        <Button variant="secondary" disabled={upgrading}
          onClick={() => window.upgradeArena?.('renovate')}
          style={{ opacity: upgrading ? 0.4 : 1, fontSize: 'var(--text-sm)' }}>
          🔧 Renovate (+25 condition) · {fc(renovationCost)} over 2yr
        </Button>
      </div>
      {upgrading && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning, #fbbc04)', marginTop: 'var(--space-2)' }}>
          ⚠️ Current upgrade in progress.
        </div>
      )}
    </SectionBox>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-3)',
      background: 'var(--color-bg-active)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: color || 'var(--color-text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{label}</div>
    </div>
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

  const effectText = useMemo(() => {
    if (pct > 110) {
      const drop = Math.round((pct - 100) * 0.6);
      return { text: `↑ +${pct - 100}% revenue/ticket · ↓ ~${drop}% attendance`, color: 'var(--color-warning, #fbbc04)' };
    } else if (pct < 90) {
      const gain = Math.round((100 - pct) * 0.4);
      return { text: `↓ ${100 - pct}% revenue/ticket · ↑ ~${gain}% attendance & fanbase`, color: 'var(--color-info, #3498db)' };
    }
    return { text: 'Balanced — standard pricing', color: 'var(--color-text-tertiary)' };
  }, [pct]);

  return (
    <SectionBox>
      <SectionTitle icon="🎟️" title="Ticket Pricing"
        subtitle="Higher prices increase revenue per ticket but reduce attendance." />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>🏷️ Discount (0.7×)</span>
        <input type="range" min="70" max="150" value={pct} onChange={handleChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
        <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Premium (1.5×)</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' }}>{pct}%</span>
        <span style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}> of base price</span>
        <span style={{ fontSize: 'var(--text-sm)', marginLeft: 'var(--space-2)', color: effectText.color }}>
          {effectText.text}
        </span>
      </div>
    </SectionBox>
  );
}

/* ── Marketing ── */
function MarketingSection({ currentBudget, revFor1Pct, revFor3Pct, revFor5Pct, fc }) {
  const [budget, setBudget] = useState(currentBudget);

  const options = useMemo(() => [
    { amount: 0, label: 'None ($0)' },
    { amount: revFor1Pct, label: `Light (${fc(revFor1Pct)} · 1%)` },
    { amount: revFor3Pct, label: `Moderate (${fc(revFor3Pct)} · 3%)` },
    { amount: revFor5Pct, label: `Aggressive (${fc(revFor5Pct)} · 5%)` },
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
    <SectionBox>
      <SectionTitle icon="📢" title="Marketing Investment"
        subtitle="Marketing grows your fanbase and boosts commercial revenue." />

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {options.map((opt, i) => (
          <Button key={i} variant={isActive(opt.amount) ? 'primary' : 'ghost'}
            onClick={() => handleClick(opt.amount)}
            style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}>
            {opt.label}
          </Button>
        ))}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)', opacity: 0.7 }}>
        {budget > 0
          ? `Current: ${fc(budget)}/season`
          : 'No marketing spend — fanbase growth relies on winning alone.'}
      </div>
    </SectionBox>
  );
}

/* ── Spending Strategy (non-T1) ── */
function SpendingSection({ initialRatio, spendingLimit, fc }) {
  const [ratio, setRatio] = useState(initialRatio);
  const [limit, setLimit] = useState(spendingLimit);

  const handleChange = useCallback((e) => {
    const val = parseInt(e.target.value);
    setRatio(val);
    window.updateOwnerSpendingRatio?.(val);
    // The controller updates the limit — we compute locally for instant feedback
    // This is approximate; the real value comes from FinanceEngine
  }, []);

  // Listen for limit updates from the controller
  React.useEffect(() => {
    window._ownerSpendingLimitUpdate = (newLimit) => setLimit(newLimit);
    return () => { delete window._ownerSpendingLimitUpdate; };
  }, []);

  return (
    <SectionBox>
      <SectionTitle icon="💰" title="Spending Strategy" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Conservative (60%)</span>
        <input type="range" min="60" max="90" value={ratio} onChange={handleChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
        <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Aggressive (90%)</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' }}>{ratio}%</span>
        <span style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}> → </span>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)' }}>
          {fc(limit)}
        </span>
      </div>
    </SectionBox>
  );
}
