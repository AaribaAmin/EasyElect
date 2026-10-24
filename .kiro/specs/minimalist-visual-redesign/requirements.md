# Requirements Document

## Introduction

This feature is a cohesive visual redesign of the Easy Elect client application. The goal is a calm, minimalist look built on the existing token-based architecture: a soft pastel palette, generous spacing, clean and readable typography, consistently rounded buttons, and vector icons in place of emoji. Every page (Home, Voting, Tweets, Causes, Connect, Not Found) and shared surface (navigation brand, settings toggle, chatbot, page headers, cards) follows the same visual system so the experience feels unified.

The redesign reuses the existing CSS custom-property design tokens defined in `client/src/styles/global.css` and the shared `.card`, `.btn`, `.btn-primary`, and `.badge` classes. Changes are expressed by updating token values and shared classes first, so pages that already consume tokens inherit the new look without per-page rework. Both the light theme (`:root`) and dark theme (`[data-theme="dark"]`) are updated together. This is a presentation-layer change: no page routes, data flows, or feature behaviors change.

## Glossary

- **Client_App**: The React + TypeScript + Vite single-page application under `client/src`.
- **Design_Tokens**: The CSS custom properties defined in `client/src/styles/global.css` (prefixed `--color-*`, `--radius-*`, `--space-*`, `--shadow-*`, `--font-sans`) that drive all theming.
- **Light_Theme**: The token values declared under the `:root` selector in `global.css`.
- **Dark_Theme**: The token values declared under the `[data-theme="dark"]` selector in `global.css`.
- **Pastel_Palette**: A set of low-saturation, soft color token values used for backgrounds, surfaces, primary, and accent colors.
- **Shared_Card**: The reusable `.card` class in `global.css`, plus the home page section card in `HomePage.module.css`.
- **Shared_Button**: The reusable `.btn` and `.btn-primary` classes in `global.css`, and page-specific button styles such as `FollowButton.module.css`.
- **Icon_Set**: The collection of vector (SVG) icons that replace emoji across the Client_App.
- **Section_Card**: A home page card rendered from the `SECTIONS` array in `client/src/lib/sections.ts`.
- **Page_Header**: The shared `PageHeader` component (`client/src/components/PageHeader.tsx`) used at the top of feature pages.
- **Emoji_Glyph**: A Unicode emoji character used as a decorative or functional icon (for example the section icons, the brand mark, the settings toggle, and tweet stat markers).

## Requirements

### Requirement 1: Pastel color palette tokens

**User Story:** As a visitor, I want the app to use soft, muted colors instead of bright saturated ones, so that the interface feels calm and easy on the eyes.

#### Acceptance Criteria

1. THE Design_Tokens SHALL define a Pastel_Palette for the Light_Theme in which `--color-primary` and `--color-accent` each have an HSL saturation of at most 60% and an HSL lightness between 55% and 85%, replacing the current saturated blue (`#2563eb`) and purple (`#7c3aed`).
2. THE Design_Tokens SHALL define a Pastel_Palette for the Dark_Theme in which `--color-primary` and `--color-accent` each have an HSL saturation of at most 60%, while `--color-bg` and `--color-surface` have an HSL lightness of at most 20%.
3. THE Design_Tokens SHALL define `--color-bg`, `--color-surface`, and `--color-surface-alt` such that each adjacent pair differs by a contrast ratio in the range 1.03:1 to 1.25:1, so surfaces read as distinct without a hard-edged boundary.
4. WHERE a token value expresses the `--color-primary` or `--color-accent` color, THE Design_Tokens SHALL define it as a single solid color value and SHALL NOT use a multi-stop gradient definition.
5. THE Light_Theme SHALL maintain a contrast ratio of at least 4.5:1 between `--color-text` and `--color-bg` and between `--color-text` and `--color-surface`.
6. THE Dark_Theme SHALL maintain a contrast ratio of at least 4.5:1 between `--color-text` and `--color-bg` and between `--color-text` and `--color-surface`.
7. WHERE text is rendered on a primary-colored background using `--color-primary-contrast`, THE Client_App SHALL maintain a contrast ratio of at least 4.5:1 between the text and the `--color-primary` background.
8. IF a required Pastel_Palette token is undefined for the active theme, THEN THE Client_App SHALL apply the corresponding Light_Theme default token value so that no element renders with an unset color.

### Requirement 2: Per-card pastel coloring on the home page

**User Story:** As a visitor on the home page, I want each section card to have its own soft pastel color, so that the sections are visually distinct without being loud.

#### Acceptance Criteria

