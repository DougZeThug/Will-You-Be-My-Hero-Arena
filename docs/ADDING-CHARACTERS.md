# Make another character from a card

Current animation: see [Articulated animation](ARTICULATED-ANIMATION.md). New packs can include a version 2 continuous-limb atlas and custom joint tracks; original eight-image packs retain the pose renderer.

Upload the original card in Codex and say **“Make this card an arena character.”** The saved `arena-card-to-character` skill handles the art and packaging. Add outfit, personality or celebration notes only if you want something the card does not show.

Codex identifies the person, preserves the original card, generates the six transparent cutout poses in the approved style, aligns the feet and throwing hand, checks the drawings, and returns one `.arena-character.json` file plus a pose preview. You do not need to draw poses, write JSON, or change the game code.

In the game, open **The collection → Install character**, choose that finished file, inspect the six-pose preview, and select **Install & preview**. The character becomes selectable in all four sports. If you ask Codex to install it into your accessible local arena, Codex can do that step too.

## What comes from the card

The card provides the visible likeness, clothes and visual identity. The additional poses are newly generated to match it; unseen poses cannot literally be extracted from a single drawing. The original card remains a separate, intact image.

The current six-pose family includes ready, underarm backswing, underarm release, football wind-up, basketball shot and celebration. The game connects these drawings through its shared match timeline, with short fades, subtle whole-paper movement, and a prop that follows each registered palm until release. New packs inherit the polished sequence without extra animation files or source edits. Cornhole and pong share the underhand sequence; football has a cocked wind-up followed by the common forward release.

## What the pack includes

- A new roster entry, with the character’s name, description and balanced game traits.
- The original card and six transparent pose PNGs, plus a registered atlas.
- Foot and palm markers, court scale and the four-sport animation mapping.
- Image checksums and a creation record.

The installer checks file structure, image integrity, source dimensions, real alpha transparency, valid markers and the 200-point trait budget before saving. The generation workflow still includes visual review: technical validation cannot judge whether a face is a good likeness.

## Saved characters and matches

Character packs are stored in this browser’s IndexedDB library, separately from the match ledger. They remain after a reload. The local demo makes an installed character available to its demo users. Keep the original pack file to install on another device or restore after browser data is cleared. Resetting demo scores does not remove the character library.

Match recordings contain stable asset paths and a snapshot of the pose geometry, rather than repeating large image data in every match. Existing character IDs cannot be overwritten with different packs. The packer assigns a new content-based ID when artwork or metadata changes. Installing an identical pack twice does not create duplicate roster entries.

The **Advanced asset mapping** panel still attaches a manually prepared mapping to an existing roster character; ordinary additions should use **Install character**.

## Current boundaries

Generation runs here in Codex using its image tools; the game does not need an image-generation API key. This workflow supports the reviewed human animation family. Pets, unusual anatomy, extra walk-cycle frames, or more elaborate individual celebrations require additional drawing and animation support.

## Give the character a personality

Upload the card in Codex and describe the intended court attitude, or let Codex interpret the supplied card. The saved workflow authors a named combination of entrance, idle, throw, celebration and frustration. Each has eight movement choices, with 24 starter bundles and adjustable energy, tempo and stable variation seed. These are independent choices, allowing a large roster to mix reserved, flamboyant, impatient and playful behaviors across different moments.

The Collection → Explore motion styles previews starters and individual moves without changing the saved character. Codex puts the reviewed combination into the finished pack. The updated workflow compares available recipes so new cards do not simply repeat the same five-move combination. Existing packs remain compatible; no JSON editing is required from the user. See `CHARACTER-PERSONALITIES.md`.
