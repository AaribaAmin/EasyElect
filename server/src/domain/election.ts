import type { Explain } from "./types.js";

/** Plain-language "How voting works" content for the MA State Primary demo. */
export interface ElectionInfo {
  title: string;
  date: string;
  intro: Explain;
  steps: { title: string; body: Explain }[];
}

export const electionInfo: ElectionInfo = {
  title: "Massachusetts State Primary",
  date: "2026-09-01",
  intro: {
    simple:
      "A primary is the first round of an election. Each party picks who will represent it in the final election in November. You usually vote within one party's list.",
    expert:
      "The state primary determines each party's nominees for the November general election. Massachusetts uses a semi-open primary: unenrolled voters may choose any party's ballot, while enrolled voters receive their party's ballot.",
  },
  steps: [
    {
      title: "Check you're registered",
      body: {
        simple:
          "Make sure you're signed up to vote. You can check online in a minute.",
        expert:
          "Verify your voter registration status and party enrollment via the Secretary of the Commonwealth's online lookup before the registration deadline.",
      },
    },
    {
      title: "Know the date",
      body: {
        simple: "Mark the primary date on your calendar so you don't miss it.",
        expert:
          "Note the primary date and early-voting window; deadlines for mail ballots differ from in-person voting.",
      },
    },
    {
      title: "Pick how you'll vote",
      body: {
        simple:
          "You can vote by mail, during early voting, or in person on the day.",
        expert:
          "Options include no-excuse mail-in voting, in-person early voting, and election-day voting at your assigned precinct.",
      },
    },
    {
      title: "Choose a party ballot",
      body: {
        simple:
          "At a primary you vote within one party. If you're not in a party, you can pick which party's ballot to use.",
        expert:
          "Unenrolled voters select a single party ballot at the polls without changing their registration; enrolled voters receive their party's ballot automatically.",
      },
    },
    {
      title: "Fill it out and turn it in",
      body: {
        simple: "Mark your choices, double-check, and submit your ballot.",
        expert:
          "Complete the ballot, review for over/undervotes, and submit per your chosen method; track mail ballots online where available.",
      },
    },
  ],
};
