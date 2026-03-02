import React, { useState } from 'react';

const navItems = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard', converted: true },
  { id: 'roster', icon: '👥', label: 'Roster', converted: true },
  { id: 'standings', icon: '🏆', label: 'Standings', converted: true },
  { id: 'schedule', icon: '📅', label: 'Schedule', converted: true },
  { id: 'finances', icon: '💰', label: 'Finances', action: 'openFinanceDashboard' },
  { id: 'scouting', icon: '🔍', label: 'Scouting', action: 'openScoutingModal' },
  { id: 'history', icon: '📜', label: 'History', action: 'openFranchiseHistory' },
  { id: 'coach', icon: '🎓', label: 'Coach', action: 'openCoachManagement' },
];

export function Sidebar({ activeScreen, onNavigate }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const handleClick = (item) => {
    if (item.converted) {
      onNavigate?.(item.id);
    } else if (item.action && window[item.action]) {
      // Call existing game function for unconverted screens
      window[item.action]();
    }
  };

  return (
    <nav style={{
      width: 'var(--sidebar-width)',
      minHeight: 'calc(100vh - var(--topbar-height))',
      background: 'var(--color-bg-raised)',
      borderRight: '1px solid var(--color-border-subtle)',
      padding: 'var(--space-4) var(--space-3)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
    }}>
      {navItems.map(item => {
        const isActive = item.converted && activeScreen === item.id;
        const isHovered = hoveredItem === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isActive ? 'var(--color-accent-light)' :
                          isHovered ? 'var(--color-bg-hover)' :
                          'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: 'var(--text-base)',
              fontWeight: isActive ? 'var(--weight-semi)' : 'var(--weight-medium)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) ease',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ fontSize: '1.1em', width: 24, textAlign: 'center' }}>
              {item.icon}
            </span>
            {item.label}
            {!item.converted && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 'var(--text-xs)',
                opacity: 0.4,
              }}>
                ↗
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
