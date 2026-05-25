import {
  Globe2,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
} from "react";

import {
  deleteRadioStation,
  fetchRadioStations,
  saveRadioStation,
} from "../../lib/api";
import type {
  RadioStation,
} from "../../types/api";

function displayDate(value: string | null) {
  if (!value) {
    return "Never played";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

interface RadioPageProps {
  setStatus: (message: string) => void;
  playingStationId: number | null;
  onPlayStation: (station: RadioStation) => void | Promise<void>;
  onStopStation: (stationId: number) => void;
}

export function RadioPage({
  setStatus,
  playingStationId,
  onPlayStation,
  onStopStation,
}: RadioPageProps) {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const selected = useMemo(() => selectedId === null ? null : stations.find((station) => station.id === selectedId) ?? null, [selectedId, stations]);

  async function loadStations() {
    try {
      const response = await fetchRadioStations();
      setStations(response);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load radio stations");
    }
  }

  useEffect(() => {
    void loadStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setStreamUrl(selected.stream_url);
      setHomepageUrl(selected.homepage_url ?? "");
      setGenre(selected.genre ?? "");
      setNotes(selected.notes ?? "");
    }
  }, [selected?.id]);

  async function saveStation() {
    try {
      const station = await saveRadioStation(
        {
          name,
          stream_url: streamUrl,
          homepage_url: homepageUrl || null,
          genre: genre || null,
          notes: notes || null,
        },
        selectedId,
      );
      setSelectedId(station.id);
      setIsEditing(false);
      await loadStations();
      setStatus(`Saved radio station: ${station.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save radio station");
    }
  }

  function newStation() {
    setSelectedId(null);
    setName("");
    setStreamUrl("");
    setHomepageUrl("");
    setGenre("");
    setNotes("");
    setIsEditing(true);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    try {
      await deleteRadioStation(selectedId);
      if (playingStationId === selectedId) {
        onStopStation(selectedId);
      }
      setSelectedId(null);
      setIsEditing(false);
      await loadStations();
      setStatus("Radio station deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete radio station");
    }
  }

  async function playStation(station: RadioStation) {
    await onPlayStation(station);
    await loadStations();
  }

  function editSelected() {
    if (!selected) {
      return;
    }
    setName(selected.name);
    setStreamUrl(selected.stream_url);
    setHomepageUrl(selected.homepage_url ?? "");
    setGenre(selected.genre ?? "");
    setNotes(selected.notes ?? "");
    setIsEditing(true);
  }

  function clearSelection() {
    if (isEditing) {
      return;
    }
    setSelectedId(null);
  }

  function clearSelectionFromBlankArea(event: ReactMouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
      clearSelection();
    }
  }

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || !isEditing) {
        return;
      }
      event.preventDefault();
      void saveStation();
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [isEditing, name, streamUrl, homepageUrl, genre, notes, selectedId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Web Radio</h1>
            <p className="text-sm text-muted">Stream bookmarks for radio stations and internet audio. Playback uses the main player bar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={newStation}>
              <Plus size={15} />
              New
            </button>
            <button className="secondary-button" type="button" onClick={() => void loadStations()}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[320px_1fr]" onClick={clearSelectionFromBlankArea}>
        <div className="min-h-0 overflow-hidden rounded border border-line bg-panel">
          <div className="border-b border-line px-3 py-2 text-xs uppercase text-muted">Stations</div>
          <div className="grid max-h-full gap-1 overflow-auto p-2" onClick={clearSelectionFromBlankArea}>
            {stations.map((station) => {
              const isPlaying = playingStationId === station.id;
              return (
                <button
                  key={station.id}
                  className={`grid min-w-0 gap-1 rounded border px-3 py-2 text-left transition ${
                    selected?.id === station.id ? "border-moss/40 bg-white/10 text-white" : "border-transparent text-neutral-200 hover:bg-white/5"
                  }`}
                  type="button"
                  onDoubleClick={() => void playStation(station)}
                  onClick={() => {
                    setSelectedId(station.id);
                    setIsEditing(false);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{station.name}</span>
                    {isPlaying && <span className="shrink-0 rounded-full border border-moss/40 bg-moss/10 px-2 py-0.5 text-[10px] uppercase text-moss">Live</span>}
                  </span>
                  <span className="truncate text-xs text-muted">{station.genre ?? "Radio"} - {displayDate(station.last_played_at)}</span>
                </button>
              );
            })}
            {stations.length === 0 && <div className="py-8 text-center text-sm text-muted">Add a stream URL to start.</div>}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded border border-line bg-panel p-4" onClick={clearSelectionFromBlankArea}>
          <div className="grid gap-5" onClick={clearSelectionFromBlankArea}>
            {!selected && !isEditing && (
              <div className="rounded border border-dashed border-line bg-ink px-4 py-10 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-moss">
                  <Radio size={20} />
                </div>
                <div className="text-sm font-medium text-white">No station selected</div>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Select a station to play it, or create a new bookmark when you want to edit details.</p>
                <button className="primary-button mx-auto mt-4" type="button" onClick={newStation}>
                  <Plus size={15} />
                  New Station
                </button>
              </div>
            )}

            {selected && !isEditing && (
              <div className="rounded border border-line bg-ink p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted">
                      <Radio size={15} />
                      Station
                    </div>
                    <h2 className="mt-1 truncate text-lg font-semibold text-white">{selected.name}</h2>
                    <div className="mt-1 truncate text-sm text-muted">{selected.genre ?? "Live web radio"}</div>
                  </div>
                  {playingStationId === selected.id && (
                    <span className="rounded-full border border-moss/40 bg-moss/10 px-2 py-1 text-[10px] uppercase text-moss">Live</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="primary-button" type="button" onClick={() => void playStation(selected)}>
                    <Play size={15} fill="currentColor" />
                    Play in main player
                  </button>
                  <button className="secondary-button" type="button" onClick={editSelected} title="Edit station (Ctrl+S saves)">
                    <Pencil size={15} />
                    Edit
                  </button>
                  {selected.homepage_url && (
                    <a className="secondary-button" href={selected.homepage_url} target="_blank" rel="noreferrer">
                      <Globe2 size={15} />
                      Site
                    </a>
                  )}
                  <button className="secondary-button" type="button" onClick={() => void deleteSelected()}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {selected ? <Pencil size={18} /> : <Plus size={18} />}
                  {selected ? "Edit Station" : "New Station"}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Name</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={name}
                      placeholder="Station name"
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Genre</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={genre}
                      placeholder="Jazz, news, ambient"
                      onChange={(event) => setGenre(event.target.value)}
                    />
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Stream URL</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={streamUrl}
                    placeholder="https://example.com/live.mp3"
                    onChange={(event) => setStreamUrl(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Homepage</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={homepageUrl}
                    placeholder="Optional"
                    onChange={(event) => setHomepageUrl(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Notes</span>
                  <textarea
                    className="min-h-24 rounded border border-line bg-panel px-3 py-2 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={notes}
                    placeholder="Optional station notes"
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="primary-button" type="button" title="Save station (Ctrl+S)" onClick={() => void saveStation()}>
                    <Save size={15} />
                    Save
                  </button>
                  {selected && (
                    <button className="secondary-button" type="button" onClick={() => void playStation(selected)}>
                      <Play size={15} fill="currentColor" />
                      Play in main player
                    </button>
                  )}
                  {selected?.homepage_url && (
                    <a className="secondary-button" href={selected.homepage_url} target="_blank" rel="noreferrer">
                      <Globe2 size={15} />
                      Site
                    </a>
                  )}
                  <button className="secondary-button" type="button" disabled={!selectedId} onClick={() => void deleteSelected()}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
