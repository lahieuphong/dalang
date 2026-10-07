# Dalang · Wayang Kulit hand puppets

An interactive Wayang Kulit shadow theatre for the browser. Raise both hands to
your webcam: each hand becomes the dalang's grip on one of two ornate puppets,
which move, lean, gesture and cast lamp-lit shadows on the screen.

Everything runs locally in the browser. No server, and the video never leaves the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

`npm run dev` and `npm run build` first run `scripts/setup-mediapipe.mjs`. It
copies the MediaPipe WASM runtime from `node_modules` into `public/mediapipe/wasm`
and downloads `public/models/hand_landmarker.task` if it is missing.

The camera needs a secure context: `localhost` or HTTPS.

## Playing

| Your hand                         | The puppet                                  |
| --------------------------------- | ------------------------------------------- |
| Move left / right                 | Walks across its half of the stage          |
| Raise high                        | Lifts off the rail                          |
| Tilt                              | Leans forward or back                       |
| Curl / extend the index finger    | Lowers / raises the front arm               |
| Point with the index alone        | Points the front arm at the other puppet    |
| Open / close the other fingers    | Raises / lowers the back arm                |
| Spread the thumb                  | Flicks the front wrist                      |
| Pinch thumb and index             | Bows the head                               |
| Bring the hand toward the camera  | Draws the puppet toward the lamp (bigger, softer shadow) |

Your left hand drives the left puppet and your right hand drives the right one.

The settings panel (gear icon) has camera on/off, the landmark overlay, preview
mirroring, motion sensitivity and motion smoothing. These preferences are saved
in `localStorage`. Camera permission is never stored.

The sound button starts a quiet, generated gamelan-style ambience. It is built
with Web Audio, so there are no audio files. You also hear a cempala knock when
a puppet is picked up. Sound is off by default and only starts after you click.

## How it works

```
webcam ──► MediaPipe HandLandmarker (≈28 Hz, GPU with CPU fallback)
             │  21 landmarks + handedness per hand, mirrored into view space
             ▼
         HandAssigner            stable hand → puppet pairing
             ▼
         extractHandFeatures     palm, tilt, finger extension, pinch, size
             ▼
         One Euro filters        removes tremor, keeps fast moves responsive
             ▼
         rigFromHand             artistic mapping to a target pose, clamped
             ▼
         PuppetController        idle/hand blend, grace period, secondary motion,
                                 damped springs at 60 fps
             ▼
         Puppet (SVG rig)        transforms set directly on SVG groups
```

- **A single loop.** `WayangExperience` runs one `requestAnimationFrame` loop.
  Per-frame data lives in refs and plain objects. React state only holds
  coarse UI state: camera status, model status, the number of hands held, and
  settings.
- **Inference throttling.** `HandTracker` runs detection at most ~28 times a
  second. It never processes the same video frame twice and only runs once the
  video has data. Between detections, the springs keep animating at display
  rate.
- **Stable assignment.** Handedness is noisy, so `HandAssigner` scores each
  possible pairing. The score combines distance from each puppet's last palm
  position, MediaPipe handedness and a weak left/right screen prior. While a
  hand is tracked, continuity wins: crossing hands or a mislabelled frame
  never swaps puppets. Handedness re-routes a hand only after it disagrees
  consistently for about a third of a second.
- **Mirroring.** MediaPipe labels handedness as if the image were a selfie.
  We feed it the raw frame, so the labels are swapped back in
  `lib/handTracker.ts`. Landmarks are then mirrored into view space, so the
  overlay canvas is never flipped.
- **Transitions.** When a hand is lost, its pose is held for 380 ms, then the
  puppet eases back to a breathing rest pose. A new hand eases the puppet up
  from rest; puppets never teleport.
- **Shadows.** Each puppet is rendered twice. The second copy is a flat
  silhouette that goes through a Gaussian blur. It is offset away from the lamp
  and scaled around it, so the shadow grows and softens as the puppet nears the
  lamp.

## Project layout

```
src/
  components/
    WayangExperience.tsx  orchestration and the animation loop
    TheaterStage.tsx      carved frame and lamp-lit screen
    StageScene.tsx        SVG scene: shadows, puppets, valance, tassel, rail
    Puppet.tsx            articulated puppet rig (imperative apply(rig))
    puppet/PuppetArt.tsx  original puppet artwork (two characters)
    puppet/palettes.ts
    Backdrop.tsx          gradients, kawung batik, mega-mendung-style clouds
    WebcamPreview.tsx, HandOverlay.tsx, StageControls.tsx,
    SettingsPopover.tsx, StatusPill.tsx, DebugPanel.tsx, icons.tsx
  hooks/                  useCamera, useHandTracking, useAnimationFrame,
                          usePreferences, useParallax
  lib/                    handMath, handAssignment, handTracker, landmarker,
                          puppetGeometry, puppetMapping, puppetMotion,
                          smoothing, drawHands, ambientAudio, status, settings,
                          simulatedHands
  styles/wayang.css
  assets/textures/        tiny SVG textures (paper, grain, kawung, floral trim)
```

## Developer flags

- `?debug=1` shows inference FPS, handedness, the hand-to-puppet assignment,
  the slots' handedness disagreement and the live features.
- `?simulate=1` drives the puppets with synthetic, scripted hands, so you can
  work without a camera. Combine both flags as `?simulate=1&debug=1`.

## Assets

- All artwork is original SVG drawn for this project: puppets, ornaments, clouds and textures.
- `@mediapipe/tasks-vision` is pinned to an exact version. The JavaScript
  bundle, the copied WASM files and the CDN fallback must all match.
- The hand model (`hand_landmarker.task`, about 7.8 MB, Apache-2.0) and the
  WASM runtime are served from this site. If they can't be loaded, the app
  falls back to the public MediaPipe CDN and Google Storage URLs.
- If the camera or the model is unavailable, the theatre still renders and
  the puppets idle. A small status line explains what happened.
