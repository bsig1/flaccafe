import { describe, expect, it } from "vitest";

import {
  defaultKeyboardShortcuts,
  formatShortcut,
  normalizeKeyboardShortcuts,
  shortcutFromEvent,
  shortcutMatchesEvent,
} from "./shared";

describe("keyboard shortcuts", () => {
  it("keeps defaults when stored shortcuts are missing or malformed", () => {
    const shortcuts = normalizeKeyboardShortcuts({
      "page.library": { key: "l", ctrl: true },
      "playback.next": { key: "" },
    });

    expect(shortcuts["page.library"]).toEqual({ key: "l", ctrl: true, alt: false, shift: false });
    expect(shortcuts["playback.next"]).toEqual(defaultKeyboardShortcuts["playback.next"]);
  });

  it("captures and matches shortcut key combinations", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true });
    const shortcut = shortcutFromEvent(event);

    expect(shortcut).toEqual({ key: "ArrowRight", ctrl: false, alt: true, shift: false });
    expect(shortcut && shortcutMatchesEvent(shortcut, event)).toBe(true);
    expect(shortcut && formatShortcut(shortcut)).toBe("Alt + ArrowRight");
  });
});
