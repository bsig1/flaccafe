import {
  Download,
  FolderOpen,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Podcast,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  deletePodcastSubscription,
  deletePodcastEpisodeDownload,
  downloadPodcastEpisode,
  ensurePodcastEpisodeTrack,
  ensurePodcastSubscriptionFolder,
  fetchPodcastEpisodes,
  fetchPodcastSubscriptions,
  fetchTrack,
  refreshPodcastSubscription,
  savePodcastSubscription,
} from "../../lib/api";
import {
  placeFloatingMenu,
} from "../../lib/uiInteractions";
import type {
  PodcastEpisode,
  PodcastSubscription,
  Track,
} from "../../types/api";
import {
  MENU_VIEWPORT_MARGIN,
} from "../shared";
import {
  formatDate,
  formatDuration,
  type PodcastEpisodeContextMenu,
  type PodcastEpisodeView,
  type PodcastPanelMode,
  type PodcastSubscriptionContextMenu,
  type PodcastsPageProps,
} from "./podcasts/podcastPageUtils";

export function PodcastsPage({
  setStatus,
  onPlayTrack,
  onAddToQueue,
  showFilePaths,
}: PodcastsPageProps) {
  const [subscriptions, setSubscriptions] = useState<PodcastSubscription[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [autoDownload, setAutoDownload] = useState(false);
  const [panelMode, setPanelMode] = useState<PodcastPanelMode>("feed");
  const [episodeView, setEpisodeView] = useState<PodcastEpisodeView>("feed");
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<Set<number>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<PodcastSubscriptionContextMenu | null>(null);
  const [episodeContextMenu, setEpisodeContextMenu] = useState<PodcastEpisodeContextMenu | null>(null);
  const episodeSelectionAnchorId = useRef<number | null>(null);
  const selected = useMemo(
    () => subscriptions.find((subscription) => subscription.id === selectedId) ?? null,
    [selectedId, subscriptions],
  );
  const hasSubscriptions = subscriptions.length > 0;
  const showingTotalFeed = !selected && panelMode === "feed" && hasSubscriptions;
  const totalEpisodeCount = subscriptions.reduce((sum, subscription) => sum + subscription.episode_count, 0);
  const totalDownloadedCount = subscriptions.reduce((sum, subscription) => sum + subscription.downloaded_count, 0);
  const visibleEpisodes = episodeView === "library"
    ? episodes.filter((episode) => episode.local_path || episode.track_id || episode.download_status === "downloaded")
    : episodes;
  const episodeListTitle = episodeView === "library" ? "Podcast Library" : showingTotalFeed ? "All Episodes" : "Episodes";
  const selectedEpisodes = visibleEpisodes.filter((episode) => selectedEpisodeIds.has(episode.id));
  const selectedDownloadableEpisodes = selectedEpisodes.filter((episode) => !episode.local_path && !episode.track_id && Boolean(episode.audio_url));
  const selectedDownloadedEpisodes = selectedEpisodes.filter((episode) => Boolean(episode.local_path));
  const selectedPlayableEpisodes = selectedEpisodes.filter((episode) => Boolean(episode.local_path || episode.track_id));
  const allVisibleEpisodesSelected = visibleEpisodes.length > 0 && visibleEpisodes.every((episode) => selectedEpisodeIds.has(episode.id));
  const contextEpisodes =
    episodeContextMenu && selectedEpisodeIds.has(episodeContextMenu.episode.id)
      ? selectedEpisodes
      : episodeContextMenu
        ? [episodeContextMenu.episode]
        : [];
  const contextDownloadableEpisodes = contextEpisodes.filter((episode) => !episode.local_path && !episode.track_id && Boolean(episode.audio_url));
  const contextDownloadedEpisodes = contextEpisodes.filter((episode) => Boolean(episode.local_path));
  const contextPlayableEpisodes = contextEpisodes.filter((episode) => Boolean(episode.local_path || episode.track_id));
  const contextBulk = contextEpisodes.length > 1;

  function resetSubscriptionForm() {
    setTitle("");
    setFeedUrl("");
    setDownloadFolder("");
    setAutoDownload(false);
  }

  function clearSubscriptionSelection() {
    setSelectedId(null);
    resetSubscriptionForm();
    setPanelMode(subscriptions.length ? "feed" : "new");
  }

  function selectSubscription(subscriptionId: number) {
    setSelectedId(subscriptionId);
    setPanelMode("feed");
  }

  function editSelectedSubscription(subscription = selected) {
    if (!subscription) {
      return;
    }
    setSelectedId(subscription.id);
    setTitle(subscription.title);
    setFeedUrl(subscription.feed_url);
    setDownloadFolder(subscription.download_folder ?? "");
    setAutoDownload(subscription.auto_download);
    setPanelMode("edit");
  }

  async function loadSubscriptions() {
    try {
      const response = await fetchPodcastSubscriptions();
      setSubscriptions(response);
      if (selectedId && !response.some((subscription) => subscription.id === selectedId)) {
        setSelectedId(null);
        resetSubscriptionForm();
        setPanelMode(response.length ? "feed" : "new");
      } else if (!selectedId && response.length === 0) {
        setPanelMode("new");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load podcast subscriptions");
    }
  }

  async function loadEpisodes(subscriptionId: number | null) {
    try {
      setEpisodes(await fetchPodcastEpisodes(subscriptionId, 300));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load podcast episodes");
    }
  }

  useEffect(() => {
    void loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setFeedUrl(selected.feed_url);
      setDownloadFolder(selected.download_folder ?? "");
      setAutoDownload(selected.auto_download);
      void loadEpisodes(selected.id);
    } else {
      resetSubscriptionForm();
      void loadEpisodes(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    const validIds = new Set(episodes.map((episode) => episode.id));
    setSelectedEpisodeIds((current) => {
      const next = new Set([...current].filter((episodeId) => validIds.has(episodeId)));
      return next.size === current.size ? current : next;
    });
  }, [episodes]);

  async function saveSubscription() {
    try {
      const saved = await savePodcastSubscription(
        {
          title: title || null,
          feed_url: feedUrl,
          download_folder: downloadFolder || null,
          auto_download: autoDownload,
        },
        selected?.id ?? null,
      );
      setSelectedId(saved.id);
      setPanelMode("feed");
      await loadSubscriptions();
      setStatus(`Saved podcast subscription: ${saved.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save podcast subscription");
    }
  }

  async function addSubscription() {
    setSelectedId(null);
    resetSubscriptionForm();
    setPanelMode("new");
  }

  function showTotalFeed() {
    setSelectedId(null);
    resetSubscriptionForm();
    setPanelMode(subscriptions.length ? "feed" : "new");
    void loadEpisodes(null);
  }

  async function deleteSelectedSubscription(subscription = selected) {
    if (!subscription) {
      return;
    }
    if (!window.confirm(`Delete podcast subscription "${subscription.title}"?`)) {
      return;
    }
    const deleteFiles =
      subscription.downloaded_count > 0 &&
      window.confirm(`Also delete ${subscription.downloaded_count.toLocaleString()} downloaded podcast file${subscription.downloaded_count === 1 ? "" : "s"}?`);
    try {
      const response = await deletePodcastSubscription(subscription.id, deleteFiles);
      clearSubscriptionSelection();
      await loadSubscriptions();
      setStatus(
        response.deleted_files
          ? `Podcast subscription deleted with ${response.deleted_files.toLocaleString()} downloaded file${response.deleted_files === 1 ? "" : "s"}`
          : "Podcast subscription deleted",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete podcast subscription");
    }
  }

  async function refreshSelectedSubscription(subscription = selected) {
    if (!subscription) {
      return;
    }
    try {
      const response = await refreshPodcastSubscription(subscription.id);
      await loadSubscriptions();
      await loadEpisodes(subscription.id);
      setStatus(`Refreshed ${response.total.toLocaleString()} podcast episode${response.total === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh podcast feed");
    }
  }

  async function revealPodcastFolder(subscription: PodcastSubscription) {
    try {
      const folder = await ensurePodcastSubscriptionFolder(subscription.id);
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_file_explorer", { path: folder.path });
      setStatus(`${folder.created ? "Created and opened" : "Opened"} podcast folder for ${subscription.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reveal in Explorer is available in the desktop app.");
    }
  }

  function updateEpisode(updated: PodcastEpisode) {
    setEpisodes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function downloadEpisode(episode: PodcastEpisode) {
    try {
      const updated = await downloadPodcastEpisode(episode.id, downloadFolder || null);
      updateEpisode(updated);
      setStatus(updated.track_id ? `Downloaded and added ${updated.title}` : `Downloaded ${updated.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download podcast episode");
    }
  }

  async function browseDownloadFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose podcast download folder",
      });
      if (typeof selected === "string") {
        setDownloadFolder(selected);
        setStatus("Podcast download folder selected");
      }
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path here in browser mode.");
    }
  }

  async function playableEpisodeTrack(episode: PodcastEpisode): Promise<Track | null> {
    if (episode.track_id) {
      return fetchTrack(episode.track_id);
    }
    if (!episode.local_path) {
      setStatus("Download the podcast episode before playing it");
      return null;
    }
    const track = await ensurePodcastEpisodeTrack(episode.id);
    setEpisodes((current) => current.map((item) => (item.id === episode.id ? { ...item, track_id: track.id } : item)));
    return track;
  }

  async function playEpisode(episode: PodcastEpisode) {
    try {
      const track = await playableEpisodeTrack(episode);
      if (!track) {
        return;
      }
      onPlayTrack(track, [track]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play podcast episode");
    }
  }

  function toggleEpisodeSelection(episodeId: number) {
    setSelectedEpisodeIds((current) => {
      const next = new Set(current);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  }

  function selectEpisodeLikeWindows(event: ReactMouseEvent, episode: PodcastEpisode) {
    const keepExisting = event.ctrlKey || event.metaKey;
    const extendRange = event.shiftKey && episodeSelectionAnchorId.current !== null;

    if (extendRange) {
      const anchorIndex = visibleEpisodes.findIndex((item) => item.id === episodeSelectionAnchorId.current);
      const targetIndex = visibleEpisodes.findIndex((item) => item.id === episode.id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeIds = visibleEpisodes.slice(start, end + 1).map((item) => item.id);
        setSelectedEpisodeIds((current) => {
          const next = keepExisting ? new Set(current) : new Set<number>();
          rangeIds.forEach((episodeId) => next.add(episodeId));
          return next;
        });
        return;
      }
    }

    episodeSelectionAnchorId.current = episode.id;
    if (keepExisting) {
      toggleEpisodeSelection(episode.id);
    } else {
      setSelectedEpisodeIds(new Set([episode.id]));
    }
  }

  function setVisibleEpisodeSelection(selected: boolean) {
    episodeSelectionAnchorId.current = selected ? visibleEpisodes[0]?.id ?? null : null;
    setSelectedEpisodeIds((current) => {
      const next = new Set(current);
      for (const episode of visibleEpisodes) {
        if (selected) {
          next.add(episode.id);
        } else {
          next.delete(episode.id);
        }
      }
      return next;
    });
  }

  function clearEpisodeSelection() {
    setSelectedEpisodeIds(new Set());
    episodeSelectionAnchorId.current = null;
  }

  async function downloadSelectedEpisodes(targetEpisodes = selectedDownloadableEpisodes) {
    if (!targetEpisodes.length) {
      setStatus("No selected remote podcast episodes can be downloaded.");
      return;
    }
    let downloaded = 0;
    const errors: string[] = [];
    setStatus(`Downloading ${targetEpisodes.length.toLocaleString()} podcast episode${targetEpisodes.length === 1 ? "" : "s"}...`);
    for (const episode of targetEpisodes) {
      try {
        const updated = await downloadPodcastEpisode(episode.id, selected ? downloadFolder || null : null);
        updateEpisode(updated);
        downloaded += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not download ${episode.title}`);
      }
    }
    await loadSubscriptions();
    setSelectedEpisodeIds((current) => {
      const next = new Set(current);
      targetEpisodes.forEach((episode) => next.delete(episode.id));
      return next;
    });
    setStatus(
      errors.length
        ? `Downloaded ${downloaded.toLocaleString()} episode${downloaded === 1 ? "" : "s"}; ${errors.length.toLocaleString()} failed`
        : `Downloaded ${downloaded.toLocaleString()} podcast episode${downloaded === 1 ? "" : "s"}`,
    );
  }

  async function deleteSelectedEpisodeFiles(targetEpisodes = selectedDownloadedEpisodes) {
    if (!targetEpisodes.length) {
      setStatus("No selected downloaded podcast files can be deleted.");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${targetEpisodes.length.toLocaleString()} downloaded podcast file${targetEpisodes.length === 1 ? "" : "s"} from disk?`,
    );
    if (!confirmed) {
      return;
    }
    let deleted = 0;
    let missing = 0;
    const errors: string[] = [];
    for (const episode of targetEpisodes) {
      try {
        const response = await deletePodcastEpisodeDownload(episode.id);
        updateEpisode(response.episode);
        if (response.deleted_file) {
          deleted += 1;
        }
        if (response.missing_file) {
          missing += 1;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not delete ${episode.title}`);
      }
    }
    await loadSubscriptions();
    setSelectedEpisodeIds((current) => {
      const next = new Set(current);
      targetEpisodes.forEach((episode) => next.delete(episode.id));
      return next;
    });
    setStatus(
      errors.length
        ? `Deleted ${deleted.toLocaleString()} podcast file${deleted === 1 ? "" : "s"}; ${errors.length.toLocaleString()} failed`
        : `Deleted ${deleted.toLocaleString()} podcast file${deleted === 1 ? "" : "s"}${missing ? ` and cleared ${missing.toLocaleString()} missing file${missing === 1 ? "" : "s"}` : ""}`,
    );
  }

  async function queueSelectedEpisodes(targetEpisodes = selectedPlayableEpisodes) {
    if (!targetEpisodes.length) {
      setStatus("No selected downloaded podcast episodes can be queued.");
      return;
    }
    let queued = 0;
    const errors: string[] = [];
    for (const episode of targetEpisodes) {
      try {
        const track = await playableEpisodeTrack(episode);
        if (track) {
          onAddToQueue(track);
          queued += 1;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not queue ${episode.title}`);
      }
    }
    setStatus(
      errors.length
        ? `Queued ${queued.toLocaleString()} podcast episode${queued === 1 ? "" : "s"}; ${errors.length.toLocaleString()} failed`
        : `Queued ${queued.toLocaleString()} podcast episode${queued === 1 ? "" : "s"}`,
    );
  }

  function handlePodcastSurfaceClick(event: ReactMouseEvent<HTMLElement>) {
    setContextMenu(null);
    setEpisodeContextMenu(null);
    const target = event.target as HTMLElement;
    if (!target.closest("[data-podcast-episode-row], button, a, input, textarea, select, summary, details, [role='menu']")) {
      clearEpisodeSelection();
    }
    if (target.closest("[data-podcast-selection-surface]")) {
      return;
    }
    clearSubscriptionSelection();
  }

  function openSubscriptionContextMenu(event: ReactMouseEvent, subscription: PodcastSubscription) {
    event.preventDefault();
    event.stopPropagation();
    selectSubscription(subscription.id);
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: 232,
      menuHeight: 188,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setEpisodeContextMenu(null);
    setContextMenu({
      x: placement.x,
      y: placement.y,
      subscription,
    });
  }

  function openEpisodeContextMenu(event: ReactMouseEvent, episode: PodcastEpisode) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedEpisodeIds.has(episode.id)) {
      episodeSelectionAnchorId.current = episode.id;
      setSelectedEpisodeIds(new Set([episode.id]));
    }
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: 240,
      menuHeight: 300,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setContextMenu(null);
    setEpisodeContextMenu({
      x: placement.x,
      y: placement.y,
      episode,
    });
  }

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
      setEpisodeContextMenu(null);
    }

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", closeContextMenu);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", closeContextMenu);
    };
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app" onMouseDown={handlePodcastSurfaceClick}>
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Podcasts</h1>
            <p className="text-sm text-muted">Follow feeds, download episodes locally, and keep podcasts out of the main music library.</p>
          </div>
          <div className="flex flex-wrap gap-2" data-podcast-selection-surface>
            {hasSubscriptions && (
              <div className="inline-flex h-9 overflow-hidden rounded border border-line bg-panel p-0.5 text-xs text-muted">
                {(["feed", "library"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`rounded px-3 font-medium transition ${
                      episodeView === mode ? "bg-moss text-black" : "hover:bg-white/10 hover:text-white"
                    }`}
                    type="button"
                    onClick={() => setEpisodeView(mode)}
                  >
                    {mode === "feed" ? "Feed" : "Library"}
                  </button>
                ))}
              </div>
            )}
            <button className="secondary-button" type="button" onClick={() => void addSubscription()}>
              <Plus size={15} />
              New
            </button>
            <button className="secondary-button" type="button" onClick={() => void loadSubscriptions()}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[320px_1fr]">
        <div className="min-h-0 overflow-hidden rounded border border-line bg-panel">
          <div className="border-b border-line px-3 py-2 text-xs uppercase text-muted">Subscriptions</div>
          <div className="grid max-h-full gap-1 overflow-auto p-2">
            {subscriptions.length > 0 && (
              <button
                data-podcast-selection-surface
                className={`grid min-w-0 gap-1 rounded px-3 py-2 text-left transition ${
                  showingTotalFeed ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
                }`}
                type="button"
                onClick={showTotalFeed}
              >
                <span className="truncate text-sm font-medium">All Episodes</span>
                <span className="text-xs text-muted">
                  {totalEpisodeCount.toLocaleString()} episodes - {totalDownloadedCount.toLocaleString()} downloaded
                </span>
              </button>
            )}
            {subscriptions.map((subscription) => (
              <button
                key={subscription.id}
                data-podcast-selection-surface
                className={`grid min-w-0 gap-1 rounded px-3 py-2 text-left transition ${
                  selected?.id === subscription.id ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
                }`}
                type="button"
                onClick={() => {
                  if (selectedId === subscription.id) {
                    clearSubscriptionSelection();
                  } else {
                    selectSubscription(subscription.id);
                  }
                }}
                onContextMenu={(event) => openSubscriptionContextMenu(event, subscription)}
              >
                <span className="truncate text-sm font-medium">{subscription.title}</span>
                <span className="text-xs text-muted">
                  {subscription.episode_count.toLocaleString()} episodes - {subscription.downloaded_count.toLocaleString()} downloaded
                </span>
              </button>
            ))}
            {subscriptions.length === 0 && <div className="py-8 text-center text-sm text-muted">Add an RSS feed to start.</div>}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded border border-line bg-panel p-4">
          <div className="grid gap-5">
            {showingTotalFeed && (
              <div className="grid gap-3 rounded border border-line bg-ink p-3" data-podcast-selection-surface>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Podcast size={18} />
                      <span className="truncate">All Podcasts</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted">
                      {episodeView === "library" ? "Downloaded episodes across every subscription." : "Latest episodes across every subscription."}
                    </div>
                  </div>
                  <button
                    className="secondary-button h-8"
                    type="button"
                    onClick={() => {
                      void loadSubscriptions();
                      void loadEpisodes(null);
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh List
                  </button>
                </div>
                <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Subscriptions</div>
                    <div className="mt-1 text-sm font-semibold text-white">{subscriptions.length.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Episodes</div>
                    <div className="mt-1 text-sm font-semibold text-white">{totalEpisodeCount.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Downloaded</div>
                    <div className="mt-1 text-sm font-semibold text-white">{totalDownloadedCount.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {selected && panelMode === "feed" && (
              <div className="grid gap-3 rounded border border-line bg-ink p-3" data-podcast-selection-surface>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Podcast size={18} />
                      <span className="truncate">{selected.title}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted">{selected.feed_url}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="secondary-button h-8" type="button" onClick={() => editSelectedSubscription()}>
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button className="secondary-button h-8" type="button" onClick={() => void refreshSelectedSubscription()}>
                      <RefreshCw size={14} />
                      Refresh Feed
                    </button>
                    <button className="secondary-button h-8" type="button" onClick={() => void deleteSelectedSubscription()}>
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Episodes</div>
                    <div className="mt-1 text-sm font-semibold text-white">{selected.episode_count.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Downloaded</div>
                    <div className="mt-1 text-sm font-semibold text-white">{selected.downloaded_count.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-line/70 bg-panel px-3 py-2">
                    <div className="uppercase">Last Checked</div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{formatDate(selected.last_checked_at)}</div>
                  </div>
                </div>
                <div className="truncate text-xs text-muted">
                  Downloads: {selected.effective_download_folder || selected.download_folder || "App default podcast folder"}
                </div>
              </div>
            )}

            {(panelMode === "new" || (!hasSubscriptions && !selected) || (selected && panelMode === "edit")) && (
            <div className="grid gap-3 rounded border border-line bg-ink p-3" data-podcast-selection-surface>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Podcast size={18} />
                {selected ? "Edit Subscription" : "New Subscription"}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Title</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={title}
                    placeholder="Optional, feed title fills on refresh"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Feed URL</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={feedUrl}
                    placeholder="https://example.com/feed.xml"
                    onChange={(event) => setFeedUrl(event.target.value)}
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Download Folder</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={downloadFolder}
                    placeholder="Default: app exports\\podcasts"
                    onChange={(event) => setDownloadFolder(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2 md:self-end">
                  <button className="secondary-button h-9" type="button" onClick={() => void browseDownloadFolder()}>
                    <FolderOpen size={15} />
                    Browse
                  </button>
                  <button className="secondary-button h-9" type="button" onClick={() => setDownloadFolder("")}>
                    Use Default
                  </button>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                <span className="text-muted">Auto-download flag</span>
                <input type="checkbox" className="h-4 w-4 accent-moss" checked={autoDownload} onChange={(event) => setAutoDownload(event.target.checked)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="primary-button" type="button" onClick={() => void saveSubscription()}>
                  <Save size={15} />
                  Save
                </button>
                {selected && (
                  <button className="secondary-button" type="button" onClick={() => setPanelMode("feed")}>
                    <X size={15} />
                    Cancel
                  </button>
                )}
              </div>
            </div>
            )}

            {(selected || showingTotalFeed) && (
            <div className="rounded border border-line bg-ink p-3" data-podcast-selection-surface>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs uppercase text-muted">
                <span>{episodeListTitle}</span>
                <span className="mr-auto">
                  {visibleEpisodes.length.toLocaleString()} shown
                  {selectedEpisodes.length > 0 ? ` - ${selectedEpisodes.length.toLocaleString()} selected` : ""}
                </span>
              </div>
              <div className="grid max-h-[34rem] gap-1 overflow-auto pr-1">
                {visibleEpisodes.map((episode) => {
                  const episodePlayable = Boolean(episode.local_path || episode.track_id);
                  const episodeSelected = selectedEpisodeIds.has(episode.id);
                  return (
                    <div
                      key={episode.id}
                      data-podcast-episode-row
                      className={`grid cursor-pointer gap-2 rounded px-3 py-2 text-sm transition md:grid-cols-[auto_1fr_auto] ${
                        episodeSelected ? "bg-white/[0.08]" : "bg-panel hover:bg-white/[0.04]"
                      } select-none`}
                      onClick={(event) => selectEpisodeLikeWindows(event, episode)}
                      onContextMenu={(event) => openEpisodeContextMenu(event, episode)}
                    >
                      <input
                        type="checkbox"
                        className="pointer-events-none mt-1 h-4 w-4 accent-moss"
                        checked={episodeSelected}
                        readOnly
                        tabIndex={-1}
                        aria-label={`Select ${episode.title}`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-neutral-100">{episode.title}</div>
                        <div className="truncate text-xs text-muted">
                          {episode.subscription_title ?? "Podcast"} - {formatDate(episode.published_at)} {episode.duration_seconds ? `- ${formatDuration(episode.duration_seconds)}` : ""}
                        </div>
                        {showFilePaths && episode.local_path && <div className="truncate text-xs text-moss">{episode.local_path}</div>}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 self-center">
                        <button
                          className="primary-button h-8 w-28 justify-center"
                          type="button"
                          disabled={episodePlayable ? false : !episode.audio_url}
                          onClick={(event) => {
                            event.stopPropagation();
                            episodePlayable ? void playEpisode(episode) : void downloadEpisode(episode);
                          }}
                        >
                          {episodePlayable ? <Play size={14} /> : <Download size={14} />}
                          {episodePlayable ? "Play" : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {visibleEpisodes.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted">
                    {episodeView === "library" ? "No downloaded podcast episodes yet." : "Refresh a feed to list episodes."}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
      {contextMenu && (
        <div
          className="fixed z-50 w-60 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="border-b border-line px-3 py-2 text-xs text-muted">
            <div className="truncate font-medium text-neutral-200">{contextMenu.subscription.title}</div>
            <div className="truncate">{contextMenu.subscription.effective_download_folder || contextMenu.subscription.download_folder || "Default podcast folder"}</div>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              void revealPodcastFolder(contextMenu.subscription);
              setContextMenu(null);
            }}
          >
            <FolderOpen size={15} />
            Reveal Download Folder
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              void refreshSelectedSubscription(contextMenu.subscription);
              setContextMenu(null);
            }}
          >
            <RefreshCw size={15} />
            Refresh Feed
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              editSelectedSubscription(contextMenu.subscription);
              setContextMenu(null);
            }}
          >
            <Pencil size={15} />
            Edit Subscription
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
            type="button"
            onClick={() => {
              void deleteSelectedSubscription(contextMenu.subscription);
              setContextMenu(null);
            }}
          >
            <Trash2 size={15} />
            Delete Subscription
          </button>
        </div>
      )}
      {episodeContextMenu && (
        <div
          className="fixed z-50 w-60 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: episodeContextMenu.x, top: episodeContextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="border-b border-line px-3 py-2 text-xs text-muted">
            <div className="truncate font-medium text-neutral-200">
              {contextBulk ? `${contextEpisodes.length.toLocaleString()} selected episodes` : episodeContextMenu.episode.title}
            </div>
            <div className="truncate">{episodeContextMenu.episode.subscription_title ?? "Podcast"}</div>
          </div>
          {!contextBulk && (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={contextPlayableEpisodes.length === 0}
              onClick={() => {
                void playEpisode(episodeContextMenu.episode);
                setEpisodeContextMenu(null);
              }}
            >
              <Play size={15} />
              Play
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={contextDownloadableEpisodes.length === 0}
            onClick={() => {
              void downloadSelectedEpisodes(contextDownloadableEpisodes);
              setEpisodeContextMenu(null);
            }}
          >
            <Download size={15} />
            {contextBulk ? "Download Selected" : "Download"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={contextPlayableEpisodes.length === 0}
            onClick={() => {
              void queueSelectedEpisodes(contextPlayableEpisodes);
              setEpisodeContextMenu(null);
            }}
          >
            <ListPlus size={15} />
            {contextBulk ? "Queue Selected" : "Queue"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={contextDownloadedEpisodes.length === 0}
            onClick={() => {
              void deleteSelectedEpisodeFiles(contextDownloadedEpisodes);
              setEpisodeContextMenu(null);
            }}
          >
            <Trash2 size={15} />
            {contextBulk ? "Delete Selected Files" : "Delete File"}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={visibleEpisodes.length === 0}
            onClick={() => {
              setVisibleEpisodeSelection(!allVisibleEpisodesSelected);
              setEpisodeContextMenu(null);
            }}
          >
            <Podcast size={15} />
            {allVisibleEpisodesSelected ? "Clear Shown" : "Select All"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={selectedEpisodeIds.size === 0}
            onClick={() => {
              clearEpisodeSelection();
              setEpisodeContextMenu(null);
            }}
          >
            <X size={15} />
            Clear Selection
          </button>
        </div>
      )}
    </section>
  );
}
