import {
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react";

import type {
  AutoDjAvoidRule,
  AutoDjSettings,
  RecommendationAbTestResponse,
  RecommendationProfile,
  RecommendationProfileComparison,
  SimilarTrack,
  Track,
} from "../../../types/api";
import { NumberField } from "../../components/common";
import {
  AutoDjExperience,
  AutoDjTemplate,
  autoDjMoodSeedOptions,
  defaultAutoDj,
  display,
  formatDuration,
  formatShortDate,
} from "../../shared";

export function AutoDjSettingsPanel({ model }: { model: any }) {
  const settings = model.settings as AutoDjSettings;
  const setSettings = model.setSettings as (settings: AutoDjSettings) => void;
  const settingsCollapsed = model.settingsCollapsed as boolean;
  const setSettingsCollapsed = model.setSettingsCollapsed as (collapsed: boolean) => void;
  const experienceLevel = model.experienceLevel as AutoDjExperience;
  const setExperienceLevel = model.setExperienceLevel as (level: AutoDjExperience) => void;
  const presets = model.presets as { label: string; settings: Partial<AutoDjSettings> }[];
  const templates = model.templates as AutoDjTemplate[];
  const recommendationProfiles = model.recommendationProfiles as RecommendationProfile[];
  const profileComparisons = model.profileComparisons as RecommendationProfileComparison[];
  const abTest = model.abTest as RecommendationAbTestResponse | null;
  const selectedAbQueue = model.selectedAbQueue as RecommendationAbTestResponse["queues"][number] | null;
  const selectedAbLabel = model.selectedAbLabel as "A" | "B";
  const selectedAbDuration = model.selectedAbDuration as number;
  const filteredSimilarPreview = model.filteredSimilarPreview as SimilarTrack[];
  const similarPreview = model.similarPreview as SimilarTrack[];
  const avoidRules = model.avoidRules as AutoDjAvoidRule[];
  const currentTrack = model.currentTrack as Track | null;
  const uiPreferences = model.uiPreferences;
  const defaultProfile = model.defaultProfile as RecommendationProfile | null;
  const {
    saveCurrentTemplate,
    deleteTemplate,
    saveCurrentProfile,
    onRefreshProfiles,
    isComparingProfiles,
    handleCompareProfiles,
    handleExportProfileComparison,
    handleImportProfileComparison,
    onSetDefaultRecommendationProfile,
    onDeleteRecommendationProfile,
    isCreatingAbTest,
    handleCreateAbTest,
    setSelectedAbLabel,
    handleChooseAbQueue,
    onPlayTrack,
    isSimilarityLoading,
    neighborAnalyzedOnly,
    setNeighborAnalyzedOnly,
    neighborGenre,
    setNeighborGenre,
    neighborMinRating,
    setNeighborMinRating,
    onDeleteAvoidRule,
  } = model;
  const selectedMoodSeeds = settings.mood_seeds ?? [];
  const moodSeedWeight = Number(settings.mood_seed_weight ?? defaultAutoDj.mood_seed_weight ?? 1.4);
  const toggleMoodSeed = (mood: string) => {
    const next = selectedMoodSeeds.includes(mood)
      ? selectedMoodSeeds.filter((seed) => seed !== mood)
      : [...selectedMoodSeeds, mood];
    setSettings({
      ...settings,
      mood_seeds: next,
      mood_seed_weight: settings.mood_seed_weight ?? defaultAutoDj.mood_seed_weight,
    });
  };
  const renderMoodSeedControls = () => (
    <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase text-muted">Mood Seeds</div>
        {selectedMoodSeeds.length > 0 && (
          <button
            className="text-xs text-muted hover:text-white"
            type="button"
            onClick={() => setSettings({ ...settings, mood_seeds: [] })}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {autoDjMoodSeedOptions.map((mood) => {
          const selected = selectedMoodSeeds.includes(mood);
          return (
            <button
              key={mood}
              className={`rounded border px-2 py-1 text-xs transition ${
                selected
                  ? "border-moss bg-moss/15 text-white"
                  : "border-line/70 bg-panel text-muted hover:text-white"
              }`}
              type="button"
              onClick={() => toggleMoodSeed(mood)}
            >
              {mood.slice(0, 1).toUpperCase() + mood.slice(1)}
            </button>
          );
        })}
      </div>
      {selectedMoodSeeds.length > 0 && (
        <label className="grid gap-1">
          <span className="text-xs text-muted">Strength {moodSeedWeight.toFixed(1)}</span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={moodSeedWeight}
            onChange={(event) => setSettings({ ...settings, mood_seed_weight: Number(event.target.value) })}
            className="accent-moss"
          />
        </label>
      )}
    </div>
  );

  return (
    <>
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
              {renderMoodSeedControls()}
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
            {renderMoodSeedControls()}
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
                  ["mood_similarity_weight", "Mood"],
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
    </>
  );
}
