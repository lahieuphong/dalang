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
thresholds or dead zones to cross before something happens. A slight bend of
one finger, a small turn of the wrist or a centimetre of palm travel already
shows on the puppet.

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
| **Thumb–index pinch**             | Precise grip, felt over the whole approach of the two fingertips: wrist turns in, forearm draws in, fingers close, head nods |
| **Ring**: curl / extend           | Lowers / raises the back arm                     |
| **Pinky**: curl / extend          | Bends / straightens the back elbow               |
| Close the whole hand              | Compacts both arms, the puppet's hands close     |
| Bring the hand toward the camera  | Draws the puppet toward the lamp (bigger, softer shadow) |

Your left hand drives the left puppet and your right hand drives the right one.

The settings panel (gear icon) has camera on/off, the landmark overlay, preview
mirroring, motion sensitivity and motion smoothing. Sensitivity is gain: how
far the puppet moves for a given hand movement (0.75× to 1.75×, 1.25× by
default). Smoothing is filtering: how firmly a resting hand is held still.
The two are independent, and the defaults are already the fast setting. These
preferences are saved in `localStorage`. Camera permission is never stored.

The sound button starts a quiet, generated gamelan-style ambience. It is built
with Web Audio, so there are no audio files. You also hear a cempala knock when
a puppet is picked up. Sound is off by default and only starts after you click.

## How it works

```
webcam (a 50–60 fps mode if the camera has one, modest resolution)
   │  requestVideoFrameCallback: each fresh frame, once, never queued
   ▼
HandTracker            MediaPipe HandLandmarker (GPU, CPU fallback), run inside
                       the frame callback; moves to a worker by itself where
                       the main thread cannot afford the model
   ▼
HandAssigner           stable hand → puppet pairing
   ▼
extractHandFeatures    all 21 landmarks: per-finger curl (linear in the bend),
                       direction, thumb spread, pinch distance, finger spread,
                       roll, pitch, fist, depth
   ▼
HandFeatureFilter      one noise-aware filter per channel: the only smoothing
   ▼
articulateFromHand     response curve × sensitivity, each finger → its own joint
stagePosition          palm (predicted up to 25 ms ahead) → puppet position
   ▼
PuppetController       stiff, critically damped followers + slight follow-through
   ▼
Puppet (SVG rig)       transforms set directly on SVG groups, display rate
```

- **A single loop.** `WayangExperience` runs one `requestAnimationFrame` loop.
  Per-frame data lives in refs and plain objects. React state only holds
  coarse UI state: camera status, model status, the number of hands held, and
  settings.
- **Latency first.** The camera is asked for a 50–60 fps mode at a modest
  resolution (then 30 fps, then anything; the mode actually granted is read
  back and shown in debug). `HandTracker` is driven by
  `requestVideoFrameCallback`: each new camera frame is offered once, the
  model never works on two frames at once, and a frame that arrives while it
  is busy only replaces the one waiting, so nothing queues and the model
  always gets the newest frame. On the main thread, inference runs inside the
  frame callback, so its result drives the very render frame that follows;
  a running time budget (60 %) keeps it from crowding out rendering.
- **Main thread or worker.** The main thread is the shortest path from a
  camera frame to a pose, so tracking starts there. When one inference keeps
  costing about two display frames (over 32 ms for six seconds), the model is also
  started in a Web Worker and auditioned on the live frames for a few
  seconds, next to normal tracking. Tracking then moves to the worker, which
  keeps rendering smooth on slower machines, unless the worker's round trip
  is more than twice what the main thread needs at that moment (workers are
  easily starved on a busy machine). `?tracker=main` / `?tracker=worker` pin
  the choice.
- **One smoothing stage.** Only `HandFeatureFilter` smooths, with one filter
  per channel: a One Euro filter that measures the channel's own noise as it
  runs. A change larger than that noise passes on the very frame it is seen;
  smaller ones still pass, over a few frames; a resting hand is held still.
  Pinch and finger curl are the fastest channels, then palm position and
  roll; pitch, yaw and depth are calm. Nothing is debounced and there are no
  dead zones. A single-frame tracker glitch is halved rather than delayed.
- **Sensitivity is not smoothing.** Finger curl is linear in the joint angles
  and goes through a response curve that amplifies small movements (0.1 →
  0.17, 0.2 → 0.31, 0.5 → 0.64) without flattening the far end; the ring and
  little fingers get extra gain. The pinch is linear over the whole approach
  of thumb and index. Each palm is mapped around its own home position, so
  more sensitivity means more travel, not puppets pushed to the edges; stage
  limits are eased, never hard.
- **Followers, not springs to chase.** Between tracker results the pose is
  carried to the display rate by very stiff, critically damped followers
  (exact integration, so they never ring): fastest for wrist and finger
  blades, then root and arm joints, softer for body and head. They add about
  one display frame. Physical character (arms trailing a fast move, the
  shadow lagging) is a small, well-damped layer on top and never delays
  control.
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
  hidden behind the rail. When a hand appears, its pose takes over at once:
  the first frame already carries the puppet about a quarter of the way and
  it is in hand after roughly 100 ms, without overshoot. When a hand is lost,
  its pose is held for 300 ms, then the puppet eases back down to its
  breathing rest pose.
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
  lib/                    handMath, handFeatureFilter, handAssignment, handTracker,
                          inferenceBackend, createHandLandmarker, trackerProtocol,
                          tracker.worker, puppetGeometry, puppetMapping, puppetMotion,
                          smoothing, drawHands, ambientAudio, status, settings,
                          simulatedHands
  styles/wayang.css
  assets/textures/        tiny SVG textures (paper, grain, kawung, floral trim)
```

## Developer flags

- `?debug=1` shows where the time goes between camera and screen, refreshed
  about six times a second:
  - `cameraFPS` with the granted camera mode, and `capture→page` (camera
    latency before the page sees a frame, where the browser reports it)
  - `inferenceFPS`, `inferenceMs`, the round trip, and where the model runs
    (`main-thread` / `worker`, `GPU` / `CPU`)
  - `inputAgeMs`: camera capture → that frame's result driving the pose;
    `result→target`: the wait for the next render frame;
    `trackingResultAgeMs`: how old the result on screen is on average
  - `renderFPS`, the worst frame of the last second, and `target→render`:
    how far the rendered puppet trails its target, in ms and stage pixels
  - the hand-to-puppet assignment, and for each held puppet a bar per finger
    (curl), pinch, fist, roll, pitch, palm position and velocity.
- `?tracker=main` or `?tracker=worker` pins where the model runs;
  `?delegate=cpu` forces the CPU delegate. Both are for comparisons.
- `?simulate=1` drives the puppets with synthetic, scripted hands, so you can
  work without a camera. Combine both flags as `?simulate=1&debug=1`.

## Assets

- All artwork is original SVG drawn for this project: puppets, ornaments, clouds and textures.
- `@mediapipe/tasks-vision` is pinned to an exact version. The JavaScript
  bundle, the copied WASM files and the CDN fallback must all match. Three
  builds of the runtime are shipped: SIMD and non-SIMD for the main thread,
  and the ES-module build for the worker.
- The hand model (`hand_landmarker.task`, about 7.8 MB, Apache-2.0) and the
  WASM runtime are served from this site. If they can't be loaded, the app
  falls back to the public MediaPipe CDN and Google Storage URLs.
- If the camera or the model is unavailable, the theatre still renders and
  the puppets idle. A small status line explains what happened.
