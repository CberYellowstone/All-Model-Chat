import { beforeEach, describe, expect, it, vi } from 'vitest';
import { float32ToPCM16Base64, getMixedAudioStream } from './audioProcessing';

class FakeTrack {
  stop = vi.fn();
}

class FakeMediaStream {
  private readonly audioTracks: FakeTrack[];
  private readonly tracks: FakeTrack[];

  constructor(audioTracks: FakeTrack[] = []) {
    this.audioTracks = audioTracks;
    this.tracks = audioTracks.length > 0 ? audioTracks : [new FakeTrack()];
  }

  getAudioTracks() {
    return this.audioTracks;
  }

  getTracks() {
    return this.tracks;
  }
}

const getDisplayMediaMock = vi.fn();

describe('getMixedAudioStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: getDisplayMediaMock,
      },
    });
  });

  it('returns microphone audio with a warning when system audio is not shared', async () => {
    const micStream = new FakeMediaStream([new FakeTrack()]);
    const displayStream = new FakeMediaStream();
    getDisplayMediaMock.mockResolvedValue(displayStream);

    const result = await getMixedAudioStream(micStream as unknown as MediaStream, true);

    expect(result.stream).toBe(micStream);
    expect(result.warning).toBe('System audio was not shared. Recording continued with microphone audio only.');
    expect(displayStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('returns microphone audio with a warning when system audio capture fails', async () => {
    const micStream = new FakeMediaStream([new FakeTrack()]);
    getDisplayMediaMock.mockRejectedValue(new DOMException('Permission dismissed', 'NotAllowedError'));

    const result = await getMixedAudioStream(micStream as unknown as MediaStream, true);

    expect(result.stream).toBe(micStream);
    expect(result.warning).toBe(
      'System audio capture was cancelled or failed. Recording continued with microphone audio only.',
    );
  });
});

describe('float32ToPCM16Base64', () => {
  it('clamps full-scale +1.0 to 32767 instead of wrapping Int16 to -32768', () => {
    // Regression: a full-scale positive sample multiplied by 32768 overflows
    // Int16 (32768 -> -32768), producing a sign-flipped click/pop. 0x7fff keeps
    // it at the true positive maximum.
    const pcm = new Int16Array(
      Uint8Array.from(atob(float32ToPCM16Base64(new Float32Array([1, -1, 0]))), (c) => c.charCodeAt(0)).buffer,
    );
    expect(pcm[0]).toBe(32767);
    expect(pcm[1]).toBe(-32767);
    expect(pcm[2]).toBe(0);
  });
});
