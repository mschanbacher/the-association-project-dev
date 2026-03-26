import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { SettingsManager } from '../../engines/SettingsManager.js';

export function SettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(() => SettingsManager.getAll());

  // Sync when modal opens
  useEffect(() => {
    if (isOpen) setSettings(SettingsManager.getAll());
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key, value) => {
    SettingsManager.set(key, value);
    setSettings(SettingsManager.getAll());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={420}>
      <ModalHeader onClose={onClose}>Settings</ModalHeader>
      <ModalBody style={{ padding: '12px 20px 20px' }}>

        {/* ── Watch Game ── */}
        <Section label="Watch Game">
          <SettingRow
            label="Default Speed"
            desc="Starting speed when watching a game"
          >
            <ToggleGroup
              value={settings.watchGameSpeed}
              onChange={(v) => update('watchGameSpeed', v)}
              options={[
                { value: 1, label: '1x' },
                { value: 3, label: '3x' },
                { value: 10, label: '10x' },
                { value: 999, label: 'Max' },
              ]}
            />
          </SettingRow>
        </Section>

        {/* ── Simulation ── */}
        <Section label="Simulation">
          <SettingRow
            label="Injury Decisions"
            desc="How to handle player injuries you can play through"
          >
            <ToggleGroup
              value={settings.injuryDecisions}
              onChange={(v) => update('injuryDecisions', v)}
              options={[
                { value: 'ask', label: 'Ask Me' },
                { value: 'always-rest', label: 'Always Rest' },
                { value: 'ai-decides', label: 'AI Decides' },
              ]}
            />
          </SettingRow>
          <Hint>
            Severe injuries and Disabled Player Exceptions always require your input.
          </Hint>

          <SettingRow
            label="Breaking News"
            desc="Show trade alerts for notable AI trades"
          >
            <ToggleGroup
              value={settings.showBreakingNews}
              onChange={(v) => update('showBreakingNews', v)}
              options={[
                { value: true, label: 'On' },
                { value: false, label: 'Off' },
              ]}
            />
          </SettingRow>

          <SettingRow
            label="AI Trade Proposals"
            desc="Auto-decline during Sim Week and Finish Season"
          >
            <ToggleGroup
              value={settings.autoDeclineTrades}
              onChange={(v) => update('autoDeclineTrades', v)}
              options={[
                { value: false, label: 'Show' },
                { value: true, label: 'Auto-Decline' },
              ]}
            />
          </SettingRow>
          <Hint>
            Sim Day and Sim Next Game always show trade proposals.
          </Hint>
        </Section>

      </ModalBody>
    </Modal>
  );
}


// ── Sub-components ──────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={S.sectionLabel}>{label}</div>
      <div style={S.sectionDivider} />
      {children}
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={S.settingRow}>
      <div style={S.settingInfo}>
        <div style={S.settingLabel}>{label}</div>
        <div style={S.settingDesc}>{desc}</div>
      </div>
      <div style={S.settingControl}>
        {children}
      </div>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div style={S.hint}>{children}</div>
  );
}

function ToggleGroup({ value, onChange, options }) {
  return (
    <div style={S.toggleGroup}>
      {options.map((opt, idx) => {
        const active = opt.value === value;
        const isLast = idx === options.length - 1;
        return (
          <ToggleButton
            key={String(opt.value)}
            active={active}
            isLast={isLast}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </ToggleButton>
        );
      })}
    </div>
  );
}

function ToggleButton({ active, isLast, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.toggleBtn,
        borderRight: isLast ? 'none' : '1px solid var(--color-border)',
        background: active
          ? 'var(--color-accent)'
          : hovered
            ? 'var(--color-bg-sunken)'
            : 'transparent',
        color: active
          ? 'var(--color-text-inverse)'
          : 'var(--color-text-secondary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}


// ── Styles ──────────────────────────────────────────────────────

const S = {
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--color-text-tertiary)',
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    background: 'var(--color-border)',
    marginBottom: 12,
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    minHeight: 36,
  },
  settingInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingLabel: {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--color-text)',
    lineHeight: 1.3,
  },
  settingDesc: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-tertiary)',
    lineHeight: 1.3,
    marginTop: 1,
  },
  settingControl: {
    flexShrink: 0,
  },
  hint: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    marginTop: -4,
    marginBottom: 14,
    paddingLeft: 1,
    lineHeight: 1.4,
  },
  toggleGroup: {
    display: 'flex',
    border: '1px solid var(--color-border)',
  },
  toggleBtn: {
    padding: '5px 11px',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    transition: 'all 100ms ease',
    whiteSpace: 'nowrap',
  },
};

// Last toggle button shouldn't have a right border — handled by the
// outer container's border. Override via CSS-in-JS isn't clean here,
// so we use a small trick: the container border covers it visually.
