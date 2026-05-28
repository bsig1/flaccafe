import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  GripVertical,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  compareRecommendationProfiles,
  chooseRecommendationAbTest,
  createRecommendationAbTest,
  exportRecommendationProfileComparison,
  exportQueue,
  fetchSimilarTracks,
  generateAutoDj,
  importRecommendationProfileComparison,
} from "../../lib/api";
import {
  placeFloatingMenu,
} from "../../lib/uiInteractions";
import type {
  AutoDjAvoidRule,
  AutoDjSettings,
  QueueTrack,
  RecommendationAbTestResponse,
  RecommendationDrift,
  RecommendationProfile,
  RecommendationProfileComparison,
  RecommendationRun,
  SimilarTrack,
  Track,
} from "../../types/api";
import { closeFloatingMenus, listenForCloseFloatingMenus } from "../menuEvents";
import { AutoDjHeader } from "./autodj/AutoDjHeader";
import { AutoDjQueuePanel } from "./autodj/AutoDjQueuePanel";
import { AutoDjSettingsPanel } from "./autodj/AutoDjSettingsPanel";
import {
  DragGhostPreview,
  NumberField,
} from "../components/common";
import {
  AutoDjExperience,
  AutoDjTemplate,
  DragGhost,
  MENU_VIEWPORT_MARGIN,
  UiPreferences,
  beginPointerReorderDrag,
  breakdownEntries,
  defaultAutoDj,
  display,
  formatDuration,
  formatPercent,
  formatShortDate,
  isClapAnalyzed,
  readAutoDjTemplates,
  reasonChipClass,
  reasonChips,
  trackGenre,
  writeAutoDjTemplates,
} from "../shared";

