import { expect, test } from "@playwright/test";

const emptyStats = {
  total_tracks: 0,
  total_albums: 0,
  total_artists: 0,
  total_playlists: 0,
  rated_tracks: 0,
  unrated_tracks: 0,
  total_duration_seconds: 0,
  played_events: 0,
  skipped_events: 0,
};

const emptyHealth = {
  missing_files: [],
  missing_metadata: [],
  duplicate_groups: [],
  unrated_tracks: [],
};

function mockedBackendResponse(pathname: string) {
  if (pathname === "/health") {
    return { status: "ok" };
  }
  if (pathname === "/settings") {
    return {
      library_path: null,
      database_path: "C:\\Users\\Test\\AppData\\Roaming\\FLAC Cafe\\music.sqlite3",
      suggested_music_path: "C:\\Users\\Test\\Music",
      write_ratings_to_files: false,
      extra: {},
    };
  }
  if (pathname === "/diagnostics/startup") {
    return {
      ok: true,
      generated_at: "2026-05-21T00:00:00Z",
      items: [],
      log_path: "backend.log",
      app_data_path: "C:\\Users\\Test\\AppData\\Roaming\\FLAC Cafe",
    };
  }
  if (pathname === "/diagnostics/logs/backend") {
    return { path: "backend.log", exists: true, lines: [] };
  }
  if (pathname === "/tracks/page") {
    return { tracks: [], total: 0, limit: 500, offset: 0 };
  }
  if (
    [
      "/albums",
      "/playlists",
      "/smart-playlists",
      "/history",
      "/autodj/avoid",
      "/autodj/profiles",
      "/autodj/history",
      "/library/tools/undo-log",
      "/library/tools/undo-batches",
    ].includes(pathname)
  ) {
    return [];
  }
  if (pathname === "/smart-playlists/presets") {
    return {
      unrated: { preset: "unrated", limit: 200 },
      favorites: { preset: "favorites", limit: 200 },
    };
  }
  if (pathname === "/library/stats") {
    return emptyStats;
  }
  if (pathname === "/library/health") {
    return emptyHealth;
  }
  if (pathname === "/analysis/clap/status") {
    return {
      installed: false,
      dependencies: {},
      model_id: "laion/clap-htsat-unfused",
      cache_dir: "",
      max_duration_seconds: 30,
      model_cached: false,
      install_supported: true,
      message: "Optional analysis runtime is not installed.",
    };
  }
  if (pathname === "/analysis/clap/coverage") {
    return {
      total_tracks: 0,
      analyzed_tracks: 0,
      unanalyzed_tracks: 0,
      failed_tracks: 0,
      coverage_percent: 0,
      provider: "clap",
    };
  }
  if (pathname === "/library/tools/acoustic-fingerprints/setup") {
    return {
      available: false,
      configured_path: null,
      resolved_path: null,
      version: null,
      tool_directory: "C:\\Users\\Test\\AppData\\Roaming\\FLAC Cafe\\tools\\chromaprint",
      checked_paths: [],
      message: "Chromaprint fpcalc is optional.",
      errors: [],
    };
  }
  return {};
}

test("renders the app shell against mocked local backend data", async ({ page }) => {
  await page.route("http://127.0.0.1:8765/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockedBackendResponse(url.pathname)),
    });
  });

  await page.goto("/");

  await expect(page.getByText("FLAC Cafe").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: /choose music folder/i })).toBeVisible();
});
