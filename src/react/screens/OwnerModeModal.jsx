import React, { useRef, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

/**
 * OwnerModeModal — hybrid React shell for the offseason owner mode.
 * 
 * The owner mode has complex interactive HTML (sponsor accept/reject buttons,
 * ticket/marketing sliders, arena upgrade buttons) that call global functions.
 * We render the pre-built HTML in a React modal shell and add a Confirm button.
 */
export function OwnerModeModal({ data, onClose }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current && data?.html) {
      contentRef.current.innerHTML = data.html;
      // Run any post-render setup (e.g., ticket price slider init)
      if (data.onMount) data.onMount();
    }
  }, [data]);

  if (!data) return null;

  const handleConfirm = () => {
    // Call the offseason controller's confirm method
    if (window._ownerModeConfirmCallback) {
      window._ownerModeConfirmCallback();
    }
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={null} maxWidth={1100} zIndex={1350}>
      <ModalHeader>
        🏢 Offseason — Owner Decisions
      </ModalHeader>

      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        <div ref={contentRef} />

        <div style={{
          marginTop: 'var(--space-5)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={handleConfirm}
            style={{
              padding: '12px 40px',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-bold)',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'transform 0.1s, opacity 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Confirm Decisions & Start Season →
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
