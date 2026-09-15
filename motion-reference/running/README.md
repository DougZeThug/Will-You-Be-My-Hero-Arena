# Running reference — V3

Actual footage: [Melissa Rudolph, Running Lateral View Slow](https://www.youtube.com/watch?v=j8P_GLzV_3U). This is a side-view adult running outdoors, not generated character motion. The downloaded source SHA-256 is `6210b241766952c179ffcc8eb22d69259ddcdcf8b4ad49a64b9b7e35abb18cf9`.

`measured.json` preserves 241 MediaPipe detections over the first eight seconds, image/world landmarks, joint angles, confidence, velocity and acceleration. Source video is 1280×720 at 30 fps. The original execution cadence is **unknown** because the uploader slowed the video. Derivatives retain media seconds and are not claimed to measure real-world running speed. Estimated world coordinates and the mass proxy are not calibrated motion capture or measured forces.

`reference-gait.json` selects media time 3.3–5.733333 seconds. The required near hip, knee, ankle, heel, toe, shoulder, elbow and wrist all exceed the compiler's 0.6 confidence gate. The compiler preserves source/model hashes and records the actual minimum confidence. It converts aspect-correct landmarks to hip/arm angles and knee/elbow flexion, applies a five-frame symmetric binomial filter, samples 33 phase keys and blends the cycle seam. The stance fraction of 0.43 is a visually estimated contact interval, not a force measurement.

Reproduce with the installed development Python:

```powershell
./work/motion-venv/Scripts/python.exe scripts/motion-reference/compile_running.py --input motion-reference/running/measured.json --out motion-reference/running/reference-gait.json
```

Runtime adaptation in `lab/human-motion/authoring/gait.ts` converts these angles through Dan/Doug's own thigh/shin lengths, bounds swing height and foot travel, and supplies native foot-IK targets. The far side uses a half-cycle offset; it is an authored adaptation, not an independently measured far-side track. Walking is an intentionally reduced-amplitude adaptation and is not claimed to be measured walking. Run/jog/sprint cadence and travel are gameplay authoring choices matched to CharacterMotor speed. The original person's appearance and limb lengths are not transferred.

This approach follows the scope of [UCSF's 2D running analysis](https://radiology.ucsf.edu/research/labs/biomechanics-and-musculoskeletal-imaging-lab-souza-lab/2-d-running-analysis-write): sagittal kinematic measurements can inform review, but do not establish complete 3D mechanics or ground forces.

Downloaded footage, overlays and decoded frames remain under ignored `work/qa/v3-reference/`. No MediaPipe, OpenCV, NumPy, model or footage is required by the shipped application. The compact compiled curves are used only by the opt-in Human Motion Lab.
