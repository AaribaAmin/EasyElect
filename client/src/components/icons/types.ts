// client/src/components/icons/types.ts

/**
 * The closed set of named glyphs the Icon component can render.
 * Each name maps to an inline SVG body in `glyphs.tsx`; `fallback` is the
 * placeholder rendered when a name does not resolve (Req 4.11).
 */
export type IconName =
  | "voting" // ballot box  (section Voting, page header)
  | "tweets" // chat bubble (section Tweets)
  | "causes" // target      (section Causes)
  | "connect" // handshake  (section Connect)
  | "brand" // brand mark (ballot)
  | "sun" // light theme indicator
  | "moon" // dark theme indicator
  | "chat" // chatbot launcher
  | "like" // tweet like (heart)
  | "repost" // tweet repost
  | "info" // "added context" marker
  | "fallback"; // placeholder when a name does not resolve

/**
 * A purely decorative icon: hidden from assistive technology (Req 4.7).
 * A `label` is disallowed here so decorative usage stays label-free.
 */
type DecorativeProps = { decorative?: true; label?: never };

/**
 * A meaningful icon that is the sole content of an interactive control:
 * it must carry a non-empty accessible label (Req 4.8).
 */
type LabeledProps = { decorative: false; label: string };

/**
 * Props for the Icon component.
 *
 * The `DecorativeProps | LabeledProps` discriminated union makes it a compile-time
 * type error to render a non-decorative icon (`decorative={false}`) without a
 * `label`, enforcing Req 4.8 at the type level.
 */
export type IconProps = {
  name: IconName;
  size?: "sm" | "md" | "lg"; // maps to --icon-size-* tokens
  className?: string;
} & (DecorativeProps | LabeledProps);
