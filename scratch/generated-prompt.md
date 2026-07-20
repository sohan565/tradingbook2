Here's a complete, copy-paste-ready prompt that combines the 21st.dev UI upgrade plan with a performance optimization pass:

---

```markdown
# PROMPT: TRADINGBOOK UI MODERNIZATION + PERFORMANCE OPTIMIZATION

You are an expert Frontend Architect specializing in high-performance React trading
applications (Next.js 15 App Router, React 19, TypeScript, CSS Modules,
lightweight-charts v5). You are working on "Tradingbook" — a backtest trading
terminal with replay engine, journal, analytics dashboard, and accounts pages.

Work in two phases: PERFORMANCE FIRST, then UI COMPONENT UPGRADES. The app has
started feeling laggy, so do not add any UI polish until the performance pass is
complete — new components must land on a fast baseline.

---

## PHASE 1 — PERFORMANCE AUDIT & OPTIMIZATION (do this first)

The app feels sluggish, especially the /backtest page (~3,600 lines, single
component) during candle replay. Profile first, then fix. Apply these in order:

### 1.1 Re-render elimination
- Audit src/app/backtest/page.tsx: nearly all state lives in one component, so
  every candle tick re-renders the entire page (order panel, positions list,
  bottom table, toolbars). Extract stable subtrees into memoized child
  components (React.memo) with narrow props: OrderPanel, PositionsSidebar,
  OpenPositionsTable, TradeHistoryTable, PlaybackControls, TabsHeader.
- Wrap callbacks passed to children in useCallback and derived values
  (unrealized P&L totals, filtered/mapped lists) in useMemo so memoized
  children actually stay stable.
- The per-tick "update unrealized PnL for all positions" effect runs
  setOpenPositions on a setTimeout for every visibleCandles change — batch it,
  and skip the state update entirely when the computed values are unchanged.
- In Chart.tsx, the position overlay re-renders pills and SVG on every drag
  pointermove via setActiveDrag. Throttle pointermove updates with
  requestAnimationFrame so at most one state update happens per frame.

### 1.2 Replay engine efficiency
- Check how visibleCandles is derived per tick: it must not clone or re-slice
  the full candle array in ways that allocate on every step. Prefer
  series.update(lastCandle) over series.setData(allCandles) on the
  lightweight-charts series for each new bar — setData on every tick is a
  classic cause of replay lag.
- Verify indicators recompute incrementally (only the newest bar), not over the
  full history each tick.
- Confirm autoSave is debounced/throttled (it serializes positions, trades, and
  markers — JSON.stringify of large arrays every tick will stutter the replay).
- Remove any JSON.stringify-based deep comparisons in hot paths (there is one
  in the drawings history mouseup handler) — replace with shallow/reference
  checks or dirty flags.

### 1.3 Bundle & load performance
- Dynamic-import heavy, non-critical panels with next/dynamic: IndicatorPanel,
  ObjectTreePanel, DrawingSettingsModal, the analytics AI coach card, and the
  journal AI chat.
- Verify lightweight-charts and its addons are only imported by pages that use
  them, and check for accidental barrel-file imports pulling extra code.
- Run a production build and report bundle sizes per route before/after.

### 1.4 Measure and prove it
- Before changes: record a React Profiler trace of 10 seconds of replay at max
  speed with 2 open positions; note commit counts and durations.
- After changes: repeat the same trace and report the improvement numbers.
- Target: replay at max speed with drawings + 2 positions with no dropped
  frames; typing in any input must never lag.

---

## PHASE 2 — UI COMPONENT UPGRADES (21st.dev)

Context: the project uses NO Tailwind and NO component library — pure CSS
Modules over a well-built design-token system in globals.css (Linear/Vercel
aesthetic: CSS variables for surfaces, ink text hierarchy, indigo accent
#5b57e0, profit/loss/warning semantics, hairline borders, light+dark themes via
next-themes [data-theme], fonts: Outfit / Plus Jakarta Sans / JetBrains Mono).

### 2.0 Foundation (do once)
- Install Tailwind CSS v4 alongside the existing CSS Modules (they coexist in
  Next.js 15; do NOT convert existing pages). Map Tailwind's theme to the
  EXISTING CSS variables in globals.css so any component from 21st.dev
  (shadcn-style, React + Tailwind) automatically respects both themes.
  Existing pages/styles must remain pixel-identical after this step.

### 2.1 High impact — real gaps (implement in this order)
1. TOASTS (Sonner-style): the app has 10 alert() call sites across
   backtest-journal, accounts, and analytics, plus two hand-rolled one-off
   toasts (journal, accounts). Install one toast system, replace ALL alert()
   calls and both custom toasts. Success/error/info variants using the
   existing profit/loss/accent tokens.
2. CONFIRM DIALOG (alert-dialog): replace all browser confirm() calls (4 files:
   session delete, drawing clear, account delete, etc.) with an accessible
   dialog — focus trap, Esc to cancel, danger-styled confirm button.
3. STYLED SELECT: replace every native <select> (analytics filters, backtest
   chart-type picker) — native dropdowns ignore the dark theme. Keyboard
   navigable, themed via tokens.
4. DATA TABLE: upgrade the plain <table> in the backtest bottom panel (Open
   Positions / Trade History) to a data-table with column sorting, right-aligned
   tabular numerals (JetBrains Mono), and sticky header. PRESERVE the existing
   inline SL/TP editing behavior (namespaced editing state side-${id} /
   table-${id}, stopPropagation on input clicks) and the partial-close dropdown.
5. DATE-RANGE PICKER: replace native date inputs on analytics with a range
   picker including presets (Last 7/30/90 days, This month, All time).

### 2.2 Medium impact — polish
6. STAT/KPI CARDS: upgrade analytics bento tiles (Win Rate, Profit Factor,
   Expectancy) with sparklines, count-up animation, and delta badges.
7. SLIDERS: replace native range inputs (replay speed, drawing opacity).
8. TABS: replace hand-rolled tab buttons (bottom panel, position tool panel)
   with an accessible tabs primitive (arrow-key navigation).
9. EMPTY STATES: replace bare text divs ("No active open positions…") with
   icon + short copy + CTA button empty states.
10. AI CHAT: restyle the journal AI chat using an AI-chat component pattern —
    message list, streaming indicator, prompt input with send button.

### 2.3 Nice-to-have (only if time permits)
11. Command palette (Ctrl+K): jump to pages, switch symbol/timeframe, toggle
    panels.
12. Calendar component for the analytics daily-P&L heatmap.
13. Drag-and-drop file upload for the market-data CSV import.

### Explicitly DO NOT
- Do not use 21st.dev marketing components (heroes, pricing, testimonials,
  footers, sign-in pages, marquees, globes, shaders).
- Do not replace lightweight-charts with any charting component.
- Do not retrofit a full dashboard template — cherry-pick components only.
- Do not restyle or break the existing chart overlay (position pills, TP/SL
  drag, close-position x button) or the drawing tools.

---

## GLOBAL CONSTRAINTS
- TypeScript strict; npx tsc --noEmit must pass after every phase.
- Both light and dark themes must work for every new component (test both).
- All new components consume the existing CSS variables — no hard-coded hex.
- Accessibility: focus visible, Esc closes overlays, min 44x44px touch targets.
- After each numbered item, verify the affected flow end-to-end in the running
  app before moving to the next.
- Report at the end: perf before/after numbers, list of replaced primitives
  (alert/confirm/select/table counts), and any items intentionally skipped.
```

---

A few notes on choices I made in this prompt:

- **Performance is Phase 1, deliberately** — the lag you're feeling is almost certainly the single 3,600-line backtest component re-rendering everything on every replay tick, plus `setData`-style full chart refreshes and un-debounced autosave serialization. New UI components would inherit that lag, so the prompt forces the fix first and requires before/after profiler numbers so the AI can't just claim it's faster.
- **It encodes what we already fixed** — the namespaced SL/TP edit state, the overlay close button, and the drag/price-scale work are called out as "preserve, don't break" so a future AI session doesn't regress them.
- **The Tailwind foundation step** is included because 21st.dev components won't work without it, with the hard constraint that existing pages stay pixel-identical.