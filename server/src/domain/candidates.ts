import type { Candidate } from "./types.js";

/**
 * Real Massachusetts state-election candidate dataset.
 *
 * These are real, declared candidates in the 2026 Massachusetts gubernatorial
 * election (general election November 3, 2026): Democratic incumbent Governor
 * Maura Healey and Republican nominee Mike Minogue. Every record carries a
 * `source` attribution, and every stance below is tied to a resolvable
 * HTTP/HTTPS source documenting a position the candidate has actually proposed
 * or publicly stated. Positions that could not be tied to a resolvable source
 * were omitted rather than inferred (e.g. Minogue's guns stance).
 *
 * To refresh this dataset, re-verify each stance against its source URL and
 * update `source.reviewedOn` (YYYY-MM-DD). See DATA_SOURCES.md.
 */
export const candidates: Candidate[] = [
  {
    id: "maura-healey",
    name: "Maura Healey",
    party: "Democratic",
    office: "Governor",
    district: "Massachusetts",
    tagline: "Lowering costs and standing up for Massachusetts.",
    handle: "@maura_healey",
    website: "https://maurahealey.com/",
    source: {
      name: "Maura Healey for Governor (official campaign site)",
      url: "https://maurahealey.com/",
      reviewedOn: "2026-10-24",
    },
    bio: {
      simple:
        "Maura Healey is the current Governor of Massachusetts, running for a second term with a focus on making life more affordable.",
      expert:
        "Maura Healey, the Democratic incumbent Governor of Massachusetts, is seeking reelection on a platform centered on affordability, energy and housing costs, and defending state programs.",
    },
    stances: [
      {
        issueId: "housing",
        position: "State investment to build more homes",
        detail: {
          simple:
            "She is putting state money into building more homes so housing costs less.",
          expert:
            "Her administration has directed state funding toward new housing production, including converting underused downtown buildings into homes to address the housing shortage.",
        },
        source: {
          name: "Mass.gov — Governor Healey Announces Over $140 Million to Create More Than 1,300 New Homes Statewide",
          url: "https://www.mass.gov/news/governor-healey-announces-over-140-million-to-create-more-than-1300-new-homes-statewide",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "climate",
        position: "Advance clean energy and offshore wind",
        detail: {
          simple:
            "She backs clean energy like offshore wind and wants to lower energy bills while cutting pollution.",
          expert:
            "She signed climate legislation to advance the clean energy transition, expand bill discounts to middle-class households, and invest in offshore wind and clean energy measures such as solar and heat pumps.",
        },
        source: {
          name: "Mass.gov — Governor Healey Signs Climate Law to Advance Clean Energy Transition, Create Jobs and Lower Costs",
          url: "https://www.mass.gov/news/governor-healey-signs-climate-law-to-advance-clean-energy-transition-create-jobs-and-lower-costs",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "transit",
        position: "Invest Fair Share revenue in transportation",
        detail: {
          simple:
            "She is using surtax money to improve transportation, including the T.",
          expert:
            "Her administration has invested Fair Share surtax revenue into transportation and education, reporting those investments in a Delivering on Fair Share impact report.",
        },
        source: {
          name: "Mass.gov — Governor Healey Releases New Impact Report on Transformative New Fair Share Investments in Education, Transportation",
          url: "https://www.mass.gov/news/governor-healey-releases-new-impact-report-on-transformative-new-fair-share-investments-in-education-transportation",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "education",
        position: "Fund education with Fair Share revenue",
        detail: {
          simple:
            "She is sending surtax money to schools to strengthen public education.",
          expert:
            "She has directed Fair Share surtax revenue into public education investments as part of the Delivering on Fair Share program.",
        },
        source: {
          name: "Mass.gov — Governor Healey Releases New Impact Report on Transformative New Fair Share Investments in Education, Transportation",
          url: "https://www.mass.gov/news/governor-healey-releases-new-impact-report-on-transformative-new-fair-share-investments-in-education-transportation",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "guns",
        position: "Strengthen gun safety laws",
        detail: {
          simple:
            "She signed a law cracking down on untraceable 'ghost guns' and strengthening violence prevention.",
          expert:
            "She signed gun safety legislation targeting ghost guns and 3-D printed weapons, enhancing measures to keep firearms from dangerous hands and investing in community violence prevention.",
        },
        source: {
          name: "Mass.gov — Governor Healey Signs Gun Safety Legislation Cracking Down on Ghost Guns, Strengthening Violence Prevention",
          url: "https://www.mass.gov/news/governor-healey-signs-gun-safety-legislation-cracking-down-on-ghost-guns-strengthening-violence-prevention",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "healthcare",
        position: "Lower health care out-of-pocket costs",
        detail: {
          simple:
            "She signed laws to lower health care costs, including capping copays for lifesaving prescriptions.",
          expert:
            "She signed laws lowering health care costs and strengthening oversight, capping copays at $25 for lifesaving prescription medications and increasing industry transparency.",
        },
        source: {
          name: "Mass.gov — Governor Healey Signs Laws Lowering Health Care Costs and Strengthening Oversight",
          url: "https://www.mass.gov/news/governor-healey-signs-laws-lowering-health-care-costs-and-strengthening-oversight",
          reviewedOn: "2026-10-24",
        },
      },
    ],
  },
  {
    id: "mike-minogue",
    name: "Mike Minogue",
    party: "Republican",
    office: "Governor",
    district: "Massachusetts",
    tagline: "Affordability, accountability, and lower costs.",
    handle: "@minogueforma",
    website: "https://minogueforma.com/",
    source: {
      name: "Mike Minogue for Governor (official campaign site)",
      url: "https://minogueforma.com/",
      reviewedOn: "2026-10-24",
    },
    bio: {
      simple:
        "Mike Minogue is a business leader and Army veteran, the Republican nominee for Governor, running on lowering costs for working families.",
      expert:
        "Mike Minogue, former CEO of medical device company Abiomed and a U.S. Army veteran, is the Republican gubernatorial nominee running on affordability, government accountability, and reducing energy, housing, tax, and health care costs.",
    },
    stances: [
      {
        issueId: "housing",
        position: "Speed up permitting and ease building rules",
        detail: {
          simple:
            "He wants to make it faster and easier to build homes by cutting permitting delays and rewarding towns that speed up approvals.",
          expert:
            "He proposes letting cities and towns retain more of their tax dollars if they expedite single-family permitting, and blames slow municipal permitting and the stretch energy code for constraining housing construction.",
        },
        source: {
          name: "WGBH — GOP's Minogue rolls out his pitch for governor ahead of the general",
          url: "https://www.wgbh.org/news/politics/2026-09-10/gops-minogue-rolls-out-his-pitch-for-governor-ahead-of-the-general",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "climate",
        position: "Repeal the net-zero emissions mandate",
        detail: {
          simple:
            "He wants to repeal the state's net-zero emissions requirement, arguing current energy policy raises costs.",
          expert:
            "His policy blueprint calls for repealing the state's net-zero emissions mandate and ending enforcement of related energy policies he argues drive up electricity costs.",
        },
        source: {
          name: "WBUR — Minogue's blueprint promises audits, tax cuts and a net-zero emissions repeal",
          url: "https://www.wbur.org/news/2026/09/11/mike-minogue-gop-governor-policy-blueprint",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "transit",
        position: "Eliminate the state gas tax",
        detail: {
          simple:
            "He wants to get rid of the state's 24-cent-per-gallon gas tax to lower driving costs.",
          expert:
            "He has called for eliminating the state's 24-cent-per-gallon gas tax and reining in government spending as part of his affordability agenda.",
        },
        source: {
          name: "Boston 25 News — What would Mike Minogue change as Mass. governor? GOP candidate makes his case in 1-on-1 interview",
          url: "https://www.boston25news.com/news/local/what-would-mike-minogue-change-mass-governor-gop-candidate-makes-his-case-1-on-1-interview/JDX7WAHHWREBTAZZA3CHWI5HYY/",
          reviewedOn: "2026-10-24",
        },
      },
      {
        issueId: "healthcare",
        position: "Lower health care and utility costs",
        detail: {
          simple:
            "He argues state policies drive up health care and utility costs and wants to bring them down for families.",
          expert:
            "He criticizes current energy policy for raising utility, housing, health care, and child care costs, and centers his campaign on reducing those costs for working families alongside a detailed healthcare strategy.",
        },
        source: {
          name: "Boston 25 News — What would Mike Minogue change as Mass. governor? GOP candidate makes his case in 1-on-1 interview",
          url: "https://www.boston25news.com/news/local/what-would-mike-minogue-change-mass-governor-gop-candidate-makes-his-case-1-on-1-interview/JDX7WAHHWREBTAZZA3CHWI5HYY/",
          reviewedOn: "2026-10-24",
        },
      },
    ],
  },
];

export const candidatesById = new Map(candidates.map((c) => [c.id, c]));