1. THE Design_Tokens SHALL define one soft pastel surface color token for each of the four Section_Cards (Voting, Tweets, Causes, Connect), such that each of the four tokens resolves to a different color value from the other three.
2. WHEN the home page renders the Section_Cards, THE Client_App SHALL apply each Section_Card's assigned pastel surface color token to that card's surface.
3. THE Client_App SHALL source each Section_Card's pastel color from a Design_Token or from a field on the `SECTIONS` metadata rather than from a hard-coded color literal in the page markup.
4. IF a Section_Card has no assigned pastel surface color token or the token fails to resolve, THEN THE Client_App SHALL render that card with the default card surface color used before this feature and SHALL still render the card with all its content visible.
5. WHILE the Dark_Theme is active, THE Client_App SHALL render each Section_Card with a dark-theme pastel surface color token that keeps card title, tagline, and description text at a contrast ratio of at least 4.5:1 against that card's surface color.
6. WHILE the Light_Theme is active, THE Client_App SHALL render each Section_Card's card title, tagline, and description text at a contrast ratio of at least 4.5:1 against that card's pastel surface color.

### Requirement 3: Evenly spaced, spacious home page card layout

**User Story:** As a visitor on the home page, I want the cards laid out evenly with generous spacing, so that the page feels open and uncluttered.

#### Acceptance Criteria

1. THE Client_App SHALL lay out the Section_Cards in a responsive grid whose rendered column widths are equal to one another within a tolerance of 1 pixel.
2. THE Client_App SHALL apply a gap between Section_Cards sourced from a spacing Design_Token (`--space-*`).
3. WHILE the viewport width is at or above 1024 pixels, THE Client_App SHALL display the four Section_Cards in a single row of four columns whose rendered widths are equal to one another within a tolerance of 1 pixel.
4. WHILE the viewport width is below 640 pixels, THE Client_App SHALL reflow the Section_Cards into a single column while applying the same spacing Design_Token (`--space-*`) gap used at wider viewports.
5. WHILE the viewport width is at or above 640 pixels and below 1024 pixels, THE Client_App SHALL display the Section_Cards in a two-column grid whose rendered column widths are equal to one another within a tolerance of 1 pixel.
6. THE Client_App SHALL apply internal padding to each Section_Card sourced from a spacing Design_Token (`--space-*`).
7. WHEN the grid reflows across any breakpoint, THE Client_App SHALL keep the vertical gap and the horizontal gap between Section_Cards equal to each other within a tolerance of 1 pixel.
8. IF a referenced spacing Design_Token (`--space-*`) resolves to no value, THEN THE Client_App SHALL apply a non-zero fallback gap and padding so that Section_Cards remain visually separated.

### Requirement 4: Vector icons replace emoji

**User Story:** As a visitor, I want crisp vector icons instead of emoji, so that the interface looks consistent and intentional across platforms.

#### Acceptance Criteria

1. THE Client_App SHALL render each of the four section icons as an Icon_Set vector icon rather than an Emoji_Glyph.
2. THE Client_App SHALL render the Page_Header icon as an Icon_Set vector icon rather than an Emoji_Glyph.
3. THE Client_App SHALL render the navigation brand mark as an Icon_Set vector icon rather than an Emoji_Glyph.
4. THE Client_App SHALL render the light/dark settings toggle indicator as an Icon_Set vector icon rather than an Emoji_Glyph.
5. THE Client_App SHALL render the chatbot launcher indicator as an Icon_Set vector icon rather than an Emoji_Glyph.
6. THE Client_App SHALL render the tweet like and repost markers as Icon_Set vector icons rather than Emoji_Glyphs.
7. WHERE an Icon_Set icon is purely decorative, THE Client_App SHALL mark the icon as hidden from assistive technology.
8. WHERE an Icon_Set icon is the only content of an interactive control, THE Client_App SHALL provide a non-empty accessible text label that describes the control's action for that control.
9. THE Client_App SHALL size Icon_Set icons using a defined icon sizing value so that all Icon_Set icons rendered within the same context display at identical width and height dimensions.
10. THE Client_App SHALL set each Icon_Set icon's color so it inherits or references a color Design_Token rather than a hard-coded color literal.
11. IF an Icon_Set vector icon referenced by any of the surfaces in criteria 1 through 6 fails to resolve or render, THEN THE Client_App SHALL display a fallback vector icon placeholder rather than an Emoji_Glyph or broken-image indicator, and SHALL preserve the surrounding layout.

### Requirement 5: Consistent rounded buttons

**User Story:** As a visitor, I want buttons to look the same on every page with soft rounded corners, so that interactive elements feel predictable and cohesive.

#### Acceptance Criteria

1. THE Shared_Button SHALL apply a corner radius sourced from a radius Design_Token (`--radius-*`), such that the computed border-radius equals the token value with zero hardcoded pixel overrides.
2. THE Client_App SHALL render every button and button-styled link across all pages with a corner radius whose computed border-radius equals a radius Design_Token value, with 0 elements using a non-token radius.
3. THE Client_App SHALL render every primary button across all pages using the `.btn-primary` style or tokens it references, such that background color, text color, and corner radius are identical across all instances.
4. WHEN a user hovers over a button, THE Client_App SHALL apply the hover treatment defined by the Shared_Button styles, producing an identical computed hover state (background and text color) for all buttons of the same variant.
5. WHEN a button receives keyboard focus, THE Client_App SHALL render a focus indicator defined in `global.css` with a minimum outline or ring thickness of 2px and a non-transparent color, visible against both light and dark backgrounds.
6. THE Client_App SHALL apply horizontal and vertical padding to buttons of the same variant using spacing Design_Tokens, such that all buttons of that variant have identical computed horizontal and vertical padding values.
7. IF a button definition references a radius, spacing, or color value that does not resolve to a defined Design_Token, THEN THE Client_App SHALL fall back to the Shared_Button default token values without rendering a hardcoded value.

