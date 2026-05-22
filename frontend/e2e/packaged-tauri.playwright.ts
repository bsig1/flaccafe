import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";

const packagedExe = process.env.FLAC_CAFE_TAURI_EXE;

test("packaged Tauri app starts and exposes backend health", async () => {
  test.skip(!packagedExe, "Set FLAC_CAFE_TAURI_EXE to run the packaged Tauri smoke test.");
  expect(existsSync(packagedExe!)).toBeTruthy();

  const port = 18766;
  let processRef: ChildProcessWithoutNullStreams | null = null;
  try {
    processRef = spawn(packagedExe!, [], {
      env: {
        ...process.env,
        FLAC_CAFE_PORT: String(port),
      },
      windowsHide: true,
    });

    await expect
      .poll(
        async () => {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/health`);
            return response.ok ? (await response.json()).status : "not-ready";
          } catch {
            return "not-ready";
          }
        },
        { timeout: 30_000, intervals: [500, 1_000, 2_000] },
      )
      .toBe("ok");
  } finally {
    if (processRef && !processRef.killed) {
      processRef.kill();
    }
  }
});
