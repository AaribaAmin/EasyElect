import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TweetCard from "./TweetCard";
import { SettingsProvider } from "../../context/SettingsContext";
import type { News_Item } from "../../types/domain";

/**
 * Unit tests for task 3.3 of tweets-section-empty-no-posts.
 *
 * TweetCard renders a curated `News_Item`: the headline `title`, the `outlet`
 * name, the formatted publication `date`, and a "Read article" link to `url`.
 * A "Following" badge shows only when `followed` is true. The neutral context
 * block renders only on the Needs Context tab (`showContext` true): with a
 * `context` payload it renders through the Explainer (which needs Settings),
 * otherwise a neutral "No added context." message. With `showContext` false or
 * omitted, no context block renders at all.
 *
 * Validates: Requirements 2.6
 */

/** A realistic verified News_Item fixture; override per case. */
function makeItem(overrides: Partial<News_Item> = {}): News_Item {
  return {
    id: "news-1",
    candidateIds: ["maura-healey", "brian-shortsleeve"],
    title: "Healey and Shortsleeve spar over transit funding",
    outlet: "Boston Globe",
    url: "https://www.bostonglobe.com/example-article",
    date: "2026-03-15",
    tabs: ["recent", "needsContext"],
    context: {
      simple: "This article summarizes a disagreement about transit budgets.",
      expert:
        "The piece details competing fiscal-year transit appropriations proposals.",
    },
    ...overrides,
  };
}

/** Explainer reads Detail_Mode from Settings, so wrap renders in the provider. */
function renderCard(props: {
  tweet: News_Item;
  showContext?: boolean;
  followed?: boolean;
}) {
  return render(
    <SettingsProvider>
      <TweetCard {...props} />
    </SettingsProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("TweetCard News rendering (Req 2.6)", () => {
  it("renders the title, outlet, and formatted date", () => {
    const item = makeItem();
    renderCard({ tweet: item });

    expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(screen.getByText(item.outlet)).toBeInTheDocument();

    // The card formats the ISO date via toLocaleDateString(month short, day,
    // year). Assert against the same formatting so the test is locale-stable.
    const formatted = new Date(item.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(screen.getByText(formatted, { exact: false })).toBeInTheDocument();
  });

  it("renders the url as a 'Read article' link opening in a new tab", () => {
    const item = makeItem();
    renderCard({ tweet: item });

    const link = screen.getByRole("link", { name: "Read article" });
    expect(link).toHaveAttribute("href", item.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the Following badge only when followed is true", () => {
    renderCard({ tweet: makeItem() });
    expect(screen.queryByText("Following")).not.toBeInTheDocument();

    renderCard({ tweet: makeItem(), followed: true });
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("renders curated context through the Explainer on the Needs Context tab", () => {
    const item = makeItem();
    renderCard({ tweet: item, showContext: true });

    // Default Detail_Mode is "simple", so the simple variant renders.
    expect(screen.getByText("Added context")).toBeInTheDocument();
    expect(screen.getByText(item.context!.simple)).toBeInTheDocument();
    expect(screen.queryByText("No added context.")).not.toBeInTheDocument();
  });

  it("shows the neutral 'No added context.' message when the item has no context", () => {
    const item = makeItem({ context: undefined });
    renderCard({ tweet: item, showContext: true });

    expect(screen.getByText("Added context")).toBeInTheDocument();
    expect(screen.getByText("No added context.")).toBeInTheDocument();
  });

  it("renders no context block when showContext is omitted", () => {
    const item = makeItem();
    renderCard({ tweet: item });

    expect(screen.queryByText("Added context")).not.toBeInTheDocument();
    expect(screen.queryByText("No added context.")).not.toBeInTheDocument();
    expect(screen.queryByText(item.context!.simple)).not.toBeInTheDocument();
  });

  it("renders no context block when showContext is false", () => {
    const item = makeItem();
    renderCard({ tweet: item, showContext: false });

    expect(screen.queryByText("Added context")).not.toBeInTheDocument();
    expect(screen.queryByText("No added context.")).not.toBeInTheDocument();
  });
});
