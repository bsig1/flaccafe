import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const packagedExe = process.env.FLAC_CAFE_TAURI_EXE;

test("packaged Tauri app starts and stays alive", async () => {
  test.skip(!packagedExe, "Set FLAC_CAFE_TAURI_EXE to run the packaged Tauri smoke test.");
  expect(existsSync(packagedExe!)).toBeTruthy();

  let processRef: ChildProcessWithoutNullStreams | null = null;
  try {
    processRef = spawn(packagedExe!, [], {
      env: process.env,
      windowsHide: true,
    });

    await delay(5_000);
    expect(processRef.exitCode).toBeNull();
  } finally {
    if (processRef && !processRef.killed) {
      processRef.kill();
    }
  }
});
