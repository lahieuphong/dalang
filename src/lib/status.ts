import type { CameraStatus, TrackingStatus } from '../types';

export type StatusTone = 'rest' | 'busy' | 'live' | 'alert';

export interface StageStatus {
  text: string;
  tone: StatusTone;
}

interface StatusInput {
  camera: CameraStatus;
  tracking: TrackingStatus;
  hands: number;
  cameraEnabled: boolean;
  simulated: boolean;
}

/** The single line of guidance shown in the stage's status pill. */
export function stageStatus({ camera, tracking, hands, cameraEnabled, simulated }: StatusInput): StageStatus {
  if (simulated) return { text: 'Simulated hands · two puppets', tone: 'live' };

  switch (camera) {
    case 'unsupported':
      return { text: 'Camera not supported · puppets resting', tone: 'alert' };
    case 'denied':
      return { text: 'Camera unavailable · interaction paused', tone: 'alert' };
    case 'error':
      return { text: 'Camera unavailable', tone: 'alert' };
    case 'requesting':
      return { text: 'Starting camera…', tone: 'busy' };
    case 'idle':
      return cameraEnabled
        ? { text: 'Camera ready · enable tracking', tone: 'rest' }
        : { text: 'Camera off · puppets resting', tone: 'rest' };
    case 'active':
      break;
  }

  if (tracking === 'error') return { text: 'Hand tracking unavailable', tone: 'alert' };
  if (tracking !== 'ready') return { text: 'Preparing hand tracking…', tone: 'busy' };
  if (hands >= 2) return { text: 'Two puppets · one per hand', tone: 'live' };
  if (hands === 1) return { text: 'One puppet active · raise another hand', tone: 'live' };
  return { text: 'Camera on · raise both hands', tone: 'rest' };
}
