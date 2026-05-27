import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  writeTrackMetadataToFiles,
} from "../../lib/api";

const DEFERRED_FILE_TAG_WRITE_DELAY_MS = 700;
const DEFERRED_FILE_TAG_WRITE_AFTER_TRACK_CHANGE_MS = 250;

type PendingFileTagWrite = {
  includeMetadata: boolean;
  includeRating: boolean;
};

export type QueueFileTagWriteRequest = {
  trackIds: number[];
  includeMetadata?: boolean;
  includeRating?: boolean;
};

export type QueueFileTagWriteResult = {
  queuedCount: number;
  heldCount: number;
  readyCount: number;
};

export function queuedFileTagWriteMessage(
  base: string,
  result: QueueFileTagWriteResult | null,
) {
  if (!result?.queuedCount) {
    return base;
  }
  if (result.heldCount > 0 && result.readyCount > 0) {
    return `${base}; file tags queued, current track waits until playback leaves it`;
  }
  if (result.heldCount > 0) {
    return `${base}; file tags queued until playback leaves this track`;
  }
  return `${base}; file tags queued`;
}

export function useDeferredFileTagWriter({
  currentTrackId,
  setStatus,
}: {
  currentTrackId: number | null;
  setStatus: (message: string) => void;
}) {
  const pendingRef = useRef<Map<number, PendingFileTagWrite>>(new Map());
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const currentTrackIdRef = useRef<number | null>(currentTrackId);
  currentTrackIdRef.current = currentTrackId;

  const flushReadyFileTagWrites = useCallback(async () => {
    if (inFlightRef.current) {
      if (timerRef.current === null) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void flushReadyFileTagWrites();
        }, DEFERRED_FILE_TAG_WRITE_DELAY_MS);
      }
      return;
    }
    const activeTrackId = currentTrackIdRef.current;
    const readyEntries = Array.from(pendingRef.current.entries()).filter(
      ([trackId]) => trackId !== activeTrackId,
    );
    if (!readyEntries.length) {
      return;
    }

    for (const [trackId] of readyEntries) {
      pendingRef.current.delete(trackId);
    }
    inFlightRef.current = true;
    const batches = new Map<string, {
      trackIds: number[];
      includeMetadata: boolean;
      includeRating: boolean;
    }>();
    for (const [trackId, write] of readyEntries) {
      const key = `${write.includeMetadata ? 1 : 0}:${write.includeRating ? 1 : 0}`;
      const batch = batches.get(key) ?? {
        trackIds: [],
        includeMetadata: write.includeMetadata,
        includeRating: write.includeRating,
      };
      batch.trackIds.push(trackId);
      batches.set(key, batch);
    }

    const errors: string[] = [];
    try {
      for (const batch of batches.values()) {
        try {
          const response = await writeTrackMetadataToFiles({
            track_ids: batch.trackIds,
            include_metadata: batch.includeMetadata,
            include_rating: batch.includeRating,
            apply: true,
            limit: batch.trackIds.length,
          });
          errors.push(...response.errors);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Queued file tag write failed");
        }
      }
    } finally {
      inFlightRef.current = false;
    }

    if (errors.length > 0) {
      setStatus(`Queued file tag write finished with ${errors.length.toLocaleString()} issue${errors.length === 1 ? "" : "s"}`);
    }
  }, [setStatus]);

  const scheduleFileTagWriteFlush = useCallback((delayMs = DEFERRED_FILE_TAG_WRITE_DELAY_MS) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushReadyFileTagWrites();
    }, delayMs);
  }, [flushReadyFileTagWrites]);

  const queueFileTagWrite = useCallback((request: QueueFileTagWriteRequest): QueueFileTagWriteResult => {
    const includeMetadata = Boolean(request.includeMetadata);
    const includeRating = Boolean(request.includeRating);
    if (!includeMetadata && !includeRating) {
      return { queuedCount: 0, heldCount: 0, readyCount: 0 };
    }
    const trackIds = Array.from(new Set(request.trackIds)).filter((trackId) => trackId > 0);
    const activeTrackId = currentTrackIdRef.current;
    let heldCount = 0;
    let readyCount = 0;

    for (const trackId of trackIds) {
      const current = pendingRef.current.get(trackId);
      pendingRef.current.set(trackId, {
        includeMetadata: includeMetadata || Boolean(current?.includeMetadata),
        includeRating: includeRating || Boolean(current?.includeRating),
      });
      if (trackId === activeTrackId) {
        heldCount += 1;
      } else {
        readyCount += 1;
      }
    }

    if (readyCount > 0) {
      scheduleFileTagWriteFlush();
    }
    return {
      queuedCount: trackIds.length,
      heldCount,
      readyCount,
    };
  }, [scheduleFileTagWriteFlush]);

  useEffect(() => {
    scheduleFileTagWriteFlush(DEFERRED_FILE_TAG_WRITE_AFTER_TRACK_CHANGE_MS);
  }, [currentTrackId, scheduleFileTagWriteFlush]);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return {
    flushReadyFileTagWrites,
    queueFileTagWrite,
  };
}
