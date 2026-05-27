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

export type PodcastsPageProps = {
  setStatus: (message: string) => void;
  onPlayTrack: (track: Track, queueItems: Track[]) => void;
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
