import {
ExternalLink,
FolderOpen,
RefreshCw,
} from "lucide-react";
import {
useEffect,
useState,
} from "react";

import {
fetchExtensions,
reloadExtensions,
} from "../../../lib/api";
import type {
ExtensionListResponse,
ExtensionManifest,
} from "../../../types/api";
import {
DisclosureSection,
} from "../../components/common";

function statusClass(extension: ExtensionManifest) {
  if (!extension.enabled) {
    return "border-line bg-panel text-muted";
  }
  return extension.valid ? "border-moss/40 bg-moss/10 text-moss" : "border-ember/50 bg-ember/10 text-ember";
}

export function ExtensionsSection() {
  const [extensions, setExtensions] = useState<ExtensionListResponse | null>(null);
  const [message, setMessage] = useState("Loading extension manifests");

  useEffect(() => {
    void loadExtensions(false);
  }, []);

  async function loadExtensions(forceReload: boolean) {
    try {
      const response = forceReload ? await reloadExtensions() : await fetchExtensions();
      setExtensions(response);
      setMessage(`${response.extensions.length} manifest${response.extensions.length === 1 ? "" : "s"} discovered`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load extension manifests");
    }
  }

  async function revealFolder(path: string | null | undefined, fallbackMessage: string) {
    if (!path) {
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_file_explorer", { path });
      setMessage(fallbackMessage);
    } catch {
      setMessage(path);
    }
  }

  const bundledExamplesDir = extensions?.search_directories.find((directory) => directory !== extensions.user_extensions_dir) ?? null;

  return (
    <DisclosureSection title="Extensions And Skins" description="Manifest discovery for advanced customization">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="min-w-0">
            <div className="font-medium text-white">Personal extension folder</div>
            <div className="mt-1 truncate text-xs text-muted" title={extensions?.user_extensions_dir}>
              {extensions?.user_extensions_dir ?? "Resolving local extension folder"}
            </div>
            {bundledExamplesDir && (
              <div className="mt-1 truncate text-xs text-muted" title={bundledExamplesDir}>
                Bundled examples: {bundledExamplesDir}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void revealFolder(extensions?.user_extensions_dir, "Opened personal extensions folder")}
              disabled={!extensions}
            >
              <FolderOpen size={15} />
              Show Personal
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void revealFolder(bundledExamplesDir, "Opened bundled examples folder")}
              disabled={!bundledExamplesDir}
            >
              <FolderOpen size={15} />
              Show Examples
            </button>
            <button className="secondary-button" type="button" onClick={() => void loadExtensions(true)}>
              <RefreshCw size={15} />
              Reload
            </button>
          </div>
        </div>

        <div className="rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted">
          {message}
        </div>

        <div className="grid gap-2">
          {extensions?.extensions.map((extension) => (
            <div key={`${extension.id}:${extension.directory}`} className="rounded border border-line/70 bg-ink p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white">{extension.name}</div>
                    <span className={`rounded border px-2 py-0.5 text-[11px] uppercase ${statusClass(extension)}`}>
                      {!extension.enabled ? "disabled" : extension.valid ? "ready" : "review"}
                    </span>
                    <span className="rounded border border-line bg-panel px-2 py-0.5 text-[11px] uppercase text-muted">
                      {extension.kind}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {extension.version}
                    {extension.author ? ` by ${extension.author}` : ""}
                  </div>
                  {extension.description && (
                    <div className="mt-2 text-xs text-neutral-300">{extension.description}</div>
                  )}
                </div>
                {extension.homepage && (
                  <a className="secondary-button" href={extension.homepage} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    Home
                  </a>
                )}
              </div>
              <div className="mt-3 truncate text-xs text-muted" title={extension.manifest_path}>
                {extension.manifest_path}
              </div>
              {extension.capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extension.capabilities.map((capability) => (
                    <span key={capability} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-muted">
                      {capability}
                    </span>
                  ))}
                </div>
              )}
              {extension.errors.length > 0 && (
                <div className="mt-2 grid gap-1 text-xs text-ember">
                  {extension.errors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {extensions && extensions.extensions.length === 0 && (
            <div className="rounded border border-dashed border-line/80 bg-ink p-3 text-xs text-muted">
              No extension manifests found yet.
            </div>
          )}
        </div>
      </div>
    </DisclosureSection>
  );
}
