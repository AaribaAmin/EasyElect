# Healthcare Query Adds Housing Card Bugfix Design

## Overview

The "Ask Easy Elect AI" chatbot detects which cause cards to surface by matching user messages against each cause's `keywords` list. The matcher, `detectCauses` in `server/src/ai/scripted.ts`, flags a cause whenever any keyword appears as a substring of the lowercased message. The Housing cause in `server/src/domain/causes.ts` lists the generic affordability adjective `"affordable"` as a keyword. As a result, any affordability-framed query about an unrelated topic — most visibly "I want affordable healthcare" — falsely matches Housing, so the Causes page is polluted with an irrelevant Housing card and the reply claims a Housing interest the user never expressed.

The fix is minimal and targeted: remove the over-broad `"affordable"` keyword from the Housing cause's `keywords` array while keeping every genuine housing term. The `detectCauses` substring-matching logic is correct for specific, on-topic keywords and does not change. The word "affordable" is already represented as a user-facing refinement ("Affordable rentals") rather than a detection keyword, so removing it from `keywords` does not weaken any legitimate Housing match.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a chatbot message whose lowercased text contains the substring `"affordable"` but contains no genuine housing keyword, yet Housing is still detected.
- **Property (P)**: The desired behavior — Housing is detected only when the message contains a genuine housing keyword, never merely because it mentions "affordable".
- **Preservation**: Existing cause detection for genuine housing queries and for every other cause must remain exactly as before.
- **detectCauses**: The function in `server/src/ai/scripted.ts` that lowercases a message and returns the ids of all causes for which any keyword is a substring of the message. It feeds `detectedCauses` on the `POST /api/chat` response.
- **Housing keywords**: The `keywords` array of the Housing cause in `server/src/domain/causes.ts`; currently `["housing", "rent", "homes", "affordable", "eviction", "landlord", "tenant"]`.
- **Genuine housing keyword**: Any Housing keyword that is specifically about housing — `"housing"`, `"rent"`, `"homes"`, `"eviction"`, `"landlord"`, `"tenant"` — as opposed to the generic adjective `"affordable"`.

## Bug Details

### Bug Condition

The bug manifests when a user sends the chatbot a message whose lowercased text contains the substring `"affordable"` but does not contain any genuine housing keyword. `detectCauses` matches the Housing cause purely on the generic adjective `"affordable"`, so Housing is surfaced for a query that is about the affordability of some unrelated topic (healthcare, education, transit, and so on) — or about affordability with no topic at all.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ChatMessage (free-text string)
  OUTPUT: boolean

  text := toLowerCase(input)

  RETURN text CONTAINS "affordable"
         AND NOT (text CONTAINS ANY genuineHousingKeyword)
             WHERE genuineHousingKeyword IN
                   ["housing", "rent", "homes", "eviction", "landlord", "tenant"]
         AND detectCauses(input) CONTAINS "housing"
END FUNCTION
```

### Examples

- `"I want affordable healthcare"` — Expected: only Healthcare detected. Actual: Housing and Healthcare both detected (Housing matched via `"affordable"`).
- `"affordable college"` — Expected: only Education detected. Actual: Housing and Education both detected.
- `"is anything affordable anymore"` — Expected: no cause detected (scripted fallback reply). Actual: Housing detected.
- `"affordable rent and healthcare"` — Expected: Housing and Healthcare both detected. Actual: Housing and Healthcare both detected (this is NOT a bug case — Housing matches via the genuine keyword `"rent"`, so the `isBugCondition` guard on genuine housing keywords is false).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Messages containing a genuine Housing keyword (`"housing"`, `"rent"`, `"homes"`, `"eviction"`, `"landlord"`, `"tenant"`) SHALL CONTINUE TO detect the Housing cause.
- Messages about a non-housing cause without the word "affordable" (for example "I care about healthcare", "tell me about climate") SHALL CONTINUE TO detect that cause and only that cause.
- Messages that mention both housing and another topic (for example "affordable rent and healthcare") SHALL CONTINUE TO detect both the Housing cause and the other cause.
- Messages that match no cause keywords SHALL CONTINUE TO detect no causes and return the scripted fallback reply.
- The `detectCauses` matching algorithm (substring match over lowercased text), the other causes' keyword lists, and the Housing cause's `title`, `icon`, `blurb`, `refinements` (including the "Affordable rentals" refinement), and `relatedIssueIds` remain unchanged.

**Scope:**
All inputs that do NOT satisfy the bug condition should be completely unaffected by this fix. This includes:
- Any message containing a genuine housing keyword (with or without "affordable").
- Any message about education, guns, climate, healthcare, or transportation that does not rely on "affordable" for its match.
- Any message that matches no cause at all.

**Note:** The expected correct behavior for bug-condition inputs is defined in the Correctness Properties section (Property 1).

## Hypothesized Root Cause

Based on the bug description and inspection of the source, the cause is well understood:

1. **Over-broad keyword in the Housing cause**: The Housing `keywords` array includes `"affordable"`, a generic affordability adjective that is not specific to housing. This is the direct cause.
   - `server/src/domain/causes.ts` — Housing cause: `keywords: ["housing", "rent", "homes", "affordable", "eviction", "landlord", "tenant"]`.

2. **Substring matching amplifies the over-broad keyword**: `detectCauses` matches when any keyword is a substring of the lowercased message (`text.includes(kw.toLowerCase())`). Combined with a generic keyword, any affordability-framed query about any topic matches Housing. The matcher itself is correct for specific keywords; the defect is the data, not the algorithm.

3. **Not a root cause (ruled out)**: The other causes' keyword lists do not contain generic affordability adjectives, so no equivalent false match exists elsewhere. The "affordable" concept is already surfaced for Housing through the `refinements` list ("Affordable rentals"), which is not used for detection, so removing it from `keywords` loses no legitimate match.

## Correctness Properties

Property 1: Bug Condition - Affordability Framing Does Not Match Housing

_For any_ input where the bug condition holds (isBugCondition returns true) — the message contains "affordable" but no genuine housing keyword — the fixed `detectCauses` SHALL NOT include the Housing cause id in its result, and SHALL still detect any on-topic cause present in the message (for example Healthcare for "affordable healthcare").

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Bug Cause Detection Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), the fixed `detectCauses` SHALL produce exactly the same set of cause ids as the original `detectCauses`, preserving detection for genuine housing queries, for every other cause, for mixed housing-plus-topic queries, and for no-match queries.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/src/domain/causes.ts`

