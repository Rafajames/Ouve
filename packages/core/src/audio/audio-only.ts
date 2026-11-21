export interface MediaTrackLike {
  readonly kind: string;
  stop(): void;
}

/**
 * Keep only audio tracks and immediately stop every non-audio track.
 * This is a defensive boundary for platform APIs that return a mixed stream
 * after a user explicitly selects a screen/window/tab source.
 */
export function selectAudioTracks<T extends MediaTrackLike>(tracks: readonly T[]): T[] {
  const audioTracks: T[] = [];

  for (const track of tracks) {
    if (track.kind === "audio") {
      audioTracks.push(track);
    } else {
      track.stop();
    }
  }

  if (audioTracks.length === 0) {
    throw new Error("The selected source did not provide an audio track.");
  }

  return audioTracks;
}
