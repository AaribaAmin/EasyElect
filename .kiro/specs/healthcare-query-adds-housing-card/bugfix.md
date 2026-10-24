# Bugfix Requirements Document

## Introduction

When a user asks the "Ask Easy Elect AI" chatbot a healthcare-only question such as "I want affordable healthcare", the assistant surfaces two cause cards — Housing and Healthcare — when only Healthcare is expected. The chatbot's cause detection is keyword-based: the server's `detectCauses` matches a cause whenever any of its keywords appears as a substring of the lowercased message. The Housing cause lists the generic affordability adjective `"affordable"` among its keywords, so any query that mentions being able to "afford" something — including "affordable healthcare" — falsely matches Housing in addition to the intended cause.

The impact is that the user's Causes page is polluted with an irrelevant Housing card, the assistant's reply claims interest in Housing the user never expressed, and cause detection becomes unreliable for any affordability-framed query across unrelated topics (education, transit, etc.).

The over-matching keyword lives in `server/src/domain/causes.ts` (Housing cause) and is consumed by `detectCauses` in `server/src/ai/scripted.ts`, which feeds `detectedCauses` on the `POST /api/chat` response.

## Bug Analysis

### Current Behavior (Defect)

When the chatbot detects causes from a free-text query, the generic word "affordable" is treated as a Housing keyword, causing Housing to match queries that are about affordability of an unrelated topic.

1.1 WHEN the user sends the chatbot a message containing "affordable healthcare" THEN the system detects both the Housing cause and the Healthcare cause and adds both cards
1.2 WHEN the user sends a message that contains the word "affordable" alongside a non-housing topic (for example "affordable college") THEN the system detects the Housing cause in addition to the topic's own cause
1.3 WHEN the user sends a message that contains the word "affordable" with no housing-related term THEN the system detects the Housing cause

### Expected Behavior (Correct)

Cause detection should match Housing only when the message refers to housing, not merely because it mentions affordability of some other topic.

2.1 WHEN the user sends the chatbot a message containing "affordable healthcare" THEN the system SHALL detect only the Healthcare cause and add only the Healthcare card
2.2 WHEN the user sends a message that contains the word "affordable" alongside a non-housing topic (for example "affordable college") THEN the system SHALL detect only that topic's cause and SHALL NOT detect the Housing cause
2.3 WHEN the user sends a message that contains the word "affordable" with no housing-related term THEN the system SHALL NOT detect the Housing cause

### Unchanged Behavior (Regression Prevention)

Genuine housing queries and all other cause detection must continue to work exactly as before.

3.1 WHEN the user sends a message containing a genuine Housing keyword (for example "housing", "rent", "eviction", "landlord", or "tenant") THEN the system SHALL CONTINUE TO detect the Housing cause
3.2 WHEN the user sends a message about a non-housing cause without the word "affordable" (for example "I care about healthcare" or "tell me about climate") THEN the system SHALL CONTINUE TO detect that cause and only that cause
3.3 WHEN the user sends a message that mentions both housing and another topic (for example "affordable rent and healthcare") THEN the system SHALL CONTINUE TO detect both the Housing and the other cause
3.4 WHEN the user sends a message that matches no cause keywords THEN the system SHALL CONTINUE TO detect no causes and return the scripted fallback reply
