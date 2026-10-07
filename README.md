# Dalang · Wayang Kulit hand puppets

An interactive Wayang Kulit shadow theatre for the browser. Raise both hands to
your webcam: each hand becomes the dalang's grip on one of two ornate puppets,
which move, lean, gesture and cast lamp-lit shadows on the screen.

Everything runs locally in the browser. No server, and the video never leaves the device.

## Run it

This project uses [Yarn](https://classic.yarnpkg.com/) 1.x.

```bash
yarn install
yarn dev        # http://localhost:5173
yarn build      # type-check + production build into dist/
yarn preview    # serve the production build
```

`yarn dev` and `yarn build` first run `scripts/setup-mediapipe.mjs`. It
copies the MediaPipe WASM runtime from `node_modules` into `public/mediapipe/wasm`
and downloads `public/models/hand_landmarker.task` if it is missing.

The camera needs a secure context: `localhost` or HTTPS.

## Playing

Every finger drives its own joint, continuously; there are no gesture
thresholds to cross before something happens.

| Your hand                         | The puppet                                       |
| --------------------------------- | ------------------------------------------------ |
| Show a hand                       | Lifts its puppet up from behind the rail         |
| Move left / right                 | Walks across its half of the stage               |
| Raise high / lower                | Lifts the puppet higher / lets it sink           |
| Roll the wrist                    | Leans the body forward or back                   |
| **Index**: curl / extend / aim    | Front shoulder: lowers / raises / aims the arm   |
| Index alone (others curled)       | Points the front arm at the other puppet         |
| **Middle**: curl                  | Bends the front elbow                            |
| **Thumb**: spread / curl          | Turns the front wrist                            |
| **Thumb–index pinch**             | Precise grip: wrist turns in, forearm draws in, fingers close, head nods |
| **Ring**: extend                  | Raises the back arm                              |
| **Pinky**: extend                 | Straightens the back elbow                       |
| Close the whole hand              | Compacts both arms, the puppet's hands close     |
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
webcam (960×540, up to 60 fps)
   │  requestVideoFrameCallback: each fresh frame, once
   ▼
HandTracker            MediaPipe HandLandmarker (GPU, CPU fallback), adaptive
                       rate within a main-thread budget; 21 landmarks per hand
   ▼
HandAssigner           stable hand → puppet pairing
   ▼
extractHandFeatures    all 21 landmarks: per-finger extension / curl / direction,
                       thumb spread, pinch, finger spread, roll, pitch, fist, depth
   ▼
HandFeatureFilter      spike guard + per-channel One Euro filters
   ▼
articulateFromHand     each finger → its own puppet joint (continuous)
stagePosition          palm (predicted ~35 ms ahead) → puppet position
   ▼
PuppetController       fast primary springs + loose secondary physics
   ▼
Puppet (SVG rig)       transforms set directly on SVG groups, 60 fps
```

- **A single loop.** `WayangExperience` runs one `requestAnimationFrame` loop.
  Per-frame data lives in refs and plain objects. React state only holds
  coarse UI state: camera status, model status, the number of hands held, and
  settings.
- **Fresh frames first.** The camera is asked for 960×540 at up to 60 fps
  (it falls back to 720p30 or anything available; the actual mode is shown in
  debug). `HandTracker` runs MediaPipe from `requestVideoFrameCallback`, once
  per new camera frame and never twice at once, so the render loop picks up
  the result in the same frame. A running time budget keeps inference under
  about half of the main thread; without frame callbacks it falls back to
  polling from the render loop.
- **Primary vs secondary motion.** Palm position and finger articulation are
  the puppeteer's intent: fast per-channel One Euro filters, a one-frame spike
  guard, short palm prediction and stiff, nearly critically damped springs.
  Physical character (arms trailing a move, flinging on a lift, the body
  leaning into travel, the shadow lagging) is a separate loose layer added on
  top, so it never delays control.
- **Stable assignment.** `HandAssigner` works like a mirror: a newly raised
  hand takes the puppet on its side of the preview, so your right hand moves
  the puppet on the right of the screen. MediaPipe handedness only breaks ties
  for hands right in the middle. While a hand is tracked, continuity (distance
  from that puppet's last palm position) wins, so crossing hands or a
  mislabelled frame never swaps puppets.
- **Mirroring.** Landmarks are mirrored into view space when the preview is,
  so the overlay canvas is never flipped. On the raw camera frame, MediaPipe's
  handedness label is the user's physical hand.
- **Transitions.** Without a hand, a puppet rests low with its lower legs
  hidden behind the rail. When a hand appears, the puppet is lifted into the
  scene in about 150 ms. When a hand is lost, its pose is held for 380 ms,
  then the puppet eases back down to its breathing rest pose. Puppets never
  teleport.
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
  lib/                    handMath, handFeatureFilter, handAssignment, handTracker, landmarker,
                          puppetGeometry, puppetMapping, puppetMotion,
                          smoothing, drawHands, ambientAudio, status, settings,
                          simulatedHands
  styles/wayang.css
  assets/textures/        tiny SVG textures (paper, grain, kawung, floral trim)
```

## Developer flags

- `?debug=1` shows the camera mode and frame rate, inference rate and cost,
  the age of the latest result, the hand-to-puppet assignment, and for each
  held puppet a bar per finger (extension and curl), pinch, fist, roll, pitch,
  palm position and velocity.
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
