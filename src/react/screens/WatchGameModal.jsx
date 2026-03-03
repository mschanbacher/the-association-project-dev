import React, { useRef, useEffect } from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';

/**
 * WatchGameModal — thin React shell around the live game viewer.
 * The game loop in GameSimController updates individual wg-* DOM elements
 * via getElementById every possession tick (60-800ms). Rather than rewriting
 * the entire real-time animation system, we render the UIRenderer HTML layout
 * and let the existing game loop drive the live updates.
 */
export function WatchGameModal({ isOpen, data, onClose }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (isOpen && data?.html && contentRef.current) {
      contentRef.current.innerHTML = data.html;
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1000} zIndex={1400}>
      <ModalBody style={{ maxHeight: '95vh', overflow: 'hidden', padding: 0 }}>
        <div ref={contentRef} />
      </ModalBody>
    </Modal>
  );
}
