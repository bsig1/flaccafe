const coffeeTapCountStorageKey = "flac-cafe-coffee-tap-count";

export function readCoffeeTapCount() {
  if (typeof window === "undefined") {
    return 0;
  }
  const parsed = Number.parseInt(window.localStorage.getItem(coffeeTapCountStorageKey) ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function writeCoffeeTapCount(count: number) {
  try {
    window.localStorage.setItem(coffeeTapCountStorageKey, String(count));
  } catch {
    // The counter is just a tiny easter egg; animation still works without storage.
  }
}

export function coffeeTapCountLabel(count: number) {
  return `Cup tapped ${count.toLocaleString()} ${count === 1 ? "time" : "times"}`;
}
