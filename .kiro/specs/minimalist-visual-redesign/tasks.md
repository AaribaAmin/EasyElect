# Implementation Plan: Minimalist Visual Redesign

## Overview

This is a presentation-only, token-first redesign. The plan builds from the value-level core outward: first the pure color utility and the typed token module (the single source of truth that mirrors `global.css`), then the inline SVG icon system, then the token value changes in `global.css`, and finally the per-page wiring (metadata, home grid, header, emoji replacements, button consistency). Property and example/integration tests are placed next to the code they validate so regressions surface early. The existing Vitest suite staying green is a hard gate (Req 9.6), re-checked at the final verification task.

Implementation language is TypeScript + React (the design uses concrete `.ts`/`.tsx`, not pseudocode). Tooling already present: Vitest, `@testing-library/react`, jsdom, and `fast-check` — no new dependency is added.

Convention for property test tags (per design Testing Strategy):
`// Feature: minimalist-visual-redesign, Property N: {property text}` with `{ numRuns: 100 }` (higher for the icon-name space).

## Tasks

- [x] 1. Implement the WCAG color utility
  - [x] 1.1 Create `client/src/lib/color.ts` with `hexToHsl`, `relativeLuminance`, `contrastRatio`
    - Implement `hexToHsl(hex)` returning `{ h, s, l }` with `s`/`l` as percentages.
    - Implement `relativeLuminance` from linearized sRGB channels and `contrastRatio(a, b) = (L1 + 0.05) / (L2 + 0.05)` per the WCAG definition.
    - Accept hex input (3- and 6-digit); export pure functions with no side effects.
    - _Requirements: 1.3, 1.5, 1.6, 1.7, 2.5, 2.6, 5.5, 9.5_

  - [x] 1.2 Write property tests for the color utility in `client/src/lib/color.test.ts`
    - **Property 1: Pastel HSL bounds hold for constrained color tokens** — iterate `--color-primary`/`--color-accent` per theme, assert S≤60% and L in 55–85% (light) / S≤60% (dark).
    - **Property 2: Dark base surfaces stay dark** — assert HSL L≤20% for dark `--color-bg`/`--color-surface`.
    - **Property 3: Adjacent surfaces are softly distinct** — assert bg↔surface and surface↔surface-alt contrast in [1.03, 1.25] per theme.
    - **Property 5: Body and surface text meet the 4.5:1 readability floor** — assert text/muted vs bg/surface/card-* ≥ 4.5:1.
    - **Property 6: Text on primary meets the 4.5:1 floor** — assert `--color-primary-contrast` vs `--color-primary` ≥ 4.5:1 per theme.
    - **Property 14: Focus outline contrast floor holds on every surface** — assert `--color-primary` vs each surface/card token ≥ 3:1.
    - Include sanity properties: `contrastRatio(a,b) === contrastRatio(b,a)` and `contrastRatio(a,a) === 1`.
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 2.5, 2.6, 5.5, 9.5**

- [x] 2. Create the typed token module (single source of truth)
  - [x] 2.1 Create `client/src/styles/tokens.ts` mirroring the committed token values
    - Export light and dark palette tokens, four `--card-*` tokens per theme, `--icon-size-sm/md/lg`, and the type-scale values exactly as specified in the design's token tables.
    - Structure values so `color.test.ts` and `tokens.test.ts` can enumerate token names and pairs.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 4.9, 6.5_

  - [x] 2.2 Write property + parity tests in `client/src/styles/tokens.test.ts`
    - **Property 4: Primary and accent are single solid colors** — assert values parse as solid color (hex/`rgb`/`hsl`) with no gradient function.
    - **Property 7: Missing tokens resolve to a defined non-empty default** — assert the `var(name, fallback)` convention yields a non-empty (non-zero for spacing) fallback over the token-name set.
    - **Property 8: The four per-card pastel tokens are mutually distinct** — assert the four `--card-*` tokens are pairwise different per theme.
    - **Property 15: The type scale is monotonically non-increasing and single-valued per level** — assert font-size(level_i) ≥ font-size(level_{i+1}) and one value per level.
    - **Parity test:** every token in `tokens.ts` appears with the same value in `global.css` (parsed as text).
    - **Validates: Requirements 1.4, 1.8, 2.1, 3.8, 5.7, 6.5, 6.6, 8.7**

