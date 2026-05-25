export async function openExternalUrl(url: string, setStatus?: (message: string) => void) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
    return;
  } catch {
    const opened = typeof window !== "undefined" ? window.open(url, "_blank", "noopener,noreferrer") : null;
    if (opened) {
      return;
    }
  }

  try {
    await navigator.clipboard?.writeText(url);
    setStatus?.("Could not open the link, so I copied it to the clipboard.");
  } catch {
    setStatus?.("Could not open the link automatically.");
  }
}
