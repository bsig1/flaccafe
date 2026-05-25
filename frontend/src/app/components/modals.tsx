import {
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  Track,
  TrackMetadataUpdate,
} from "../../types/api";
import {
  DeleteTrackPrompt,
  display,
  fileExtension,
  fileName,
  supportsFileTagWriting,
} from "../shared";

export type EditableMetadataKey = keyof Omit<TrackMetadataUpdate, "write_to_file">;

export function MetadataEditorModal({
  track,
  initialField,
  writeToFiles,
  onWriteToFilesChange,
  onClose,
  onSave,
}: {
  track: Track;
  initialField?: EditableMetadataKey | null;
  writeToFiles: boolean;
  onWriteToFilesChange: (value: boolean) => void;
  onClose: () => void;
  onSave: (trackId: number, metadata: TrackMetadataUpdate) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? "",
    album_artist: track.album_artist ?? "",
    track_number: track.track_number?.toString() ?? "",
    disc_number: track.disc_number?.toString() ?? "",
    genre: track.genre ?? "",
    year: track.year?.toString() ?? "",
  });
  const inputRefs = useRef<Partial<Record<EditableMetadataKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!initialField) {
      return;
    }
    const handle = window.setTimeout(() => {
      const input = inputRefs.current[initialField];
      input?.focus();
      input?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [track.id, initialField]);

  function textValue(value: string): string | null {
    const cleaned = value.trim();
    return cleaned || null;
  }

  function numberValue(value: string): number | null {
    const cleaned = value.trim();
    return cleaned ? Number(cleaned) : null;
  }

  const previewValues = {
    title: textValue(form.title),
    artist: textValue(form.artist),
    album: textValue(form.album),
    album_artist: textValue(form.album_artist),
    track_number: numberValue(form.track_number),
    disc_number: numberValue(form.disc_number),
    genre: textValue(form.genre),
    year: numberValue(form.year),
  };
  const metadataChanges = (
    [
      ["Title", track.title, previewValues.title],
      ["Artist", track.artist, previewValues.artist],
      ["Album", track.album, previewValues.album],
      ["Album Artist", track.album_artist, previewValues.album_artist],
      ["Genre", track.genre, previewValues.genre],
      ["Year", track.year, previewValues.year],
      ["Track", track.track_number, previewValues.track_number],
      ["Disc", track.disc_number, previewValues.disc_number],
    ] as const
  ).filter(([, before, after]) => (before ?? null) !== (after ?? null));
  const tagWritable = supportsFileTagWriting(track.path);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    await onSave(track.id, { ...previewValues, write_to_file: writeToFiles });
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded border border-line bg-[rgb(var(--color-popover))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">Edit Metadata</div>
            <div className="mt-1 truncate text-xs text-muted">{fileName(track.path)}</div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["title", "Title"],
                ["artist", "Artist"],
                ["album", "Album"],
                ["album_artist", "Album Artist"],
                ["genre", "Genre"],
                ["year", "Year"],
                ["track_number", "Track Number"],
                ["disc_number", "Disc Number"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">{label}</span>
                <input
                  ref={(element) => {
                    inputRefs.current[field] = element;
                  }}
                  className={`h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2 ${
                    initialField === field ? "border-moss/60" : ""
                  }`}
                  inputMode={field === "year" || field === "track_number" || field === "disc_number" ? "numeric" : undefined}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs ${writeToFiles ? "border-ember/40 bg-ember/10 text-ember" : "border-line bg-ink text-muted"}`}>
            <span>
              {writeToFiles && tagWritable
                ? "File tag writing is enabled. Saving will update SQLite and supported audio file tags."
                : writeToFiles
                  ? `${fileExtension(track.path).toUpperCase() || "This format"} may not support safe tag writing yet. Saving will try the file write and stop if mutagen rejects it.`
                  : "File tag writing is off. Saving will update SQLite only."}
            </span>
            <label className="flex shrink-0 items-center gap-2 text-[11px] uppercase">
              File writes
              <input
                type="checkbox"
                className="h-4 w-4 accent-ember"
                checked={writeToFiles}
                onChange={(event) => onWriteToFilesChange(event.target.checked)}
              />
            </label>
          </div>

          <div className="rounded border border-line/70 bg-ink p-3 text-xs">
            <div className="mb-2 font-medium text-neutral-200">Changes to save</div>
            {metadataChanges.length === 0 ? (
              <div className="text-muted">No changes yet.</div>
            ) : (
              <div className="grid gap-2">
                {metadataChanges.map(([label, before, after]) => (
                  <div key={label} className="grid grid-cols-[90px_1fr] gap-2">
                    <div className="text-muted">{label}</div>
                    <div className="min-w-0 truncate text-neutral-200">
                      <span className="text-muted">{display(before, "Empty")}</span>
                      <span className="px-2 text-ember">to</span>
                      <span>{display(after, "Empty")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void submit()}>
            <Pencil size={15} />
            Save Metadata
          </button>
        </div>
      </div>
    </div>
  );
}



export function BulkMetadataModal({
  tracks,
  writeToFiles,
  onClose,
  onSave,
}: {
  tracks: Track[];
  writeToFiles: boolean;
  onClose: () => void;
  onSave: (metadata: TrackMetadataUpdate) => void | Promise<void>;
}) {
  const [enabledFields, setEnabledFields] = useState<Record<EditableMetadataKey, boolean>>({
    title: false,
    artist: false,
    album: false,
    album_artist: false,
    track_number: false,
    disc_number: false,
    genre: false,
    year: false,
  });
  const [values, setValues] = useState<Record<EditableMetadataKey, string>>({
    title: "",
    artist: "",
    album: "",
    album_artist: "",
    track_number: "",
    disc_number: "",
    genre: "",
    year: "",
  });

  const fields: Array<[EditableMetadataKey, string, "text" | "number"]> = [
    ["artist", "Artist", "text"],
    ["album", "Album", "text"],
    ["album_artist", "Album Artist", "text"],
    ["genre", "Genre", "text"],
    ["year", "Year", "number"],
    ["disc_number", "Disc", "number"],
  ];
  const enabledCount = Object.values(enabledFields).filter(Boolean).length;
  const unsupported = tracks.filter((track) => !supportsFileTagWriting(track.path));

  function submit() {
    const metadata: TrackMetadataUpdate = {};
    for (const [key] of fields) {
      if (!enabledFields[key]) {
        continue;
      }
      const raw = values[key].trim();
      switch (key) {
        case "year":
        case "disc_number":
        case "track_number":
          metadata[key] = raw ? Number(raw) : null;
          break;
        default:
          metadata[key] = raw || null;
      }
    }
    void onSave(metadata);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded border border-line bg-[rgb(var(--color-popover))] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">Bulk Metadata Preview</div>
            <div className="mt-1 text-sm text-muted">{tracks.length.toLocaleString()} selected tracks</div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-5">
          <div className="grid gap-3">
            {fields.map(([key, label, type]) => (
              <div key={key} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 rounded border border-line/70 bg-ink p-3 text-sm">
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={enabledFields[key]}
                    onChange={(event) => setEnabledFields((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
                <input
                  type={type}
                  disabled={!enabledFields[key]}
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 disabled:opacity-40 focus:ring-2"
                  value={values[key]}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted">Preview</div>
            <div className="grid gap-1 text-xs">
              {tracks.slice(0, 8).map((track) => (
                <div key={track.id} className="grid grid-cols-[1fr_1fr] gap-3 rounded bg-panel px-2 py-1.5">
                  <div className="truncate text-muted">{display(track.title, "Untitled")} - {display(track.artist)}</div>
                  <div className="truncate text-neutral-200">
                    {fields
                      .filter(([key]) => enabledFields[key])
                      .map(([key, label]) => `${label}: ${values[key].trim() || "(blank)"}`)
                      .join(" / ") || "No fields selected"}
                  </div>
                </div>
              ))}
              {tracks.length > 8 && <div className="text-muted">...and {(tracks.length - 8).toLocaleString()} more tracks</div>}
            </div>
          </div>
          {writeToFiles && unsupported.length > 0 && (
            <div className="mt-3 rounded border border-ember/40 bg-ember/10 p-3 text-xs text-ember">
              {unsupported.length} selected file{unsupported.length === 1 ? "" : "s"} may not support direct metadata writes. SQLite updates will still be attempted track by track.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" disabled={enabledCount === 0} onClick={submit}>
            <Pencil size={15} />
            Apply Previewed Changes
          </button>
        </div>
      </div>
    </div>
  );
}



export function DeleteTrackDialog({
  prompt,
  onCancel,
  onConfirm,
}: {
  prompt: DeleteTrackPrompt;
  onCancel: () => void;
  onConfirm: (deleteFile: boolean, remember: boolean) => void | Promise<void>;
}) {
  const [rememberChoice, setRememberChoice] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded border border-line bg-[rgb(var(--color-popover))] shadow-2xl">
        <div className="border-b border-line px-5 py-4">
          <div className="text-base font-semibold text-white">Delete Track</div>
          <div className="mt-1 text-sm text-muted">{prompt.title}</div>
        </div>
        <div className="grid gap-3 p-5 text-sm text-neutral-200">
          <button className="secondary-button justify-start" type="button" onClick={() => void onConfirm(false, rememberChoice)}>
            <Trash2 size={15} />
            Remove from library only
          </button>
          <button
            className="secondary-button justify-start text-red-300"
            type="button"
            disabled={!prompt.allowFileDelete}
            onClick={() => void onConfirm(true, rememberChoice)}
          >
            <Trash2 size={15} />
            Remove from library and delete file
          </button>
          <label className="mt-1 flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
            <span>Remember this choice</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={rememberChoice}
              onChange={(event) => setRememberChoice(event.target.checked)}
            />
          </label>
          <div className="text-xs text-muted">Deleted files are sent to the Windows Recycle Bin when possible.</div>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
