import {
  describe,
  expect,
  it,
} from "vitest";

import {
  fileManagementSections,
  filterFileManagementSections,
} from "./FileManagementNavigator";

describe("file management navigator", () => {
  it("filters tools by category and task keywords", () => {
    expect(filterFileManagementSections(fileManagementSections, "Tags", "artwork").map((section) => section.id)).toEqual([
      "musicBrainz",
    ]);
    expect(filterFileManagementSections(fileManagementSections, "Import", "musicbee").map((section) => section.id)).toEqual([
      "libraryImporters",
    ]);
  });
});
