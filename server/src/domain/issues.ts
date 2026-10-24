import type { Issue } from "./types.js";

/**
 * Policy areas covered in the MVP. Each carries a plain-language and a
 * standard-terminology explainer so the UI can match the user's detail mode.
 */
export const issues: Issue[] = [
  {
    id: "housing",
    title: "Housing & Rent",
    icon: "🏠",
    summary: "How to keep housing affordable and build more homes.",
    explainer: {
      simple:
        "Housing is about whether people can afford a place to live. Some leaders want to build more homes to bring prices down; others want rules that limit how fast rent can rise.",
      expert:
        "Housing policy spans supply-side measures (upzoning, permitting reform, subsidized construction) and demand-side protections (rent stabilization, eviction protections, housing vouchers). The tension is between increasing supply and regulating prices.",
    },
  },
  {
    id: "education",
    title: "Education",
    icon: "📚",
    summary: "Funding and policy for public schools and college.",
    explainer: {
      simple:
        "Education covers how schools are paid for and run, from kindergarten through college. Debates include how much money schools get and whether college should cost less.",
      expert:
        "Education policy addresses K-12 funding formulas (e.g. the Student Opportunity Act), charter school expansion, standardized testing (MCAS), and higher-education affordability including community college and student debt.",
    },
  },
  {
    id: "guns",
    title: "Gun Policy",
    icon: "🔫",
    summary: "Rules on who can own firearms and how.",
    explainer: {
      simple:
        "Gun policy is about the rules for buying and owning firearms. Some want stricter checks and limits; others want to protect gun owners' rights.",
      expert:
        "Firearms policy includes licensing requirements, assault-weapons restrictions, red-flag (extreme risk protection) orders, and background-check thresholds, balanced against Second Amendment considerations.",
    },
  },
  {
    id: "healthcare",
    title: "Healthcare",
    icon: "🩺",
    summary: "Access to and cost of medical care.",
    explainer: {
      simple:
        "Healthcare is about making sure people can see a doctor without it costing too much. Leaders differ on how much the state should help pay.",
      expert:
        "Healthcare policy covers coverage expansion, cost containment, prescription-drug pricing, and proposals ranging from strengthening the ACA marketplace to single-payer models at the state level.",
    },
  },
  {
    id: "climate",
    title: "Climate & Energy",
    icon: "🌱",
    summary: "Clean energy and reducing emissions.",
    explainer: {
      simple:
        "Climate policy is about cutting pollution and moving to cleaner energy like wind and solar, while keeping energy bills manageable.",
      expert:
        "Climate and energy policy includes emissions-reduction targets, offshore wind and solar buildout, grid modernization, building electrification, and a just transition for affected workers.",
    },
  },
  {
    id: "transit",
    title: "Transportation",
    icon: "🚆",
    summary: "Public transit, roads, and getting around.",
    explainer: {
      simple:
        "Transportation is about how people get around, like fixing the T, improving buses, and maintaining roads.",
      expert:
        "Transportation policy addresses MBTA funding and reliability, regional transit authorities, congestion pricing, road and bridge maintenance, and multimodal infrastructure investment.",
    },
  },
];

export const issuesById = new Map(issues.map((i) => [i.id, i]));
