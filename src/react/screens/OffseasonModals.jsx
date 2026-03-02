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
  { id: 'seasonEndModal',             maxWidth: 1000 },
  { id: 'championshipPlayoffModal',   maxWidth: 1000 },
  { id: 'playoffModal',               maxWidth: 1000 },
  { id: 'developmentModal',           maxWidth: 800 },
  { id: 'financialTransitionModal',   maxWidth: 900 },
  { id: 'complianceModal',            maxWidth: 700 },
  { id: 'draftResultsModal',          maxWidth: 1200 },
  { id: 'freeAgencyModal',            maxWidth: 1100 },
  { id: 'collegeGradFAModal',         maxWidth: 1000 },
  { id: 'financeDashboardModal',      maxWidth: 1100 },
  { id: 'rosterModal',                maxWidth: 1600 },
  { id: 'bracketViewerModal',         maxWidth: 1400 },
  { id: 'allStarModal',               maxWidth: 900 },
  { id: 'injuryModal',                maxWidth: 700 },
  { id: 'contractDecisionsModal',     maxWidth: 900 },
  { id: 'coachModal',                 maxWidth: 1100 },
  { id: 'calendarModal',              maxWidth: 1100 },
];

// Module-level state for the classList interceptors
let _showGen = 0;       // Incremented on every show — used to invalidate stale closes
let _doClose = null;    // Points to the React close function
let _doShow = null;     // Points to the React show function

export function OffseasonModals() {
  const { refresh } = useGame();
  const [activeCfg, setActiveCfg] = useState(null);
  const containerRef = useRef(null);
  const movedRef = useRef({ contentNode: null, originalParent: null });

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
    restoreNode();
    setActiveCfg(null);
    refresh?.();
  }, [restoreNode, refresh]);

  // Show a modal in the overlay
  const showModal = useCallback((cfg) => {
    // Restore any previously moved node first
    restoreNode();
    setActiveCfg(cfg);
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
          // Capture current gen — if a new show happens before our
          // deferred close, the gen will have changed and we skip.
          const gen = _showGen;
          console.log(`🔄 Hide: ${cfg.id} (gen=${gen})`);
          // Defer close to let the current handler finish
          // (it might show the next modal after hiding this one)
          Promise.resolve().then(() => {
            if (_showGen === gen && _doClose) {
              // No new modal was shown since this hide — close the overlay
              _doClose();
            }
            // else: a new show already replaced this, skip the close
          });
          // Always update the legacy element's class for consistency
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
      onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div style={{
        maxWidth: activeCfg.maxWidth,
        width: '100%',
        animation: 'slideUp 0.2s ease-out',
      }}>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
