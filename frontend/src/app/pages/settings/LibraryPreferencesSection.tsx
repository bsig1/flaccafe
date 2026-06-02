import type {
  CSSProperties,
} from "react";

import {
  Disc3,
  EyeOff,
  FolderOpen,
  Podcast,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";

import type {
  FontChoice,
  ThemeAccent,
  ThemeColorKey,
  ThemeColorOverrideValue,
  ThemeColorSwatchKey,
  ThemePalette,
} from "../../../config/theme";
import {
  fontChoiceLabels,
  resolveThemeColor,
  sidebarWidthDefaultPx,
  sidebarWidthMaxPx,
  sidebarWidthMinPx,
  sidebarWidthStepPx,
  themeAccentLabels,
  themeAccentValues,
  themeColorCssVariables,
  themeColorKeys,
  themeColorLabels,
  themeColorSwatchKeys,
  themeColorSwatchLabels,
  themeColorSwatchValues,
  themeOrder,
} from "../../../config/theme";
import {
  DisclosureSection,
} from "../../components/common";
import type {
  CheckboxAccentPreference,
  CheckboxUncheckedPreference,
  FontScalePreference,
  Page,
  RememberedDeleteChoice,
  SidebarPlacement,
  SidebarWidthPreference,
  UiDensityPreference,
  UiPreferences,
} from "../../shared";

type SetUiPreferences = (updater: (current: UiPreferences) => UiPreferences) => void;

const checkboxAccentLabels: Record<CheckboxAccentPreference, string> = {
  theme: "Theme Default",
  ember: "Ember",
  moss: "Moss",
  paper: "Paper",
  softAccent: "Soft Accent",
};

const checkboxUncheckedLabels: Record<CheckboxUncheckedPreference, string> = {
  theme: "Theme Default",
  line: "Line",
  muted: "Muted",
  ember: "Ember",
  moss: "Moss",
  paper: "Paper",
  softAccent: "Soft Accent",
};

const fontScaleLabels: Record<FontScalePreference, string> = {
  theme: "Theme Default",
  small: "Small",
  default: "Default",
  large: "Large",
};

const densityLabels: Record<UiDensityPreference, string> = {
  theme: "Theme Default",
  comfortable: "Comfortable",
  compact: "Compact",
};

const sidebarWidthSliderValues: SidebarWidthPreference[] = [
  "theme",
  ...Array.from(
    { length: Math.floor((sidebarWidthMaxPx - sidebarWidthMinPx) / sidebarWidthStepPx) + 1 },
    (_, index) => sidebarWidthMinPx + index * sidebarWidthStepPx,
  ),
];

const libraryPreviewRows = [
  { title: "Midnight Roast", artist: "The Cups", album: "Night Shift", checked: true },
  { title: "Window Seat", artist: "Cafe Sketch", album: "Soft Light", checked: false },
];

function themeColorSelectValue(preferences: UiPreferences, key: ThemeColorKey): ThemeColorOverrideValue {
  const value = preferences.themeColorOverrides[key];
  return value && themeColorSwatchKeys.includes(value as ThemeColorSwatchKey) ? value : "theme";
}

function setThemeColorOverride(
  preferences: UiPreferences,
  key: ThemeColorKey,
  value: ThemeColorOverrideValue,
): UiPreferences {
  const nextOverrides = { ...preferences.themeColorOverrides };
  if (value === "theme") {
    delete nextOverrides[key];
  } else {
    nextOverrides[key] = value;
  }
  return { ...preferences, themeColorOverrides: nextOverrides };
}

function rgbTripletToHex(value: string): string {
  const channels = value
    .split(/\s+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((channel) => Number.isFinite(channel))
    .slice(0, 3);
  if (channels.length !== 3) {
    return `rgb(${value})`;
  }
  return `#${channels.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function themeColorSwatchOptionLabel(key: ThemeColorSwatchKey): string {
  return `${themeColorSwatchLabels[key]} (${rgbTripletToHex(themeColorSwatchValues[key])})`;
}

function libraryPreviewStyle(
  preferences: UiPreferences,
  themeDefaults: ThemePalette,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const key of themeColorKeys) {
    style[themeColorCssVariables[key]] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, key);
  }
  const selectedCheckboxAccent =
    preferences.checkboxAccent === "theme" ? themeDefaults.checkboxAccent : preferences.checkboxAccent;
  const selectedCheckboxUnchecked =
    preferences.checkboxUnchecked === "theme" ? themeDefaults.checkboxUnchecked : preferences.checkboxUnchecked;
  style["--checkbox-accent"] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, selectedCheckboxAccent);
  style["--checkbox-unchecked"] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, selectedCheckboxUnchecked);
  return style as CSSProperties;
}

function LibraryCustomizationPreview({
  uiPreferences,
  themeDefaults,
}: {
  uiPreferences: UiPreferences;
  themeDefaults: ThemePalette;
}) {
  const density = uiPreferences.density === "theme" ? themeDefaults.density : uiPreferences.density;
  const compact = density === "compact";
  return (
    <div className="grid gap-2 rounded border border-line/70 bg-[rgb(var(--color-quiet))] p-3" style={libraryPreviewStyle(uiPreferences, themeDefaults)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase text-muted">Library Preview</div>
        <div className="rounded border border-line bg-[rgb(var(--color-panel))] px-2 py-1 text-[11px] text-muted">
          {compact ? "Compact" : "Comfortable"}
        </div>
      </div>
      <div className="overflow-hidden rounded border border-line bg-[rgb(var(--color-panel))]">
        <div className="grid grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] border-b border-line bg-[rgb(var(--color-strip))] px-2 py-2 text-[11px] uppercase text-muted">
          <span />
          <span>Title</span>
          <span>Artist</span>
          <span>Album</span>
          <span className="text-right">Rating</span>
        </div>
        {libraryPreviewRows.map((row, index) => (
          <div
            key={row.title}
            className={`grid grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] items-center gap-0 border-b border-line/60 px-2 text-sm last:border-b-0 ${
              index === 0 ? "bg-[rgb(var(--color-hover-panel))]" : "bg-[rgb(var(--color-subtle))]"
            } ${compact ? "h-9" : "h-12"}`}
          >
            <input aria-label={`Select ${row.title}`} checked={row.checked} readOnly tabIndex={-1} type="checkbox" />
            <span className="truncate font-medium text-white">{row.title}</span>
            <span className="truncate text-muted">{row.artist}</span>
            <span className="truncate text-muted">{row.album}</span>
            <span className="text-right text-ember">{index === 0 ? "4.5" : "3.0"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LibraryPreferencesSection({
  hideFilePaths,
  setHideFilePaths,
  uiPreferences,
  setUiPreferences,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
  cdAutoLookupMetadata,
  onCdAutoLookupMetadataChange,
  rememberedDeleteChoice,
  updateRememberedDeleteChoice,
  onOpenThemeFolder,
}: {
  hideFilePaths: boolean;
  setHideFilePaths: (value: boolean) => void;
  uiPreferences: UiPreferences;
  setUiPreferences: SetUiPreferences;
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  cdAutoLookupMetadata: boolean;
  onCdAutoLookupMetadataChange: (value: boolean) => void;
  rememberedDeleteChoice: RememberedDeleteChoice | "ask";
  updateRememberedDeleteChoice: (choice: RememberedDeleteChoice | "ask") => void;
  onOpenThemeFolder: () => void;
}) {
  const themeDefaults = themeAccentValues[uiPreferences.themeAccent] ?? themeAccentValues.cafe;
  const explicitSidebarWidth =
    uiPreferences.sidebarWidthPx === "theme"
      ? sidebarWidthDefaultPx
      : Math.min(sidebarWidthMaxPx, Math.max(sidebarWidthMinPx, uiPreferences.sidebarWidthPx));
  const sidebarWidthSliderValue =
    uiPreferences.sidebarWidthPx === "theme"
      ? 0
      : Math.max(1, sidebarWidthSliderValues.indexOf(explicitSidebarWidth));
  const sidebarWidthLabel =
    uiPreferences.sidebarWidthPx === "theme"
      ? `Theme Default (${themeDefaults.sidebarWidthPx}px)`
      : `${uiPreferences.sidebarWidthPx}px`;

  return (
    <DisclosureSection title="Library Preferences" description="Display, rating storage, and startup behavior">
      <div className="grid gap-3 text-sm text-neutral-200">
        <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <EyeOff className="shrink-0 text-muted" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">Hide file paths in track lists</div>
              <div className="text-xs text-muted">Keeps the library view focused on music metadata.</div>
            </div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-moss"
            checked={hideFilePaths}
            onChange={(event) => setHideFilePaths(event.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Podcast className="shrink-0 text-muted" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">Hide podcast file paths</div>
              <div className="text-xs text-muted">Keeps downloaded episode paths out of the Podcasts page.</div>
            </div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-moss"
            checked={!uiPreferences.showPodcastFilePaths}
            onChange={(event) =>
              setUiPreferences((current) => ({ ...current, showPodcastFilePaths: !event.target.checked }))
            }
          />
        </label>

        <div className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Disc3 className="shrink-0 text-muted" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">CD sidebar tab</div>
              <div className="text-xs text-muted">Controls when CD playback and ripping appears in the sidebar.</div>
            </div>
          </div>
          <select
            className="h-9 shrink-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2"
            value={uiPreferences.cdSidebarMode}
            onChange={(event) =>
              setUiPreferences((current) => ({
                ...current,
                cdSidebarMode: event.target.value as UiPreferences["cdSidebarMode"],
              }))
            }
          >
            <option value="never">Never</option>
            <option value="drive">When CD drive is detected</option>
            <option value="always">Always</option>
          </select>
        </div>

        <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Search className="shrink-0 text-muted" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">Auto-look up CD metadata</div>
              <div className="text-xs text-muted">Automatically queries MusicBrainz when a CD drive with media is detected.</div>
            </div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-moss"
            checked={cdAutoLookupMetadata}
            onChange={(event) => onCdAutoLookupMetadataChange(event.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Star className="shrink-0 text-ember" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">Write ratings and metadata to audio files</div>
              <div className="text-xs text-muted">
                When enabled, FLAC Cafe writes tags for files it can safely update. Otherwise edits stay in SQLite.
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-ember"
            checked={writeRatingsToFiles}
            onChange={(event) => onWriteRatingsToFilesChange(event.target.checked)}
          />
        </label>

        <div className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
          <div className="min-w-0">
            <div className="font-medium text-white">Remembered delete action</div>
            <div className="text-xs text-muted">
              File deletes are sent to the Windows Recycle Bin when possible.
            </div>
          </div>
          <select
            className="h-9 shrink-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2"
            value={rememberedDeleteChoice}
            onChange={(event) =>
              updateRememberedDeleteChoice(event.target.value as RememberedDeleteChoice | "ask")
            }
          >
            <option value="ask">Ask each time</option>
            <option value="library">Remove from library only</option>
            <option value="file">Delete file too</option>
          </select>
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="font-medium text-white">Library layout</div>
          <label className="flex items-center justify-between gap-4">
            <span className="text-muted">Album cover grid</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={uiPreferences.albumGrid}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, albumGrid: event.target.checked }))
              }
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Startup Page</span>
            <select
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={uiPreferences.startupPage}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, startupPage: event.target.value as Page }))
              }
            >
              <option value="library">Library</option>
              <option value="analysis">Analysis</option>
              <option value="nowPlaying">Now Playing</option>
              <option value="artist">Artist</option>
              <option value="cd">CD</option>
              <option value="history">History</option>
              <option value="autodj">AutoDJ</option>
              <option value="settings">Settings</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="font-medium text-white">Library Customization</div>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Accent</span>
            <select
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={uiPreferences.themeAccent}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, themeAccent: event.target.value as ThemeAccent }))
              }
            >
              {themeOrder.map((theme) => (
                <option key={theme} value={theme}>
                  {themeAccentLabels[theme]}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button w-fit" type="button" onClick={onOpenThemeFolder}>
            <FolderOpen size={15} />
            Show Theme Folder
          </button>
          <LibraryCustomizationPreview uiPreferences={uiPreferences} themeDefaults={themeDefaults} />
          <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Star className="shrink-0 text-ember" size={18} />
              <div className="min-w-0">
                <div className="font-medium text-white">Display ratings as numbers</div>
                <div className="text-xs text-muted">Shows ratings as 4.5 instead of star icons in the library and player.</div>
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-ember"
              checked={uiPreferences.displayRatingsAsNumbers}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, displayRatingsAsNumbers: event.target.checked }))
              }
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Checkbox Color</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.checkboxAccent}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, checkboxAccent: event.target.value as CheckboxAccentPreference }))
                }
              >
                {Object.entries(checkboxAccentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Unchecked Checkbox</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.checkboxUnchecked}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, checkboxUnchecked: event.target.value as CheckboxUncheckedPreference }))
                }
              >
                {Object.entries(checkboxUncheckedLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Density</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.density}
                onChange={(event) => {
                  const density = event.target.value as UiDensityPreference;
                  setUiPreferences((current) => ({
                    ...current,
                    density,
                    compactLibraryRows:
                      density === "theme" ? themeDefaults.density === "compact" : density === "compact",
                  }));
                }}
              >
                <option value="theme">Theme Default ({densityLabels[themeDefaults.density]})</option>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Sidebar Width</span>
              <div className="rounded border border-line bg-panel px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted">Width</span>
                  <span className="font-medium text-white">{sidebarWidthLabel}</span>
                </div>
                <input
                  className="theme-slider"
                  type="range"
                  min={0}
                  max={sidebarWidthSliderValues.length - 1}
                  step={1}
                  value={sidebarWidthSliderValue}
                  aria-label="Sidebar width"
                  style={{
                    "--theme-slider-fill": `${(sidebarWidthSliderValue / (sidebarWidthSliderValues.length - 1)) * 100}%`,
                  } as CSSProperties}
                  onChange={(event) => {
                    const sidebarWidthPx = sidebarWidthSliderValues[Number(event.target.value)] ?? "theme";
                    setUiPreferences((current) => ({ ...current, sidebarWidthPx }));
                  }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>Theme</span>
                  <span>{sidebarWidthMinPx}px</span>
                  <span>{sidebarWidthMaxPx}px</span>
                </div>
              </div>
            </label>
            <label className="grid content-start gap-2 self-start">
              <span className="text-xs uppercase text-muted">Sidebar Position</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.sidebarPlacement}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, sidebarPlacement: event.target.value as SidebarPlacement }))
                }
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Font</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.fontChoice}
                onChange={(event) => {
                  setUiPreferences((current) => ({ ...current, fontChoice: event.target.value as FontChoice }));
                }}
              >
                {Object.entries(fontChoiceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Font Size</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.fontScale}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, fontScale: event.target.value as FontScalePreference }))
                }
              >
                {Object.entries(fontScaleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 rounded border border-line/70 bg-panel p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-medium text-white">Color Roles</div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setUiPreferences((current) => ({ ...current, themeColorOverrides: {} }))}
              >
                <RotateCcw size={14} />
                Reset Colors
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
              {themeColorKeys.map((colorKey) => {
                const currentValue = themeColorSelectValue(uiPreferences, colorKey);
                const previewColor = resolveThemeColor(themeDefaults, uiPreferences.themeColorOverrides, colorKey);
                return (
                  <label key={colorKey} className="grid min-w-0 gap-2">
                    <span className="flex items-center justify-between gap-3 text-xs uppercase text-muted">
                      <span>{themeColorLabels[colorKey]}</span>
                      <span
                        className="h-4 w-4 rounded border border-white/20"
                        style={{ backgroundColor: `rgb(${previewColor})` }}
                      />
                    </span>
                    <select
                      className="h-9 w-full min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={currentValue}
                      onChange={(event) =>
                        setUiPreferences((current) =>
                          setThemeColorOverride(
                            current,
                            colorKey,
                            event.target.value as ThemeColorOverrideValue,
                          ),
                        )
                      }
                    >
                      <option value="theme">Theme Default ({rgbTripletToHex(themeDefaults[colorKey])})</option>
                      {themeColorSwatchKeys.map((optionKey) => (
                        <option key={optionKey} value={optionKey}>
                          {themeColorSwatchOptionLabel(optionKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DisclosureSection>
  );
}
