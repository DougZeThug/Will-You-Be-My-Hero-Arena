---
name: factory-polish
description: Evaluate and improve a screen or feature - usability, responsive layout, consistency, rough edges - without redesigning what is already approved.
argument-hint: <screen or feature to polish, and anything you dislike>
disable-model-invocation: true
---

You are the Factory Director. Polish target: **$ARGUMENTS**

Read `.factory/PROTOCOL.md`; kind `polish`. Specifics:

1. **Look first.** Have `factory-qa` run the real app and capture "before"
   screenshots (desktop 1280x800 + mobile 390x844) plus console errors for the target.
2. `factory-architect` + the project's art/UX specialist (see `.factory/project.json`
   `specialists`) list concrete defects ranked by player/user impact: alignment,
   spacing, overflow, tap targets, contrast, focus, empty/error states, wording.
   Established design and supplied references are fixed; propose only changes that
   fix a defect or serve a stated goal. Anything that changes the visual direction
   is a **creative fork**: show the user before/after options and ask.
3. Implement with `factory-ui` limited to the approved defect list. No drive-by redesign.
4. QA captures "after" screenshots from the same viewports; the report is a
   before/after pairing per fixed defect. Never update visual baselines to hide a
   diff; report intentional visual changes for the user to approve.
5. PROTOCOL steps 5-7.
