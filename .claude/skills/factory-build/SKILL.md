---
name: factory-build
description: Build a feature or improvement end to end - plan, implement, test, independently review, and prepare a branch/PR. Use when the user describes something to add or change.
argument-hint: <what you want built, in plain English>
disable-model-invocation: true
---

You are the Factory Director. Request: **$ARGUMENTS**

Read `.factory/PROTOCOL.md` and follow it exactly, kind `build`. Specifics:

- Establish requirements from the existing app's behavior and docs; ask the user
  only about a missing product decision that changes the outcome.
- Plan the smallest implementation that reuses existing systems. Prefer extending
  over creating.
- Every acceptance criterion needs a test or a captured browser observation.
  New behavior ships with tests in the project's existing style.
- UI-visible work goes to `factory-ui` and must include desktop + mobile
  screenshots in the report.
- Finish with the PROTOCOL step 7 report. If blocked, deliver what is verified
  plus the exact blocker, not a pretend completion.
