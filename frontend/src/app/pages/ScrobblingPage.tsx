import {
  Heart,
  RefreshCw,
  Save,
  Send,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchLovedTracks,
  fetchScrobbleAccounts,
  fetchScrobbleOutbox,
  importScrobbleHistory,
  queueScrobbleHistory,
  saveScrobbleAccount,
  submitScrobbleOutbox,
} from "../../lib/api";
import type {
  LovedTrack,
  ScrobbleAccount,
  ScrobbleOutboxEntry,
  ScrobbleService,
} from "../../types/api";
import {
  NumberField,
} from "../components/common";

function accountFor(accounts: ScrobbleAccount[], service: ScrobbleService) {
  return accounts.find((account) => account.service === service);
}

export function ScrobblingPage({ setStatus }: { setStatus: (message: string) => void }) {
  const [accounts, setAccounts] = useState<ScrobbleAccount[]>([]);
  const [outbox, setOutbox] = useState<ScrobbleOutboxEntry[]>([]);
  const [loved, setLoved] = useState<LovedTrack[]>([]);
  const [service, setService] = useState<ScrobbleService>("listenbrainz");
  const [queueLimit, setQueueLimit] = useState(100);
  const [csvPath, setCsvPath] = useState("");
  const [listenBrainzToken, setListenBrainzToken] = useState("");
  const [listenBrainzEnabled, setListenBrainzEnabled] = useState(false);
  const [lastfmApiKey, setLastfmApiKey] = useState("");
  const [lastfmApiSecret, setLastfmApiSecret] = useState("");
  const [lastfmSessionKey, setLastfmSessionKey] = useState("");
  const [lastfmEnabled, setLastfmEnabled] = useState(false);
  const pendingCount = useMemo(() => outbox.filter((entry) => entry.status !== "submitted").length, [outbox]);

  async function loadScrobbling() {
    try {
      const [accountResponse, outboxResponse, lovedResponse] = await Promise.all([
        fetchScrobbleAccounts(),
        fetchScrobbleOutbox(150),
        fetchLovedTracks(100),
      ]);
      setAccounts(accountResponse);
      setOutbox(outboxResponse);
      setLoved(lovedResponse);
      const listenbrainz = accountFor(accountResponse, "listenbrainz");
      const lastfm = accountFor(accountResponse, "lastfm");
      setListenBrainzToken(listenbrainz?.token ?? "");
      setListenBrainzEnabled(Boolean(listenbrainz?.enabled));
      setLastfmApiKey(lastfm?.api_key ?? "");
      setLastfmApiSecret(lastfm?.api_secret ?? "");
      setLastfmSessionKey(lastfm?.session_key ?? "");
      setLastfmEnabled(Boolean(lastfm?.enabled));
      setStatus("Scrobbling data loaded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load scrobbling data");
    }
  }

  useEffect(() => {
    void loadScrobbling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAccounts() {
    try {
      await Promise.all([
        saveScrobbleAccount("listenbrainz", {
          enabled: listenBrainzEnabled,
          token: listenBrainzToken || null,
        }),
        saveScrobbleAccount("lastfm", {
          enabled: lastfmEnabled,
          api_key: lastfmApiKey || null,
          api_secret: lastfmApiSecret || null,
          session_key: lastfmSessionKey || null,
        }),
      ]);
      await loadScrobbling();
      setStatus("Scrobbling accounts saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save scrobbling accounts");
    }
  }

  async function queueHistory() {
    try {
      const response = await queueScrobbleHistory(service, queueLimit);
      await loadScrobbling();
      setStatus(`Queued ${response.queued.toLocaleString()} of ${response.considered.toLocaleString()} history plays`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not queue scrobbles");
    }
  }

  async function submitOutbox() {
    try {
      const response = await submitScrobbleOutbox(service, 50);
      await loadScrobbling();
      setStatus(`Submitted ${response.submitted.toLocaleString()} scrobble${response.submitted === 1 ? "" : "s"}; ${response.failed.toLocaleString()} failed`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit scrobbles");
    }
  }

  async function importHistory(apply: boolean) {
    try {
      const response = await importScrobbleHistory(csvPath, apply);
      setStatus(`${apply ? "Imported" : "Previewed"} ${response.total.toLocaleString()} history row${response.total === 1 ? "" : "s"}; ${response.updated.toLocaleString()} updated`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import history CSV");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Scrobbling</h1>
            <p className="text-sm text-muted">ListenBrainz and Last.fm outbox, loved tracks, and history import.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadScrobbling()}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
        <div className="grid gap-4">
          <div className="grid gap-3 rounded border border-line bg-panel p-4">
            <div className="text-sm font-semibold text-white">Accounts</div>
            <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
              <span className="text-muted">Enable ListenBrainz</span>
              <input type="checkbox" className="h-4 w-4 accent-moss" checked={listenBrainzEnabled} onChange={(event) => setListenBrainzEnabled(event.target.checked)} />
            </label>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={listenBrainzToken}
              placeholder="ListenBrainz user token"
              type="password"
              onChange={(event) => setListenBrainzToken(event.target.value)}
            />
            <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
              <span className="text-muted">Enable Last.fm</span>
              <input type="checkbox" className="h-4 w-4 accent-moss" checked={lastfmEnabled} onChange={(event) => setLastfmEnabled(event.target.checked)} />
            </label>
            <input className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={lastfmApiKey} placeholder="Last.fm API key" onChange={(event) => setLastfmApiKey(event.target.value)} />
            <input className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={lastfmApiSecret} placeholder="Last.fm shared secret" type="password" onChange={(event) => setLastfmApiSecret(event.target.value)} />
            <input className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={lastfmSessionKey} placeholder="Last.fm session key" type="password" onChange={(event) => setLastfmSessionKey(event.target.value)} />
            <button className="primary-button justify-self-start" type="button" onClick={() => void saveAccounts()}>
              <Save size={15} />
              Save Accounts
            </button>
          </div>

          <div className="grid gap-3 rounded border border-line bg-panel p-4">
            <div className="text-sm font-semibold text-white">Queue And Submit</div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Service</span>
                <select className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2" value={service} onChange={(event) => setService(event.target.value as ScrobbleService)}>
                  <option value="listenbrainz">ListenBrainz</option>
                  <option value="lastfm">Last.fm</option>
                </select>
              </label>
              <NumberField label="History Limit" value={queueLimit} min={1} max={10000} onChange={setQueueLimit} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={() => void queueHistory()}>
                <Upload size={15} />
                Queue History
              </button>
              <button className="primary-button" type="button" onClick={() => void submitOutbox()}>
                <Send size={15} />
                Submit Pending
              </button>
            </div>
            <div className="text-xs text-muted">{pendingCount.toLocaleString()} pending or failed outbox item{pendingCount === 1 ? "" : "s"}</div>
          </div>

          <div className="grid gap-3 rounded border border-line bg-panel p-4">
            <div className="text-sm font-semibold text-white">History CSV Import</div>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={csvPath}
              placeholder="CSV with artist,title,play_count,rating,loved"
              onChange={(event) => setCsvPath(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={() => void importHistory(false)}>Preview</button>
              <button className="primary-button" type="button" onClick={() => void importHistory(true)}>Apply Import</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded border border-line bg-panel p-4">
            <div className="mb-2 text-sm font-semibold text-white">Outbox</div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {outbox.map((entry) => (
                <div key={entry.id} className="grid gap-1 rounded bg-ink px-3 py-2 text-xs">
                  <div className="truncate text-neutral-100">{entry.artist} - {entry.title}</div>
                  <div className={entry.status === "submitted" ? "text-moss" : entry.status === "failed" ? "text-ember" : "text-muted"}>
                    {entry.service} · {entry.event_type} · {entry.status} · attempts {entry.attempts}
                  </div>
                  {entry.last_error && <div className="truncate text-ember">{entry.last_error}</div>}
                </div>
              ))}
              {outbox.length === 0 && <div className="py-8 text-center text-sm text-muted">No scrobbles queued.</div>}
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <Heart size={16} />
              Loved Tracks
            </div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {loved.map((track) => (
                <div key={track.track_id} className="grid gap-1 rounded bg-ink px-3 py-2 text-xs">
                  <div className="truncate text-neutral-100">{track.artist ?? "Unknown"} - {track.title ?? "Untitled"}</div>
                  <div className="truncate text-muted">{track.album ?? "No album"} · {track.source}</div>
                </div>
              ))}
              {loved.length === 0 && <div className="py-8 text-center text-sm text-muted">No loved tracks stored yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
