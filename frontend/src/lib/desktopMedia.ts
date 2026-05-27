const MEDIA_SCHEME = "flaccafe-media";
const LEGACY_MEDIA_ORIGIN = `${MEDIA_SCHEME}://localhost`;
const WINDOWS_MEDIA_ORIGIN = `http://${MEDIA_SCHEME}.localhost`;
const OTHER_MEDIA_ORIGIN = LEGACY_MEDIA_ORIGIN;

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function mediaPathFromInput(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed.startsWith(LEGACY_MEDIA_ORIGIN) || trimmed.startsWith(WINDOWS_MEDIA_ORIGIN)) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}`;
    } catch {
      return "/";
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function usesWindowsCustomProtocolOrigin() {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform
    ?? navigator.userAgent;
  return /win|android/i.test(platform);
}

export function desktopMediaUrl(pathOrUrl: string): string | null {
  if (!isTauriDesktop()) {
    return null;
  }
  const origin = usesWindowsCustomProtocolOrigin() ? WINDOWS_MEDIA_ORIGIN : OTHER_MEDIA_ORIGIN;
  return `${origin}${mediaPathFromInput(pathOrUrl)}`;
}
