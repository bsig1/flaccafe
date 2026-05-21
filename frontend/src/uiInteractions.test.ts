import { describe, expect, it } from "vitest";

import {
  limitRecentItems,
  placeFloatingMenu,
  readBooleanFlag,
  settingsDiagnosticLabel,
  toggleOrderedValue,
  undoBannerText,
  writeBooleanFlag,
} from "./uiInteractions";

describe("library and context menu interactions", () => {
  it("flips the track menu above the cursor near the bottom edge", () => {
    const placement = placeFloatingMenu({
      cursorX: 760,
      cursorY: 760,
      viewportWidth: 900,
      viewportHeight: 800,
      menuWidth: 250,
      menuHeight: 410,
      submenuWidth: 190,
      margin: 12,
    });

    expect(placement.flipY).toBe(true);
    expect(placement.submenuLeft).toBe(true);
    expect(placement.y).toBe(350);
    expect(placement.x).toBe(638);
  });

  it("keeps visible metadata columns ordered by the library header order", () => {
    const order = ["title", "artist", "album", "genre", "rating"];

    expect(toggleOrderedValue(["title", "rating"], "artist", order)).toEqual(["title", "artist", "rating"]);
    expect(toggleOrderedValue(["title", "artist", "rating"], "artist", order)).toEqual(["title", "rating"]);
  });
});

describe("small persisted UI interactions", () => {
  it("remembers quick-start dismissal as a boolean local flag", () => {
    localStorage.clear();

    expect(readBooleanFlag(localStorage, "quick-start")).toBe(false);
    writeBooleanFlag(localStorage, "quick-start", true);

    expect(readBooleanFlag(localStorage, "quick-start")).toBe(true);
  });

  it("limits saved AutoDJ templates to the recent visible set", () => {
    const templates = Array.from({ length: 30 }, (_, index) => ({ id: index }));

    expect(limitRecentItems(templates, 24)).toHaveLength(24);
    expect(limitRecentItems(templates, 24)[0]).toEqual({ id: 0 });
  });
});

describe("diagnostic and undo banner copy", () => {
  it("summarizes Settings diagnostics state", () => {
    expect(settingsDiagnosticLabel("ok", true)).toBe("diagnostics ok");
    expect(settingsDiagnosticLabel("ok", false)).toBe("self-check review");
    expect(settingsDiagnosticLabel("down", true)).toBe("backend down");
  });

  it("formats undo banner text consistently", () => {
    expect(undoBannerText("3 tracks")).toBe("Removed 3 tracks");
  });
});