### Requirement 6: Clean, readable typography

**User Story:** As a visitor, I want clean and readable text with comfortable spacing, so that content is easy to scan and read.

#### Acceptance Criteria

1. WHEN any page renders body text, THE Client_App SHALL apply the `--font-sans` Design_Token as the base font family.
2. WHEN any page renders body text, THE Client_App SHALL apply a computed body line-height of at least 1.5 and at most 1.8.
3. WHEN any page renders a long-form text block, THE Client_App SHALL constrain its maximum line width to a measure between 60 and 80 characters.
4. WHEN any page renders heading, body, or muted text, THE Client_App SHALL apply color exclusively from the `--color-text` and `--color-text-muted` Design_Tokens and SHALL NOT apply hard-coded color literals.
5. WHEN any page renders headings and body text, THE Client_App SHALL apply a type scale in which each heading level from the largest heading down to body text has a font size no smaller than the next-lower level, with the same size values reused for the same level across all pages.
6. IF a referenced typography Design_Token resolves to no value, THEN THE Client_App SHALL fall back to a defined default value for that property and SHALL continue rendering readable text.

### Requirement 7: Spacious, minimalist layout rhythm

**User Story:** As a visitor, I want consistent generous spacing throughout the app, so that every page feels open and minimalist.

#### Acceptance Criteria

1. THE Client_App SHALL source vertical and horizontal spacing between layout elements from spacing Design_Tokens (`--space-*`) rather than hard-coded length literals.
2. THE Client_App SHALL apply spacing between a Page_Header and the content that follows it that resolves to the same `--space-*` Design_Token computed value on every feature page.
3. THE Client_App SHALL apply spacing between stacked cards and between content groups that resolves to the same `--space-*` Design_Token computed value on every page.
4. THE Shared_Card SHALL apply a soft shadow sourced from a shadow Design_Token (`--shadow-sm` or `--shadow-md`) rather than a hard, high-contrast border alone.
5. WHERE a surface uses a border, THE Client_App SHALL source the border color from the `--color-border` Design_Token.

### Requirement 8: Cross-page visual consistency

**User Story:** As a visitor, I want every page to share the same visual style, so that the app feels like one cohesive product.

#### Acceptance Criteria

1. THE Client_App SHALL apply the same Pastel_Palette Design_Tokens, resolved to identical computed values for a given active theme, across the Home, Voting, Tweets, Causes, Connect, and Not Found pages.
2. THE Client_App SHALL render every card on every page using the Shared_Card class, such that each card resolves its background, border, corner radius, and spacing from the shared card Design_Tokens rather than from per-page literal values.
3. WHEN a feature page renders a Page_Header, THE Client_App SHALL display it with the same icon, title, and subtitle styling sourced from the shared Page_Header component on every page that uses it.
4. WHEN the active theme changes between Light_Theme and Dark_Theme, THE Client_App SHALL update colors on every page solely by flipping the `[data-theme]` attribute, with no page-specific color override required and all visible color changes applied within 200 milliseconds.
5. THE Client_App SHALL reuse the shared components and shared classes for cards, buttons, headers, and icons, such that for each of these element types there is exactly one shared styling source and no per-page style definition that overrides the shared source for the same element type.
6. WHERE a page introduces a visual element not covered by a shared class, THE Client_App SHALL style that element using only existing Pastel_Palette Design_Tokens, with no literal color, spacing, or radius values outside the defined token set.
7. IF a page references a Design_Token that is undefined or missing, THEN THE Client_App SHALL render that element using the shared fallback Design_Token and produce a visible indication that resolves to the shared system styling rather than leaving the element unstyled.

### Requirement 9: Preserve existing behavior and accessibility

**User Story:** As a user, I want the redesign to keep the app working and accessible, so that nothing I rely on breaks.

#### Acceptance Criteria

1. THE Client_App SHALL resolve all existing routes and navigation targets to the same destination pages as before the redesign.
2. THE Client_App SHALL preserve the action performed by each interactive control type (buttons, links, toggles, form inputs, chatbot) so each behaves the same as before the redesign.
3. WHILE the user has requested reduced motion via `prefers-reduced-motion: reduce`, THE Client_App SHALL NOT introduce any animation or transition that plays.
4. WHEN an interactive element is focused via keyboard, THE Client_App SHALL render a focus indicator visually distinct from the element's unfocused state using the focus style defined in `global.css`.
5. WHEN an interactive element is focused via keyboard, THE Client_App SHALL render a focus indicator with a contrast ratio of at least 3:1 against the adjacent background.
6. THE Client_App SHALL keep the existing automated test suite passing with zero failing tests after the redesign.
7. IF a visual element conveys information using color, THEN THE Client_App SHALL also convey that information through text or an Icon_Set icon so meaning is not carried by color alone.
