/**
 * Typed design tokens for the minimalist visual redesign.
 *
 * This module is the **single source of truth** for the redesign's value-level
 * tokens. The same values are mirrored into `client/src/styles/global.css` and
 * kept in lockstep by a parity test (`tokens.test.ts`), so the value-level
 * property tests (contrast, HSL bounds, card distinctness, type-scale
 * monotonicity, solid-color / no-gradient) read exactly what the stylesheet
 * ships.
 *
 * jsdom does not resolve the CSS `var()` cascade or perform layout, so the
 * property tests cannot read computed token values at runtime. Instead they
 * read these exported structures directly. Everything here is therefore shaped
 * for enumeration:
 *
 *   - `PALETTE` is keyed by theme, then by token name → hex value, so a test
 *     can iterate every palette token of a theme, or pick named pairs (e.g.
 *     `--color-text` vs `--color-bg`) to assert a contrast floor.
 *   - `CARD_TOKENS` is keyed by theme, then by the four `--card-*` token names,
 *     so a test can assert the four values of a theme are pairwise distinct.
 *   - `ICON_SIZE_TOKENS` maps the three `--icon-size-*` names to their rem
 *     values.
 *   - `TYPE_SCALE` is an ordered list from the largest heading down to body
 *     text, so a test can assert each level's size is no larger than the one
 *     above it (single-valued, monotonically non-increasing).
 *
 * All color values are single solid hex strings (no gradients) and are
 * consumable by the pure helpers in `../lib/color.ts` (`hexToHsl`,
 * `relativeLuminance`, `contrastRatio`), which accept hex input.
 */

/** The two themes the palette is defined for. */
export type ThemeName = "light" | "dark";

/** Names of the palette tokens defined per theme (the `--color-*` set). */
export type PaletteTokenName =
  | "--color-bg"
  | "--color-surface"
  | "--color-surface-alt"
  | "--color-border"
  | "--color-text"
  | "--color-text-muted"
  | "--color-primary"
  | "--color-primary-contrast"
  | "--color-primary-soft"
  | "--color-accent"
  | "--color-danger"
  | "--color-success"
  | "--color-warning";

/** Names of the four per-card pastel surface tokens. */
export type CardTokenName =
  | "--card-voting"
  | "--card-tweets"
  | "--card-causes"
  | "--card-connect";

/** Names of the icon-size tokens. */
export type IconSizeTokenName =
  | "--icon-size-sm"
  | "--icon-size-md"
  | "--icon-size-lg";

/** A single palette theme: every palette token name mapped to a hex value. */
export type PaletteTokens = Record<PaletteTokenName, string>;

/** The four per-card pastel tokens of one theme mapped to hex values. */
export type CardTokens = Record<CardTokenName, string>;

/**
 * The light and dark Pastel_Palette tokens.
 *
 * Values mirror the design's token tables exactly and are the same strings
 * written into `:root` and `[data-theme="dark"]` in `global.css`.
 *
 * Constraints encoded here (checked by `color.test.ts`):
 *   - light `--color-primary`/`--color-accent`: HSL S ≤ 60%, L ∈ [55%, 85%]
 *   - dark `--color-primary`/`--color-accent`: HSL S ≤ 60%
 *   - dark `--color-bg`/`--color-surface`: HSL L ≤ 20%
 *   - adjacent surfaces (bg↔surface, surface↔surface-alt) contrast ∈ [1.03, 1.25]
 *   - `--color-text`/`--color-text-muted` vs surfaces ≥ 4.5:1
 *   - `--color-primary-contrast` vs `--color-primary` ≥ 4.5:1
 *   - `--color-primary` vs every surface ≥ 3:1 (focus outline floor)
 */
export const PALETTE: Record<ThemeName, PaletteTokens> = {
  light: {
    "--color-bg": "#f4f6fb",
    "--color-surface": "#fbfcff",
    "--color-surface-alt": "#eaeef6",
    "--color-border": "#d7deec",
    "--color-text": "#232a39",
    "--color-text-muted": "#5c6678",
    "--color-primary": "#5f7fca",
    "--color-primary-contrast": "#0e1322",
    "--color-primary-soft": "#dfe6f7",
    "--color-accent": "#b089d1",
    "--color-danger": "#d4766f",
    "--color-success": "#6fb08a",
    "--color-warning": "#d0a46b",
  },
  dark: {
    "--color-bg": "#12161f",
    "--color-surface": "#191e2a",
    "--color-surface-alt": "#212736",
    "--color-border": "#2d3547",
    "--color-text": "#e9edf5",
    "--color-text-muted": "#9aa5b8",
    "--color-primary": "#8098d6",
    "--color-primary-contrast": "#0e1322",
    "--color-primary-soft": "#26314d",
    "--color-accent": "#b79ad8",
    "--color-danger": "#e58e86",
    "--color-success": "#79c79c",
    "--color-warning": "#e0b67e",
  },
};

