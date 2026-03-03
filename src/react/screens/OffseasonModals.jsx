import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

/* ═══════════════════════════════════════════════════════════════
   OffseasonModals — intercepts legacy modal show/hide.
   
   Moves actual .modal-content DOM nodes into a React overlay,
   preserving all event handlers (both inline and programmatic).
   
   Patches classList.remove('hidden') to intercept shows and
   classList.add('hidden') to intercept hides. Uses a generation
   counter to prevent stale close calls from dismissing a newly
   opened modal.
   ═══════════════════════════════════════════════════════════════ */

const MODAL_IDS = [
  { id: 'championshipPlayoffModal',   maxWidth: 1000 },
  { id: 'playoffModal',               maxWidth: 1000 },
  { id: 'freeAgencyModal',            maxWidth: 1100 },
  { id: 'collegeGradFAModal',         maxWidth: 1000 },
  { id: 'financeDashboardModal',      maxWidth: 1100 },
  { id: 'rosterModal',                maxWidth: 1600 },
  { id: 'bracketViewerModal',         maxWidth: 1400 },
  { id: 'coachModal',                 maxWidth: 1100 },
];

// Module-level state for the classList interceptors
let _showGen = 0;
let _doClose = null;
let _doShow = null;
let _overlayEl = null;  // Direct ref to overlay DOM for immediate hide

export function OffseasonModals() {
  const { refresh } = useGame();
  const [activeCfg, setActiveCfg] = useState(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const movedRef = useRef({ contentNode: null, originalParent: null });

  // Keep overlay ref in sync for immediate DOM access
  useEffect(() => {
    _overlayEl = overlayRef.current;
  });

  // Restore DOM node to original parent
  const restoreNode = useCallback(() => {
    const { contentNode, originalParent } = movedRef.current;
    if (contentNode && originalParent) {
      try {
        originalParent.appendChild(contentNode);
      } catch (e) { /* already restored */ }
      contentNode.style.maxHeight = '';
      contentNode.style.overflowY = '';
    }
    movedRef.current = { contentNode: null, originalParent: null };
  }, []);

  // Close overlay
  const closeOverlay = useCallback(() => {
    // Immediately hide via DOM so there's no visual lag
    if (_overlayEl) _overlayEl.style.display = 'none';
    restoreNode();
    setActiveCfg(null);
    refresh?.();
  }, [restoreNode, refresh]);

  // Show a modal in the overlay
  const showModal = useCallback((cfg) => {
    restoreNode();
    // Make sure overlay is visible (might have been hidden by closeOverlay)
    if (_overlayEl) _overlayEl.style.display = '';
    // Always create a new object so React detects a state change
    // even when the same modal is re-shown (e.g. championship playoff rounds)
    setActiveCfg({ ...cfg });
  }, [restoreNode]);

  // Keep module-level refs in sync
  useEffect(() => {
    _doClose = closeOverlay;
    _doShow = showModal;
    return () => { _doClose = null; _doShow = null; };
  }, [closeOverlay, showModal]);

  // Patch legacy modals
  useEffect(() => {
    const cleanups = [];

    MODAL_IDS.forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (!el) return;

      const origRemove = DOMTokenList.prototype.remove.bind(el.classList);
      const origAdd = DOMTokenList.prototype.add.bind(el.classList);

      // Intercept SHOW
      el.classList.remove = function (...args) {
        if (args.includes('hidden') || args[0] === 'hidden') {
          _showGen++;
          console.log(`🔄 Show: ${cfg.id} (gen=${_showGen})`);
          if (_doShow) _doShow(cfg);
          return;
        }
        origRemove(...args);
      };

      // Intercept HIDE
      el.classList.add = function (...args) {
        if (args.includes('hidden') || args[0] === 'hidden') {
          const gen = _showGen;
          console.log(`🔄 Hide: ${cfg.id} (gen=${gen})`);
          
          // Immediately hide the overlay via DOM (no waiting for React)
          // This prevents the blur from lingering
          if (_overlayEl) _overlayEl.style.display = 'none';
          
          // Defer the full close (restore node + React state) to let
          // the current handler finish — it might show the next modal
          Promise.resolve().then(() => {
            if (_showGen === gen && _doClose) {
              _doClose();
            } else if (_showGen !== gen && _overlayEl) {
              // A new modal was shown — make sure overlay is visible
              _overlayEl.style.display = '';
            }
          });
          origAdd(...args);
          return;
        }
        origAdd(...args);
      };

      cleanups.push(() => {
        el.classList.remove = origRemove;
        el.classList.add = origAdd;
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, []);

  // When activeCfg changes, move the content node
  useEffect(() => {
    if (!activeCfg || !containerRef.current) return;

    const legacyModal = document.getElementById(activeCfg.id);
    if (!legacyModal) return;

    const contentNode = legacyModal.querySelector('.modal-content') || legacyModal.firstElementChild;
    if (!contentNode) return;

    movedRef.current = { contentNode, originalParent: legacyModal };
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(contentNode);
    contentNode.style.display = '';
    contentNode.style.maxHeight = '80vh';
    contentNode.style.overflowY = 'auto';

    // Ensure overlay is visible
    if (overlayRef.current) overlayRef.current.style.display = '';
  }, [activeCfg]);

  // ESC to close
  useEffect(() => {
    if (!activeCfg) return;
    const onKey = (e) => { if (e.key === 'Escape') closeOverlay(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeCfg, closeOverlay]);

  if (!activeCfg) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '20px',
      }}
    >
      <div style={{
        maxWidth: activeCfg.maxWidth,
        width: '100%',
        filter: 'drop-shadow(0 0 20px rgba(102, 126, 234, 0.15))',
      }}>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
