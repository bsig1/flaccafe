import {
Download,
Eye,
FolderOpen,
RefreshCw,
Save,
Trash2,
} from "lucide-react";

import type {
DeviceSyncDetectedDevice,
DeviceSyncProfile,
DeviceSyncProfilePayload,
DeviceSyncResponse,
FileOrganizationReportResponse,
FileOrganizationResponse,
PlaylistSummary
} from "../../../types/api";
import {
DisclosureSection,
} from "../../components/common";
import { AudioConversionSection } from "./AudioConversionSection";
import { LibraryImportersSection } from "./LibraryImportersSection";

function defaultToolTarget(folderPath: string, folderName: string): string {
  const trimmed = folderPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "";
  }
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}${folderName}`;
}

function defaultAudioConversionTarget(folderPath: string): string {
  return defaultToolTarget(folderPath, "FLAC Cafe Converted");
}

export function FileManagementTransferSections({ model }: { model: any }) {
  const fileOrganizationPreview = model.fileOrganizationPreview as FileOrganizationResponse | null;
  const fileOrganizationReport = model.fileOrganizationReport as FileOrganizationReportResponse | null;
  const deviceSyncPreview = model.deviceSyncPreview as DeviceSyncResponse | null;
  const deviceSyncProfiles = model.deviceSyncProfiles as DeviceSyncProfile[];
  const deviceSyncPresets = model.deviceSyncPresets as DeviceSyncProfilePayload[];
  const deviceSyncDevices = model.deviceSyncDevices as DeviceSyncDetectedDevice[];
  const deviceSyncPlaylistIds = model.deviceSyncPlaylistIds as Set<number>;
  const playlists = model.playlists as PlaylistSummary[];
  const scopedTrackIds = model.scopedTrackIds as number[];
  const {
    showTool, organizeTemplate, setOrganizeTemplate, organizeBaseFolder, setOrganizeBaseFolder, organizeCollisionStrategy, setOrganizeCollisionStrategy, organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders, onPreviewFileOrganization, onExportFileOrganizationReport, applyFileOrganization, organizationOptions, folderPath, 
    deviceSyncTarget, setDeviceSyncTarget, deviceSyncProfileId, setDeviceSyncProfileId, deviceSyncProfileName, setDeviceSyncProfileName, deviceSyncDeviceKind, setDeviceSyncDeviceKind, deviceSyncMusicSubfolder, setDeviceSyncMusicSubfolder, deviceSyncPlaylistSubfolder, setDeviceSyncPlaylistSubfolder, setDeviceSyncPlaylistIds, deviceSyncCopyFiles, setDeviceSyncCopyFiles, deviceSyncExportPlaylists, setDeviceSyncExportPlaylists, deviceSyncPreserveStructure, setDeviceSyncPreserveStructure, applyDeviceSyncProfile, saveCurrentDeviceSyncProfile, deleteCurrentDeviceSyncProfile, useDetectedDevice, toggleDeviceSyncPlaylist, deviceSyncOptions, onDeviceSync, loadDeviceSyncSupport,
    audioConversionSetup, audioConversionPreview, audioConversionProgress, onRefreshAudioConversionSetup, onInstallAudioConversionFfmpeg, onBrowseAudioConversionTarget, onPreviewAudioConversion, onStartAudioConversion, onCancelAudioConversion, setStatus,
  } = model;

  return (
    <>
          {showTool("organizer") && (
          <DisclosureSection title="File Organizer" description="Preview tag-based renames/reorganization and export a review report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Template</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                  value={organizeTemplate}
                  onChange={(event) => setOrganizeTemplate(event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Base Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={organizeBaseFolder}
                  placeholder={folderPath || "Leave empty to use the music folder"}
                  onChange={(event) => setOrganizeBaseFolder(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Name Collisions</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={organizeCollisionStrategy}
                    onChange={(event) => setOrganizeCollisionStrategy(event.target.value as "skip" | "auto_rename")}
                  >
                    <option value="skip">Skip existing files</option>
                    <option value="auto_rename">Auto-rename with (2)</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Remove empty source folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={organizeCleanupEmptyFolders}
                    onChange={(event) => setOrganizeCleanupEmptyFolders(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onPreviewFileOrganization(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Eye size={15} />
                  Preview Renames
                </button>
                <button className="secondary-button" type="button" onClick={() => void onExportFileOrganizationReport(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Download size={15} />
                  Export Rename Report
                </button>
                <button className="primary-button" type="button" onClick={() => void applyFileOrganization()}>
                  <FolderOpen size={15} />
                  Rename/Reorganize
                </button>
              </div>
              {fileOrganizationPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {fileOrganizationPreview.changed_count.toLocaleString()} possible renames, {fileOrganizationPreview.applied.toLocaleString()} applied
                    {fileOrganizationPreview.removed_empty_folders
                      ? `, ${fileOrganizationPreview.removed_empty_folders.toLocaleString()} empty folders removed`
                      : ""}
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {fileOrganizationPreview.changes.slice(0, 50).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">{change.current_path}</div>
                        <div className={change.error || change.collision ? "truncate text-ember" : "truncate text-neutral-200"}>
                          {change.target_path}
                          {change.collision ? " - collision" : ""}
                          {change.error ? ` - ${change.error}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fileOrganizationReport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{fileOrganizationReport.report_path}</div>
                  <div>
                    {fileOrganizationReport.changed_count.toLocaleString()} changes, {fileOrganizationReport.collisions.toLocaleString()} collisions
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("deviceSync") && (
          <DisclosureSection title="Device Sync Folder" description="Preview copy jobs and playlist exports for a phone, USB drive, or portable player">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Saved Profile</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={deviceSyncProfileId ?? ""}
                      onChange={(event) => {
                        const profile = deviceSyncProfiles.find((item) => item.id === Number(event.target.value));
                        if (profile) {
                          applyDeviceSyncProfile(profile);
                        } else {
                          setDeviceSyncProfileId(null);
                        }
                      }}
                    >
                      <option value="">New profile</option>
                      {deviceSyncProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Profile Name</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={deviceSyncProfileName}
                      placeholder="Phone, USB stick, car player"
                      onChange={(event) => setDeviceSyncProfileName(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button self-end" type="button" onClick={() => void saveCurrentDeviceSyncProfile()}>
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button self-end" type="button" disabled={!deviceSyncProfileId} onClick={() => void deleteCurrentDeviceSyncProfile()}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Preset</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      defaultValue=""
                      onChange={(event) => {
                        const preset = deviceSyncPresets.find((item) => item.name === event.target.value);
                        if (preset) {
                          applyDeviceSyncProfile(preset);
                        }
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Load Android/USB preset</option>
                      {deviceSyncPresets.map((preset) => (
                        <option key={preset.name} value={preset.name}>{preset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Mounted Device</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      defaultValue=""
                      onChange={(event) => {
                        const device = deviceSyncDevices.find((item) => item.id === event.target.value);
                        if (device) {
                          useDetectedDevice(device);
                        }
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Use detected drive</option>
                      {deviceSyncDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.id} - {device.label} ({device.hint ?? "drive"})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button self-end" type="button" onClick={() => void loadDeviceSyncSupport()}>
                    <RefreshCw size={15} />
                    Refresh
                  </button>
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Target Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={deviceSyncTarget}
                  placeholder="Example: E:\\Music"
                  onChange={(event) => setDeviceSyncTarget(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Device Type</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={deviceSyncDeviceKind}
                    onChange={(event) => setDeviceSyncDeviceKind(event.target.value as DeviceSyncProfilePayload["device_kind"])}
                  >
                    <option value="folder">Folder</option>
                    <option value="usb">USB drive</option>
                    <option value="android_folder">Android folder</option>
                    <option value="android_mtp">Android MTP note</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Music Subfolder</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={deviceSyncMusicSubfolder}
                    placeholder="Music"
                    onChange={(event) => setDeviceSyncMusicSubfolder(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Playlist Subfolder</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={deviceSyncPlaylistSubfolder}
                    placeholder="Playlists"
                    onChange={(event) => setDeviceSyncPlaylistSubfolder(event.target.value)}
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Copy audio files</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncCopyFiles}
                    onChange={(event) => setDeviceSyncCopyFiles(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Export playlists</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncExportPlaylists}
                    onChange={(event) => setDeviceSyncExportPlaylists(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Preserve folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncPreserveStructure}
                    onChange={(event) => setDeviceSyncPreserveStructure(event.target.checked)}
                  />
                </label>
              </div>
              <div className="rounded border border-line bg-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs uppercase text-muted">Playlists</div>
                  <button
                    className="text-xs text-moss hover:text-white"
                    type="button"
                    onClick={() =>
                      setDeviceSyncPlaylistIds(
                        deviceSyncPlaylistIds.size === playlists.length
                          ? new Set()
                          : new Set(playlists.map((playlist) => playlist.id)),
                      )
                    }
                  >
                    {deviceSyncPlaylistIds.size === playlists.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="grid max-h-48 gap-1 overflow-auto pr-1">
                  {playlists.map((playlist) => (
                    <label key={playlist.id} className="flex items-center justify-between gap-3 rounded bg-panel px-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-200">{playlist.name}</span>
                        <span className="block truncate text-xs text-muted">{playlist.track_count.toLocaleString()} tracks</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss"
                        checked={deviceSyncPlaylistIds.has(playlist.id)}
                        onChange={() => toggleDeviceSyncPlaylist(playlist.id)}
                      />
                    </label>
                  ))}
                  {playlists.length === 0 && <div className="py-4 text-center text-xs text-muted">No playlists yet.</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(false))}>
                  <Eye size={15} />
                  Preview Sync
                </button>
                <button className="primary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(true))}>
                  <FolderOpen size={15} />
                  Sync Folder
                </button>
              </div>
              {deviceSyncPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {deviceSyncPreview.changed_files.toLocaleString()} files need copy,{" "}
                    {deviceSyncPreview.copied_files.toLocaleString()} copied,{" "}
                    {deviceSyncPreview.playlists_written.toLocaleString()} playlists written
                  </div>
                  {deviceSyncPreview.playlist_exports.length > 0 && (
                    <div className="mb-3 grid gap-1">
                      {deviceSyncPreview.playlist_exports.map((playlist) => (
                        <div key={playlist.playlist_id} className="rounded bg-panel px-2 py-1.5">
                          <div className={playlist.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {playlist.name} - {playlist.track_count.toLocaleString()} tracks
                          </div>
                          <div className="truncate text-muted">{playlist.error ?? playlist.playlist_path}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {deviceSyncPreview.changes.slice(0, 60).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-neutral-200">{change.title ?? change.source_path}</div>
                        <div className={change.error ? "truncate text-ember" : "truncate text-muted"}>
                          {change.error ?? change.target_path}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("audioConversion") && (
          <AudioConversionSection
            scopedTrackIds={scopedTrackIds}
            setup={audioConversionSetup}
            preview={audioConversionPreview}
            progress={audioConversionProgress}
            defaultTargetFolder={defaultAudioConversionTarget(folderPath)}
            onBrowseTarget={onBrowseAudioConversionTarget}
            onRefreshFfmpeg={onRefreshAudioConversionSetup}
            onInstallFfmpeg={onInstallAudioConversionFfmpeg}
            onPreview={onPreviewAudioConversion}
            onStart={onStartAudioConversion}
            onCancel={onCancelAudioConversion}
          />
          )}

          {showTool("libraryImporters") && <LibraryImportersSection setStatus={setStatus} />}


    </>
  );
}
