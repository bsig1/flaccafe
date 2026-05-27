const EARLY_END_MIN_DURATION_SECONDS = 30;

function earlyEndToleranceSeconds(durationSeconds: number) {
  return Math.max(8, Math.min(30, durationSeconds * 0.08));
}

export function playbackEndedEarly(positionSeconds: number, durationSeconds: number) {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return false;
  }
  if (durationSeconds < EARLY_END_MIN_DURATION_SECONDS || positionSeconds <= 1) {
    return false;
  }
  return positionSeconds < durationSeconds - earlyEndToleranceSeconds(durationSeconds);
}
