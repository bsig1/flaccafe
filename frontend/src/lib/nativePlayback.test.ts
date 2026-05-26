import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  NativePlaybackDiagnosticsResponse,
} from "./nativePlayback";
import {
  summarizeNativeDiagnostics,
} from "./nativePlayback";

function diagnostics(entries: NativePlaybackDiagnosticsResponse["entries"], streamErrors: string[] = []): NativePlaybackDiagnosticsResponse {
  return {
    entries,
    stream_errors: streamErrors,
    current_path: null,
    prepared_next_path: null,
    prepared_next_duration_seconds: null,
    prepared_next_at_ms: null,
    device_id: null,
    device_name: null,
    buffer_frames: null,
    sample_rate: null,
    channel_count: null,
    sample_format: null,
  };
}

describe("Rust playback diagnostics", () => {
  it("summarizes empty diagnostics", () => {
    expect(summarizeNativeDiagnostics(null)).toBe("Diagnostics not loaded");
    expect(summarizeNativeDiagnostics(diagnostics([]))).toBe("No recent Rust playback failures");
  });

  it("summarizes recent failures by severity and category", () => {
    const summary = summarizeNativeDiagnostics(
      diagnostics(
        [
          {
            id: 1,
            timestamp_ms: 1,
            severity: "error",
            category: "cpal",
            operation: "open_output_sink",
            message: "Could not open device",
            path: null,
            device_id: "default",
            device_name: "Speakers",
            buffer_frames: 1024,
            sample_rate: null,
            channel_count: null,
            sample_format: null,
          },
          {
            id: 2,
            timestamp_ms: 2,
            severity: "warning",
            category: "symphonia",
            operation: "decode_audio_file",
            message: "Decode warning",
            path: "C:\\Music\\song.flac",
            device_id: null,
            device_name: null,
            buffer_frames: null,
            sample_rate: null,
            channel_count: null,
            sample_format: null,
          },
        ],
        ["stream stopped"],
      ),
    );

    expect(summary).toContain("1 error");
    expect(summary).toContain("1 warning");
    expect(summary).toContain("1 stream callback");
    expect(summary).toContain("cpal, symphonia");
  });
});
