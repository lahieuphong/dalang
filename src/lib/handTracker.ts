import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandDetection, HandFrame, Point, Side } from '../types';

/** Never run inference more often than this, even when it is very cheap. */
const MAX_INFERENCE_FPS = 60;
/** Inference may use at most this share of main-thread time, so rendering stays smooth. */
const MAIN_THREAD_BUDGET = 0.5;
/** …but never throttle below this rate. */
const MAX_INFERENCE_INTERVAL_MS = 100;
/** The first calls include GPU warm-up (shader compilation) and must not skew the average. */
const WARMUP_CALLS = 3;

export interface TrackerStats {
  /** New frames delivered by the camera per second. */
  cameraFps: number;
  /** Inference calls per second. */
  inferenceFps: number;
  /** Average duration of one inference call, ms. */
  inferenceMs: number;
}

/** Older browsers lack requestVideoFrameCallback even though the DOM types declare it. */
const supportsFrameCallback = (video: HTMLVideoElement) => typeof video.requestVideoFrameCallback === 'function';

/**
 * Runs MediaPipe on the webcam as fresh frames arrive.
 *
 * Where `requestVideoFrameCallback` exists, inference is driven by the camera
 * itself: each newly presented frame is processed once, right away, before
 * the render loop reads the result in the same frame. Otherwise it falls back
 * to polling from the render loop and skipping repeated `currentTime`s. In both
 * cases inference is throttled adaptively (a running time budget) so it
 * takes no more than about half of the main thread, and never runs twice at once.
 */
export class HandTracker {
  readonly stats: TrackerStats = { cameraFps: 0, inferenceFps: 0, inferenceMs: 0 };
  /** Mirror landmarks into view space (matches the mirrored preview). */
  mirror = true;

  private readonly landmarker: HandLandmarker;
  private readonly onFatal: (error: unknown) => void;
  private video: HTMLVideoElement | null = null;
  private callbackHandle = 0;
  private latest: HandFrame | null = null;
  private unread = false;
  private busy = false;
  private failures = 0;
  private lastMediaTime = -1;
  private lastInferenceAt = -Infinity;
  private lastTimestamp = 0;
  private lastPresented = -1;
  private lastPresentedAt = 0;
  private calls = 0;
  /** Main-thread time spent on inference that the budget has not yet paid back, ms. */
  private debt = 0;
  private debtAt = 0;

  constructor(landmarker: HandLandmarker, onFatal: (error: unknown) => void) {
    this.landmarker = landmarker;
    this.onFatal = onFatal;
  }

  /** Starts following a video element (idempotent). */
  attach(video: HTMLVideoElement) {
    if (this.video === video) return;
    this.detach();
    this.video = video;
    if (supportsFrameCallback(video)) this.callbackHandle = video.requestVideoFrameCallback(this.onVideoFrame);
  }

  detach() {
    const video = this.video;
    if (video && this.callbackHandle && supportsFrameCallback(video)) video.cancelVideoFrameCallback(this.callbackHandle);
    this.video = null;
    this.callbackHandle = 0;
    this.lastMediaTime = -1;
  }

  dispose() {
    this.detach();
    this.latest = null;
    this.unread = false;
  }

  /**
   * Called once per render frame. Returns the newest result exactly once
   * (null when nothing new arrived). Without frame callbacks, this is also
   * where inference runs.
   */
  take(now: number): HandFrame | null {
    const video = this.video;
    if (video && !supportsFrameCallback(video)) {
      this.inferIfDue(video, now, now, video.currentTime);
    }
    if (!this.unread) return null;
    this.unread = false;
    return this.latest;
  }

  private onVideoFrame = (now: number, metadata: VideoFrameCallbackMetadata) => {
    const video = this.video;
    if (!video) return;
    this.callbackHandle = video.requestVideoFrameCallback(this.onVideoFrame);

    if (this.lastPresented >= 0) {
      const frames = metadata.presentedFrames - this.lastPresented;
      const seconds = (now - this.lastPresentedAt) / 1000;
      if (frames > 0 && seconds > 0) this.stats.cameraFps += (frames / seconds - this.stats.cameraFps) * 0.1;
    }
    this.lastPresented = metadata.presentedFrames;
    this.lastPresentedAt = now;

    const captured = metadata.captureTime ?? metadata.expectedDisplayTime ?? now;
    this.inferIfDue(video, now, Math.min(captured, now), metadata.mediaTime);
  };

  private inferIfDue(video: HTMLVideoElement, now: number, captureTime: number, mediaTime: number) {
    if (this.busy) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
    if (mediaTime === this.lastMediaTime) return;
    if (now - this.lastInferenceAt < 1000 / MAX_INFERENCE_FPS - 1) return;
    // Budget on a running average rather than per frame: each call adds its cost
    // as debt, time pays it back at the budget rate. Frames are skipped only
    // while in debt, so a 30 fps camera is processed on most frames even when
    // a call costs more than half a frame.
    this.debt = Math.max(0, this.debt - (now - this.debtAt) * MAIN_THREAD_BUDGET);
    this.debtAt = now;
    const overdue = now - this.lastInferenceAt >= MAX_INFERENCE_INTERVAL_MS;
    if (this.debt > this.stats.inferenceMs && !overdue) return;

    const elapsed = now - this.lastInferenceAt;
    this.lastInferenceAt = now;
    this.lastMediaTime = mediaTime;
    // MediaPipe requires strictly increasing timestamps.
    const timestamp = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    this.busy = true;
    const started = performance.now();
    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, timestamp);
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      if (this.failures === 3) this.onFatal(error);
      return;
    } finally {
      this.busy = false;
    }
    const duration = Math.min(performance.now() - started, 200);
    this.calls += 1;
    if (this.calls > WARMUP_CALLS) {
      this.stats.inferenceMs = this.stats.inferenceMs ? this.stats.inferenceMs + (duration - this.stats.inferenceMs) * 0.1 : duration;
      this.debt += duration;
    }
    if (Number.isFinite(elapsed) && elapsed > 0) this.stats.inferenceFps += (1000 / elapsed - this.stats.inferenceFps) * 0.1;

    this.latest = toFrame(result, video.videoWidth / video.videoHeight, this.mirror, captureTime);
    this.unread = true;
  }
}

function toFrame(result: HandLandmarkerResult, aspect: number, mirror: boolean, time: number): HandFrame {
  const hands: HandDetection[] = result.landmarks.map((landmarks, i) => {
    const category = result.handedness[i]?.[0];
    // On the raw (unmirrored) camera frame, the Tasks API labels the user's
    // physical hand directly; verified with a real webcam.
    const handedness: Side | null = category ? (category.categoryName === 'Right' ? 'right' : 'left') : null;
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
