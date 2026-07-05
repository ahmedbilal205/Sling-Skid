# Sling Skid Project Guide

This project is an Expo Router game built with React Native, React Three Fiber, Three.js WebGPU, `react-native-wgpu` on native, and Zustand for game state. The current app entry point is a single playable game, **Sling Skid**, mounted from `app/index.tsx`.

The game is an endless arcade driving game. A police car moves forward on a procedurally generated road. The player holds/taps during curves to attach a sling line to the curve's center anchor, pulling the car inward. Releasing lets the car float or drift wide. The skill is timing and feathering the hold/release through turns without leaving the road.

## Quick Start

- Install dependencies: `npm install`
- Start Expo: `npm run start`
- Run web: `npm run web`
- Run Android development build: `npm run android`
- Lint: `npm run lint`

The project uses Expo SDK 54, React 19, React Native 0.81, Three 0.183, `@react-three/fiber` 9, and Zustand 5.

## Repository Shape

- `app/index.tsx` mounts `SlingSkidGame`.
- `app/_layout.tsx` configures the Expo Router stack, theme provider, safe area provider, status bar, and imports the Three warning filter.
- `components/sling-skid/` contains the actual game.
- `components/sling-skid/store/` contains runtime state, gameplay rules, constants, and UI snapshot helpers.
- `components/sling-skid/scene/` builds the Three scene.
- `components/sling-skid/car/` contains the car model, tether, tire marks, and sling particles.
- `components/sling-skid/track/` contains procedural track generation, road rendering, centerline helpers, anchors, and ground.
- `components/sling-skid/camera/` contains the follow camera.
- `components/sling-skid/ui/` contains React Native overlays for menu, HUD, swing feedback, and game over.
- `components/webgpu/` contains the native WebGPU canvas bridge and minimal demo/debug components.
- `assets/models/police_car.native.glb` is the native car model asset.
- `public/models/police_car.glb` is the web car model asset.
- `public/draco/gltf/` contains Draco decoder files used by the web GLB loader.

## Platform Architecture

`components/sling-skid/SlingSkidGame.tsx` exports the native implementation by default. TypeScript and Metro are configured with platform suffixes, so web resolves `SlingSkidGame.web.tsx` while native resolves `SlingSkidGame.native.tsx`.

On web:

- `SlingSkidGame.web.tsx` uses `@react-three/fiber`'s normal `Canvas`.
- The `gl` factory creates a `THREE.WebGPURenderer` from `three/webgpu`.
- Rendering is delayed until after mount with an `isClient` flag.
- A React error boundary shows a WebGPU unavailable message if renderer setup fails.

On native:

- `SlingSkidGame.native.tsx` uses `WebGpuFiberCanvas`.
- `WebGpuFiberCanvas` wraps `react-native-wgpu`'s canvas/context in a browser-like canvas adapter.
- It creates a React Three Fiber root with `createRoot`, configures it with a `THREE.WebGPURenderer`, and calls `context.present()` after each render.
- Native DPR is capped by the game at `Math.min(PixelRatio.get(), 1.5)` to reduce GPU cost.

Important config:

- `metro.config.js` maps imports of `three` to `three/webgpu`.
- `metro.config.js` forces native `@react-three/fiber` to resolve to its CommonJS build.
- `metro.config.js` adds `glb` to Metro asset extensions.
- `tsconfig.json` enables strict mode, `@/*` path aliases, and platform module suffixes.

## Gameplay Loop

The game has three phases:

- `menu`: start overlay is visible and the car/camera sit in an idle view.
- `playing`: the car advances, input controls the sling, scoring updates, and off-road ends the run.
- `gameOver`: final stats are shown and tapping restarts.

Input is intentionally simple:

- Press/touch down while playing calls `triggerSling()`.
- Release/cancel calls `releaseSling()`.
- While held inside an active curve zone, the sling engages and tension rises.
- While released, the car is allowed to drift or float wider.

The full-screen tap layer only exists during `playing`, so start and game-over overlays can receive presses.

## Runtime State Model

The gameplay state lives in `components/sling-skid/store/gameStore.ts`.

There are two related state layers:

- A module-level `runtimeState`, used by the render loop and Three objects every frame.
- A Zustand store, used by React UI components and published at a throttled cadence.

This split is intentional. The car, camera, tether, particles, anchors, and lighting read `getGameRuntimeState()` directly inside `useFrame` for smooth 60 FPS behavior without forcing React rerenders. UI overlays use Zustand selectors, often through `useThrottledGameSnapshot`, to update around 10 FPS.

Primary actions:

- `startGameRuntime()` generates a fresh track, resets score/combo/distance/speed, and enters `playing`.
- `endGameRuntime()` enters `gameOver`.
- `triggerSlingRuntime()` marks input as held and engages the current arc when possible.
- `releaseSlingRuntime()` marks input as released and disengages the swing.
- `stepGameRuntime(dt)` advances all gameplay simulation.

`Car.tsx` owns the per-frame call to `stepGameRuntime(dt)`. The step is clamped to a maximum `dt` of `0.05` seconds to avoid large simulation jumps.

