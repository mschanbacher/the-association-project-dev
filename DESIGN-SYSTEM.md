# The Association Project — Design System Reference

## Core Principles (Dieter Rams)
- **Zero border-radius** on everything. No exceptions.
- **No emoji** in any user-facing UI. Use typography, color, and layout to communicate.
- **Minimal formatting** — information density through clean tables and tight spacing, not decoration.
- **Team identity** through color, not logos or icons.

## Brand Color
- `#F04E2C` — used for pre-team-selection UI (NewGameFlow "New Game" button, "PROJECT" text)
- Once a team is selected, the team's accent color replaces the brand color everywhere

## Team Colors
- Defined in `src/react/styles/TeamColors.js` (258 teams)
- Each team has `primary` and `secondary` (highlight) colors
- **Left border pattern**: team cards show a 3px left border in primary color; when selected/active, shifts to secondary
- Applied via CSS variables `--color-accent` (primary) and related tokens set at runtime

## Typography
| Role | Size | Weight | Tracking | Font |
|------|------|--------|----------|------|
| Page title | 16-22px | 700 | -0.02em | DM Sans |
| Section label | 10px | 600 | 0.06-0.12em | DM Sans, uppercase |
| Body | 13-14px | 400-500 | — | DM Sans |
| Mono (stats/scores/dates/money) | — | 600-700 | — | JetBrains Mono |

## Color Usage
- **Team accent**: "this is yours" — sidebar highlights, your row in tables, interactive elements
- **Semantic green** (`--color-win`): positive state (wins, cap space available, ≥2 players at position)
- **Semantic red** (`--color-loss`): negative state (losses, over cap, 0 players at position)
- **Semantic gold** (`--color-warning`): caution (1 player at position, expiring contracts)
- **Semantic blue** (`--color-info`): neutral informational state (DPE replacement modals, league news alerts, system notifications)
- **Tier colors**: `--color-tier1` (gold), `--color-tier2` (grey), `--color-tier3` (bronze)
- Semantic colors are constant regardless of team — never change based on team identity
- **Away team**: always `#6B6B65` (neutral grey) in watch game to avoid same-color conflicts

## Spacing
- `--gap` (8px) as standard gap
- Padding: 12-16px for cards, 20-28px for modal bodies
- 4-8px between related items within a group

## Borders
- Zero radius everywhere
- 1px for standard divisions
- 2px for major sections
- 3px for state indicators (left borders: tier color, decision state, team identity)

## Tables (preferred over cards for data)
- Header: 10px uppercase, 600 weight, tertiary color
- Rows: 1px border-subtle between
- Clickable rows: hover to accent-bg
- Mono for all numbers, `font-variant-numeric: tabular-nums`

## Filters / Toggles
- Flat button groups, no border-radius
- Selected: filled accent background, white/inverse text
- Unselected: transparent background, secondary text

## Modals
- No emoji in headers
- Action buttons in header bar (right side) for primary modals
- z-index hierarchy: base modals 1100, playoff modal 1300, box score 1400

## Interactive Patterns
- **Win probability arc**: semicircular SVG gauge, 16px stroke, solid fill + diagonal hatch (3px lines, 50% opacity) for remainder, split at midpoint to avoid SVG large-arc-flag bugs
- **Coach avatar**: team accent square with large white initials + small geometric archetype mark (▲■◆●▶△▼◎)
- **Position counts**: green (≥2), gold (=1), red (=0)
- **Calendar**: 2-column month grid (420px min), 9px opponent text, win/loss dots

## League Names
- T1: National Basketball Association (NBA)
- T2: North American Regional Basketball League (NARBL)
- T3: North American Metro Basketball League (MBL)

## What NOT to Do
- No emoji anywhere in user-facing code (engines or components)
- No hardcoded hex colors — always use CSS variables
- No `border-radius` on any element
- No engine color functions (`getRatingColor`, `getAttrColor`) — components own their own color logic via CSS variables
- No `large-arc-flag=1` in SVG arcs — split at midpoint instead
