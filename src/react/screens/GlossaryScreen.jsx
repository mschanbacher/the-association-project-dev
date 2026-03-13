import React, { useState, useMemo, useCallback } from 'react';
import { GLOSSARY, getCategories, getCategoryEntries, searchGlossary } from '../../data/Glossary.js';

/**
 * GlossaryScreen - In-game encyclopedia and help system
 * 
 * Displays glossary entries organized by category with search functionality.
 * Can be opened from the sidebar or by clicking "?" icons throughout the UI.
 */
export default function GlossaryScreen() {
  const [selectedCategory, setSelectedCategory] = useState('stats');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntry, setExpandedEntry] = useState(null);
  
  const categories = useMemo(() => getCategories(), []);
  
  const entries = useMemo(() => {
    if (searchTerm.trim()) {
      return searchGlossary(searchTerm);
    }
    return getCategoryEntries(selectedCategory);
  }, [selectedCategory, searchTerm]);
  
  const currentCategory = GLOSSARY[selectedCategory];
  
  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
    setExpandedEntry(null);
  }, []);
  
  const toggleEntry = useCallback((key) => {
    setExpandedEntry(prev => prev === key ? null : key);
  }, []);
  
  return (
    <div style={{ 
      display: 'flex', 
      height: '100%',
      background: 'var(--color-bg)',
    }}>
      {/* Left sidebar - Categories */}
      <div style={{
        width: 200,
        borderRight: '1px solid var(--color-border)',
        padding: '16px 0',
        flexShrink: 0,
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '0 16px 16px',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Categories
        </div>
        
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              setSelectedCategory(cat.key);
              setSearchTerm('');
              setExpandedEntry(null);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              background: selectedCategory === cat.key && !searchTerm 
                ? 'var(--color-bg-selected)' 
                : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: selectedCategory === cat.key && !searchTerm
                ? 'var(--color-text)'
                : 'var(--color-text-secondary)',
              fontWeight: selectedCategory === cat.key && !searchTerm
                ? 'var(--weight-semi)'
                : 'var(--weight-normal)',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>
      
      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Search bar */}
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search glossary..."
            value={searchTerm}
            onChange={handleSearch}
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '10px 14px',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-raised)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
        </div>
        
        {/* Category header */}
        {!searchTerm && currentCategory && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              marginBottom: 8,
            }}>
              {currentCategory._category}
            </h2>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
            }}>
              {currentCategory._description}
            </p>
          </div>
        )}
        
        {/* Search results header */}
        {searchTerm && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semi)',
              color: 'var(--color-text-secondary)',
            }}>
              {entries.length} result{entries.length !== 1 ? 's' : ''} for "{searchTerm}"
            </h2>
          </div>
        )}
        
        {/* Entries list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(entry => (
            <GlossaryEntry
              key={entry.key}
              entry={entry}
              isExpanded={expandedEntry === entry.key}
              onToggle={() => toggleEntry(entry.key)}
              showCategory={!!searchTerm}
            />
          ))}
          
          {entries.length === 0 && (
            <div style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
            }}>
              No entries found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual glossary entry component
 */
function GlossaryEntry({ entry, isExpanded, onToggle, showCategory }) {
  return (
    <div
      style={{
        background: 'var(--color-bg-raised)',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {entry.short && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--color-accent)',
              minWidth: 48,
            }}>
              {entry.short}
            </span>
          )}
          <span style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-semi)',
            color: 'var(--color-text)',
          }}>
            {entry.name}
          </span>
          {showCategory && entry.categoryName && (
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              background: 'var(--color-bg-sunken)',
              padding: '2px 6px',
            }}>
              {entry.categoryName}
            </span>
          )}
        </div>
        <span style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}>
          {isExpanded ? '−' : '+'}
        </span>
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}>
          {/* Description */}
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            marginTop: 12,
            lineHeight: 1.6,
          }}>
            {entry.description}
          </p>
          
          {/* Formula */}
          {entry.formula && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Formula
              </div>
              <code style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                background: 'var(--color-bg-sunken)',
                padding: '8px 12px',
                color: 'var(--color-text)',
              }}>
                {entry.formula}
              </code>
            </div>
          )}
          
          {/* Example */}
          {entry.example && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Example
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
              }}>
                {entry.example}
              </p>
            </div>
          )}
          
          {/* Benchmark */}
          {entry.benchmark && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Benchmark
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
              }}>
                {entry.benchmark}
              </p>
            </div>
          )}
          
          {/* Tiers (for ratings) */}
          {entry.tiers && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Rating Tiers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(entry.tiers).map(([range, desc]) => (
                  <div key={range} style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-accent)',
                      minWidth: 48,
                    }}>
                      {range}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Interpretation (for win probability) */}
          {entry.interpretation && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                How to Read
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(entry.interpretation).map(([range, desc]) => (
                  <div key={range} style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-accent)',
                      minWidth: 60,
                    }}>
                      {range}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Factors list */}
          {entry.factors && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semi)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Key Factors
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
              }}>
                {entry.factors.map((factor, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Note */}
          {entry.note && (
            <p style={{
              marginTop: 12,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              fontStyle: 'italic',
            }}>
              Note: {entry.note}
            </p>
          )}
          
          {/* Related entries */}
          {entry.related && entry.related.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}>
                Related: {entry.related.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
