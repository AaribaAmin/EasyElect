import type { News_Item } from "./types.js";

/**
 * Curated News_Dataset for the (repurposed) News section (served on the
 * fallback branch of resolveTweets).
 *
 * This dataset holds ONLY real, publicly published news items tied to real
 * candidates on the Massachusetts ballot. Every record is a Verified_Source:
 * its `url` resolves over HTTP/HTTPS to a real article from a reputable outlet,
 * .gov page, or official campaign site; its `title` is the real headline; its
 * `outlet` is the real publisher; and its `date` is the real publication date
 * in ISO 8601. Nothing here is fabricated — headlines, outlets, dates, and URLs
 * were found and verified via web search/fetch before being added.
 *
 * Candidates with no verifiable coverage contribute nothing: there is no
 * placeholder and no invented item. Coverage currently concentrates on the
 * well-covered statewide races (Governor: Healey/Minogue; U.S. Senate:
 * Markey/Deaton) plus a few other statewide officeholders with findable
 * coverage (Attorney General Campbell, Auditor DiZoglio) and one independent
 * Senate candidate (Ayyadurai). The dataset is kept within 0..100 records.
 *
 * Each `candidateIds` entry matches a real Candidate.id in candidates.ts, and
 * any `context` block is a neutral clarification that does not endorse, rank,
 * or recommend. The per-item source log (outlet, url, date, verified-on) lives
 * in DATA_SOURCES.md.
 */
