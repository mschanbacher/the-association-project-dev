import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

export function GameMenuModal({ isOpen, onClose }) {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    window.downloadSave?.();
    onClose();
  };

  const handleUpload = () => {
    window.uploadSave?.();
  };

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    window.resetGame?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={360}>
      <ModalHeader onClose={onClose}>Game Menu</ModalHeader>
      <ModalBody style={{ padding: '12px 16px' }}>
        <MenuRow label="Download Save" desc="Export your game to a file" onClick={handleDownload} />
        <MenuRow label="Load Save" desc="Import a save file (replaces current)" onClick={handleUpload} />

        <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

        {!confirming ? (
          <MenuRow label="Reset Game" desc="Start over — all progress will be lost"
            danger onClick={handleReset} />
        ) : (
          <MenuRow label="Confirm Reset?" desc="Click again to permanently erase your save"
            danger active onClick={handleReset} />
        )}
      </ModalBody>
    </Modal>
  );
}

function MenuRow({ label, desc, danger, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 12px', marginBottom: 4,
        border: 'none',
        background: active ? 'var(--color-loss-bg)'
          : hovered ? (danger ? 'var(--color-loss-bg)' : 'var(--color-bg-sunken)')
          : 'transparent',
        cursor: 'pointer', fontFamily: 'var(--font-body)',
        transition: 'background 100ms ease',
      }}
    >
      <div style={{
        fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 2,
        color: danger ? 'var(--color-loss)' : 'var(--color-text)',
      }}>{label}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{desc}</div>
    </button>
  );
}
