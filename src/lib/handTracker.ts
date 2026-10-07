import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandDetection, HandFrame, Point, Side } from '../types';

const TARGET_FPS = 28;

/**
 * Runs MediaPipe inference on the webcam, throttled to ~28 Hz and never twice
 * on the same video frame. The render loop calls `process` every animation
 * frame and reuses the latest result in between.
 */
export class HandTracker {
  /** Inference calls per second (smoothed). */
  fps = 0;
  latest: HandFrame | null = null;

  private readonly landmarker: HandLandmarker;
  private readonly onFatal: (error: unknown) => void;
  private readonly interval = 1000 / TARGET_FPS;
  private lastVideoTime = -1;
  private lastInferenceAt = -Infinity;
  private lastTimestamp = 0;
  private failures = 0;

  constructor(landmarker: HandLandmarker, onFatal: (error: unknown) => void) {
    this.landmarker = landmarker;
    this.onFatal = onFatal;
  }

  process(video: HTMLVideoElement, now: number, mirror: boolean): HandFrame | null {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return null;
    if (now - this.lastInferenceAt < this.interval) return null;
    if (video.currentTime === this.lastVideoTime) return null;

    const elapsed = now - this.lastInferenceAt;
    this.lastInferenceAt = now;
    this.lastVideoTime = video.currentTime;
    // MediaPipe requires strictly increasing timestamps.
    const timestamp = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, timestamp);
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      if (this.failures === 3) this.onFatal(error);
      return null;
    }

    if (Number.isFinite(elapsed)) this.fps += (1000 / elapsed - this.fps) * 0.1;
    this.latest = toFrame(result, video.videoWidth / video.videoHeight, mirror, now);
    return this.latest;
  }
}

function toFrame(result: HandLandmarkerResult, aspect: number, mirror: boolean, time: number): HandFrame {
  const hands: HandDetection[] = result.landmarks.map((landmarks, i) => {
    const category = result.handedness[i]?.[0];
    // MediaPipe labels handedness as if the image were already mirrored (selfie view).
    // We feed it the raw camera frame, so its "Left" is the user's right hand.
    const handedness: Side | null = category ? (category.categoryName === 'Left' ? 'right' : 'left') : null;
    // With a mirrored preview your left hand appears on the left, next to the left puppet.
    const naturalSide: Side | null = handedness && (mirror ? handedness : handedness === 'left' ? 'right' : 'left');
    const world = result.worldLandmarks[i];
    return {
      landmarks: landmarks.map((p): Point => ({ x: mirror ? 1 - p.x : p.x, y: p.y, z: p.z })),
      worldLandmarks: world ? world.map((p): Point => ({ x: mirror ? -p.x : p.x, y: p.y, z: p.z })) : null,
      handedness,
      naturalSide,
      handednessScore: category?.score ?? 0,
    };
  });
  return { hands, aspect, time };
}
