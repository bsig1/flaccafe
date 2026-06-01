import {
describe,
expect,
it,
} from "vitest";

import {
artistSummaryBlocks,
} from "./ArtistPage";

describe("artist summary rendering", () => {
  it("turns Wikipedia plaintext section markers into readable blocks", () => {
    const blocks = artistSummaryBlocks(
      "Matthew Tyler Musto, known professionally as Blackbear, is an American musician. == Early life == Musto was born in Daytona Beach. == Career == === 2006-2014: Early career === In high school, Musto was the singer of Polaroid.",
    );

    expect(blocks).toEqual([
      {
        kind: "paragraph",
        text: "Matthew Tyler Musto, known professionally as Blackbear, is an American musician.",
      },
      { kind: "heading", level: 2, text: "Early life" },
      { kind: "paragraph", text: "Musto was born in Daytona Beach." },
      { kind: "heading", level: 2, text: "Career" },
      { kind: "heading", level: 3, text: "2006-2014: Early career" },
      { kind: "paragraph", text: "In high school, Musto was the singer of Polaroid." },
    ]);
  });
});
