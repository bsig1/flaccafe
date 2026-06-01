import {
ChevronDown,
ExternalLink,
Heart,
KeyRound,
RefreshCw,
Save,
Send,
Upload,
} from "lucide-react";
import {
useEffect,
useMemo,
useRef,
useState,
} from "react";

import {
completeLastFmLogin,
fetchLovedTracks,
fetchScrobbleAccounts,
fetchScrobbleOutbox,
importScrobbleHistory,
queueScrobbleHistory,
saveScrobbleAccount,
startLastFmLogin,
submitScrobbleOutbox,
} from "../../lib/api";
import {
openExternalUrl,
} from "../../lib/externalLinks";
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

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function lastFmApprovalStillPending(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("unauthorized") || normalized.includes("not been authorized") || normalized.includes("token has not");
}

const LASTFM_API_URL = "https://www.last.fm/api";

export function ScrobblingPage({
  setStatus,
  onOpenApiKeysSettings,
}: {
  setStatus: (message: string) => void;
  onOpenApiKeysSettings: () => void;
}) {
  const [accounts, setAccounts] = useState<ScrobbleAccount[]>([]);
  const [outbox, setOutbox] = useState<ScrobbleOutboxEntry[]>([]);
  const [loved, setLoved] = useState<LovedTrack[]>([]);
  const [service, setService] = useState<ScrobbleService>("listenbrainz");
  const [openAccountSetup, setOpenAccountSetup] = useState<ScrobbleService | null>(null);
  const [queueLimit, setQueueLimit] = useState(100);
  const [csvPath, setCsvPath] = useState("");
  const [listenBrainzToken, setListenBrainzToken] = useState("");
  const [listenBrainzEnabled, setListenBrainzEnabled] = useState(false);
  const [lastfmSessionKey, setLastfmSessionKey] = useState("");
  const [lastfmEnabled, setLastfmEnabled] = useState(false);
  const [lastfmLoginToken, setLastfmLoginToken] = useState("");
  const [lastfmLoginUrl, setLastfmLoginUrl] = useState("");
  const [lastfmLoginBusy, setLastfmLoginBusy] = useState(false);
  const [lastfmAuthWaiting, setLastfmAuthWaiting] = useState(false);
  const lastfmPollTimerRef = useRef<number | null>(null);
  const lastfmPollInFlightRef = useRef(false);
  const lastfmAccount = useMemo(() => accountFor(accounts, "lastfm"), [accounts]);
  const visibleOutbox = useMemo(
    () => outbox.filter((entry) => entry.service === service),
    [outbox, service],
  );
  const pendingCount = useMemo(
    () => visibleOutbox.filter((entry) => entry.status !== "submitted").length,
    [visibleOutbox],
  );
  const listenBrainzConfigured = Boolean(listenBrainzEnabled && listenBrainzToken.trim());
  const lastFmConfigured = Boolean(lastfmEnabled && lastfmSessionKey.trim());

  function accountSetupButtonClass(open: boolean) {
    return `flex w-full items-center justify-between gap-3 rounded border px-3 py-3 text-left transition ${
      open
        ? "border-moss/60 bg-white/10 text-white"
        : "border-line/70 bg-ink text-neutral-200 hover:border-moss/40 hover:bg-white/[0.035]"
    }`;
  }

  function clearLastFmPoll() {
    if (lastfmPollTimerRef.current !== null) {
      window.clearInterval(lastfmPollTimerRef.current);
      lastfmPollTimerRef.current = null;
    }
    lastfmPollInFlightRef.current = false;
  }

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
      setLastfmSessionKey(lastfm?.session_key ?? "");
      setLastfmEnabled(Boolean(lastfm?.enabled));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load scrobbling data");
    }
  }

  useEffect(() => {
    void loadScrobbling();
    return clearLastFmPoll;
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
          session_key: lastfmSessionKey.trim() || null,
        }),
      ]);
      await loadScrobbling();
      setStatus("Scrobbling accounts saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save scrobbling accounts");
    }
  }

  async function openLastFmAuthorize(url: string) {
    try {
      if (isTauriRuntime()) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_external_url", { url });
        return;
      }
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (opened) {
        return;
      }
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      setStatus("Last.fm authorization URL copied. Paste it into your browser to continue.");
    } catch {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      setStatus("Could not open Last.fm automatically. Authorization URL copied instead.");
    }
  }

  async function completeLastFmAuthForToken(
    token: string,
    silent = false,
  ): Promise<"connected" | "waiting" | "failed"> {
    setLastfmLoginBusy(true);
    try {
      const response = await completeLastFmLogin(token, true);
      clearLastFmPoll();
      setLastfmEnabled(true);
      setLastfmSessionKey(response.account.session_key ?? "");
      setLastfmLoginToken("");
      setLastfmLoginUrl("");
      setLastfmAuthWaiting(false);
      await loadScrobbling();
      setStatus(`Last.fm connected${response.account.username ? ` as ${response.account.username}` : ""}`);
      return "connected";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete Last.fm login";
      if (lastFmApprovalStillPending(message)) {
        if (!silent) {
          setStatus("Last.fm is still waiting for browser approval.");
        }
        return "waiting";
      }
      if (!silent) {
        setStatus(message);
      }
      return "failed";
    } finally {
      setLastfmLoginBusy(false);
    }
  }

  function startLastFmPoll(token: string) {
    let attempts = 0;
    lastfmPollTimerRef.current = window.setInterval(() => {
      if (lastfmPollInFlightRef.current) {
        return;
      }
      lastfmPollInFlightRef.current = true;
      attempts += 1;
      void completeLastFmAuthForToken(token, true).then((result) => {
        lastfmPollInFlightRef.current = false;
        if (result === "connected") {
          return;
        }
        if (result === "failed") {
          clearLastFmPoll();
          setLastfmAuthWaiting(false);
          return;
        }
        if (attempts >= 40) {
          clearLastFmPoll();
          setLastfmAuthWaiting(false);
          setStatus("Still waiting for Last.fm approval. Approve in the browser, then use Check now.");
        }
      });
    }, 3000);
  }

  async function startLastFmAuth() {
    clearLastFmPoll();
    setLastfmLoginBusy(true);
    try {
      await saveScrobbleAccount("lastfm", {
        enabled: lastfmEnabled,
        session_key: lastfmSessionKey.trim() || null,
      });
      const response = await startLastFmLogin();
      setLastfmLoginToken(response.token);
      setLastfmLoginUrl(response.auth_url);
      setLastfmAuthWaiting(true);
      void openLastFmAuthorize(response.auth_url);
      setStatus("Approve FLAC Cafe in Last.fm. This page will finish automatically.");
      startLastFmPoll(response.token);
    } catch (error) {
      setLastfmAuthWaiting(false);
      const message = error instanceof Error ? error.message : "Could not start Last.fm login";
      setStatus(message.includes("credentials") ? `${message} Add them in Settings -> API Keys.` : message);
    } finally {
      setLastfmLoginBusy(false);
    }
  }

  async function completeLastFmAuth() {
    if (!lastfmLoginToken) {
      setStatus("Start Last.fm login first");
      return;
    }
    const result = await completeLastFmAuthForToken(lastfmLoginToken, false);
    if (result === "waiting") {
      setLastfmAuthWaiting(true);
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
            <p className="text-sm text-muted">ListenBrainz, optional bring-your-own-key Last.fm, local loved tracks, and history import.</p>
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
            <div>
              <div className="text-sm font-semibold text-white">Account Setup</div>
              <div className="mt-1 text-xs text-muted">Open the service you want to connect. Both are optional.</div>
            </div>

            <button
              className={accountSetupButtonClass(openAccountSetup === "listenbrainz")}
              type="button"
              onClick={() => setOpenAccountSetup((current) => (current === "listenbrainz" ? null : "listenbrainz"))}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">ListenBrainz</span>
                <span className="block truncate text-xs text-muted">
                  {listenBrainzConfigured ? "Configured" : "Use a ListenBrainz user token"}
                </span>
              </span>
              <ChevronDown className={`shrink-0 transition ${openAccountSetup === "listenbrainz" ? "rotate-180" : ""}`} size={16} />
            </button>
            {openAccountSetup === "listenbrainz" && (
              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                  <span className="text-muted">Enable ListenBrainz</span>
                  <input type="checkbox" className="h-4 w-4 accent-moss" checked={listenBrainzEnabled} onChange={(event) => setListenBrainzEnabled(event.target.checked)} />
                </label>
                <input
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={listenBrainzToken}
                  placeholder="ListenBrainz user token"
                  type="password"
                  onChange={(event) => setListenBrainzToken(event.target.value)}
                />
                <button className="primary-button justify-self-start" type="button" onClick={() => void saveAccounts()}>
                  <Save size={15} />
                  Save ListenBrainz
                </button>
              </div>
            )}

            <button
              className={accountSetupButtonClass(openAccountSetup === "lastfm")}
              type="button"
              onClick={() => setOpenAccountSetup((current) => (current === "lastfm" ? null : "lastfm"))}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Last.fm</span>
                <span className="block truncate text-xs text-muted">
                  {lastFmConfigured ? "Configured" : "Uses API keys from Settings"}
                </span>
              </span>
              <ChevronDown className={`shrink-0 transition ${openAccountSetup === "lastfm" ? "rotate-180" : ""}`} size={16} />
            </button>
            {openAccountSetup === "lastfm" && (
              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="text-xs text-muted">
                  Last.fm API credentials are managed in Settings &gt; API Keys. Add them there, then use browser login here.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button h-8" type="button" onClick={onOpenApiKeysSettings}>
                    <KeyRound size={14} />
                    Manage API Keys
                  </button>
                  <button className="secondary-button h-8" type="button" onClick={() => void openExternalUrl(LASTFM_API_URL, setStatus)}>
                    <ExternalLink size={14} />
                    Last.fm API Page
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                  <span className="text-muted">Enable Last.fm</span>
                  <input type="checkbox" className="h-4 w-4 accent-moss" checked={lastfmEnabled} onChange={(event) => setLastfmEnabled(event.target.checked)} />
                </label>
                <input
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={lastfmSessionKey}
                  placeholder="Last.fm session key, filled after browser login"
                  type="password"
                  onChange={(event) => setLastfmSessionKey(event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button className="secondary-button h-8" type="button" disabled={lastfmLoginBusy} onClick={() => void startLastFmAuth()}>
                    <ExternalLink size={14} />
                    {lastfmAccount?.username || lastfmSessionKey ? "Reconnect" : "Connect in Browser"}
                  </button>
                  <button className="primary-button h-8" type="button" disabled={!lastfmLoginToken || lastfmLoginBusy} onClick={() => void completeLastFmAuth()}>
                    <KeyRound size={14} />
                    Check Now
                  </button>
                  {lastfmLoginUrl && (
                    <button className="secondary-button h-8" type="button" onClick={() => void openLastFmAuthorize(lastfmLoginUrl)}>
                      Open Approval Page
                    </button>
                  )}
                  <button className="primary-button h-8" type="button" onClick={() => void saveAccounts()}>
                    <Save size={14} />
                    Save Last.fm
                  </button>
                </div>
                <div className="text-xs text-muted">
                  {lastfmAccount?.username
                    ? `Connected as ${lastfmAccount.username}`
                    : lastfmSessionKey
                      ? "Session key saved"
                      : "Not connected"}
                </div>
                {lastfmAuthWaiting && (
                  <div className="rounded border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-moss">
                    Waiting for browser approval. After you approve Last.fm, this will connect automatically.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Scrobble Queue</div>
                <div className="mt-1 text-xs text-muted">Choose a service, then queue or submit listening history.</div>
              </div>
              <button className="secondary-button h-8" type="button" onClick={() => void saveAccounts()}>
                <Save size={14} />
                Save Accounts
              </button>
            </div>
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
            <div className="text-xs text-muted">{pendingCount.toLocaleString()} pending or failed {service === "lastfm" ? "Last.fm" : "ListenBrainz"} item{pendingCount === 1 ? "" : "s"}</div>
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
            <div className="mb-2 text-sm font-semibold text-white">{service === "lastfm" ? "Last.fm" : "ListenBrainz"} Outbox</div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {visibleOutbox.map((entry) => (
                <div key={entry.id} className="grid gap-1 rounded bg-ink px-3 py-2 text-xs">
                  <div className="truncate text-neutral-100">{entry.artist} - {entry.title}</div>
                  <div className={entry.status === "submitted" ? "text-moss" : entry.status === "failed" ? "text-ember" : "text-muted"}>
                    {entry.event_type} - {entry.status} - attempts {entry.attempts}
                  </div>
                  {entry.last_error && <div className="truncate text-ember">{entry.last_error}</div>}
                </div>
              ))}
              {visibleOutbox.length === 0 && <div className="py-8 text-center text-sm text-muted">No scrobbles queued for this service.</div>}
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <Heart size={16} />
              Local Loved Tracks
            </div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {loved.map((track) => (
                <div key={track.track_id} className="grid gap-1 rounded bg-ink px-3 py-2 text-xs">
                  <div className="truncate text-neutral-100">{track.artist ?? "Unknown"} - {track.title ?? "Untitled"}</div>
                  <div className="truncate text-muted">{track.album ?? "No album"} - {track.source}</div>
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
