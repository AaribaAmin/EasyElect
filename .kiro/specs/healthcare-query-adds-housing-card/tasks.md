# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Affordability Framing Does Not Match Housing
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For reproducibility, scope the property to concrete bug-condition cases built from "affordable" + a non-housing topic keyword; generate over the non-housing topics (e.g. "healthcare", "college", "climate") with no genuine housing term present
  - Create `server/src/ai/scripted.bugfix.test.ts` (Vitest) importing `detectCauses` from `./scripted.js`
  - Assert `detectCauses("I want affordable healthcare")` does NOT include `"housing"` and DOES include `"healthcare"` (from Bug Condition / Example 1 in design)
  - Assert `detectCauses("affordable college")` does NOT include `"housing"` and DOES include `"education"` (Example 2 — note "college" is the education keyword)
  - Assert `detectCauses("is anything affordable anymore")` returns `[]` — no cause, including no `"housing"` (Example 3)
  - Property-based (fast-check): for any non-housing topic keyword `k`, `detectCauses("affordable " + k)` does NOT include `"housing"` and DOES include that topic's cause id (isBugCondition from design: text contains "affordable" and no genuine housing keyword)
  - Run on UNFIXED code: `npm test` in `server/` (or `vitest run` scoped to the file)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists; Housing is wrongly detected via the "affordable" keyword)
  - Document counterexamples found (e.g., `detectCauses("I want affordable healthcare")` returns `["housing", "healthcare"]` instead of `["healthcare"]`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Bug Cause Detection Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run the UNFIXED code first, record actual outputs, then assert those outputs
  - Create `server/src/ai/scripted.preservation.test.ts` (Vitest) importing `detectCauses` from `./scripted.js`
  - Observe on UNFIXED code and assert each genuine Housing keyword still detects Housing: for each of "housing", "rent", "homes", "eviction", "landlord", "tenant", `detectCauses` includes `"housing"` (Preservation 3.1)
  - Observe and assert single-cause detection for non-housing topics without "affordable": `detectCauses("I care about healthcare")` equals `["healthcare"]`; `detectCauses("tell me about climate")` equals `["climate"]` (Preservation 3.2)
  - Observe and assert mixed query: `detectCauses("affordable rent and healthcare")` includes both `"housing"` (via genuine keyword "rent") and `"healthcare"` (Preservation 3.3)
  - Observe and assert no-match: a message matching no keywords (e.g. "the quick brown fox") returns `[]` (Preservation 3.4)
  - Property-based (fast-check): generate messages from the non-bug input space (genuine housing terms, other-cause terms, and no-match strings) and assert the output equals a reference computed against the original keyword lists — capturing that all non-bug-condition inputs are unaffected
  - If `fast-check` is not yet a dev dependency in `server/package.json`, add it (`npm install -D fast-check` in `server/`) for the property tests
  - Run on UNFIXED code: `npm test` in `server/`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for Housing cause matching affordability-framed non-housing queries

  - [x] 3.1 Remove the over-broad "affordable" keyword from the Housing cause
    - In `server/src/domain/causes.ts`, edit the Housing cause (`id: "housing"`) `keywords` array
    - Before: `keywords: ["housing", "rent", "homes", "affordable", "eviction", "landlord", "tenant"]`
    - After: `keywords: ["housing", "rent", "homes", "eviction", "landlord", "tenant"]`
    - Leave everything else untouched: no change to `detectCauses` in `server/src/ai/scripted.ts`, no change to the Housing cause's `title`, `icon`, `blurb`, `refinements` (keep the "Affordable rentals" refinement), or `relatedIssueIds`, and no change to any other cause
    - _Bug_Condition: isBugCondition(input) — text contains "affordable" AND no genuine housing keyword AND detectCauses(input) contains "housing"_
    - _Expected_Behavior: for bug-condition inputs, detectCauses SHALL NOT include "housing" and SHALL still detect any on-topic cause present_
    - _Preservation: Preservation Requirements from design — genuine housing keywords, other causes, mixed queries, and no-match queries unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Affordability Framing Does Not Match Housing
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior; when it passes, it confirms Housing is no longer matched by "affordable" alone
    - Run `npm test` in `server/`
    - **EXPECTED OUTCOME**: Test PASSES (confirms the bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Bug Cause Detection Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run `npm test` in `server/`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions for genuine housing, other causes, mixed queries, and no-match)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Add integration tests for POST /api/chat
  - Add integration tests (supertest against the Express app in `server/src/app.ts`, following the pattern in `server/src/app.test.ts`)
  - `POST /api/chat` with "I want affordable healthcare" returns `detectedCauses` containing only `"healthcare"` and a reply that mentions Healthcare but not Housing (Expected Behavior 2.1)
  - `POST /api/chat` with a genuine housing message ("my rent is too high") returns `detectedCauses` including `"housing"` (Preservation 3.1)
  - `POST /api/chat` with "affordable rent and healthcare" returns `detectedCauses` including both `"housing"` and `"healthcare"` (Preservation 3.3)
  - Run `npm test` in `server/` and confirm these pass on the fixed code
  - _Requirements: 2.1, 3.1, 3.3_

- [x] 5. Checkpoint - Ensure the full build and test suite pass
  - Run the server build (`npm run build` in `server/`) and the full test suite (`npm test` in `server/`, i.e. `vitest run`)
  - Confirm all exploration, preservation, and integration tests pass and no existing tests regress
  - Ensure all tests pass; ask the user if questions arise
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_
