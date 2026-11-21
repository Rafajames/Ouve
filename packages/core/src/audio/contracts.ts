export interface AudioChunk {
  sessionId: string;
  sequence: number;
  timestampMs: number;
  mimeType: string;
  data: Blob;
}

export interface AudioCaptureOptions {
  sourceId: string;
  includeMicrophone: boolean;
  microphoneDeviceId?: string;
}

export interface AudioCaptureCapabilities {
  screenSelection: boolean;
  windowSelection: boolean;
  tabSelection: boolean;
  systemAudio: boolean;
  microphone: boolean;
}

export interface AudioCaptureHandle {
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
}

export interface AudioCaptureAdapter {
  getCapabilities(): Promise<AudioCaptureCapabilities>;
  start(options: AudioCaptureOptions, onChunk: (chunk: AudioChunk) => void, onError: (error: Error) => void): Promise<AudioCaptureHandle>;
}

/**
 * Product invariant: consumers receive audio chunks only.
 * Platform adapters must discard any video frames immediately when a
 * platform API requires a video track to present a source picker.
 */
