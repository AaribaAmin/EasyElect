import type { Candidate } from "./types.js";

/**
 * Curated candidates for the Massachusetts State Primary demo.
 *
 * IMPORTANT: These are ILLUSTRATIVE, FICTIONAL candidates created for the MVP
 * demo. Names, quotes, and positions do not represent any real person. This
 * avoids falsely attributing statements to actual candidates. When real,
 * verifiable data is available, replace these records (and the tweets) with
 * properly sourced content and attribution.
 */
export const candidates: Candidate[] = [
  {
    id: "harper-vega",
    name: "Harper Vega",
    party: "Democratic",
    office: "Governor",
    district: "Massachusetts",
    tagline: "Homes you can afford, schools you can trust.",
    handle: "@harpervega",
    website: "https://example.org/harper-vega",
    bio: {
      simple:
        "Harper Vega is a former city councilor who focuses on making housing cheaper and schools stronger.",
      expert:
        "Harper Vega, a two-term municipal councilor, centers a platform on housing supply expansion and increased K-12 funding via the state formula.",
    },
    stances: [
      {
        issueId: "housing",
        position: "Build more homes and cap rent spikes",
        detail: {
          simple:
            "Wants to build lots of new homes and stop rent from jumping too fast.",
          expert:
            "Supports statewide upzoning near transit plus a cap on annual rent increases tied to inflation.",
        },
      },
      {
        issueId: "education",
        position: "Fully fund the Student Opportunity Act",
        detail: {
          simple: "Wants to send more money to public schools.",
          expert:
            "Advocates accelerating the Student Opportunity Act funding schedule for high-need districts.",
        },
      },
      {
        issueId: "climate",
        position: "Rapid offshore wind buildout",
        detail: {
          simple: "Wants more wind and solar power, fast.",
          expert:
            "Backs an accelerated offshore wind procurement timeline and building electrification incentives.",
        },
      },
      {
        issueId: "transit",
        position: "Fix and fund the MBTA",
        detail: {
          simple: "Wants to fix the T so it runs on time.",
          expert:
            "Proposes dedicated MBTA capital funding and a reliability-focused maintenance program.",
        },
      },
    ],
  },
  {
    id: "daniel-okafor",
    name: "Daniel Okafor",
    party: "Republican",
    office: "Governor",
    district: "Massachusetts",
    tagline: "Lower costs, safer streets, common sense.",
    handle: "@danokafor",
    website: "https://example.org/daniel-okafor",
    bio: {
      simple:
        "Daniel Okafor is a small-business owner who wants to lower taxes and costs for families.",
      expert:
        "Daniel Okafor, a small-business owner, runs on tax relief, regulatory streamlining, and public-safety investment.",
    },
    stances: [
      {
        issueId: "housing",
        position: "Cut red tape to build more homes",
        detail: {
          simple:
            "Wants to make it easier and faster to build homes by removing rules.",
          expert:
            "Favors permitting reform and reduced regulatory barriers over rent controls to expand supply.",
        },
      },
      {
        issueId: "healthcare",
        position: "Lower premiums through competition",
        detail: {
          simple: "Wants to lower the cost of health insurance.",
          expert:
            "Supports market-based competition and price transparency to reduce premiums rather than a single-payer approach.",
        },
      },
      {
        issueId: "guns",
        position: "Protect lawful gun ownership",
        detail: {
          simple: "Wants to protect the rights of legal gun owners.",
          expert:
            "Emphasizes Second Amendment protections while supporting enforcement of existing laws.",
        },
      },
      {
        issueId: "transit",
        position: "Audit the MBTA before new spending",
        detail: {
          simple: "Wants to check how the T spends money before giving it more.",
          expert:
            "Calls for an independent MBTA performance audit prior to additional capital appropriations.",
        },
      },
    ],
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    party: "Democratic",
    office: "US Senate",
    district: "Massachusetts",
    tagline: "Healthcare for all, a livable planet.",
    handle: "@priyanair",
    website: "https://example.org/priya-nair",
    bio: {
      simple:
        "Priya Nair is a doctor who wants everyone to be able to afford healthcare.",
      expert:
        "Priya Nair, a practicing physician, campaigns on universal coverage and aggressive climate action.",
    },
    stances: [
      {
        issueId: "healthcare",
        position: "Move toward universal coverage",
        detail: {
          simple: "Wants everyone to have health insurance.",
          expert:
            "Supports a public option as a step toward universal coverage and drug-price negotiation.",
        },
      },
      {
        issueId: "climate",
        position: "Aggressive emissions cuts",
        detail: {
          simple: "Wants to cut pollution quickly.",
          expert:
            "Backs binding interim emissions targets and large-scale clean-energy investment.",
        },
      },
      {
        issueId: "education",
        position: "Tuition-free community college",
        detail: {
          simple: "Wants community college to be free.",
          expert:
            "Advocates tuition-free community college and expanded need-based aid.",
        },
      },
      {
        issueId: "guns",
        position: "Stronger gun safety laws",
        detail: {
          simple: "Wants stricter rules on guns.",
          expert:
            "Supports expanded background checks and extreme-risk protection orders.",
        },
      },
    ],
  },
  {
    id: "marcus-lindqvist",
    name: "Marcus Lindqvist",
    party: "Republican",
    office: "US Senate",
    district: "Massachusetts",
    tagline: "Fiscal discipline and strong communities.",
    handle: "@marcuslind",
    website: "https://example.org/marcus-lindqvist",
    bio: {
      simple:
        "Marcus Lindqvist is a veteran and businessman focused on jobs and lower spending.",
      expert:
        "Marcus Lindqvist, a veteran and business executive, prioritizes fiscal restraint and economic growth.",
    },
    stances: [
      {
        issueId: "healthcare",
        position: "Market-based cost control",
        detail: {
          simple: "Wants competition to lower healthcare costs.",
          expert:
            "Favors competition, transparency, and HSAs over expanding public programs.",
        },
      },
      {
        issueId: "climate",
        position: "All-of-the-above energy",
        detail: {
          simple:
            "Wants a mix of energy sources, including some traditional ones.",
          expert:
            "Supports an all-of-the-above energy strategy balancing renewables with reliability and cost.",
        },
      },
      {
        issueId: "education",
        position: "School choice and local control",
        detail: {
          simple: "Wants parents to have more choice in schools.",
          expert:
            "Backs charter expansion and local control over curriculum and budgets.",
        },
      },
      {
        issueId: "guns",
        position: "Enforce existing laws",
        detail: {
          simple: "Wants to focus on enforcing the gun laws we already have.",
          expert:
            "Emphasizes enforcement of current statutes over new restrictions.",
        },
      },
    ],
  },
  {
    id: "sofia-alvarez",
    name: "Sofia Alvarez",
    party: "Green-Rainbow",
    office: "US Senate",
    district: "Massachusetts",
    tagline: "People and planet over profit.",
    handle: "@sofiaalvarez",
    website: "https://example.org/sofia-alvarez",
    bio: {
      simple:
        "Sofia Alvarez is a community organizer focused on climate and fairness.",
      expert:
        "Sofia Alvarez, a longtime community organizer, runs on a Green New Deal-style platform and economic justice.",
    },
    stances: [
      {
        issueId: "climate",
        position: "Green New Deal for Massachusetts",
        detail: {
          simple: "Wants a big plan to fight climate change and create jobs.",
          expert:
            "Proposes a state Green New Deal pairing decarbonization with a jobs guarantee and just transition.",
        },
      },
      {
        issueId: "housing",
        position: "Social housing and strong tenant protections",
        detail: {
          simple:
            "Wants publicly built affordable homes and strong renter protections.",
          expert:
            "Supports public/social housing development and robust rent stabilization with eviction protections.",
        },
      },
      {
        issueId: "healthcare",
        position: "State single-payer",
        detail: {
          simple: "Wants the state to pay for everyone's healthcare.",
          expert: "Advocates a state single-payer healthcare system.",
        },
      },
    ],
  },
];

export const candidatesById = new Map(candidates.map((c) => [c.id, c]));
