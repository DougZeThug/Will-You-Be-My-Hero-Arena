---
name: arena-performance-audit
description: Measure Arena real-time frame behavior and rendering/game counters, identify avoidable costs, and compare targeted performance changes without weakening art or animation. Use for slow frames, stutter or performance reviews.
---

# Arena performance auditing

Read [AGENTS.md](../../../AGENTS.md) and the performance section of [the Lab workflow](../../../docs/AI-DEVELOPMENT-WORKFLOW.md). Reuse the existing diagnostics rather than installing a second game loop or stacking WebGL wrappers.

Choose a scenario that reproduces the slow period. Record seed, viewport, browser, reduced-motion setting and whether rendering is hardware or software accelerated. Warm up assets before measuring sustained play; report asset load separately. Keep before/after conditions comparable.

Use `getPerformance()` and meaningful state/counters to identify whether time grows with characters, active projectiles, effects, textures, draw calls or scene lifetime. Inspect frame-time distribution and slow-frame frequency, not only rounded FPS. Treat texture memory as an estimate; do not imply precise GPU allocation.

Measure actual real-time playback for smoothness. Deterministic `step(...)`, paused checkpoints, background tabs and headless screenshots are useful correctness tools but do not establish user-device frame performance. Label those samples and do not mix them into a real-time percentile claim.

If cost grows after repeated scenario loads, inspect cleanup of input listeners, timers, game objects, textures and instrumentation. A one-time asset cache increase is different from unbounded growth. Keep instrumentation buffers bounded and disable or isolate expensive diagnostic work from the production path.

For an authorized optimization, fix the measured source of cost and repeat the same comparison. Preserve art resolution, connected shoulders, semantic markers and gameplay timing unless the user requested a quality tradeoff. Do not lower animation fidelity merely to improve a counter.

Run regression/state checks after changing runtime code and inspect affected motion. Save raw measurement/state evidence in `work/qa/`; report conditions, sample count, before/after distribution, relevant counters and limitations. Avoid claiming universal 60 FPS from one desktop run or a synthetic clock.
