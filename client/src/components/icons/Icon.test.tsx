import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { render } from "@testing-library/react";
import Icon from "./Icon";
import type { IconName } from "./types";

/**
 * Property tests for the Icon component (Task 3.5).
 *
 * The icon-name space is small and closed, so these properties sample it (and,
 * for Property 13, an unbounded space of arbitrary strings outside the union)
 * at a higher iteration count — `{ numRuns: 200 }` — to exercise the mapping and
 * the fallback path thoroughly.
 *
 * **Validates: Requirements 4.7, 4.8, 4.9, 4.11**
 */

/** The closed set of valid icon names (mirrors the `IconName` union). */
const ICON_NAMES: readonly IconName[] = [
  "voting",
  "tweets",
  "causes",
  "connect",
  "brand",
  "sun",
  "moon",
  "chat",
  "like",
  "repost",
  "info",
  "fallback",
];

/** The three size tokens the component maps to `--icon-size-*`. */
const SIZES = ["sm", "md", "lg"] as const;

/** An arbitrary over the valid icon-name union. */
const iconNameArb = fc.constantFrom(...ICON_NAMES);

/** An arbitrary over the three supported sizes. */
const sizeArb = fc.constantFrom(...SIZES);

/** The single `<svg>` the component is expected to render. */
function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  return svg as unknown as SVGSVGElement;
}

