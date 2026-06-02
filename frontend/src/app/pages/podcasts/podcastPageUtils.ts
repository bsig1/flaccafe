import type {
PodcastEpisode,
PodcastSubscription,
Track,
} from "../../../types/api";

export type PodcastPanelMode = "new" | "feed" | "edit";
export type PodcastEpisodeView = "feed" | "library";

export interface PodcastSubscriptionContextMenu {
  x: number;
  y: number;
  subscription: PodcastSubscription;
}

export interface PodcastEpisodeContextMenu {
  x: number;
  y: number;
  episode: PodcastEpisode;
}

export type PodcastEpisodeSelectionState = {
  selectedEpisodes: PodcastEpisode[];
  selectedDownloadableEpisodes: PodcastEpisode[];
  selectedDownloadedEpisodes: PodcastEpisode[];
  selectedPlayableEpisodes: PodcastEpisode[];
  allVisibleEpisodesSelected: boolean;
  contextEpisodes: PodcastEpisode[];
  contextDownloadableEpisodes: PodcastEpisode[];
  contextDownloadedEpisodes: PodcastEpisode[];
  contextPlayableEpisodes: PodcastEpisode[];
  contextBulk: boolean;
};

export type PodcastsPageProps = {
  setStatus: (message: string) => void;
  onPlayTrack: (track: Track, queueItems: Track[], options?: { resumePositionSeconds?: number | null }) => void;
  onAddToQueue: (track: Track) => void;
  showFilePaths: boolean;
};

export function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function formatDuration(seconds: number | null) {
  if (!seconds) {
    return "";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function podcastEpisodeSelectionState(
  visibleEpisodes: PodcastEpisode[],
  selectedEpisodeIds: Set<number>,
  episodeContextMenu: PodcastEpisodeContextMenu | null,
): PodcastEpisodeSelectionState {
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
  return {
    selectedEpisodes,
    selectedDownloadableEpisodes,
    selectedDownloadedEpisodes,
    selectedPlayableEpisodes,
    allVisibleEpisodesSelected,
    contextEpisodes,
    contextDownloadableEpisodes,
    contextDownloadedEpisodes,
    contextPlayableEpisodes,
    contextBulk: contextEpisodes.length > 1,
  };
}
