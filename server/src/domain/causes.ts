import type { Cause } from "./types.js";

/**
 * Interest areas users can adopt. The chatbot matches a user's message against
 * `keywords` to surface the relevant cause card (Task 11). Each links to issues
 * (Voting) and to Connect entries via causeIds.
 */
export const causes: Cause[] = [
  {
    id: "housing",
    title: "Housing",
    icon: "🏠",
    keywords: ["housing", "rent", "homes", "affordable", "eviction", "landlord", "tenant"],
    blurb: {
      simple: "Making it possible for people to afford a place to live.",
      expert:
        "Housing affordability, supply expansion, and tenant protections at the state and local level.",
    },
    refinements: [
      "Affordable rentals",
      "First-time homebuyers",
      "Tenant protections",
      "Building more homes",
      "Homelessness services",
    ],
    relatedIssueIds: ["housing"],
  },
  {
    id: "education",
    title: "Education",
    icon: "📚",
    keywords: ["education", "school", "schools", "college", "students", "teachers", "tuition"],
    blurb: {
      simple: "Strong, affordable schools from kindergarten through college.",
      expert:
        "K-12 funding, school choice, higher-education affordability, and student debt.",
    },
    refinements: [
      "Public school funding",
      "Free community college",
      "Teacher pay",
      "Special education",
      "Student debt",
    ],
    relatedIssueIds: ["education"],
  },
  {
    id: "guns",
    title: "Gun Policy",
    icon: "🔫",
    keywords: ["gun", "guns", "firearm", "firearms", "second amendment", "shooting"],
    blurb: {
      simple: "The rules around owning and buying firearms.",
      expert:
        "Firearm licensing, background checks, and extreme-risk protection orders.",
    },
    refinements: [
      "Background checks",
      "Red-flag laws",
      "Gun owner rights",
      "Assault-weapon rules",
    ],
    relatedIssueIds: ["guns"],
  },
  {
    id: "climate",
    title: "Climate",
    icon: "🌱",
    keywords: ["climate", "environment", "energy", "wind", "solar", "emissions", "green"],
    blurb: {
      simple: "Cleaner energy and cutting pollution.",
      expert:
        "Emissions reduction, clean-energy buildout, and a just transition.",
    },
    refinements: [
      "Offshore wind",
      "Solar power",
      "Electric transit",
      "Green jobs",
      "Lower energy bills",
    ],
    relatedIssueIds: ["climate"],
  },
  {
    id: "healthcare",
    title: "Healthcare",
    icon: "🩺",
    keywords: ["healthcare", "health", "insurance", "medical", "doctor", "medicare", "medicaid"],
    blurb: {
      simple: "Being able to afford to see a doctor.",
      expert:
        "Coverage expansion, cost containment, and prescription-drug pricing.",
    },
    refinements: [
      "Lower premiums",
      "Public option",
      "Prescription costs",
      "Mental health",
      "Rural access",
    ],
    relatedIssueIds: ["healthcare"],
  },
  {
    id: "transit",
    title: "Transportation",
    icon: "🚆",
    keywords: ["transit", "transportation", "mbta", "the t", "bus", "train", "roads", "commute"],
    blurb: {
      simple: "Getting around reliably — trains, buses, and roads.",
      expert:
        "MBTA reliability, regional transit, and infrastructure investment.",
    },
    refinements: [
      "Fix the MBTA",
      "Cheaper fares",
      "Better buses",
      "Safe roads & bridges",
      "Bike & pedestrian safety",
    ],
    relatedIssueIds: ["transit"],
  },
];

export const causesById = new Map(causes.map((c) => [c.id, c]));