describe("Icon — Property 11: accessibility is correct by role", () => {
  // Feature: minimalist-visual-redesign, Property 11: Icon accessibility is correct by role — decorative → aria-hidden="true" and no accessible name; labeled (decorative={false}, non-empty label) → non-empty aria-label via role="img".
  it("decorative icons are aria-hidden with no accessible name", () => {
    fc.assert(
      fc.property(iconNameArb, sizeArb, (name, size) => {
        const { container, unmount } = render(
          <Icon name={name} size={size} decorative />
        );
        const svg = svgOf(container);

        // Hidden from assistive technology (Req 4.7).
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        // No accessible name: no label and not exposed as an image role.
        expect(svg.getAttribute("aria-label")).toBeNull();
        expect(svg.getAttribute("role")).toBeNull();

        unmount();
      }),
      { numRuns: 200 }
    );
  });

  it("labeled icons expose role=img and a non-empty aria-label", () => {
    const labelArb = fc
      .string({ minLength: 1, maxLength: 40 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(iconNameArb, sizeArb, labelArb, (name, size, label) => {
        const { container, unmount } = render(
          <Icon name={name} size={size} decorative={false} label={label} />
        );
        const svg = svgOf(container);

        // Exposed as an image with a meaningful, non-empty name (Req 4.8).
        expect(svg.getAttribute("role")).toBe("img");
        const ariaLabel = svg.getAttribute("aria-label");
        expect(ariaLabel).toBe(label);
        expect((ariaLabel ?? "").length).toBeGreaterThan(0);
        // A labeled icon must not also be hidden from AT.
        expect(svg.getAttribute("aria-hidden")).toBeNull();

        unmount();
      }),
      { numRuns: 200 }
    );
  });
});

describe("Icon — Property 12: icons of the same size are dimensionally identical", () => {
  // Feature: minimalist-visual-redesign, Property 12: Icons of the same size are dimensionally identical — same `size` prop yields the same size class mapping to one --icon-size-* token (assert both SVGs carry the same CSS module size class).
  it("same size prop yields the same size class across any two icons", () => {
    fc.assert(
      fc.property(
        iconNameArb,
        iconNameArb,
        sizeArb,
        (nameA, nameB, size) => {
          const a = render(<Icon name={nameA} size={size} decorative />);
          const b = render(<Icon name={nameB} size={size} decorative />);

          const classesA = new Set(svgOf(a.container).getAttribute("class")!.split(/\s+/));
          const classesB = new Set(svgOf(b.container).getAttribute("class")!.split(/\s+/));

          // Both carry the base `.icon` class and an identical set of classes,
          // so the generated size class (mapping to one --icon-size-* token) is
          // the same for both.
          expect([...classesA].sort()).toEqual([...classesB].sort());
          expect(classesA.size).toBeGreaterThan(0);

          a.unmount();
          b.unmount();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("different sizes map to different size classes", () => {
    fc.assert(
      fc.property(iconNameArb, (name) => {
        const rendered = SIZES.map((size) => {
          const { container, unmount } = render(
            <Icon name={name} size={size} decorative />
          );
          const classes = svgOf(container).getAttribute("class")!.split(/\s+/);
          unmount();
          return classes;
        });

        // The three size variants produce three distinct class strings: the
        // size-specific class differs per size while the base class is shared.
        const joined = rendered.map((c) => [...c].sort().join(" "));
        expect(new Set(joined).size).toBe(SIZES.length);
      }),
      { numRuns: 200 }
    );
  });
});

describe("Icon — Property 13: rendering always produces a vector, falling back on unknown names", () => {
  // Feature: minimalist-visual-redesign, Property 13: Icon rendering always produces a vector, falling back on unknown names — any name (including names outside the union, pass via cast) renders an <svg>, unknown → fallback glyph, never emoji/broken image; adjacent sibling nodes preserved.

  /** The exact inner markup of the fallback glyph, rendered on its own. */
  function fallbackInnerHtml(): string {
    const { container, unmount } = render(<Icon name="fallback" decorative />);
    const html = svgOf(container).innerHTML;
    unmount();
    return html;
  }

  it("any valid name renders exactly one <svg> vector (no emoji/img)", () => {
    fc.assert(
      fc.property(iconNameArb, sizeArb, (name, size) => {
        const { container, unmount } = render(
          <Icon name={name} size={size} decorative />
        );

        // A single inline SVG vector — never an <img> (which could 404/break).
        expect(container.querySelectorAll("svg")).toHaveLength(1);
        expect(container.querySelector("img")).toBeNull();

        const svg = svgOf(container);
        expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
        // The glyph body is itself vector markup, never text/emoji.
        expect(svg.textContent ?? "").toBe("");
        expect(svg.childElementCount).toBeGreaterThan(0);

        unmount();
      }),
      { numRuns: 200 }
    );
  });

  it("names outside the union render the fallback glyph, still a vector", () => {
    const expectedFallback = fallbackInnerHtml();

    // Names that are NOT part of the IconName union.
    const unknownNameArb = fc
      .string({ maxLength: 24 })
      .filter((s) => !(ICON_NAMES as readonly string[]).includes(s));

    fc.assert(
      fc.property(unknownNameArb, sizeArb, (unknown, size) => {
        const { container, unmount } = render(
          // Names outside the union are passed via a cast (Req 4.11).
          <Icon name={unknown as IconName} size={size} decorative />
        );

        // Still a single inline SVG, never an <img> or emoji text.
        expect(container.querySelectorAll("svg")).toHaveLength(1);
        expect(container.querySelector("img")).toBeNull();

        const svg = svgOf(container);
        expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
        // Unknown name resolves to the fallback glyph specifically.
        expect(svg.innerHTML).toBe(expectedFallback);
        expect(svg.textContent ?? "").toBe("");

        unmount();
      }),
      { numRuns: 200 }
    );
  });

  it("preserves adjacent sibling nodes around the icon", () => {
    fc.assert(
      fc.property(
        fc.oneof(iconNameArb, fc.string({ maxLength: 16 })),
        (name) => {
          const { container, unmount } = render(
            <div>
              <span data-testid="before">before</span>
              <Icon name={name as IconName} decorative />
              <span data-testid="after">after</span>
            </div>
          );

          const root = container.firstElementChild!;
          const children = Array.from(root.children);

          // The icon renders between its siblings without disturbing them:
          // [span#before, svg, span#after] in order.
          expect(children).toHaveLength(3);
          expect(children[0].getAttribute("data-testid")).toBe("before");
          expect(children[1].tagName.toLowerCase()).toBe("svg");
          expect(children[2].getAttribute("data-testid")).toBe("after");
          expect(children[0].textContent).toBe("before");
          expect(children[2].textContent).toBe("after");

          unmount();
        }
      ),
      { numRuns: 200 }
    );
  });
});
