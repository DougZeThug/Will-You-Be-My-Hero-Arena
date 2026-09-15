# Human motion reference library

Development data only. No video model, Python dependency or reference footage ships with Arena.

Ask Astra: **“Analyze this video for Dan's basketball shot, show the reference beside his rig, then propose the timing changes.”** Attach the video here in Codex. Astra runs the utility and loads its JSON into Human Motion V2. You do not need to operate a terminal or author keyframes.

The pinned development environment uses MediaPipe Pose Landmarker 0.10.32, OpenCV contrib 4.13.0.92 and NumPy 2.2.6. Use one OpenCV distribution; MediaPipe already depends on contrib. Install `requirements.txt` into `work/motion-venv`. Model: [Google's pose landmarker lite, float16 revision 1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task), stored in `work/motion-models`. Every extraction records the actual model/video SHA-256.

Developer invocation:

```powershell
./work/motion-venv/Scripts/python.exe scripts/motion-reference/extract.py reference.mp4 --out work/qa/motion-reference --start 0 --seconds 8
```

Optional `--crop x,y,width,height` isolates one person before inference. Use a steady camera and visible feet/hands. No automatic multi-person identity inference or camera-motion compensation is claimed.

Outputs: `motion.json`, `summary.json`, annotated `overlay.mp4`, and one inspected PNG per second. Source timestamps come from decoded presentation time; any nominal-FPS fallback is recorded. Gaps and low-confidence landmarks remain unavailable. A short symmetric filter reduces noise without introducing causal phase lag. Normalize with a fixed median torso length and aspect-correct image coordinates; retain original image/world positions, confidence, joint angles, velocities and acceleration. Pose-model hand landmarks are coarse references, not individual finger rigs. “Mass proxy” is explicitly approximate.

The browser importer validates bounded, monotonic reference tracks. The retarget helper produces a review proposal using target limb lengths and reference angles; it does not mutate a live rig or generate approved production animation. Perspective and occlusion need review before authoring.

Initial coverage:

| Family | Evidence | Status |
|---|---|---|
| Locomotion / athletic jump | Google's public [real-person pose demonstration](https://mediapipe.dev/images/mobile/pose_world_landmarks.mp4) | Toolchain exercised on 125 decoded frames; derived fixture in `locomotion/` |
| Cornhole | `cornhole/measured.json` and `reference-throw.json` | 158 measured frames; confidence-qualified near-side tracks plus declared authored adaptations |
| Basketball | [Jr. NBA shooting setup](https://jr.nba.com/shooting/) and [Allan Houston demonstration](https://jr.nba.com/video/fundamentals-of-shooting/) | Coaching reference; no claim of extracted basketball tracks |
| Running | [Running reference provenance](running/README.md) | 241 measured frames; near-side cycle retargeted with character lengths and bounded swing |
| Football, combat, celebrations | Import path available | Event-specific video data still to be curated |

Keep third-party videos and large debug overlays in ignored `work/`. Keep concise derived data with provenance here. Never label generated or manually authored poses as measured human landmarks. Follow the [official MediaPipe API guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python) for model/API changes.

The Lab's **Load measured reference demo**, **Retarget proposal on Dan** and **Export Dan motion proposal** buttons exercise this path without code. `retargetMotion` emits a full timed intermediate track, preserving target lengths and detected gaps. A speed change scales timestamps and supplied semantic markers together. These proposals require native clip authoring and visual review before installation.