- [x] 3. Build the inline SVG icon system
  - [x] 3.1 Create `client/src/components/icons/types.ts`
    - Define the `IconName` union (voting, tweets, causes, connect, brand, sun, moon, chat, like, repost, info, fallback) and `IconProps` as a discriminated union (`DecorativeProps | LabeledProps`) enforcing a non-empty `label` when `decorative === false`.
    - _Requirements: 4.7, 4.8_

  - [x] 3.2 Create `client/src/components/icons/glyphs.tsx`
    - Define `GLYPHS: Record<IconName, ReactNode>` with inline `<path>`/`<g>` bodies for every name, including `fallback`.
    - Use `currentColor` for fill/stroke; add no runtime dependency.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10, 4.11_

  - [x] 3.3 Create `client/src/components/icons/Icon.module.css`
    - `.icon { width/height: var(--icon-size-md, ...); color: inherit; }` plus `.sm/.md/.lg` mapping to `--icon-size-sm/md/lg`.
    - No hardcoded color literal; rely on `inherit`/`currentColor`.
    - _Requirements: 4.9, 4.10_

  - [x] 3.4 Create `client/src/components/icons/Icon.tsx`
    - Render `<svg viewBox="0 0 24 24" focusable="false">` with `GLYPHS[name] ?? GLYPHS.fallback`.
    - Apply size class from the `size` prop; apply `aria-hidden` when decorative, `role="img"` + `aria-label` when labeled.
    - _Requirements: 4.7, 4.8, 4.9, 4.11_

  - [x] 3.5 Write property tests for the Icon component in `client/src/components/icons/Icon.test.tsx`
    - **Property 11: Icon accessibility is correct by role** — decorative → `aria-hidden="true"` and no accessible name; labeled → non-empty `aria-label` via `role="img"`.
    - **Property 12: Icons of the same size are dimensionally identical** — same `size` prop yields the same size class mapping to one `--icon-size-*` token.
    - **Property 13: Icon rendering always produces a vector, falling back on unknown names** — any name (including names outside the union) renders an `<svg>`, unknown → fallback glyph, never emoji/broken image, siblings preserved.
    - **Validates: Requirements 4.7, 4.8, 4.9, 4.11**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update design tokens and shared classes in `global.css`
  - [x] 5.1 Replace light-theme (`:root`) and dark-theme (`[data-theme="dark"]`) palette values
    - Apply the new pastel palette, four `--card-*` tokens per theme, and `--icon-size-sm/md/lg`, matching `tokens.ts` exactly (keeps the parity test green).
    - Keep `--color-primary`/`--color-accent` as single solid colors (no gradient).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 4.9_

  - [x] 5.2 Apply `var(name, light-default)` fallbacks and token-sourced shared classes
    - Add light-theme default as the `var()` second argument wherever a token is consumed in `.card`, `.btn`, `.btn-primary`, `.badge`, and new styles.
    - Standardize `.btn`/`.btn-primary` radius (`--radius-*`), padding (`--space-*`), hover, and a `:focus-visible` outline ≥ 2px in a non-transparent token color.
    - Card soft shadow from `--shadow-sm`/`--shadow-md`; border color from `--color-border`.
    - Add/confirm the `prefers-reduced-motion: reduce` rule nulls transitions/animations.
    - _Requirements: 1.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.6, 7.1, 7.4, 7.5, 8.2, 8.5, 8.7, 9.3_

  - [x] 5.3 Set typography and spacing rhythm tokens in `global.css`
    - `body` uses `var(--font-sans)` base family and body line-height in [1.5, 1.8]; long-form prose container measure 60–80ch.
    - Heading/body/muted colors reference only `--color-text`/`--color-text-muted`; apply the single-valued, non-increasing type scale.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [x] 5.4 Write CSS-invariant property tests in `client/src/styles/css-invariants.test.ts`
    - **Property 10: Styling values are token-sourced, not hardcoded literals** — parse shared classes, Icon styles, and changed page modules; assert color/spacing/radius/shadow declarations reference `var(--...)` with no literals; text color only `--color-text`/`--color-text-muted`; border only `--color-border`.
    - **Property 16: Grid gaps are symmetric across every breakpoint** — assert a single `gap` value from one `--space-*` token (no asymmetric row/column split) at each breakpoint.
    - **Validates: Requirements 2.3, 3.7, 4.10, 5.1, 5.2, 5.6, 6.4, 7.1, 7.5, 8.2, 8.5, 8.6**

