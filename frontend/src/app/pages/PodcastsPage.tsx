import {
  Download,
  Plus,
  Podcast,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  deletePodcastSubscription,
  downloadPodcastEpisode,
  fetchPodcastEpisodes,
  fetchPodcastSubscriptions,
  refreshPodcastSubscription,
  savePodcastSubscription,
} from "../../lib/api";
import type {
  PodcastEpisode,
  PodcastSubscription,
} from "../../types/api";

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return "";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function PodcastsPage({ setStatus }: { setStatus: (message: string) => void }) {
  const [subscriptions, setSubscriptions] = useState<PodcastSubscription[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [autoDownload, setAutoDownload] = useState(false);
  const selected = useMemo(
    () => subscriptions.find((subscription) => subscription.id === selectedId) ?? subscriptions[0] ?? null,
    [selectedId, subscriptions],
  );

  async function loadSubscriptions() {
    try {
      const response = await fetchPodcastSubscriptions();
      setSubscriptions(response);
      if (!selectedId && response[0]) {
        setSelectedId(response[0].id);
      }
      setStatus(response.length ? `Loaded ${response.length.toLocaleString()} podcast subscription${response.length === 1 ? "" : "s"}` : "No podcast subscriptions yet");
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
      void loadEpisodes(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function saveSubscription() {
    try {
      const saved = await savePodcastSubscription(
        {
          title: title || null,
          feed_url: feedUrl,
          download_folder: downloadFolder || null,
          auto_download: autoDownload,
        },
        selectedId,
      );
      setSelectedId(saved.id);
      await loadSubscriptions();
      setStatus(`Saved podcast subscription: ${saved.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save podcast subscription");
    }
  }

  async function addSubscription() {
    setSelectedId(null);
    setTitle("");
    setFeedUrl("");
    setDownloadFolder("");
    setAutoDownload(false);
    setEpisodes([]);
  }

  async function deleteSelectedSubscription() {
    if (!selectedId) {
      return;
    }
    try {
      await deletePodcastSubscription(selectedId);
      setSelectedId(null);
      await loadSubscriptions();
      setStatus("Podcast subscription deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete podcast subscription");
    }
  }

  async function refreshSelectedSubscription() {
    if (!selected) {
      return;
    }
    try {
      const response = await refreshPodcastSubscription(selected.id);
      await loadSubscriptions();
      await loadEpisodes(selected.id);
      setStatus(`Refreshed ${response.total.toLocaleString()} podcast episode${response.total === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh podcast feed");
    }
  }

  async function downloadEpisode(episode: PodcastEpisode) {
    try {
      const updated = await downloadPodcastEpisode(episode.id, downloadFolder || null);
      setEpisodes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatus(`Downloaded ${updated.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download podcast episode");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Podcasts</h1>
            <p className="text-sm text-muted">Optional RSS subscriptions and episode downloads for local listening.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            {subscriptions.map((subscription) => (
              <button
                key={subscription.id}
                className={`grid min-w-0 gap-1 rounded px-3 py-2 text-left transition ${
                  selected?.id === subscription.id ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
                }`}
                type="button"
                onClick={() => setSelectedId(subscription.id)}
              >
                <span className="truncate text-sm font-medium">{subscription.title}</span>
                <span className="text-xs text-muted">
                  {subscription.episode_count.toLocaleString()} episodes · {subscription.downloaded_count.toLocaleString()} downloaded
                </span>
              </button>
            ))}
            {subscriptions.length === 0 && <div className="py-8 text-center text-sm text-muted">Add an RSS feed to start.</div>}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded border border-line bg-panel p-4">
          <div className="grid gap-5">
            <div className="grid gap-3 rounded border border-line bg-ink p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Podcast size={18} />
                Subscription
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
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2 md:self-end">
                  <span className="text-muted">Auto-download flag</span>
                  <input type="checkbox" className="h-4 w-4 accent-moss" checked={autoDownload} onChange={(event) => setAutoDownload(event.target.checked)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="primary-button" type="button" onClick={() => void saveSubscription()}>
                  <Save size={15} />
                  Save
                </button>
                <button className="secondary-button" type="button" disabled={!selected} onClick={() => void refreshSelectedSubscription()}>
                  <RefreshCw size={15} />
                  Refresh Feed
                </button>
                <button className="secondary-button" type="button" disabled={!selected} onClick={() => void deleteSelectedSubscription()}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>

            <div className="rounded border border-line bg-ink p-3">
              <div className="mb-2 text-xs uppercase text-muted">Episodes</div>
              <div className="grid max-h-[34rem] gap-1 overflow-auto pr-1">
                {episodes.map((episode) => (
                  <div key={episode.id} className="grid gap-1 rounded bg-panel px-3 py-2 text-sm md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="truncate text-neutral-100">{episode.title}</div>
                      <div className="truncate text-xs text-muted">
                        {episode.subscription_title ?? "Podcast"} · {formatDate(episode.published_at)} {episode.duration_seconds ? `· ${formatDuration(episode.duration_seconds)}` : ""}
                      </div>
                      {episode.local_path && <div className="truncate text-xs text-moss">{episode.local_path}</div>}
                    </div>
                    <button className="secondary-button h-8 self-center" type="button" disabled={!episode.audio_url} onClick={() => void downloadEpisode(episode)}>
                      <Download size={14} />
                      {episode.download_status === "downloaded" ? "Again" : "Download"}
                    </button>
                  </div>
                ))}
                {episodes.length === 0 && <div className="py-8 text-center text-sm text-muted">Refresh a feed to list episodes.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
