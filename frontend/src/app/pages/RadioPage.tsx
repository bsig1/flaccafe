import {
  Globe2,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  deleteRadioStation,
  fetchRadioStations,
  markRadioStationPlayed,
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

export function RadioPage({ setStatus }: { setStatus: (message: string) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const selected = useMemo(() => stations.find((station) => station.id === selectedId) ?? stations[0] ?? null, [selectedId, stations]);
  const playing = stations.find((station) => station.id === playingId) ?? null;

  async function loadStations() {
    try {
      const response = await fetchRadioStations();
      setStations(response);
      if (!selectedId && response[0]) {
        setSelectedId(response[0].id);
      }
      setStatus(response.length ? `Loaded ${response.length.toLocaleString()} radio station${response.length === 1 ? "" : "s"}` : "No radio stations yet");
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
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    try {
      await deleteRadioStation(selectedId);
      if (playingId === selectedId) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      setSelectedId(null);
      await loadStations();
      setStatus("Radio station deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete radio station");
    }
  }

  async function playStation(station: RadioStation) {
    try {
      setPlayingId(station.id);
      await markRadioStationPlayed(station.id);
      window.setTimeout(() => {
        void audioRef.current?.play().catch(() => {
          setStatus("The stream did not start automatically. Press play in the radio controls.");
        });
      }, 0);
      await loadStations();
      setStatus(`Playing ${station.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start radio stream");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Web Radio</h1>
            <p className="text-sm text-muted">Stream bookmarks for radio stations and internet audio.</p>
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
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[320px_1fr]">
        <div className="min-h-0 overflow-hidden rounded border border-line bg-panel">
          <div className="border-b border-line px-3 py-2 text-xs uppercase text-muted">Stations</div>
          <div className="grid max-h-full gap-1 overflow-auto p-2">
            {stations.map((station) => (
              <button
                key={station.id}
                className={`grid min-w-0 gap-1 rounded px-3 py-2 text-left transition ${
                  selected?.id === station.id ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
                }`}
                type="button"
                onDoubleClick={() => void playStation(station)}
                onClick={() => setSelectedId(station.id)}
              >
                <span className="truncate text-sm font-medium">{station.name}</span>
                <span className="truncate text-xs text-muted">{station.genre ?? "Radio"} · {displayDate(station.last_played_at)}</span>
              </button>
            ))}
            {stations.length === 0 && <div className="py-8 text-center text-sm text-muted">Add a stream URL to start.</div>}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded border border-line bg-panel p-4">
          <div className="grid gap-5">
            <div className="grid gap-3 rounded border border-line bg-ink p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Radio size={18} />
                Station
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
                <button className="primary-button" type="button" onClick={() => void saveStation()}>
                  <Save size={15} />
                  Save
                </button>
                {selected && (
                  <button className="secondary-button" type="button" onClick={() => void playStation(selected)}>
                    <Radio size={15} />
                    Play
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

            <div className="rounded border border-line bg-ink p-3">
              <div className="mb-2 text-xs uppercase text-muted">Stream Player</div>
              <div className="mb-2 truncate text-sm text-neutral-100">{playing?.name ?? "No station playing"}</div>
              <audio ref={audioRef} className="w-full" src={playing?.stream_url ?? undefined} controls preload="none" />
              {playing?.stream_url && <div className="mt-2 truncate text-xs text-muted">{playing.stream_url}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