## Physics and Feel

This is not a rigid-body physics game. It is a custom velocity and steering simulation tuned for arcade feel.

During each gameplay step:

1. The current or nearby arc zone is resolved from the car position.
2. Pace speed increases gradually from `INITIAL_SPEED` to `MAX_SPEED`.
3. Velocity is guided toward the current road tangent.
4. If the car is inside an arc and input is held, sling tension rises.
5. Engaged sling tension pulls velocity inward toward the arc center and aligns velocity along the arc tangent.
6. If in an arc and not engaged, a release force pushes the car outward.
7. Velocity is normalized toward the desired pace speed.
8. Position, heading, distance, score, and swing metrics are updated.
9. `isOnRoad()` checks whether the car is still within the road boundary plus any turn grace.
10. Segments are advanced, generated ahead, and pruned behind.

Key tuning constants live in `components/sling-skid/store/constants.ts`.

Important tuning groups:

- Road dimensions: `ROAD_WIDTH`, `ROAD_HALF_WIDTH`, `BOUNDARY_TOLERANCE`.
- Speed: `INITIAL_SPEED`, `SPEED_INCREMENT`, `MAX_SPEED`.
- Arc control zone: `ARC_CONTROL_LEAD`, `ARC_CONTROL_EXIT`, `ARC_ZONE_RADIAL_SLACK`.
- Steering assist: `STRAIGHT_GUIDE_ASSIST`, `ARC_GUIDE_ASSIST`, `TURN_ALIGN_FORCE`.
- Sling feel: `TURN_PULL_FORCE`, `TURN_RADIUS_PULL`, `TURN_RELEASE_FLOAT`, `TENSION_RISE_RATE`, `TENSION_DROP_RATE`.
- Scoring: `SCORE_PERFECT`, `SCORE_GOOD`, `SCORE_WEAK`.
- Camera framing: all `CAMERA_*` constants.

## Track Generation

Track generation lives in `components/sling-skid/track/trackGenerator.ts`.

The track is a list of `TrackSegment` objects:

- `StraightSegment`: start, heading, length, end, end heading.
- `ArcSegment`: start, heading, center, radius, sweep angle, turn direction, end, end heading.

`generateInitialTrack()` starts with a 32-meter straight, then fills an initial segment buffer. `generateNextSegment()` alternates readable straights and random arcs. After every arc, it always adds a straight recovery/approach segment. Difficulty increases with distance by making curves somewhat tighter and straights shorter.

`isOnRoad()` checks the car against nearby segments only. For straights, it projects the car into forward/perpendicular coordinates. For arcs, it checks radial distance from the arc center and angular progress through the sweep.

`centerline.ts` contains reusable path sampling helpers for camera/path work:

- `sampleSegmentPoints`
- `buildCenterlinePath`
- `poseAtS`
- `pointAheadOnPath`
- `projectXZToPathS`
- `pathSAtSegmentStart`

Some of these helpers are available for future camera or effects work even if not all are heavily used right now.

## Scoring and Swing Quality

Each arc creates or updates a `SwingState`.

Important swing fields:

- `engaged`: whether the sling is actively pulling.
- `anchorIndex`: segment index of the arc anchor.
- `tension`: smoothed 0-1 line tension.
- `zoneProgress`: progress through the arc control zone.
- `turnTime`: time spent in this turn zone.
- `turnControl`: tension-weighted controlled time.
- `wideTime`: accumulated penalty for being radially wide.
- `regrabs`: number of repeated grabs during a turn.
- `slip`: visual/feedback drift amount.
- `radialError`: car distance from ideal arc radius.
- `lineState`: `neutral`, `loading`, or `drifting`.
- `quality`: last scored quality: `none`, `perfect`, `good`, or `weak`.

`scoreTurn()` compares controlled time against turn time, subtracts wide drift penalty, and adds a small regrab bonus. Perfect and good turns continue the combo and increase multiplier up to 8x. Weak turns award a small fixed score and reset combo.

Score also increases continuously with distance and a bonus for sling tension.

## Rendering

`components/sling-skid/scene/GameScene.tsx` composes the 3D world:

- background color and fog
- ambient light
- moving directional sunlight/shadow target
- follow camera
- environment ground plane
- road mesh
- anchor nodes
- car
- tether line
- tire marks
- sling particles

`scene/registerThree.ts` extends React Three Fiber with the Three/WebGPU classes used in JSX. If adding a new Three object type to JSX and TypeScript/runtime complains, it may need to be registered here.

### Road Rendering

`TrackMesh.tsx` samples visible track segments into a centerline and renders road strips as instanced box meshes:

- brown shoulder/base
- dark asphalt
- white edge lines
- yellow center line

Only segments around the current segment index are rendered. The road uses instancing with `MAX_ROAD_PIECES` to keep draw calls controlled.

### Anchors

`AnchorNode.tsx` renders the next and active curve anchors at arc centers. Upcoming anchors pulse red. Active anchors turn yellow or blue depending on swing state and scale/emissive intensity with tension. Passed/inactive anchors are hidden.

