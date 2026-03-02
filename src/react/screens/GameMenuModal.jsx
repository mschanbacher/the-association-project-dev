import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

/**
 * GameMenuModal — Save, Load, and Reset controls.
 */
export function GameMenuModal({ isOpen, onClose }) {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    window.downloadSave?.();
    onClose();
  };

  const handleUpload = () => {
    window.uploadSave?.();
    // Don't close — uploadSave opens a file picker
  };

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    window.resetGame?.();
    // Page will reload
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={400}>
      <ModalHeader onClose={onClose}>Game Menu</ModalHeader>
      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <MenuButton
            icon="💾"
            label="Download Save"
            desc="Export your game to a file"
            onClick={handleDownload}
          />
          <MenuButton
            icon="📂"
            label="Load Save"
            desc="Import a save file (replaces current)"
            onClick={handleUpload}
          />

          <div style={{
            borderTop: '1px solid var(--color-border-subtle)',
            margin: 'var(--space-1) 0',
          }} />

          {!confirming ? (
            <MenuButton
              icon="🔄"
              label="Reset Game"
              desc="Start over — all progress will be lost"
              onClick={handleReset}
              variant="danger"
            />
          ) : (
            <MenuButton
              icon="⚠️"
              label="Confirm Reset?"
              desc="Click again to permanently erase your save"
              onClick={handleReset}
              variant="danger"
            />
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}

function MenuButton({ icon, label, desc, onClick, variant }) {
  const [hovered, setHovered] = useState(false);
  const isDanger = variant === 'danger';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isDanger ? 'rgba(234, 67, 53, 0.2)' : 'var(--color-border-subtle)'}`,
        background: hovered
          ? isDanger ? 'rgba(234, 67, 53, 0.08)' : 'var(--color-bg-hover)'
          : 'var(--color-bg-sunken)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
        transition: 'all var(--duration-fast) ease',
      }}
    >
      <div style={{
        fontSize: 'var(--text-md)',
        fontWeight: 'var(--weight-semi)',
        marginBottom: 2,
        color: isDanger ? 'var(--color-loss)' : 'var(--color-text)',
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
      }}>
        {desc}
      </div>
    </button>
  );
}