export const tweets: News_Item[] = [
  // --- Governor: Healey vs. Minogue ----------------------------------------
  {
    id: "news-healey-minogue-first-debate-wbur",
    candidateIds: ["maura-healey", "mike-minogue"],
    title:
      "In first Healey-Minogue debate, lots of talk of affordability, the governor's record and Trump's impact",
    outlet: "WBUR",
    url: "https://www.wbur.org/news/2026/10/08/massachusetts-governor-gubernatorial-debate-keller-wbz",
    date: "2026-10-08",
    tabs: ["recent", "interactions"],
  },
  {
    id: "news-healey-minogue-first-debate-cbs",
    candidateIds: ["maura-healey", "mike-minogue"],
    title:
      "Healey, Minogue spar over spending, political ties in first Massachusetts governor debate",
    outlet: "CBS News Boston",
    url: "https://www.cbsnews.com/boston/news/maura-healey-mike-minogue-massachusetts-governor-debate/",
    date: "2026-10-08",
    tabs: ["notable", "interactions"],
  },
  {
    id: "news-healey-minogue-final-debate-boston",
    candidateIds: ["maura-healey", "mike-minogue"],
    title:
      "Healey and Minogue made their final pitches to voters in a tense debate. Here are 4 takeaways.",
    outlet: "Boston.com",
    url: "https://www.boston.com/news/politics/2026/10/16/healey-and-minogue-made-their-final-pitches-to-voters-in-a-tense-debate-here-are-4-takeaways/",
    date: "2026-10-16",
    tabs: ["recent", "interactions", "needsContext"],
    context: {
      simple:
        "This covers the second and final debate before the November 3 election. The two candidates disagreed on housing, energy, abortion, immigration, and government accountability.",
      expert:
        "Reporting on the final pre-election gubernatorial debate, hosted by WCVB, WBUR, and the Boston Globe, covering housing costs, public accountability, abortion access, immigration enforcement, and energy policy ahead of the Nov. 3 general election.",
    },
  },
  {
    id: "news-healey-minogue-final-debate-wbjournal",
    candidateIds: ["maura-healey", "mike-minogue"],
    title:
      "Healey, Minogue clash over energy costs and housing construction in final debate",
    outlet: "Worcester Business Journal",
    url: "https://wbjournal.com/article/healey-minogue-clash-over-energy-costs-and-housing-construction-in-final-debate/",
    date: "2026-10-16",
    tabs: ["notable", "interactions"],
  },
  {
    id: "news-minogue-blueprint-wgbh",
    candidateIds: ["mike-minogue"],
    title:
      "GOP's Minogue rolls out his pitch for governor ahead of the general",
    outlet: "GBH News",
    url: "https://www.wgbh.org/news/politics/2026-09-10/gops-minogue-rolls-out-his-pitch-for-governor-ahead-of-the-general",
    date: "2026-09-10",
    tabs: ["notable"],
  },
  {
    id: "news-minogue-blueprint-wbur",
    candidateIds: ["mike-minogue"],
    title:
      "Minogue's blueprint promises audits, tax cuts and a net-zero emissions repeal",
    outlet: "WBUR",
    url: "https://www.wbur.org/news/2026/09/11/mike-minogue-gop-governor-policy-blueprint",
    date: "2026-09-11",
    tabs: ["notable"],
  },

  // --- U.S. Senate: Markey vs. Deaton (and Ayyadurai) -----------------------
  {
    id: "news-markey-deaton-debate-boston",
    candidateIds: ["edward-j-markey", "john-deaton"],
    title: "Sen. Ed Markey and John Deaton square off in lone debate",
    outlet: "Boston.com",
    url: "https://www.boston.com/news/politics/2026/10/13/ed-markey-john-deaton-senate-debate/",
    date: "2026-10-13",
    tabs: ["recent", "interactions"],
  },
  {
    id: "news-ayyadurai-belmont-voice-lawsuit-boston",
    candidateIds: ["shiva-ayyadurai"],
    title: "Senate hopeful Shiva Ayyadurai sues local Belmont newspaper",
    outlet: "Boston.com",
    url: "https://www.boston.com/news/politics/2026/10/23/senate-candidate-shiva-ayyadurai-belmont-voice-lawsuit/",
    date: "2026-10-23",
    tabs: ["recent"],
  },

  // --- Attorney General: Andrea Joy Campbell --------------------------------
  {
    id: "news-campbell-meta-settlement-massgov",
    candidateIds: ["andrea-joy-campbell"],
    title:
      "AG Campbell Reaches Landmark Settlement With Meta That Requires Design Changes To Protect Massachusetts Young People From Social Media Harms",
    outlet: "Mass.gov (Office of the Attorney General)",
    url: "https://www.mass.gov/news/ag-campbell-reaches-landmark-settlement-with-meta-that-requires-design-changes-to-protect-massachusetts-young-people-from-social-media-harms",
    date: "2026-04-24",
    tabs: ["notable", "needsContext"],
    context: {
      simple:
        "This is an official press release from the Attorney General's office describing a multistate settlement with Meta. It is a government announcement, not independent reporting.",
      expert:
        "Official Office of the Attorney General announcement of a bipartisan multistate settlement with Meta resolving consumer-protection allegations; as a first-party government source it reflects the office's own framing rather than third-party coverage.",
    },
  },

  // --- Auditor: Diana DiZoglio ----------------------------------------------
  {
    id: "news-dizoglio-question1-wgbh",
    candidateIds: ["diana-dizoglio"],
    title:
      "What you need to know about Question 1: Expanding public records law",
    outlet: "GBH News",
    url: "https://www.wgbh.org/news/politics/2026-10-19/what-you-need-to-know-about-question-1-expanding-public-records-law",
    date: "2026-10-19",
    tabs: ["needsContext"],
    context: {
      simple:
        "An explainer of a 2026 ballot question that DiZoglio is the public face of. It lays out what supporters and opponents say so voters can decide for themselves.",
      expert:
        "A ballot-measure explainer on Question 1 (applying public records law to the Legislature and governor's office), presenting proponent and opponent arguments; informational rather than a candidate endorsement.",
    },
  },
  {
    id: "news-dizoglio-campbell-transparency-iberkshires",
    candidateIds: ["diana-dizoglio", "andrea-joy-campbell"],
    title: "State Auditor DiZoglio Pushes for Beacon Hill Transparency",
    outlet: "iBerkshires",
    url: "https://www.iberkshires.com/story/84014/State-Auditor-DiZoglio-Pushes-for-Beacon-Hill-Transparency-.html",
    date: "2026-09-28",
    tabs: ["notable", "interactions"],
  },
];