### Car

`Car.tsx` loads a GLB police car:

- Web: `/models/police_car.glb` from `public`.
- Native: `assets/models/police_car.native.glb` via `expo-asset`.

Web uses `DRACOLoader` with decoder files in `public/draco/gltf/`. Native swaps GLB mesh materials to basic vertex-colored materials to improve compatibility with the native WebGPU stack. If model loading fails, a simple box fallback car is rendered.

`Car.tsx` also advances the simulation every frame and applies runtime car position/heading to the car group.

### Tether, Tire Marks, Particles

- `Tether.tsx` draws a sagging line from the car to the active arc center. It appears when tension is non-trivial or the car is drifting.
- `TireMarks.tsx` uses instanced planes to stamp skid marks when the car is slipping inside an active arc.
- `SlingParticles.tsx` emits a short burst of small cubes when the sling first engages.

### Camera

`FollowCamera.tsx` is a custom dynamic camera with portrait and landscape constants. It follows behind and above the car, looks ahead along velocity, biases toward upcoming anchor nodes, and locks a wider dual-target frame around both car and hook during turns.

The camera also solves for screen safety using projected NDC coordinates so the car and hook remain visible. The many `CAMERA_*` constants in `constants.ts` are part of this system.

## UI

UI overlays are normal React Native views layered over the 3D canvas.

- `StartScreen.tsx`: menu overlay, tapping starts.
- `HUD.tsx`: distance, score, combo multiplier, line readout, beginner hint, and speed bar.
- `SwingFeedback.tsx`: short turn-state prompt such as `PULL`, `LOADED`, `DRIFT`, or `FEATHER`.
- `GameOverScreen.tsx`: score, distance, turns completed, tap to retry.
- `styles.ts`: shared overlay text and stat styles.

`HUD` and `SwingFeedback` use `useThrottledGameSnapshot()` to avoid rerendering React Native UI every frame.

## Assets

Important runtime assets:

- `public/models/police_car.glb`
- `assets/models/police_car.native.glb`
- `assets/models/police_car.texture.jpg`
- `public/draco/gltf/draco_decoder.js`
- `public/draco/gltf/draco_decoder.wasm`
- `public/draco/gltf/draco_wasm_wrapper.js`

`assets.d.ts` declares `*.glb` and `*.jpg` imports for TypeScript.

## Common Change Guide

To tune driving feel:

- Start in `components/sling-skid/store/constants.ts`.
- If changing rules, inspect `stepGameRuntime()` in `gameStore.ts`.
- Keep `dt`-based math frame-rate independent.

To change scoring:

- Edit `scoreTurn()` in `gameStore.ts`.
- Check `SwingState` fields updated in `stepGameRuntime()`.
- Update HUD/game-over UI only if the displayed metrics change.

To change road generation:

- Edit `generateNextSegment()` in `trackGenerator.ts`.
- Make sure generated segments connect by using previous segment `end` and `endHeading`.
- Recheck `isOnRoad()` if adding new segment types.

To add new 3D JSX objects:

- Import from `three/webgpu`.
- Register the class in `scene/registerThree.ts` if R3F does not already know it.
- Prefer instancing for repeated geometry.

To change car visuals:

- Update `Car.tsx` for loading, scaling, rotation, or fallback behavior.
- Keep separate web and native asset paths in mind.
- Preserve the native material compatibility workaround unless the native renderer has been verified with the original GLB materials.

To change camera behavior:

- Start with `CAMERA_*` constants before rewriting `FollowCamera.tsx`.
- Test portrait and landscape. The camera has separate safety and distance constants for each.

To change UI:

- Use React Native overlays in `components/sling-skid/ui/`.
- Use throttled snapshots for rapidly changing game data.
- Keep the full-screen game input layer below UI overlays by respecting current z-indexes.

## Important Implementation Notes

- `getGameRuntimeState()` is the source for high-frequency render-frame reads.
- Zustand is used as the React-facing publication layer, not the inner simulation loop.
- `stepGameRuntime()` should only run while `phase === 'playing'`.
- The game currently depends on WebGPU availability. There is no WebGL fallback.
- Native WebGPU requires a development build; Expo Go is not enough for `react-native-wgpu`.
- Web should be tested in a WebGPU-capable browser such as current Chrome or Edge.
- The default `README.md` is still the generated Expo README and does not describe the actual game.
- `app/_layout.tsx` and `components/webgpu/three-warning-filter.ts` currently include warning-suppression plumbing for a Three clock deprecation warning.

## Current Known Gaps

- There are no automated gameplay tests.
- The procedural track uses `Math.random()`, so runs are not deterministic or seedable.
- The UI does not expose pause, settings, calibration, or accessibility options.
- `endGameRuntime()` exists but normal game-over flow is usually triggered by off-road detection inside `stepGameRuntime()`.
- Some WebGPU demo components remain in `components/webgpu/` for diagnostics but are not mounted by the main route.