- [x] 6. Retype SECTIONS metadata and PageHeader
  - [x] 6.1 Update `client/src/lib/sections.ts`
    - Change `SectionMeta.icon` from `string` to `IconName`; add optional `color?: string` naming a per-card token (e.g. `"--card-voting"`).
    - Replace emoji literals with icon names; assign each section its `--card-*` token.
    - _Requirements: 2.1, 2.3, 4.1_

  - [x] 6.2 Update `client/src/components/PageHeader.tsx`
    - Retype `icon?: string` → `icon?: IconName`; render `<Icon name={icon} decorative />` instead of an emoji span.
    - _Requirements: 4.2, 8.3_

  - [x] 6.3 Write property test for SECTIONS color references in `client/src/styles/css-invariants.test.ts`
    - **Property 9: Section card colors are token references, never literals** — every `SECTIONS` entry with a `color` matches `/^--/` and is not a color literal.
    - **Validates: Requirements 2.3**

- [x] 7. Apply the home-page grid and per-card coloring
  - [x] 7.1 Update `client/src/pages/HomePage.module.css` responsive grid
    - Explicit `grid-template-columns`: `repeat(4,1fr)` ≥1024px, `repeat(2,1fr)` 640–1023px, `1fr` <640px.
    - Single `gap: var(--space-5, ...)` for both axes; card padding `var(--space-5, ...)` with non-zero fallbacks.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 7.2 Update `client/src/pages/HomePage.tsx` to render icons and per-card backgrounds
    - Render `<Icon name={s.icon} decorative />`; set card background via `var(section.color, var(--color-surface))` sourced from metadata (no literal).
    - _Requirements: 2.2, 2.3, 2.4, 4.1_

  - [x] 7.3 Write example tests for per-card application and grid in `client/src/pages/HomePage.test.tsx`
    - Per-card application (2.2, 2.4): each card's background references its mapped `--card-*` token; a section with undefined `color` falls back to `var(--color-surface)` with title/tagline/description present.
    - Grid breakpoints (3.1–3.6): parse `HomePage.module.css` asserting `repeat(4,1fr)`/`repeat(2,1fr)`/`1fr` and `gap`/`padding` reference `--space-*`.
    - _Requirements: 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 8. Replace remaining emoji with icons across shared surfaces
  - [x] 8.1 Replace the brand mark in `client/src/components/Layout.tsx`
    - Render `<Icon name="brand" decorative />` for the navigation brand mark.
    - _Requirements: 4.3, 8.3_

  - [x] 8.2 Replace the theme indicator in `client/src/components/SettingsToggles.tsx`
    - Render `<Icon name={theme === "dark" ? "moon" : "sun"} decorative />`; keep the existing `aria-label` on the button; align button radius/padding/focus with `.btn`.
    - _Requirements: 4.4, 5.1, 5.6, 9.7_

  - [x] 8.3 Replace the chatbot launcher glyph in `client/src/components/chatbot/Chatbot.tsx`
    - Render `<Icon name="chat" decorative />` on the launcher (button already labeled).
    - _Requirements: 4.5_

  - [x] 8.4 Replace tweet markers in `client/src/features/tweets/TweetCard.tsx`
    - Render `<Icon name="like" .../>`, `name="repost"`, and `name="info"` for the added-context marker; keep labels/text so meaning is not color-only.
    - _Requirements: 4.6, 9.7_

  - [x] 8.5 Confirm FollowButton conforms to shared button tokens in `client/src/features/voting/FollowButton.module.css`
    - Ensure radius/padding/color come from tokens (keep the intentional full-round `999px` pill variant, free of color literals).
    - _Requirements: 5.1, 5.2, 5.6, 5.7_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add example and integration tests for cross-cutting criteria
  - [x] 10.1 Write icons-replace-emoji tests
    - Render Home, a `PageHeader`, `Layout`, `SettingsToggles`, `Chatbot`, `TweetCard`; assert an `<svg>` at each surface and the previously used emoji codepoints (🗳️ 💬 🎯 🤝 🌙 ☀️ ♥ 🔁 ℹ️) are absent from DOM text; assert `Icon.module.css` sets `color: inherit` and glyphs use `currentColor`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10_

  - [x] 10.2 Write button-consistency tests
    - Assert primary buttons across pages all carry `.btn-primary` (single source) and exactly one hover rule per variant exists in `global.css`.
    - _Requirements: 5.3, 5.4_

  - [x] 10.3 Write typography and spacing-rhythm tests
    - Parse `global.css`: `body` uses `var(--font-sans)`, line-height ∈ [1.5, 1.8], long-form container 60–80ch; `PageHeader` margin-bottom is one `--space-*` token; stacked-card/group gaps reference one `--space-*` token; `.card` box-shadow references a `--shadow-*` token.
    - _Requirements: 6.1, 6.2, 6.3, 7.2, 7.3, 7.4_

  - [x] 10.4 Write cross-page consistency tests
    - Assert palette tokens are defined only in `global.css` (no page module redefines `--color-*`); render two pages' `PageHeader` and assert shared structure/classes; toggle theme and assert `documentElement` `data-theme` flips with colors token-driven.
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.5 Write behavior-preservation tests
    - Assert every route renders its page and that theme/mode toggles, `FollowButton`, and chatbot submit still perform their actions.
    - _Requirements: 9.1, 9.2_

  - [x] 10.6 Write reduced-motion and focus tests
    - Assert the `prefers-reduced-motion` rule nulls transitions/animations; assert `:focus-visible` outline differs from the unfocused state; assert color-coded states also carry text or a labeled icon.
    - _Requirements: 9.3, 9.4, 9.7_

- [x] 11. Final verification - confirm the suite is green
  - Run `npm run test`, `npm run typecheck`, and `npm run build` (from `client/`); fix any failure until all three pass with zero failing tests, confirming the existing suite stays green.
  - _Requirements: 9.6_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP, but they encode the design's 16 correctness properties and the example/integration coverage; skipping them weakens the Req 9 accessibility/behavior guarantees.
- Each task references specific requirement clauses and, where applicable, the exact correctness property it validates for traceability.
- Property tests use `fast-check` at ≥100 iterations and carry the required `// Feature: minimalist-visual-redesign, Property N: ...` tag.
- The parity test (2.2) keeps `tokens.ts` and `global.css` in lockstep, so value-level property tests reflect what the stylesheet ships.
- Checkpoints validate incrementally; the final task re-checks the hard gate (Req 9.6) with test + typecheck + build.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["2.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["1.2", "2.2", "3.4", "5.1"] },
    { "id": 3, "tasks": ["3.5", "5.2", "5.3", "6.1", "6.2"] },
    { "id": 4, "tasks": ["5.4", "6.3", "7.1", "7.2", "8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 5, "tasks": ["7.3", "10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] }
  ]
}
```
