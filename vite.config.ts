import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function appChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  if (!normalized.includes("/frontend/src/app/")) {
    return undefined;
  }
  if (normalized.includes("/pages/file-management/") || normalized.endsWith("/pages/FileManagementPage.tsx")) {
    return "page-file-management";
  }
  if (normalized.includes("/pages/settings/") || normalized.endsWith("/pages/SettingsPage.tsx")) {
    return "page-settings";
  }
  if (normalized.includes("/pages/library/") || normalized.endsWith("/pages/LibraryPage.tsx")) {
    return "page-library";
  }
  if (normalized.includes("/pages/autodj/") || normalized.endsWith("/pages/AutoDjPage.tsx")) {
    return "page-autodj";
  }
  if (normalized.includes("/player/") || normalized.endsWith("/pages/NowPlayingPage.tsx")) {
    return "playback-ui";
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("node_modules")) {
            if (normalized.includes("/react/") || normalized.includes("/react-dom/") || normalized.includes("/scheduler/")) {
              return "vendor-react";
            }
            if (normalized.includes("/lucide-react/") || normalized.includes("/lucide/")) {
              return "vendor-icons";
            }
            if (normalized.includes("/@tauri-apps/")) {
              return "vendor-tauri";
            }
            return "vendor";
          }
          return appChunk(normalized);
        },
      },
    },
  },
});