**Location**: The Housing cause (`id: "housing"`), `keywords` array.

**Specific Changes**:
1. **Remove the over-broad keyword**: Delete the string `"affordable"` from the Housing cause's `keywords` array.
   - Before: `keywords: ["housing", "rent", "homes", "affordable", "eviction", "landlord", "tenant"]`
   - After: `keywords: ["housing", "rent", "homes", "eviction", "landlord", "tenant"]`

2. **Keep all genuine housing keywords**: `"housing"`, `"rent"`, `"homes"`, `"eviction"`, `"landlord"`, `"tenant"` remain unchanged so genuine housing detection is preserved.

3. **Leave everything else untouched**: No change to `detectCauses` in `server/src/ai/scripted.ts`, no change to the Housing cause's `title`, `icon`, `blurb`, `refinements` (the "Affordable rentals" refinement stays), or `relatedIssueIds`, and no change to any other cause.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on the unfixed code, then verify the fix works correctly and preserves existing behavior. Tests exercise `detectCauses` directly (unit and property level) and, where useful, the `POST /api/chat` endpoint via supertest to confirm the `detectedCauses` field end to end. Vitest is the project's test runner (`vitest run`).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `detectCauses` with affordability-framed messages that have no genuine housing term and assert that the result does NOT include `"housing"`. Run these tests on the UNFIXED code to observe them fail (Housing is wrongly detected), confirming the over-broad keyword is the cause.

**Test Cases**:
1. **Affordable healthcare**: `detectCauses("I want affordable healthcare")` should not include `"housing"` and should include `"healthcare"` (will fail on unfixed code — Housing wrongly detected).
2. **Affordable non-housing topic**: `detectCauses("affordable college")` should not include `"housing"` and should include `"education"` (will fail on unfixed code).
3. **Affordable with no topic**: `detectCauses("is anything affordable anymore")` should return no causes (will fail on unfixed code — Housing wrongly detected).
4. **Endpoint check**: `POST /api/chat` with "I want affordable healthcare" returns `detectedCauses` containing only `"healthcare"` (will fail on unfixed code).

**Expected Counterexamples**:
- Housing appears in `detectCauses` output for messages that contain "affordable" but no housing term.
- Confirmed cause: the generic `"affordable"` keyword in the Housing `keywords` array, matched by substring in `detectCauses`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := detectCauses_fixed(input)
  ASSERT NOT result CONTAINS "housing"
  ASSERT result CONTAINS every on-topic cause present in input
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT detectCauses_original(input) = detectCauses_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain.
- It catches edge cases that manual unit tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

The standard property-based testing library for this TypeScript/Vitest ecosystem is `fast-check`, which integrates directly with Vitest. If it is not already a dev dependency it should be added for the property tests; the unit and integration tests require no new dependency.

**Test Plan**: Observe behavior on the UNFIXED code first for genuine housing queries and other-cause queries, then write tests capturing that behavior and confirm it is preserved after the fix.

**Test Cases**:
1. **Genuine Housing keywords preserved**: For each of "housing", "rent", "eviction", "landlord", "tenant", "homes", `detectCauses` still includes `"housing"` after the fix.
2. **Mixed query preserved**: `detectCauses("affordable rent and healthcare")` still includes both `"housing"` and `"healthcare"` (Housing via the genuine keyword `"rent"`).
3. **Other-cause detection preserved**: `detectCauses("I care about healthcare")` and `detectCauses("tell me about climate")` each return exactly their one cause and not Housing.
4. **No-match preserved**: A message matching no keywords returns no causes and the endpoint returns the scripted fallback reply.

### Unit Tests

- `detectCauses` returns only `["healthcare"]` for "I want affordable healthcare".
- `detectCauses` returns only `["education"]` for "affordable college".
- `detectCauses` returns `[]` for "is anything affordable anymore".
- `detectCauses` still returns `["housing"]` for each genuine housing keyword.
- `detectCauses` returns both `"housing"` and `"healthcare"` for "affordable rent and healthcare".

### Property-Based Tests

- Generate random messages that embed "affordable" plus a non-housing topic keyword and assert Housing is never in the result while the topic's cause always is (Property 1).
- Generate random messages drawn from the non-bug input space (genuine housing terms, other-cause terms, no-match strings) and assert the fixed `detectCauses` output equals a reference computed against the original keyword lists minus the "affordable"-only Housing matches (Property 2).

### Integration Tests

- `POST /api/chat` with "I want affordable healthcare" returns `detectedCauses` of only `"healthcare"` and a reply that mentions Healthcare but not Housing.
- `POST /api/chat` with a genuine housing message ("my rent is too high") returns `detectedCauses` including `"housing"`.
- `POST /api/chat` with "affordable rent and healthcare" returns `detectedCauses` including both `"housing"` and `"healthcare"`.
