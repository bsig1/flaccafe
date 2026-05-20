import type { Track } from "./types";

export interface SmtcButtonPayload {
  command: "play" | "pause" | "stop" | "previous" | "next" | "seek";
  position_seconds: number | null;
}

interface SmtcStatePayload {
  track: {
    id: number;
    title: string | null;
    artist: string | null;
    album: string | null;
    album_artist: string | null;
    genre: string | null;
    duration_seconds: number | null;
  } | null;
  is_playing: boolean;
  position_seconds: number;
  duration_seconds: number;
  can_previous: boolean;
  can_next: boolean;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function updateSmtcState({
  track,
  isPlaying,
  positionSeconds,
  durationSeconds,
  canPrevious,
  canNext,
}: {
  track: Track | null;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  canPrevious: boolean;
  canNext: boolean;
}): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const payload: SmtcStatePayload = {
    track: track
      ? {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          album_artist: track.album_artist,
          genre: track.analysis_genre ?? track.genre,
          duration_seconds: track.duration_seconds,
        }
      : null,
    is_playing: isPlaying,
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds,
    can_previous: canPrevious,
    can_next: canNext,
  };
  await invoke("smtc_update_state", { payload });
}

export async function clearSmtcState(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("smtc_clear", {});
}

export async function listenForSmtcButtons(
  handler: (payload: SmtcButtonPayload) => void,
): Promise<(() => void) | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<SmtcButtonPayload>("smtc-button", (event) => handler(event.payload));
}
