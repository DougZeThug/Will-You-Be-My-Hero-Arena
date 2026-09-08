# Character production and mapping

Every competitor has a collectible card face and an independent animated arena rig. The initial showcase has Mack (human) and Captain Marmalade (quadruped cat). Additional humanoids, the second pet, and a Secret character are deliberately held for the requested user review of this first pair.

Production completed for the pair:

1. Generated separate illustrated component sheets with three expression heads and torso/limb pieces. Original PNGs retain alpha even though some image viewers expose hidden RGB background colors.
2. Inspected the sheets, detected grid drift, cropped by actual alpha components, removed neighboring fragments, and added transparent padding. Do not blindly slice equal cells: row-three parts started above the nominal grid line.
3. Closed selected visible cat joint caps with adjacent fur patches. Prepared assets are under `public/assets/mack` and `public/assets/marmalade`. Original sheets are kept alongside the parts.
4. Authored separate human and feline rigs. Two-bone arm/paw chains drive event-specific release sockets; body, head, legs and tail animate independently. Expression swaps provide happy and disappointed faces. All supported views are shallow right-facing three-quarter views. Camera motion stays in the illustration plane.
5. Created 2:3 collectible demo card faces from the same prepared artwork, while keeping the arena figure independent. Future original cards should retain their original artwork and aspect ratio.
6. Connected prepare, sport-specific release, follow-through, reactions, recovery, summon, walk and victory poses to the shared playback clock.

For an imported card, provide the card plus optional clear reference photographs and a short personality description. Recreate obscured full-body anatomy, isolate movable layers, paint overlap areas, normalize proportions, align the feet/ground anchor, bind joints, and author appropriate sports poses. A single uploaded card is not an automatically finished rig.

The Collection → Asset mapping screen validates JSON and asset loading, attaches prepared assets to an existing catalog ID, and previews the supported family’s motion. It is a mapping and preview workflow, not a full visual skeleton editor or automatic retargeter. An imported rig must conform to the authored family’s normalized dimensions and release sockets. Custom proportions, unusual anatomy and new skeleton families require authored rig/action mappings in `rig.ts` before they can be selected. The `scale` and `groundAnchor` manifest fields describe the normalized contract; arbitrary retargeting of those fields is not implemented.

Review every expression and clip for identity drift, visible caps, gaps, floating feet, detached props, silhouette overlap, and release-point agreement. The first prototype still needs the user’s motion/style review before these conventions are expanded across the roster. No licensed runtime or paid external animator is required to run the current pair. More complex Secret anatomy may benefit from manual animation polish, but no external service is currently blocking this showcase.

Signature moves are cosmetic. Blacklight Bloom is a recorded preselected cosmetic stage effect and adds no score. Actual scoring always comes from the shot/contact record.
