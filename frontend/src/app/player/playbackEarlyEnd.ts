const EARLY_END_MIN_DURATION_SECONDS = 45;
const EARLY_END_SETTLE_SECONDS = 2.5;

function earlyEndToleranceSeconds(durationSeconds: number) {
  return Math.max(12, Math.min(45, durationSeconds * 0.12));
}

export function playbackEndedEarly(positionSeconds: number, durationSeconds: number) {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return false;
  }
  if (durationSeconds < EARLY_END_MIN_DURATION_SECONDS || positionSeconds <= 5) {
    return false;
  }
  return positionSeconds < durationSeconds - earlyEndToleranceSeconds(durationSeconds) - EARLY_END_SETTLE_SECONDS;
}