export function AutoDjPage({
  queue,
  setQueue,
  setRecommendationDrift,
  setStatus,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onUseGeneratedQueue,
  onQuickAutoDj,
  onRevealTrack,
  onAddTracksToPlaylist,
  currentTrackId,
  currentTrack,
  uiPreferences,
  continuousAutoDjEnabled,
  continuousAutoDjBusy,
  onContinuousAutoDjChange,
  onContinuousSettingsChange,
  avoidRules,
  onDeleteAvoidRule,
  recommendationProfiles,
  recommendationDrift,
  recommendationHistory,
  onRefreshProfiles,
  onRefreshHistory,
  onSaveRecommendationProfile,
  onDeleteRecommendationProfile,
  onSetDefaultRecommendationProfile,
}: {
  queue: QueueTrack[];
  setQueue: (tracks: QueueTrack[]) => void;
  setRecommendationDrift: (drift: RecommendationDrift) => void;
  setStatus: (message: string) => void;
  onPlayTrack: (track: Track, queue: Track[], options?: { suppressExitRecord?: boolean }) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onUseGeneratedQueue: (tracks: Track[]) => void;
  onQuickAutoDj: (track: Track) => void | Promise<void>;
  onRevealTrack: (track: Track) => void | Promise<void>;
  onAddTracksToPlaylist: (trackIds: number[]) => void;
  currentTrackId: number | null;
  currentTrack: Track | null;
  uiPreferences: UiPreferences;
  continuousAutoDjEnabled: boolean;
  continuousAutoDjBusy: boolean;
  onContinuousAutoDjChange: (enabled: boolean) => void;
  onContinuousSettingsChange: (settings: AutoDjSettings) => void;
  avoidRules: AutoDjAvoidRule[];
  onDeleteAvoidRule: (ruleId: number) => void;
  recommendationProfiles: RecommendationProfile[];
  recommendationDrift: RecommendationDrift;
  recommendationHistory: RecommendationRun[];
  onRefreshProfiles: () => void | Promise<void>;
  onRefreshHistory: () => void | Promise<void>;
  onSaveRecommendationProfile: (name: string, settings: AutoDjSettings, isDefault: boolean) => void | Promise<void>;
  onDeleteRecommendationProfile: (profileId: number) => void | Promise<void>;
  onSetDefaultRecommendationProfile: (profileId: number) => void | Promise<void>;
}) {
  const AUTO_DJ_CONTEXT_MENU_WIDTH = 224;
  const AUTO_DJ_CONTEXT_MENU_HEIGHT = 332;
  const [settings, setSettings] = useState<AutoDjSettings>({
    ...defaultAutoDj,
    queue_length: uiPreferences.defaultQueueLength,
    temperature: uiPreferences.defaultTemperature,
    similarity_weight: uiPreferences.similarityWeight,
  });
  const [busy, setBusy] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<AutoDjExperience>("simple");
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [templates, setTemplates] = useState<AutoDjTemplate[]>(readAutoDjTemplates);
  const [explainTrackKey, setExplainTrackKey] = useState<string | null>(null);
  const [selectedQueueKeys, setSelectedQueueKeys] = useState<Set<string>>(() => new Set());
  const [queueContextMenu, setQueueContextMenu] = useState<{
    track: QueueTrack;
    index: number;
    rowKey: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragQueueIndex, setDragQueueIndex] = useState<number | null>(null);
  const [dragQueueOverIndex, setDragQueueOverIndex] = useState<number | null>(null);
  const [queueDragGhost, setQueueDragGhost] = useState<DragGhost | null>(null);
  const [similarPreview, setSimilarPreview] = useState<SimilarTrack[]>([]);
  const [isSimilarityLoading, setIsSimilarityLoading] = useState(false);
  const [neighborAnalyzedOnly, setNeighborAnalyzedOnly] = useState(false);
  const [neighborMinRating, setNeighborMinRating] = useState(0);
  const [neighborGenre, setNeighborGenre] = useState("");
  const [profileComparisons, setProfileComparisons] = useState<RecommendationProfileComparison[]>([]);
  const [profileComparisonSeed, setProfileComparisonSeed] = useState<number | null>(null);
  const [isComparingProfiles, setIsComparingProfiles] = useState(false);
  const [abTest, setAbTest] = useState<RecommendationAbTestResponse | null>(null);
  const [selectedAbLabel, setSelectedAbLabel] = useState<"A" | "B">("A");
  const [isCreatingAbTest, setIsCreatingAbTest] = useState(false);
  const appliedDefaultProfileId = useRef<number | null>(null);
  const defaultProfile = recommendationProfiles.find((profile) => profile.is_default) ?? null;
  const presets: { label: string; settings: Partial<AutoDjSettings> }[] = [
    {
      label: "Favorites",
      settings: {
        temperature: 0.18,
        minimum_rating: 4,
        unrated_exploration_percent: 0,
        target_unrated_percent: 0,
        target_exploration_percent: 0,
        rating_weight: 2.8,
        exploration_weight: 0.15,
        recently_played_cooldown_days: 7,
      },
    },
    { label: "Discovery", settings: { temperature: 1.25, unrated_exploration_percent: 35, recently_played_cooldown_days: 7 } },
    { label: "Deep Cuts", settings: { temperature: 1.05, unrated_exploration_percent: 18, recently_played_cooldown_days: 45 } },
    { label: "Similar", settings: { seed_track_id: currentTrack?.id ?? null, similarity_weight: uiPreferences.similarityWeight, temperature: 0.7 } },
  ];
  const queueDuration = queue.reduce((total, track) => total + (track.duration_seconds ?? 0), 0);
  const queueArtists = new Set(queue.map((track) => display(track.artist)).filter(Boolean)).size;
  const clapTracks = queue.filter((track) => isClapAnalyzed(track)).length;
  const selectedAbQueue = abTest?.queues.find((candidate) => candidate.label === selectedAbLabel) ?? abTest?.queues[0] ?? null;
  const selectedAbDuration = selectedAbQueue?.tracks.reduce((total, track) => total + (track.duration_seconds ?? 0), 0) ?? 0;
  const queueKeys = queue.map((track, index) => `${track.id}-${index}`);
  const allQueueSelected = queue.length > 0 && queueKeys.every((key) => selectedQueueKeys.has(key));
  const filteredSimilarPreview = similarPreview.filter((track) => {
    if (neighborAnalyzedOnly && !isClapAnalyzed(track)) {
      return false;
    }
    if (neighborMinRating > 0 && (track.rating ?? 0) < neighborMinRating) {
      return false;
    }
    if (neighborGenre.trim() && !display(trackGenre(track), "").toLowerCase().includes(neighborGenre.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
  const compactReasonForTrack = (track: QueueTrack) => {
    const chips = reasonChips(track.reason);
    return (
      chips.find((reason) => /seed|similar|audio/i.test(reason)) ??
      chips.find((reason) => /exploration|unrated/i.test(reason)) ??
      chips.find((reason) => /not recently|unplayed|stale/i.test(reason)) ??
      chips[0] ??
      "balanced pick"
    );
  };
  const compactScoreBreakdown = (track: QueueTrack) =>
    breakdownEntries(track)
      .filter(([key]) => key !== "random" && key !== "total")
      .slice(0, 2);
  const scoreLabel = (key: string) => key.replace(/_/g, " ");
  const generationMessage = busy
    ? `Scoring candidates - ${generationElapsed < 10 ? generationElapsed.toFixed(1) : generationElapsed.toFixed(0)}s elapsed`
    : null;

  useEffect(() => {
    if (!defaultProfile || appliedDefaultProfileId.current === defaultProfile.id) {
      return;
    }
    appliedDefaultProfileId.current = defaultProfile.id;
    setSettings({ ...defaultAutoDj, ...defaultProfile.settings });
  }, [defaultProfile?.id]);

  useEffect(() => {
    onContinuousSettingsChange(settings);
  }, [settings, onContinuousSettingsChange]);

  useEffect(() => {
    if (!queueContextMenu) {
      return;
    }
    const close = () => setQueueContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    const stopListeningForFloatingMenus = listenForCloseFloatingMenus(close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
      stopListeningForFloatingMenus();
    };
  }, [queueContextMenu]);

  useEffect(() => {
    const seedTrackId = settings.seed_track_id ?? null;
    if (!seedTrackId) {
      setSimilarPreview([]);
      return;
    }
    let canceled = false;
    setIsSimilarityLoading(true);
    fetchSimilarTracks(seedTrackId, 10)
      .then((tracks) => {
        if (!canceled) {
          setSimilarPreview(tracks);
        }
      })
      .catch((error) => {
        if (!canceled) {
          setSimilarPreview([]);
          setStatus(error instanceof Error ? error.message : "Could not load similar tracks");
        }
      })
      .finally(() => {
        if (!canceled) {
          setIsSimilarityLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [settings.seed_track_id, setStatus]);

  useEffect(() => {
    if (!busy || generationStartedAt === null) {
      return;
    }
    const updateProgress = () => {
      const elapsedMs = window.performance.now() - generationStartedAt;
      setGenerationElapsed(elapsedMs / 1000);
      setGenerationProgress(Math.min(94, 8 + Math.log1p(elapsedMs / 350) * 24));
    };
    updateProgress();
    const interval = window.setInterval(updateProgress, 120);
    return () => window.clearInterval(interval);
  }, [busy, generationStartedAt]);

  function toggleQueueSelection(key: string) {
    setSelectedQueueKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setQueueSelection(selected: boolean) {
    setSelectedQueueKeys(selected ? new Set(queueKeys) : new Set());
  }

  function openQueueContextMenu(event: ReactMouseEvent, track: QueueTrack, index: number, rowKey: string) {
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenus();
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: AUTO_DJ_CONTEXT_MENU_WIDTH,
      menuHeight: AUTO_DJ_CONTEXT_MENU_HEIGHT,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setQueueContextMenu({ track, index, rowKey, x: placement.x, y: placement.y });
  }

  function removeSelectedQueueItems() {
    if (selectedQueueKeys.size === 0) {
      return;
    }
    setQueue(queue.filter((track, index) => !selectedQueueKeys.has(`${track.id}-${index}`)));
    setSelectedQueueKeys(new Set());
    setExplainTrackKey(null);
  }

  function moveQueueItem(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= queue.length) {
      return;
    }
    const next = [...queue];
    [next[index], next[target]] = [next[target], next[index]];
    setQueue(next);
    setSelectedQueueKeys(new Set());
  }

  function reorderQueueItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) {
      return;
    }
    const next = [...queue];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setQueue(next);
    setSelectedQueueKeys(new Set());
    setExplainTrackKey(null);
  }

  function beginQueueDrag(event: ReactPointerEvent<HTMLElement>, index: number, track: Track) {
    setDragQueueIndex(index);
    setDragQueueOverIndex(index);
    setQueueDragGhost({
      x: event.clientX,
      y: event.clientY,
      title: display(track.title, "Untitled"),
      subtitle: display(track.artist),
    });
    beginPointerReorderDrag({
      event,
      fromIndex: index,
      onHover: (nextIndex) => {
        setDragQueueOverIndex(nextIndex);
        if (nextIndex === null) {
          setDragQueueIndex(null);
        }
      },
      onPosition: (position) =>
        setQueueDragGhost((current) => (position && current ? { ...current, ...position } : null)),
      onCommit: reorderQueueItem,
    });
  }

  function saveCurrentTemplate() {
    const name = window.prompt("Template name", "AutoDJ Template");
    if (!name?.trim()) {
      return;
    }
    const template: AutoDjTemplate = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      name: name.trim(),
      settings,
    };
    const next = [template, ...templates.filter((item) => item.name.toLowerCase() !== template.name.toLowerCase())].slice(0, 24);
    setTemplates(next);
    writeAutoDjTemplates(next);
    setStatus(`Saved AutoDJ template ${template.name}`);
  }

  function deleteTemplate(templateId: string) {
    const next = templates.filter((template) => template.id !== templateId);
    setTemplates(next);
    writeAutoDjTemplates(next);
  }

  function saveCurrentProfile(isDefault = false) {
    const name = window.prompt("Recommendation profile name", defaultProfile?.name ?? "Cafe Profile");
    if (!name?.trim()) {
      return;
    }
    void onSaveRecommendationProfile(name.trim(), settings, isDefault);
  }

  async function handleGenerate() {
    setGenerationProgress(6);
    setGenerationElapsed(0);
    setGenerationStartedAt(window.performance.now());
    setBusy(true);
    try {
      const response = await generateAutoDj(settings);
      setGenerationProgress(100);
      setQueue(response.tracks);
      onUseGeneratedQueue(response.tracks);
      setRecommendationDrift(response.drift);
      void onRefreshHistory();
      setStatus(`Generated ${response.tracks.length} tracks`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Queue generation failed");
    } finally {
      setBusy(false);
      setGenerationStartedAt(null);
    }
  }

  async function handleCompareProfiles() {
    if (recommendationProfiles.length < 2) {
      setStatus("Save at least two recommendation profiles to compare them");
      return;
    }
    setIsComparingProfiles(true);
    try {
      const seed = Date.now() % 1_000_000;
      const comparisons = await compareRecommendationProfiles({
        seed,
        seed_track_id: settings.seed_track_id ?? currentTrack?.id ?? null,
      });
      setProfileComparisons(comparisons);
      setProfileComparisonSeed(seed);
      setStatus(`Compared ${comparisons.length} recommendation profiles`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile comparison failed");
    } finally {
      setIsComparingProfiles(false);
    }
  }

  async function handleImportProfileComparison() {
    const reportPath = window.prompt("Comparison report path");
    if (!reportPath?.trim()) {
      return;
    }
    try {
      const response = await importRecommendationProfileComparison(reportPath.trim());
      setProfileComparisons(response.comparisons);
      setProfileComparisonSeed(response.seed);
      setStatus(`Imported ${response.comparisons.length} profile comparisons`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile comparison import failed");
    }
  }

  async function handleExportProfileComparison() {
    if (recommendationProfiles.length < 2) {
      setStatus("Save at least two recommendation profiles before exporting a comparison");
      return;
    }
    try {
      const seed = profileComparisonSeed ?? Date.now() % 1_000_000;
      const response = await exportRecommendationProfileComparison({
        seed,
        seed_track_id: settings.seed_track_id ?? currentTrack?.id ?? null,
      });
      setProfileComparisonSeed(seed);
      setStatus(`Exported ${response.profile_count} profile comparisons to ${response.export_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile comparison export failed");
    }
  }

  async function handleCreateAbTest() {
    setIsCreatingAbTest(true);
    try {
      const response = await createRecommendationAbTest({
        base_settings: settings,
        seed_track_id: settings.seed_track_id ?? currentTrack?.id ?? null,
        seed: Date.now() % 1_000_000,
      });
      setAbTest(response);
      setSelectedAbLabel(response.queues[0]?.label ?? "A");
      setStatus("Generated two AutoDJ candidates");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "A/B queue generation failed");
    } finally {
      setIsCreatingAbTest(false);
    }
  }

  async function handleChooseAbQueue(label: "A" | "B") {
    if (!abTest) {
      return;
    }
    const chosen = abTest.queues.find((item) => item.label === label);
    const rejected = abTest.queues.find((item) => item.label !== label);
    if (!chosen) {
      return;
    }
    try {
      const response = await chooseRecommendationAbTest({
        test_id: abTest.test_id,
        chosen_label: label,
        chosen_track_ids: chosen.tracks.map((track) => track.id),
        rejected_track_ids: rejected?.tracks.map((track) => track.id) ?? [],
      });
      setSettings(chosen.settings);
      setQueue(chosen.tracks);
      onUseGeneratedQueue(chosen.tracks);
      setRecommendationDrift(chosen.drift);
      setAbTest(null);
      setStatus(`Chose queue ${label}; learned from ${response.inserted_feedback} tracks`);
      void onRefreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save A/B feedback");
    }
  }

  async function handleExport() {
    if (queue.length === 0) {
      setStatus("Generate a queue first");
      return;
    }
    try {
      const response = await exportQueue(queue.map((track) => track.id));
      setStatus(`Exported ${response.track_count} tracks to ${response.playlist_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  const autoDjSettingsModel = {
    settings,
    setSettings,
    settingsCollapsed,
    setSettingsCollapsed,
    experienceLevel,
    setExperienceLevel,
    presets,
    templates,
    saveCurrentTemplate,
    deleteTemplate,
    defaultProfile,
    recommendationProfiles,
    onRefreshProfiles,
    isComparingProfiles,
    handleCompareProfiles,
    handleExportProfileComparison,
    handleImportProfileComparison,
    onSetDefaultRecommendationProfile,
    onDeleteRecommendationProfile,
    profileComparisons,
    abTest,
    isCreatingAbTest,
    handleCreateAbTest,
    selectedAbLabel,
    setSelectedAbLabel,
    selectedAbQueue,
    selectedAbDuration,
    handleChooseAbQueue,
    saveCurrentProfile,
    filteredSimilarPreview,
    similarPreview,
    isSimilarityLoading,
    neighborAnalyzedOnly,
    setNeighborAnalyzedOnly,
    neighborGenre,
    setNeighborGenre,
    neighborMinRating,
    setNeighborMinRating,
    avoidRules,
    onDeleteAvoidRule,
    currentTrack,
    uiPreferences,
    onPlayTrack,
  };

  const autoDjQueueModel = {
    queue,
    selectedQueueKeys,
    setQueueSelection,
    removeSelectedQueueItems,
    queueDuration,
    queueArtists,
    clapTracks,
    recommendationDrift,
    recommendationHistory,
    onRefreshHistory,
    allQueueSelected,
    toggleQueueSelection,
    explainTrackKey,
    setExplainTrackKey,
    currentTrackId,
    dragQueueIndex,
    dragQueueOverIndex,
    openQueueContextMenu,
    beginQueueDrag,
    onPlayTrack,
    compactReasonForTrack,
    compactScoreBreakdown,
    scoreLabel,
    moveQueueItem,
    setQueue,
    setSelectedQueueKeys,
    queueContextMenu,
    setQueueContextMenu,
    onPlayNext,
    onAddToQueue,
    onQuickAutoDj,
    onRevealTrack,
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <DragGhostPreview ghost={queueDragGhost} />
      <AutoDjHeader
        queueLength={queue.length}
        busy={busy}
        generationProgress={generationProgress}
        generationMessage={generationMessage}
        continuousAutoDjEnabled={continuousAutoDjEnabled}
        continuousAutoDjBusy={continuousAutoDjBusy}
        onGenerate={handleGenerate}
        onExport={handleExport}
        onAddQueue={() => onAddTracksToPlaylist(queue.map((track) => track.id))}
        onClear={() => setQueue([])}
        onContinuousAutoDjChange={onContinuousAutoDjChange}
      />

      <div
        className={`grid min-h-0 flex-1 overflow-hidden ${
          settingsCollapsed
            ? "grid-cols-[52px_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
        }`}
      >
        <AutoDjSettingsPanel model={autoDjSettingsModel} />

        <AutoDjQueuePanel model={autoDjQueueModel} />
      </div>
    </main>
  );
}
