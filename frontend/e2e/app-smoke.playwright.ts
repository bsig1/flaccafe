import { test } from "@playwright/test";

test.skip("browser shell smoke requires the Tauri/Rust API bridge", async () => {
  // The desktop app no longer falls back to a browser-visible Python HTTP server.
});
