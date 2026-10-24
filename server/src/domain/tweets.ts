import type { Tweet } from "./types.js";

/**
 * Curated posts for the Tweets section.
 *
 * IMPORTANT: These are ILLUSTRATIVE, FICTIONAL posts for the demo, attributed
 * to the fictional candidates in candidates.ts. They do not quote any real
 * person. The `context` blocks on "Needs Context" posts are editorial
 * clarifications written for the demo; Task 13 can regenerate them via AI.
 */
export const tweets: Tweet[] = [
  {
    id: "t1",
    candidateId: "harper-vega",
    authorName: "Harper Vega",
    authorHandle: "@harpervega",
    text: "Just toured a stalled housing project in Worcester. We can build the homes families need — if we cut the delays. Let's get it done. 🏠",
    date: "2026-08-20",
    likes: 1240,
    reposts: 310,
    tabs: ["recent", "notable"],
    sourceUrl: "https://example.org/posts/t1",
  },
  {
    id: "t2",
    candidateId: "priya-nair",
    authorName: "Priya Nair",
    authorHandle: "@priyanair",
    text: "As a doctor I've seen patients skip meds they can't afford. A public option would change that. Healthcare is a right.",
    date: "2026-08-21",
    likes: 2890,
    reposts: 760,
    tabs: ["recent", "notable"],
    sourceUrl: "https://example.org/posts/t2",
  },
  {
    id: "t3",
    candidateId: "daniel-okafor",
    authorName: "Daniel Okafor",
    authorHandle: "@danokafor",
    text: "The MBTA got another funding boost and trains are still late. Before we spend more, let's see a full audit of where the money goes.",
    date: "2026-08-19",
    likes: 980,
    reposts: 240,
    tabs: ["recent", "needsContext"],
    context: {
      simple:
        "The MBTA runs Boston-area trains and buses. 'Audit' means an outside review of how it spends money. Supporters say it finds waste; critics say delays also come from years of underfunding.",
      expert:
        "The MBTA faces a documented capital maintenance backlog. Performance audits can surface inefficiencies, but transit analysts note reliability issues also stem from deferred maintenance and historical underinvestment, so an audit alone may not resolve service gaps.",
    },
    sourceUrl: "https://example.org/posts/t3",
  },
  {
    id: "t4",
    candidateId: "marcus-lindqvist",
    authorName: "Marcus Lindqvist",
    authorHandle: "@marcuslind",
    text: "We don't need a government takeover of healthcare. Competition and price transparency will lower costs for everyone.",
    date: "2026-08-18",
    likes: 1120,
    reposts: 350,
    tabs: ["recent", "needsContext"],
    context: {
      simple:
        "'Government takeover' usually refers to single-payer, where the state pays for care. 'Price transparency' means hospitals showing prices up front. Experts disagree on how much competition alone lowers costs.",
      expert:
        "The 'government takeover' framing references single-payer proposals. Evidence on price transparency's effect on costs is mixed; economists note healthcare markets have limited price elasticity, so competition-based approaches may yield modest savings relative to claims.",
    },
    sourceUrl: "https://example.org/posts/t4",
  },
  {
    id: "t5",
    candidateId: "sofia-alvarez",
    authorName: "Sofia Alvarez",
    authorHandle: "@sofiaalvarez",
    text: "A Green New Deal for Massachusetts means good union jobs AND a livable planet. These aren't in conflict — they go together. 🌱",
    date: "2026-08-22",
    likes: 3400,
    reposts: 1100,
    tabs: ["recent", "notable", "needsContext"],
    context: {
      simple:
        "'Green New Deal' is a plan to fight climate change while creating jobs. Supporters say it boosts the economy; critics worry about the cost and how to pay for it.",
      expert:
        "A Green New Deal couples decarbonization with labor and equity provisions (jobs guarantee, just transition). Debate centers on fiscal scale, financing mechanisms, and implementation timelines rather than the goals themselves.",
    },
    sourceUrl: "https://example.org/posts/t5",
  },
  {
    id: "t6",
    candidateId: "harper-vega",
    authorName: "Harper Vega",
    authorHandle: "@harpervega",
    text: "Replying to @danokafor — audits are fine, but families can't wait. We can fix the T and review spending at the same time.",
    date: "2026-08-19",
    likes: 640,
    reposts: 120,
    tabs: ["interactions"],
    inReplyTo: "@danokafor",
    sourceUrl: "https://example.org/posts/t6",
  },
  {
    id: "t7",
    candidateId: "priya-nair",
    authorName: "Priya Nair",
    authorHandle: "@priyanair",
    text: "Grateful for the nurses who joined us in Springfield today. Your voices are why I'm fighting for affordable care. 💙",
    date: "2026-08-23",
    likes: 1870,
    reposts: 410,
    tabs: ["recent"],
    sourceUrl: "https://example.org/posts/t7",
  },
  {
    id: "t8",
    candidateId: "marcus-lindqvist",
    authorName: "Marcus Lindqvist",
    authorHandle: "@marcuslind",
    text: "Replying to @priyanair — a public option still puts bureaucrats between you and your doctor. Let's lower costs without that.",
    date: "2026-08-21",
    likes: 530,
    reposts: 150,
    tabs: ["interactions"],
    inReplyTo: "@priyanair",
    sourceUrl: "https://example.org/posts/t8",
  },
  {
    id: "t9",
    candidateId: "sofia-alvarez",
    authorName: "Sofia Alvarez",
    authorHandle: "@sofiaalvarez",
    text: "Social housing works in Vienna. It can work here. Housing is a human right, not a commodity. 🏘️",
    date: "2026-08-17",
    likes: 2100,
    reposts: 680,
    tabs: ["notable", "needsContext"],
    context: {
      simple:
        "'Social housing' means homes built and owned by the public or nonprofits, rented at affordable rates. Vienna is often cited as a successful example. Critics question whether it scales to the US.",
      expert:
        "Vienna's Gemeindebau model houses a large share of residents in publicly developed units. Translating it to Massachusetts raises questions about capital financing, land availability, and governance, which proponents and skeptics weigh differently.",
    },
    sourceUrl: "https://example.org/posts/t9",
  },
  {
    // Intentionally has NO curated context, to demonstrate on-demand context
    // generation (scripted fallback, or real AI when a key is configured).
    id: "t10",
    candidateId: "daniel-okafor",
    authorName: "Daniel Okafor",
    authorHandle: "@danokafor",
    text: "We need to bring back common-sense budgeting on Beacon Hill. Every dollar should be accountable to taxpayers.",
    date: "2026-08-24",
    likes: 870,
    reposts: 190,
    tabs: ["recent", "needsContext"],
    sourceUrl: "https://example.org/posts/t10",
  },
];
