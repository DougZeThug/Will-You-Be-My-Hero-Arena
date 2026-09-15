# Directional garment sources

Generated with the built-in ImageGen tool on 2026-09-14 as targeted edits of the existing side-view source atlases. Requested change: rear-three-quarter garment material for opposite-facing presentation, preserving the existing illustrated style and clothing. Doug uses the patterned back of his open overshirt; Dan uses the plain white shirt back.

- Doug generation: `exec-cc0db47b-138e-4c74-bd80-3f12e4862e72.png`
- Dan generation: `exec-1d81d4c9-e583-480f-9e9e-8f960ebfc02d.png`

These source images are not used as replacement character atlases. `DirectionalSkin` composites only the garment polygon into a private texture, rejects source magenta, and retains the original alpha, face, hair, hands, arms, legs and shoes. Only `body` / `torso_back` slots receive the variant, only in the opposite view. The front view uses the approved original print. Native anatomical bone scales stay at one. Near-arm semantics remain anatomical right in the rear-three-quarter view.

The protected-pixel browser test compares source alpha and pixels outside the garment area and rejects introduced magenta. Review both views at full character scale; the generated garment material does not establish a new rig, a complete directional asset pack, or an editor round trip.
