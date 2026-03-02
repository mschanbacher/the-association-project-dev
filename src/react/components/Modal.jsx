import React, { useEffect, useCallback } from 'react';

/**
 * Modal — reusable overlay + content container.
 * Renders into the React tree (no portal) since we control the full layout.
 */
export function Modal({ isOpen, onClose, maxWidth = 700, children, zIndex = 1100 }) {
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape' && onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn var(--duration-normal) var(--ease-out)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-raised)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp var(--duration-normal) var(--ease-out)',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * ModalHeader — title bar with optional close button.
 */
export function ModalHeader({ children, onClose }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-5) var(--space-6)',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--weight-bold)',
      }}>
        {children}
      </div>
      {onClose && (
        <button onClick={onClose} style={{
          background: 'var(--color-bg-sunken)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-base)',
          transition: 'background var(--duration-fast) ease',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-sunken)'}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * ModalBody — padded content area.
 */
export function ModalBody({ children, style }) {
  return (
    <div style={{ padding: 'var(--space-6)', ...style }}>
      {children}
    </div>
  );
}

/**
 * ModalFooter — bottom bar, typically for action buttons.
 */
export function ModalFooter({ children }) {
  return (
    <div style={{
      padding: 'var(--space-4) var(--space-6)',
      borderTop: '1px solid var(--color-border-subtle)',
      display: 'flex',
      justifyContent: 'center',
      gap: 'var(--space-3)',
    }}>
      {children}
    </div>
  );
}
