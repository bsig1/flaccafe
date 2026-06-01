import {
afterEach,
describe,
expect,
it,
} from "vitest";

import { desktopMediaUrl } from "./desktopMedia";

function setDesktopPlatform(platform: string) {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
}

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("desktop media URLs", () => {
  it("returns null outside the Tauri shell", () => {
    expect(desktopMediaUrl("/track-artwork/7")).toBeNull();
  });

  it("uses the WebView2 custom protocol origin on Windows", () => {
    setDesktopPlatform("Win32");

    expect(desktopMediaUrl("/track-artwork/7")).toBe("http://flaccafe-media.localhost/track-artwork/7");
  });

  it("normalizes legacy custom-scheme URLs on Windows", () => {
    setDesktopPlatform("Win32");

    expect(desktopMediaUrl("flaccafe-media://localhost/track-artwork/7?v=abc")).toBe(
      "http://flaccafe-media.localhost/track-artwork/7?v=abc",
    );
  });

  it("keeps the custom scheme on non-Windows platforms", () => {
    setDesktopPlatform("MacIntel");

    expect(desktopMediaUrl("/album-artwork/2?v=abc")).toBe("flaccafe-media://localhost/album-artwork/2?v=abc");
  });
});
