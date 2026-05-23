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
import { AutoDjHeader } from "./autodj/AutoDjHeader";
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
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
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
        {settingsCollapsed ? (
          <section className="flex min-h-0 min-w-0 flex-col items-center gap-3 border-r border-line bg-[rgb(var(--color-strip))] px-2 py-4">
            <button
              className="icon-button h-9 w-9"
              type="button"
              title="Show AutoDJ settings"
              onClick={() => setSettingsCollapsed(false)}
            >
              <PanelLeftOpen size={16} />
            </button>
            <div className="mt-2 select-none text-xs font-medium uppercase tracking-[0.18em] text-muted [writing-mode:vertical-rl]">
              Settings
            </div>
          </section>
        ) : (
        <section className="min-h-0 w-full min-w-0 max-w-80 overflow-y-auto overflow-x-hidden border-r border-line p-5 [contain:inline-size]">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-white">
            <span className="inline-flex min-w-0 items-center gap-2">
              <SlidersHorizontal size={17} />
              Settings
            </span>
            <button
              className="icon-button h-8 w-8"
              type="button"
              title="Minimize AutoDJ settings"
              onClick={() => setSettingsCollapsed(true)}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
          <div className="mb-4 grid grid-cols-2 rounded border border-line bg-panel p-1 text-sm">
            {(
              [
                ["simple", "Simple"],
                ["advanced", "Advanced"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`h-8 rounded transition ${
                  experienceLevel === id ? "bg-white/10 text-white" : "text-muted hover:text-white"
                }`}
                type="button"
                onClick={() => setExperienceLevel(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mb-4 grid min-w-0 grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                className="secondary-button min-w-0 justify-center text-center"
                type="button"
                onClick={() => setSettings({ ...settings, ...preset.settings })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {experienceLevel === "simple" ? (
            <div className="grid min-w-0 max-w-full gap-4 overflow-hidden">
              <NumberField
                label="Queue Length"
                min={1}
                max={200}
                value={settings.queue_length}
                onChange={(value) => setSettings({ ...settings, queue_length: value })}
              />
              <label className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">
                  Adventure {settings.temperature.toFixed(2)}
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.05}
                  value={settings.temperature}
                  onChange={(event) => setSettings({ ...settings, temperature: Number(event.target.value) })}
                  className="accent-moss"
                />
                <span className="text-xs text-muted">Lower is safer. Higher explores deeper cuts.</span>
              </label>
              <label className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">
                  Discovery {settings.unrated_exploration_percent.toFixed(0)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={settings.unrated_exploration_percent}
                  onChange={(event) =>
                    setSettings({ ...settings, unrated_exploration_percent: Number(event.target.value) })
                  }
                  className="accent-ember"
                />
              </label>
              <label className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">
                  Similar Songs {Number(settings.similarity_weight ?? 0).toFixed(1)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.1}
                  value={settings.similarity_weight ?? 0}
                  onChange={(event) => setSettings({ ...settings, similarity_weight: Number(event.target.value) })}
                  className="accent-moss"
                />
                <button
                  className="secondary-button min-w-0 justify-center text-center"
                  type="button"
                  disabled={!currentTrack}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      seed_track_id: currentTrack?.id ?? null,
                      similarity_weight: settings.similarity_weight || uiPreferences.similarityWeight,
                    })
                  }
                >
                  <Wand2 size={15} />
                  {settings.seed_track_id ? "Seeded from current track" : "Use current track"}
                </button>
              </label>
              <div className="rounded border border-line/70 bg-ink p-3 text-xs text-muted">
                Advanced includes cooldowns, scoring weights, profiles, avoid rules, and seed-neighbor filters.
              </div>
            </div>
          ) : (
            <>
          <div className="mb-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase text-muted">Saved Templates</div>
              <button className="text-xs text-moss hover:text-white" type="button" onClick={saveCurrentTemplate}>
                Save
              </button>
            </div>
            <div className="grid max-h-40 gap-1 overflow-y-auto overflow-x-hidden">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                  <button
                    className="min-w-0 flex-1 truncate text-left text-neutral-200 hover:text-white"
                    type="button"
                    onClick={() => setSettings({ ...settings, ...template.settings })}
                    title={template.name}
                  >
                    {template.name}
                  </button>
                  <button className="text-muted hover:text-white" type="button" title="Delete template" onClick={() => deleteTemplate(template.id)}>
                    <X size={13} />
                  </button>
                </div>
              ))}
              {templates.length === 0 && <div className="text-xs text-muted">Save tuned settings here for later queues.</div>}
            </div>
          </div>
          <div className="mb-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 grid gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase text-muted">Recommendation Profiles</div>
                  {defaultProfile && <div className="mt-0.5 truncate text-[11px] text-moss">Default: {defaultProfile.name}</div>}
                </div>
                <button className="rounded border border-moss/40 bg-moss/10 px-3 py-1.5 text-xs text-moss hover:text-white" type="button" onClick={() => saveCurrentProfile(false)}>
                  Save
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button className="rounded border border-line/70 bg-panel px-2 py-1 text-xs text-muted hover:text-white" type="button" onClick={() => void onRefreshProfiles()}>
                  Refresh
                </button>
                <button className="rounded border border-line/70 bg-panel px-2 py-1 text-xs text-muted hover:text-white disabled:opacity-50" type="button" disabled={isComparingProfiles} onClick={() => void handleCompareProfiles()}>
                  Compare
                </button>
                <button className="rounded border border-line/70 bg-panel px-2 py-1 text-xs text-muted hover:text-white" type="button" onClick={() => void handleExportProfileComparison()}>
                  Export
                </button>
                <button className="rounded border border-line/70 bg-panel px-2 py-1 text-xs text-muted hover:text-white" type="button" onClick={() => void handleImportProfileComparison()}>
                  Import
                </button>
              </div>
            </div>
            <div className="grid max-h-48 gap-1 overflow-y-auto overflow-x-hidden">
              {recommendationProfiles.map((profile) => (
                <div key={profile.id} className="grid gap-1 rounded bg-panel px-2 py-1.5 text-xs">
                  <button
                    className="min-w-0 truncate text-left text-neutral-100 hover:text-white"
                    type="button"
                    onClick={() => setSettings({ ...defaultAutoDj, ...profile.settings })}
                    title={profile.name}
                  >
                    {profile.name}
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <span className={profile.is_default ? "text-moss" : "text-muted"}>
                      {profile.is_default ? "default profile" : `${formatShortDate(profile.updated_at)}`}
                    </span>
                    <span className="flex items-center gap-2">
                      {!profile.is_default && (
                        <button className="text-muted hover:text-moss" type="button" onClick={() => void onSetDefaultRecommendationProfile(profile.id)}>
                          Default
                        </button>
                      )}
                      <button className="text-muted hover:text-red-300" type="button" onClick={() => void onDeleteRecommendationProfile(profile.id)}>
                        Delete
                      </button>
                    </span>
                  </div>
                </div>
              ))}
              {recommendationProfiles.length === 0 && (
                <div className="text-xs text-muted">Profiles persist tuned AutoDJ settings and can become the Settings default.</div>
              )}
            </div>
            {profileComparisons.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-2 text-xs font-medium uppercase text-muted">Profile Comparison</div>
                <div className="grid gap-2">
                  {profileComparisons.map((comparison) => (
                    <div key={comparison.profile.id} className="rounded border border-line/70 bg-panel p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white">{comparison.profile.name}</span>
                        <span className="text-muted">{comparison.drift.total_tracks} tracks</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                        <span className="rounded bg-ink px-1.5 py-1 text-moss">Fav {comparison.drift.familiar_percent.toFixed(0)}%</span>
                        <span className="rounded bg-ink px-1.5 py-1 text-ember">Explore {comparison.drift.exploration_percent.toFixed(0)}%</span>
                        <span className="rounded bg-ink px-1.5 py-1 text-red-300">Repeat {comparison.drift.repeat_artist_percent.toFixed(0)}%</span>
                      </div>
                      <div className="mt-2 truncate text-[11px] text-muted">
                        {comparison.top_tracks.slice(0, 2).map((track) => display(track.title, "Untitled")).join(" / ") || "No tracks"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase text-muted">A/B Queue Feedback</div>
                <button
                  className="text-xs text-moss hover:text-white"
                  type="button"
                  disabled={isCreatingAbTest}
                  onClick={() => void handleCreateAbTest()}
                >
                  {isCreatingAbTest ? "Generating" : "Generate A/B"}
                </button>
              </div>
              {abTest ? (
                <div className="grid min-w-0 max-w-full gap-2 overflow-hidden rounded border border-line/70 bg-panel p-2 text-xs">
                  <div className="grid grid-cols-2 rounded border border-line bg-ink p-1">
                    {abTest.queues.map((candidate) => (
                      <button
                        key={candidate.label}
                        className={`h-8 rounded transition ${
                          selectedAbLabel === candidate.label ? "bg-white/10 text-white" : "text-muted hover:text-white"
                        }`}
                        type="button"
                        onClick={() => setSelectedAbLabel(candidate.label)}
                      >
                        Queue {candidate.label}
                      </button>
                    ))}
                  </div>
                  {selectedAbQueue && (
                    <>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-white">Queue {selectedAbQueue.label}</div>
                          <div className="truncate text-[11px] text-muted">
                            {selectedAbQueue.tracks.length.toLocaleString()} tracks - {formatDuration(selectedAbDuration)}
                          </div>
                        </div>
                        <button
                          className="shrink-0 rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss hover:text-white"
                          type="button"
                          onClick={() => void handleChooseAbQueue(selectedAbQueue.label)}
                        >
                          Choose {selectedAbQueue.label}
                        </button>
                      </div>
                      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 text-[11px]">
                        <span className="truncate rounded bg-ink px-1.5 py-1 text-moss" title={`Familiar ${selectedAbQueue.drift.familiar_percent.toFixed(0)}%`}>
                          Fav {selectedAbQueue.drift.familiar_percent.toFixed(0)}%
                        </span>
                        <span className="truncate rounded bg-ink px-1.5 py-1 text-ember" title={`Exploration ${selectedAbQueue.drift.exploration_percent.toFixed(0)}%`}>
                          Explore {selectedAbQueue.drift.exploration_percent.toFixed(0)}%
                        </span>
                        <span className="truncate rounded bg-ink px-1.5 py-1 text-red-300" title={`Repeat artists ${selectedAbQueue.drift.repeat_artist_percent.toFixed(0)}%`}>
                          Repeat {selectedAbQueue.drift.repeat_artist_percent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto overflow-x-hidden rounded border border-line/70 bg-ink">
                        {selectedAbQueue.tracks.map((track, index) => (
                          <div
                            key={`${selectedAbQueue.label}-${track.id}-${index}`}
                            className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2 border-b border-line/50 px-2 py-2 last:border-b-0"
                          >
                            <span className="text-right tabular-nums text-muted">{index + 1}</span>
                            <button
                              className="min-w-0 text-left"
                              type="button"
                              title={`${display(track.title, "Untitled")} - ${display(track.artist)} - ${display(track.album)}`}
                              onClick={() => onPlayTrack(track, selectedAbQueue.tracks)}
                            >
                              <span className="block truncate font-medium text-neutral-100">{display(track.title, "Untitled")}</span>
                              <span className="block truncate text-[11px] text-muted">
                                {display(track.artist)} - {display(track.album)}
                              </span>
                            </button>
                            <span className="truncate text-right tabular-nums text-moss">{track.score.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted">Compare two queues, pick the better one, and the recommender will bias future queues toward tracks like that choice.</div>
              )}
            </div>
            <button className="mt-2 w-full text-left text-xs text-muted hover:text-white" type="button" onClick={() => saveCurrentProfile(true)}>
              Save current settings as default profile
            </button>
          </div>
            <div className="grid min-w-0 max-w-full gap-4 overflow-hidden">
            <NumberField
              label="Queue Length"
              min={1}
              max={200}
              value={settings.queue_length}
              onChange={(value) => setSettings({ ...settings, queue_length: value })}
            />
            <NumberField
              label="Artist Cooldown"
              min={0}
              max={50}
              value={settings.artist_cooldown}
              onChange={(value) => setSettings({ ...settings, artist_cooldown: value })}
            />
            <NumberField
              label="Album Cooldown"
              min={0}
              max={100}
              value={settings.album_cooldown}
              onChange={(value) => setSettings({ ...settings, album_cooldown: value })}
            />
            <NumberField
              label="Recent Days"
              min={0}
              max={3650}
              value={settings.recently_played_cooldown_days}
              onChange={(value) => setSettings({ ...settings, recently_played_cooldown_days: value })}
            />
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase text-muted">Drift Targets</div>
                <button
                  className="text-xs text-muted hover:text-white"
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      target_unrated_percent: null,
                      target_exploration_percent: null,
                      max_repeat_artist_percent: null,
                      minimum_rating: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
              {(
                [
                  ["target_unrated_percent", "Unrated target", 0, 80],
                  ["target_exploration_percent", "Exploration target", 0, 100],
                  ["max_repeat_artist_percent", "Max repeat artist", 0, 95],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="grid gap-1">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{label}</span>
                    <button
                      className="text-[11px] text-muted hover:text-white"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setSettings({
                          ...settings,
                          [key]: settings[key] === null || settings[key] === undefined
                            ? key === "target_unrated_percent"
                              ? settings.unrated_exploration_percent
                              : key === "target_exploration_percent"
                                ? 30
                                : 25
                            : null,
                        });
                      }}
                    >
                      {settings[key] === null || settings[key] === undefined ? "Off" : `${Number(settings[key]).toFixed(0)}%`}
                    </button>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    disabled={settings[key] === null || settings[key] === undefined}
                    value={Number(settings[key] ?? (key === "target_unrated_percent" ? settings.unrated_exploration_percent : key === "target_exploration_percent" ? 30 : 25))}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                    className="accent-moss disabled:opacity-40"
                  />
                </label>
              ))}
              <label className="grid gap-1">
                <span className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>Minimum rating</span>
                  <button
                    className="text-[11px] text-muted hover:text-white"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setSettings({ ...settings, minimum_rating: settings.minimum_rating == null ? 4 : null });
                    }}
                  >
                    {settings.minimum_rating == null ? "Off" : `${Number(settings.minimum_rating).toFixed(1)}+`}
                  </button>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  disabled={settings.minimum_rating == null}
                  value={settings.minimum_rating ?? 4}
                  onChange={(event) => setSettings({ ...settings, minimum_rating: Number(event.target.value) })}
                  className="accent-moss disabled:opacity-40"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">
                Similarity {Number(settings.similarity_weight ?? 0).toFixed(1)}
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={settings.similarity_weight ?? 0}
                onChange={(event) =>
                  setSettings({ ...settings, similarity_weight: Number(event.target.value) })
                }
                className="accent-moss"
              />
              <button
                className="secondary-button min-w-0 justify-center text-center"
                type="button"
                disabled={!currentTrack}
                onClick={() =>
                  setSettings({
                    ...settings,
                    seed_track_id: currentTrack?.id ?? null,
                    similarity_weight: settings.similarity_weight || uiPreferences.similarityWeight,
                  })
                }
              >
                <Wand2 size={15} />
                {settings.seed_track_id ? "Seeded from current track" : "Use current track as seed"}
              </button>
              {settings.seed_track_id && (
                <button
                  className="text-xs text-muted hover:text-white"
                  type="button"
                  onClick={() => setSettings({ ...settings, seed_track_id: null })}
                >
                  Clear seed
                </button>
              )}
            </label>
            {settings.seed_track_id && (
              <div className="min-w-0 max-w-full overflow-hidden rounded border border-line/70 bg-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium uppercase text-muted">Seed Neighbors</div>
                  <div className="text-xs text-muted">{isSimilarityLoading ? "Loading" : `${filteredSimilarPreview.length}/${similarPreview.length} shown`}</div>
                </div>
                <div className="mb-2 grid gap-2 text-xs">
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-2 py-1.5 text-muted">
                    <span>Analyzed only</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={neighborAnalyzedOnly}
                      onChange={(event) => setNeighborAnalyzedOnly(event.target.checked)}
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
                    <input
                      className="h-8 rounded border border-line bg-panel px-2 text-neutral-100 outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      placeholder="Filter genre"
                      value={neighborGenre}
                      onChange={(event) => setNeighborGenre(event.target.value)}
                    />
                    <select
                      className="h-8 rounded border border-line bg-panel px-2 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
                      value={neighborMinRating}
                      onChange={(event) => setNeighborMinRating(Number(event.target.value))}
                    >
                      <option value={0}>Any</option>
                      <option value={3}>3+</option>
                      <option value={4}>4+</option>
                      <option value={4.5}>4.5+</option>
                    </select>
                  </div>
                </div>
                <div className="grid max-h-56 min-w-0 gap-1 overflow-y-auto overflow-x-hidden">
                  {filteredSimilarPreview.map((track) => (
                    <div key={track.id} className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded bg-panel px-2 py-1.5 text-xs">
                      <button
                        className="icon-button h-7 w-7 shrink-0"
                        type="button"
                        title={`Play ${display(track.title, "track")}`}
                        onClick={() => onPlayTrack(track, similarPreview)}
                      >
                        <Play size={13} />
                      </button>
                      <button
                        className="min-w-0 flex-1 text-left"
                        type="button"
                        title={track.similarity_reason}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            seed_track_id: track.id,
                            similarity_weight: settings.similarity_weight || uiPreferences.similarityWeight,
                          })
                        }
                      >
                        <div className="truncate text-neutral-100">{display(track.title, "Untitled")}</div>
                        <div className="truncate text-muted">{display(track.artist)} - {track.similarity_reason}</div>
                      </button>
                      <div className="shrink-0 text-right tabular-nums text-moss">
                        {track.similarity_score.toFixed(2)}
                        <div className="text-[10px] text-muted">{track.audio_similarity !== null ? track.audio_similarity.toFixed(2) : "--"}</div>
                      </div>
                    </div>
                  ))}
                  {!isSimilarityLoading && filteredSimilarPreview.length === 0 && (
                    <div className="text-xs text-muted">Analyze tracks with CLAP or use richer metadata for better neighbors.</div>
                  )}
                </div>
              </div>
            )}
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="text-xs font-medium uppercase text-muted">Scoring Weights</div>
              {(
                [
                  ["rating_weight", "Rating"],
                  ["recency_weight", "Recency"],
                  ["skip_weight", "Skips"],
                  ["exploration_weight", "Exploration"],
                  ["play_history_weight", "Play history"],
                  ["feedback_weight", "Manual queue"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-xs text-muted">
                    {label} {Number(settings[key] ?? 0).toFixed(1)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={Number(settings[key] ?? 0)}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                    className="accent-moss"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="text-xs font-medium uppercase text-muted">Seed Match Bias</div>
              {(
                [
                  ["audio_similarity_weight", "Audio"],
                  ["artist_similarity_weight", "Artist"],
                  ["album_similarity_weight", "Album"],
                  ["genre_similarity_weight", "Genre"],
                  ["year_similarity_weight", "Era"],
                  ["rating_similarity_weight", "Rating"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-xs text-muted">
                    {label} {Number(settings[key] ?? defaultAutoDj[key]).toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.05}
                    value={Number(settings[key] ?? defaultAutoDj[key])}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                    className="accent-moss"
                  />
                </label>
              ))}
            </div>
            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase text-muted">Avoid List</div>
                <div className="text-xs text-muted">{avoidRules.length} rules</div>
              </div>
              <div className="grid max-h-44 gap-1 overflow-y-auto overflow-x-hidden">
                {avoidRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 uppercase text-muted">{rule.scope}</span>
                      <span className="text-neutral-200">{rule.label}</span>
                    </span>
                    <button className="text-muted hover:text-white" type="button" onClick={() => onDeleteAvoidRule(rule.id)}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {avoidRules.length === 0 && <div className="text-xs text-muted">Right-click tracks in Library to avoid them in AutoDJ.</div>}
              </div>
            </div>
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">Temperature {settings.temperature.toFixed(2)}</span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={settings.temperature}
                onChange={(event) =>
                  setSettings({ ...settings, temperature: Number(event.target.value) })
                }
                className="accent-moss"
              />
            </label>
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">
                Unrated {settings.unrated_exploration_percent.toFixed(0)}%
              </span>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={settings.unrated_exploration_percent}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    unrated_exploration_percent: Number(event.target.value),
                  })
                }
                className="accent-ember"
              />
            </label>
          </div>
            </>
          )}
        </section>
        )}

        <section className="min-w-0 overflow-auto">
          {selectedQueueKeys.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-[rgb(var(--color-subtle))] px-4 py-2 text-sm">
              <div className="text-muted">
                <span className="font-medium text-white">{selectedQueueKeys.size}</span> selected
              </div>
              <div className="flex items-center gap-2">
                <button className="secondary-button h-8" type="button" onClick={() => setQueueSelection(false)}>
                  Clear
                </button>
                <button className="secondary-button h-8 text-ember" type="button" onClick={removeSelectedQueueItems}>
                  <Trash2 size={14} />
                  Remove Selected
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-3 border-b border-line bg-[rgb(var(--color-strip))] p-4 md:grid-cols-4">
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Tracks</div>
              <div className="mt-1 text-xl font-semibold text-white">{queue.length}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Duration</div>
              <div className="mt-1 text-xl font-semibold text-white">{formatDuration(queueDuration)}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Artists</div>
              <div className="mt-1 text-xl font-semibold text-white">{queueArtists}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">CLAP</div>
              <div className="mt-1 text-xl font-semibold text-moss">{queue.length ? formatPercent((clapTracks / queue.length) * 100) : "--"}</div>
            </div>
          </div>
          {recommendationDrift.total_tracks > 0 && (
            <div className="border-b border-line bg-[rgb(var(--color-subtle))] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Recommendation Drift</div>
                  <div className="text-xs text-muted">
                    {recommendationDrift.unique_artists} artists, {recommendationDrift.unique_albums} albums, average rating{" "}
                    {recommendationDrift.average_rating?.toFixed(2) ?? "unrated"}
                  </div>
                </div>
                <div className="text-xs text-muted">{recommendationDrift.total_tracks} tracks</div>
              </div>
              {recommendationDrift.warnings.length > 0 && (
                <div className="mb-3 grid gap-1.5">
                  {recommendationDrift.warnings.map((warning) => (
                    <div key={warning} className="rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
                      {warning}
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ["Familiar", recommendationDrift.familiar_percent, "bg-moss"],
                  ["Exploration", recommendationDrift.exploration_percent, "bg-ember"],
                  ["Unrated", recommendationDrift.unrated_percent, "bg-[rgb(var(--color-soft-accent))]"],
                  ["Artist repeats", recommendationDrift.repeat_artist_percent, "bg-red-300"],
                  ["CLAP", recommendationDrift.clap_percent, "bg-neutral-300"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded border border-line/70 bg-panel p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-muted">{label}</span>
                      <span className="tabular-nums text-neutral-100">{Number(value).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-ink">
                      <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {recommendationHistory.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium uppercase text-muted">Recent Queue Balance</div>
                    <button className="text-xs text-muted hover:text-white" type="button" onClick={() => void onRefreshHistory()}>
                      Refresh
                    </button>
                  </div>
                  <div className="grid gap-1.5">
                    {recommendationHistory.slice(0, 5).map((run) => (
                      <div key={run.id} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-xs">
                        <span className="truncate text-muted">{formatShortDate(run.created_at)}</span>
                        <div className="flex h-2 overflow-hidden rounded bg-ink">
                          <div className="bg-moss" style={{ width: `${Math.min(100, run.drift.familiar_percent)}%` }} />
                          <div className="bg-ember" style={{ width: `${Math.min(100, run.drift.exploration_percent)}%` }} />
                        </div>
                        <span className="text-right tabular-nums text-muted">{run.track_ids.length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <th className="w-11 px-3 py-3 font-medium">
                  <input
                    aria-label="Select AutoDJ queue"
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={allQueueSelected}
                    disabled={queue.length === 0}
                    onChange={(event) => setQueueSelection(event.target.checked)}
                  />
                </th>
                <th className="w-14 px-3 py-3 font-medium"></th>
                <th className="w-20 px-4 py-3 font-medium">#</th>
                <th className="w-[42%] px-3 py-3 font-medium xl:w-[34%]">Title</th>
                <th className="w-[24%] px-3 py-3 font-medium xl:w-[18%]">Artist</th>
                <th className="hidden w-[18%] px-3 py-3 font-medium xl:table-cell">Album</th>
                <th className="w-24 px-3 py-3 font-medium">Score</th>
                <th className="hidden w-[22%] px-3 py-3 font-medium 2xl:table-cell">Why</th>
                <th className="w-28 px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((track, index) => {
                const rowKey = `${track.id}-${index}`;
                const explained = explainTrackKey === rowKey;
                return (
                <Fragment key={rowKey}>
                <tr
                  data-reorder-index={index}
                  onContextMenu={(event) => openQueueContextMenu(event, track, index, rowKey)}
                  className={`border-b border-line/60 hover:bg-white/[0.035] ${
                    selectedQueueKeys.has(rowKey)
                      ? "bg-white/[0.035]"
                      : dragQueueIndex === index
                        ? "bg-moss/10"
                        : dragQueueOverIndex === index
                          ? "bg-ember/10"
                          : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      aria-label={`Select ${display(track.title, "track")}`}
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={selectedQueueKeys.has(rowKey)}
                      onChange={() => toggleQueueSelection(rowKey)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className={`icon-button h-8 w-8 ${
                        currentTrackId === track.id ? "border-moss text-moss" : ""
                      }`}
                      title={`Play ${display(track.title, "track")}`}
                      type="button"
                      onClick={() => onPlayTrack(track, queue)}
                    >
                      {currentTrackId === track.id ? <Volume2 size={15} /> : <Play size={15} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    <button
                      className="inline-flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-muted hover:bg-white/10 hover:text-white active:cursor-grabbing"
                      type="button"
                      title="Drag to reorder"
                      onPointerDown={(event) => beginQueueDrag(event, index, track)}
                    >
                      <GripVertical size={14} />
                      <span>{index + 1}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="truncate font-medium text-white">{display(track.title, "Untitled")}</div>
                    <div className="truncate text-xs text-muted 2xl:hidden">
                      {compactReasonForTrack(track)}
                    </div>
                  </td>
                  <td className="truncate px-3 py-3 text-neutral-200">{display(track.artist)}</td>
                  <td className="hidden truncate px-3 py-3 text-neutral-300 xl:table-cell">{display(track.album)}</td>
                  <td className="px-3 py-3 tabular-nums text-moss">{track.score.toFixed(2)}</td>
                  <td className="hidden px-3 py-3 2xl:table-cell">
                    <button
                      className="grid w-full min-w-0 gap-1 rounded px-1.5 py-1 text-left hover:bg-white/[0.04]"
                      type="button"
                      title={track.reason}
                      onClick={() => setExplainTrackKey(explained ? null : rowKey)}
                    >
                      <span className="truncate text-xs font-medium text-neutral-100">{compactReasonForTrack(track)}</span>
                      <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                        {compactScoreBreakdown(track).map(([key, value]) => (
                          <span
                            key={key}
                            className={`max-w-[7rem] truncate rounded border px-1.5 py-0.5 text-[11px] ${
                              value >= 0
                                ? "border-moss/30 bg-moss/10 text-moss"
                                : "border-red-500/30 bg-red-500/10 text-red-200"
                            }`}
                            title={`${scoreLabel(key)}: ${value.toFixed(3)}`}
                          >
                            {scoreLabel(key)} {value >= 0 ? "+" : ""}
                            {value.toFixed(2)}
                          </span>
                        ))}
                        {isClapAnalyzed(track) && (
                          <span className="shrink-0 rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[11px] text-moss">
                            CLAP
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="icon-button h-8 w-8" type="button" title="Move up" disabled={index === 0} onClick={() => moveQueueItem(index, "up")}>
                        <ArrowUp size={14} />
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Move down" disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, "down")}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className={`icon-button h-8 w-8 ${explained ? "border-moss text-moss" : ""}`}
                        type="button"
                        title="Why this track?"
                        onClick={() => setExplainTrackKey(explained ? null : rowKey)}
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="icon-button h-8 w-8"
                        type="button"
                        title="Remove from queue"
                        onClick={() => {
                          setQueue(queue.filter((_, itemIndex) => itemIndex !== index));
                          setSelectedQueueKeys(new Set());
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {explained && (
                  <tr className="border-b border-line/60 bg-[rgb(var(--color-subtle))]">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid gap-4 text-sm md:grid-cols-[1fr_280px]">
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase text-muted">Why this track</div>
                          <div className="flex flex-wrap gap-2">
                            {breakdownEntries(track).map(([key, value]) => (
                              <span
                                key={key}
                                className={`rounded border px-2 py-1 text-xs ${
                                  value >= 0
                                    ? "border-moss/30 bg-moss/10 text-moss"
                                    : "border-red-500/30 bg-red-500/10 text-red-200"
                                }`}
                                title={`${key}: ${value.toFixed(3)}`}
                              >
                                {scoreLabel(key)} {value >= 0 ? "+" : ""}
                                {value.toFixed(3)}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 rounded border border-line/70 bg-ink px-3 py-2 text-xs leading-5 text-neutral-300">
                            {track.reason}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {reasonChips(track.reason).map((reason) => (
                              <span
                                key={reason}
                                className={`rounded border px-2 py-1 text-xs ${reasonChipClass(reason)}`}
                              >
                                {reason}
                              </span>
                            ))}
                            {isClapAnalyzed(track) && (
                              <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-xs text-moss">
                                CLAP {display(track.analysis_genre, "audio")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded border border-line/70 bg-panel p-3 text-xs">
                          <div className="mb-2 font-medium uppercase text-muted">Audio analysis</div>
                          <div className="grid gap-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Provider</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_provider, "None")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Genre</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_genre, "-")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Confidence</span>
                              <span className="text-neutral-200">
                                {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                                  ? formatPercent(track.analysis_genre_confidence * 100)
                                  : "--"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Seed similarity</span>
                              <span className="text-neutral-200">
                                {track.score_breakdown?.similarity ? `+${track.score_breakdown.similarity.toFixed(3)}` : "--"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
              })}
            </tbody>
          </table>
          {queue.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted">
              Generate a queue after scanning your library.
            </div>
          )}
          {queueContextMenu && (
            <div
              className="fixed z-50 w-56 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
              style={{ left: queueContextMenu.x, top: queueContextMenu.y }}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onPlayTrack(queueContextMenu.track, queue);
                  setQueueContextMenu(null);
                }}
              >
                <Play size={15} />
                Play
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onPlayNext(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <SkipForward size={15} />
                Play Next
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onAddToQueue(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <Plus size={15} />
                Add To Playback Queue
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onQuickAutoDj(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <Wand2 size={15} />
                AutoDJ From Track
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onRevealTrack(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <FolderOpen size={15} />
                Reveal in Explorer
              </button>
              <div className="my-1 border-t border-line" />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  setExplainTrackKey(queueContextMenu.rowKey);
                  setQueueContextMenu(null);
                }}
              >
                <Info size={15} />
                Why This Track?
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                type="button"
                disabled={queueContextMenu.index === 0}
                onClick={() => {
                  moveQueueItem(queueContextMenu.index, "up");
                  setQueueContextMenu(null);
                }}
              >
                <ArrowUp size={15} />
                Move Up
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                type="button"
                disabled={queueContextMenu.index === queue.length - 1}
                onClick={() => {
                  moveQueueItem(queueContextMenu.index, "down");
                  setQueueContextMenu(null);
                }}
              >
                <ArrowDown size={15} />
                Move Down
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
                type="button"
                onClick={() => {
                  setQueue(queue.filter((_, itemIndex) => itemIndex !== queueContextMenu.index));
                  setSelectedQueueKeys(new Set());
                  setQueueContextMenu(null);
                }}
              >
                <Trash2 size={15} />
                Remove From AutoDJ
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
