# Character personalities and court presentation

The current renderer uses separate illustrated body parts driven by authored GSAP joint timelines. Dan and Doug now perform different arm and leg sequences. Built-in motion choices are starting points, and each new pack can carry its own custom choreography. See [ANIMATION-HANDOFF](ANIMATION-HANDOFF.md) for the current system and limits.

Open **The Collection → Explore motion styles** to try a starting personality, then change individual moves. Selecting a move plays the relevant preview. **Return to this card’s personality** restores the saved profile. Preview changes do not change installed cards or match recordings; Codex saves the chosen profile in a new character pack.

## Starting styles

The quiet operator, The lock-in showman, The wildcard, The ice-cold closer, The powerhouse, The sharpshooter, The hothead, The trickster, The old hand, The eager rookie, The headliner, The stone face, The hype machine, The scrappy underdog, The perfectionist, The swagger king, The party starter, The comeback kid, The slow burn, The live wire, The zen master, The relentless grinder, The chaos merchant, The clubhouse captain.

| Category | Available movements |
| --- | --- |
| Entrance | Planted arrival, Fist-first pop, Wobbly burst, Easy glide, Heavy landing, Side slide, Paper twist, Spring-loaded hop |
| Idle | Quiet breathing, Heel tap, Restless shuffle, Slow sway, Watchful lean, Rhythmic bob, Weight shift, Relaxed lean |
| Throw | Measured setup, Quick snap, Offbeat wind-up, Smooth release, Power drive, Pendulum rock, Hesitation beat, Whip release |
| Celebration | Quiet fist raise, Showy flourish, Victory jig, Knowing lean, Raised-arm salute, Victory strut, Excited pop, Crowd bow |
| Frustration | Head-down reset, Annoyed stamp, Disbelief wobble, Small shrug, Surprised recoil, Impatient shuffle, Deadpan hold, Deflated slump |

Dan retains the quiet operator combination: planted entry, breathing idle, measured throw, restrained fist raise and low-stance reset. Doug retains the lock-in showman combination: raised-fist pop, heel tap, quick snap, flourish and annoyed stamp. For another card, a quiet breathing idle can pair with a whip release, an excited jump and a deadpan miss. A name such as “The last-bag menace” belongs to the authored combination rather than restricting it to a broad personality bucket.

## Future uploads in Codex

Upload a card and ask to make and install its character. Codex generates and reviews the articulated parts and six compatibility poses, registers the palms and feet, authors custom joint tracks, and packages it in the finished `.arena-character.json`. The saved workflow compares available existing recipes and avoids repeating their choreography. When preparing a batch, it keeps a working roster table so choices remain intentional across many cards. You do not need to choose numeric settings or edit source code.

The optional personality object is stored in the recipe and asset manifest:

```json
{
  "preset": "veteran",
  "name": "The last-bag menace",
  "energy": 0.94,
  "tempo": 1.03,
  "seed": 7041,
  "moves": {
    "entrance": "slide",
    "idle": "scan",
    "throw": "hesitate",
    "celebration": "strut",
    "frustration": "freeze"
  }
}
```

The exact keys live in `lib/arena/motion-catalog.json`, also included in the saved skill. Name is optional, 1–80 characters. Energy is 0.5–1.4; tempo is 0.85–1.2; seed is an integer 0–1000000. Moves are optional overrides of the starter. Newly authored packs explicitly record all five. Personality changes create new immutable pack revisions. Existing four-style profiles and recipes with no personality keep their exact pack contents/revisions and remain accepted.

## Court grounding

Each pose gets two soft, layered contact shadows derived from its transparent silhouette near the soles. Shadows blend with the registered foot positions during a pose change, soften when a character hops and stay on the court plane. The renderer applies a subtle warm sunset tint; original PNGs remain unchanged. Both players keep their registered court positions and exact release palms.

Each player has one presentation card 130 world pixels behind/left and 24 pixels above their floor baseline, scaled to 0.86 (about 18% larger than before). The old freestanding trapezoid base is removed. The same card is the portal source and remains the character’s anchor.

All equipment now stands on a shared lane baseline: 622 for the foreground and 489 for the rear. The rear board is 70% of the foreground scale; hoops, targets and tables use 78%. Cups and projectiles scale consistently with the target lane. Subtle court guide marks make the throwing direction readable. Artwork, scoring surfaces and projected contact points remain registered together.

## Timing, implementation and limits

The entrance takes 2.65 seconds, with players staggered 0.74 seconds apart. Card impact, charge, clipped emergence, landing and pose settling follow the playback clock. Setup-dialog exit and asset readiness gate playback, so the first entrance is visible. Scores resolve within about 2.3 seconds; complete turns allow up to 3.7 seconds for natural reactions. Waiting idles use 16% amplitude. At the release instant, the drawing is fully visible at its registered hand and the projectile starts there immediately.

`personality.ts` resolves and validates combinations. `match-timeline.ts` owns cadence and ordered phases. `summon-motion.ts` handles portals, `pose-motion.ts` handles character actions, and `grounding.ts` locates soles and card anchors. PixiJS performs the masks, pose blends, tint and transformations. GSAP now interpolates the articulated joint tracks; pose-motion remains the compatibility renderer for older eight-image packs.

Personality is cosmetic. It never changes accuracy, targets, physics samples, scoring, rarity or awards. New matches snapshot the complete nested profile; existing recordings are not rewritten. Reduced motion removes travel, shaking, hops, tilt and scale changes while keeping readable states and poses.

The characters remain illustrated paper cutouts. Head, arms, legs and feet animate independently in articulated packs. Faces and fingers remain fixed drawings. New joint gestures are supported through authored pack tracks; additional facial or hand variants still need artwork and renderer support.
