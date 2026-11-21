import { describe, expect, it, vi } from "vitest";
import { selectAudioTracks, type MediaTrackLike } from "../src/audio/audio-only.js";

function track(kind: string): MediaTrackLike {
  return { kind, stop: vi.fn() };
}

describe("audio-only capture boundary", () => {
  it("keeps audio tracks and stops video tracks immediately", () => {
    const audio = track("audio");
    const video = track("video");

    expect(selectAudioTracks([audio, video])).toEqual([audio]);
    expect(video.stop).toHaveBeenCalledOnce();
    expect(audio.stop).not.toHaveBeenCalled();
  });

  it("rejects sources without audio and stops non-audio tracks", () => {
    const video = track("video");

    expect(() => selectAudioTracks([video])).toThrow(/did not provide an audio track/);
    expect(video.stop).toHaveBeenCalledOnce();
  });
});
