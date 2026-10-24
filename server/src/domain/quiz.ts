import type { QuizQuestion } from "./types.js";

/**
 * Find-your-match quiz questions. Each maps to an issue; the user's chosen
 * option carries a value on a -2..2 spectrum. Task 8 scores these against each
 * candidate's position value on the same issue (see quizScoring).
 */
export const quizQuestions: QuizQuestion[] = [
  {
    id: "q-housing",
    issueId: "housing",
    prompt: "How should the state make housing more affordable?",
    options: [
      { id: "q-housing-a", label: "Build a lot more homes, fewer rules", value: 2 },
      { id: "q-housing-b", label: "Build more and add some renter protections", value: 1 },
      { id: "q-housing-c", label: "Mix of both", value: 0 },
      { id: "q-housing-d", label: "Strong rent limits and tenant protections", value: -1 },
      { id: "q-housing-e", label: "Publicly built (social) housing", value: -2 },
    ],
  },
  {
    id: "q-healthcare",
    issueId: "healthcare",
    prompt: "What's the best way to handle healthcare costs?",
    options: [
      { id: "q-hc-a", label: "Competition and price transparency", value: 2 },
      { id: "q-hc-b", label: "Mostly market-based with some help", value: 1 },
      { id: "q-hc-c", label: "A balance", value: 0 },
      { id: "q-hc-d", label: "A public option for everyone", value: -1 },
      { id: "q-hc-e", label: "State pays for all care (single-payer)", value: -2 },
    ],
  },
  {
    id: "q-climate",
    issueId: "climate",
    prompt: "How fast should Massachusetts cut emissions?",
    options: [
      { id: "q-cl-a", label: "Balance clean energy with cost and reliability", value: 2 },
      { id: "q-cl-b", label: "Steady transition to clean energy", value: 1 },
      { id: "q-cl-c", label: "Somewhere in the middle", value: 0 },
      { id: "q-cl-d", label: "Move quickly to clean energy", value: -1 },
      { id: "q-cl-e", label: "Aggressive Green New Deal-style plan", value: -2 },
    ],
  },
  {
    id: "q-education",
    issueId: "education",
    prompt: "What should education policy prioritize?",
    options: [
      { id: "q-ed-a", label: "School choice and local control", value: 2 },
      { id: "q-ed-b", label: "More options with some extra funding", value: 1 },
      { id: "q-ed-c", label: "A mix", value: 0 },
      { id: "q-ed-d", label: "More public school funding", value: -1 },
      { id: "q-ed-e", label: "Big funding boost and free community college", value: -2 },
    ],
  },
  {
    id: "q-guns",
    issueId: "guns",
    prompt: "What's your view on gun policy?",
    options: [
      { id: "q-gun-a", label: "Protect gun owners' rights", value: 2 },
      { id: "q-gun-b", label: "Mostly enforce current laws", value: 1 },
      { id: "q-gun-c", label: "Balanced approach", value: 0 },
      { id: "q-gun-d", label: "Some stricter rules", value: -1 },
      { id: "q-gun-e", label: "Strong gun safety laws", value: -2 },
    ],
  },
];