/**
 * The four per-card pastel surface tokens per theme.
 *
 * Light values are pale (dark text clears 4.5:1); dark values are deep (light
 * text clears 4.5:1). The four tokens of each theme resolve to four distinct
 * values (Req 2.1).
 */
export const CARD_TOKENS: Record<ThemeName, CardTokens> = {
  light: {
    "--card-voting": "#e7eefb",
    "--card-tweets": "#e6f3ee",
    "--card-causes": "#fbeee6",
    "--card-connect": "#f1e9f7",
  },
  dark: {
    "--card-voting": "#1b2740",
    "--card-tweets": "#162b26",
    "--card-causes": "#33241a",
    "--card-connect": "#271b33",
  },
};

/**
 * Icon-size tokens (Req 4.9). Icons set `color: inherit` and use
 * `currentColor`, so color is sourced from the surrounding text; only the
 * dimensions are tokenized here.
 */
export const ICON_SIZE_TOKENS: Record<IconSizeTokenName, string> = {
  "--icon-size-sm": "1rem",
  "--icon-size-md": "1.5rem",
  "--icon-size-lg": "2.25rem",
};

/** One level of the type scale: a stable name and its single rem size. */
export interface TypeScaleLevel {
  /** The level's name, from the largest heading down to body text. */
  level: "h1" | "h2" | "h3" | "h4" | "body";
  /** The single font-size value for this level, in `rem`. */
  size: string;
}

/**
 * The type scale, ordered from the largest heading down to body text.
 *
 * Each level has exactly one size value reused across all pages, and the
 * sizes are monotonically non-increasing (Req 6.5, Property 15). Expressed in
 * `rem` so the sizes compare numerically after stripping the unit.
 */
export const TYPE_SCALE: readonly TypeScaleLevel[] = [
  { level: "h1", size: "2rem" },
  { level: "h2", size: "1.5rem" },
  { level: "h3", size: "1.25rem" },
  { level: "h4", size: "1.125rem" },
  { level: "body", size: "1rem" },
];

/** The two theme names, for tests that iterate over both themes. */
export const THEME_NAMES: readonly ThemeName[] = ["light", "dark"];

/** All palette token names, for enumeration in tests. */
export const PALETTE_TOKEN_NAMES: readonly PaletteTokenName[] = [
  "--color-bg",
  "--color-surface",
  "--color-surface-alt",
  "--color-border",
  "--color-text",
  "--color-text-muted",
  "--color-primary",
  "--color-primary-contrast",
  "--color-primary-soft",
  "--color-accent",
  "--color-danger",
  "--color-success",
  "--color-warning",
];

/** The four per-card pastel token names, for enumeration in tests. */
export const CARD_TOKEN_NAMES: readonly CardTokenName[] = [
  "--card-voting",
  "--card-tweets",
  "--card-causes",
  "--card-connect",
];

/** The three icon-size token names, for enumeration in tests. */
export const ICON_SIZE_TOKEN_NAMES: readonly IconSizeTokenName[] = [
  "--icon-size-sm",
  "--icon-size-md",
  "--icon-size-lg",
];

/**
 * Every token name → value pair across the palette, card, and icon-size sets,
 * flattened per theme.
 *
 * The parity test (2.2) iterates this to assert each token appears with the
 * same value in `global.css`. Icon-size tokens are theme-independent, so they
 * are included identically in both themes.
 */
export const ALL_TOKENS: Record<ThemeName, Record<string, string>> = {
  light: {
    ...PALETTE.light,
    ...CARD_TOKENS.light,
    ...ICON_SIZE_TOKENS,
  },
  dark: {
    ...PALETTE.dark,
    ...CARD_TOKENS.dark,
    ...ICON_SIZE_TOKENS,
  },
};

/**
 * The adjacent surface pairs whose contrast must stay in the soft [1.03, 1.25]
 * band (Req 1.3, Property 3), named by palette token so tests can look up the
 * values per theme.
 */
export const ADJACENT_SURFACE_PAIRS: ReadonlyArray<
  readonly [PaletteTokenName, PaletteTokenName]
> = [
  ["--color-bg", "--color-surface"],
  ["--color-surface", "--color-surface-alt"],
];
