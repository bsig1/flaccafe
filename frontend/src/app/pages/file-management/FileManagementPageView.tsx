import { ListChecks,RotateCcw } from "lucide-react";

import {
DisclosureAccordionProvider,
} from "../../components/common";
import { CacheUndoLogSection } from "./CacheUndoLogSection";
import { FileManagementMetadataReviewSections } from "./FileManagementMetadataReviewSections";
import {
FileManagementNavigator,
fileManagementSections,
} from "./FileManagementNavigator";
import { FileManagementTagPreparationSections } from "./FileManagementTagPreparationSections";
import { FileManagementTransferSections } from "./FileManagementTransferSections";
import { OptionalDependenciesSection } from "./OptionalDependenciesSection";
import { ReportViewerSection } from "./ReportViewerSection";
import { VolumeTagsSection } from "./VolumeTagsSection";

type OperationQueueItem = {
  key: string;
  title: string;
  detail: string;
  status: "running" | "done" | "waiting" | "issue";
  percent: number | null;
};

function buildOperationQueue(model: any): OperationQueueItem[] {
  const items: OperationQueueItem[] = [];
  const audioProgress = model.audioConversionProgress;
  if (audioProgress) {
    const done = ["completed", "canceled"].includes(audioProgress.status);
    items.push({
      key: "audio-conversion",
      title: "Audio conversion",
      detail: audioProgress.message ?? `${audioProgress.processed_tracks ?? 0} of ${audioProgress.total_tracks ?? 0} tracks`,
      status: audioProgress.status === "failed" ? "issue" : done ? "done" : "running",
      percent: Math.max(0, Math.min(100, Number(audioProgress.percent ?? 0))),
    });
  }
  if (model.autoTagProgress) {
    const progress = model.autoTagProgress;
    items.push({
      key: "musicbrainz-tags",
      title: progress.phase === "apply" ? "MusicBrainz apply" : "MusicBrainz preview",
      detail: progress.label,
      status: progress.completed >= progress.total ? "done" : "running",
      percent: progress.total > 0 ? Math.max(2, Math.min(100, (progress.completed / progress.total) * 100)) : null,
    });
  }
  if (model.fileWriteBusy || model.fileWritePreview) {
    items.push({
      key: "sqlite-file-tags",
      title: "SQLite tags to files",
      detail: model.fileWriteBusy
        ? "Writing supported audio tags"
        : `${model.fileWritePreview?.changed ?? 0} pending, ${model.fileWritePreview?.applied ?? 0} written`,
      status: model.fileWriteBusy ? "running" : "done",
      percent: model.fileWriteBusy ? null : 100,
    });
  }
  if (model.fileOrganizationPreview) {
    items.push({
      key: "file-organization",
      title: "File organization",
      detail: `${model.fileOrganizationPreview.changed_count.toLocaleString()} moves, ${model.fileOrganizationPreview.applied.toLocaleString()} applied`,
      status: model.fileOrganizationPreview.applied > 0 ? "done" : "waiting",
      percent: model.fileOrganizationPreview.total > 0
        ? Math.min(100, Math.max(2, (model.fileOrganizationPreview.applied / model.fileOrganizationPreview.total) * 100))
        : 100,
    });
  }
  if (model.duplicateActionResult) {
    items.push({
      key: "duplicate-action",
      title: "Duplicate cleanup",
      detail: `${model.duplicateActionResult.affected.toLocaleString()} affected, ${model.duplicateActionResult.deleted_files.toLocaleString()} files recycled`,
      status: model.duplicateActionResult.errors.length ? "issue" : "done",
      percent: 100,
    });
  }
  if (model.metadataCsvImportReport) {
    items.push({
      key: "metadata-csv",
      title: "Metadata CSV import",
      detail: `${model.metadataCsvImportReport.changed.toLocaleString()} changed from ${model.metadataCsvImportReport.total.toLocaleString()} rows`,
      status: model.metadataCsvImportReport.errors > 0 ? "issue" : "done",
      percent: 100,
    });
  }
  return items;
}

function OperationQueuePanel({ items }: { items: OperationQueueItem[] }) {
  const visibleItems = items.slice(0, 6);
  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ListChecks size={15} />
            Operations Queue
          </div>
          <div className="text-xs text-muted">Moves, deletes, tag writes, imports, and conversions in one place.</div>
        </div>
        <span className="rounded border border-line bg-ink px-2 py-1 text-xs text-muted">
          {visibleItems.length.toLocaleString()} visible
        </span>
      </div>
      <div className="grid gap-2">
        {visibleItems.map((item) => (
          <div key={item.key} className="grid gap-1 rounded border border-line/70 bg-ink px-3 py-2">
            <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-neutral-100">{item.title}</span>
              <span
                className={`rounded border px-2 py-0.5 uppercase ${
                  item.status === "running"
                    ? "border-moss/40 bg-moss/10 text-moss"
                    : item.status === "issue"
                      ? "border-ember/40 bg-ember/10 text-ember"
                      : "border-line bg-panel text-muted"
                }`}
              >
                {item.status}
              </span>
            </div>
            <div className="truncate text-xs text-muted">{item.detail}</div>
            <div className="h-1.5 overflow-hidden rounded bg-panel">
              <div
                className={`h-full rounded ${item.status === "issue" ? "bg-ember" : "bg-moss"} ${item.percent === null ? "w-1/3 animate-pulse" : ""}`}
                style={item.percent === null ? undefined : { width: `${item.percent}%` }}
              />
            </div>
          </div>
        ))}
        {visibleItems.length === 0 && (
          <div className="rounded border border-dashed border-line bg-ink px-3 py-6 text-center text-xs text-muted">
            Operations will appear here as tools preview, apply, move, recycle, write tags, or convert files.
          </div>
        )}
      </div>
    </div>
  );
}

export function FileManagementPageView({ model }: { model: any }) {
  const {
    onRefreshUndoLog, openFileManagementSection, setOpenFileManagementSection, scopedTrackIds, incomingTrackScopeIds, setToolTarget, visibleSectionIds, toolCategory, setToolCategory, toolSearch, setToolSearch, showTool, openSignalFor, initialFocusToolId,
    targetSearch, setTargetSearch, targetSearchBusy, targetSearchResults, searchLibraryTargets, appendLibraryTarget, trackScopeText, setTrackScopeText, removeScopedTrackId,
    audioConversionSetup, audioConversionInstallProgress, clapStatus, clapInstallProgress, isClapInstalling, onRefreshAudioConversionSetup, onInstallAudioConversionFfmpeg, onRefreshClapStatus, onInstallClap, setStatus,
    onClearArtistCache, onClearLibraryCaches, onAdvancedTagLibraryChanged, fileOrganizationReport, metadataCsvImportReport, duplicateActionResult, reportPath, setReportPath, reportFile, onReadReportFile, bulkUndoLog, bulkUndoBatches, bulkUndoRestoreResult, onRestoreUndoEntry, onRestoreUndoBatch,
  } = model;
  const operationQueueItems = buildOperationQueue(model);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">File Management</h1>
          <p className="text-xs text-muted">Batch cleanup, duplicate review, metadata import, and safe file moves.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void onRefreshUndoLog()}>
          <RotateCcw size={15} />
          Refresh Log
        </button>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <DisclosureAccordionProvider
          openSectionId={openFileManagementSection}
          onOpenSectionChange={setOpenFileManagementSection}
        >
        <div className="grid max-w-6xl gap-5">
          <div className="rounded border border-line bg-panel p-4">
            <div className="grid gap-4">
              <div>
                <div className="text-xs uppercase text-muted">Current Target</div>
                <div className="mt-1 text-sm font-medium text-neutral-100">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} selected track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Tool defaults"}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {scopedTrackIds.length
                    ? "Scoped tools will only act on those tracks until you clear the target."
                    : "Each tool chooses its normal safe target, usually recent or missing-metadata tracks."}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className="h-9 rounded border border-line bg-ink px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={targetSearch}
                      placeholder="Search tracks, albums, or artists to append"
                      onChange={(event) => setTargetSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void searchLibraryTargets();
                        }
                      }}
                    />
                    <button className="secondary-button h-9" type="button" disabled={targetSearchBusy} onClick={() => void searchLibraryTargets()}>
                      {targetSearchBusy ? "Searching" : "Search"}
                    </button>
                  </div>
                  <div className="grid max-h-48 gap-1 overflow-auto pr-1">
                    {targetSearchResults.map((result: any) => (
                      <button
                        key={result.key}
                        className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded border border-line/60 bg-ink px-2 py-1.5 text-left text-xs transition hover:border-moss/40 hover:bg-white/[0.035]"
                        type="button"
                        onClick={() => void appendLibraryTarget(result)}
                      >
                        <span className="rounded border border-line bg-panel px-2 py-0.5 text-center uppercase text-muted">{result.kind}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-100">{result.label}</span>
                          <span className="block truncate text-muted">{result.description}</span>
                        </span>
                        <span className="text-moss">Add</span>
                      </button>
                    ))}
                    {targetSearchResults.length === 0 && (
                      <div className="rounded border border-dashed border-line bg-ink px-3 py-4 text-center text-xs text-muted">
                        Search adds tracks directly; albums and artists add all local tracks they contain.
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <textarea
                    className="min-h-24 rounded border border-line bg-ink px-3 py-2 text-xs text-neutral-100 outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={trackScopeText}
                    placeholder="Editable target track IDs"
                    onChange={(event) => setTrackScopeText(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {incomingTrackScopeIds.length > 0 && !scopedTrackIds.length && (
                      <button className="secondary-button h-8" type="button" onClick={() => setToolTarget("selected")}>
                        Use Selected
                      </button>
                    )}
                    <button
                      className="secondary-button h-8"
                      type="button"
                      disabled={!scopedTrackIds.length}
                      onClick={() => setToolTarget("tool-default")}
                    >
                      Clear
                    </button>
                  </div>
                  {scopedTrackIds.length > 0 && (
                    <div className="flex max-h-20 flex-wrap gap-1 overflow-auto">
                      {scopedTrackIds.slice(0, 60).map((trackId: number) => (
                        <button
                          key={trackId}
                          className="rounded border border-line bg-ink px-2 py-0.5 text-xs text-muted transition hover:border-ember/60 hover:text-ember"
                          type="button"
                          title="Remove target"
                          onClick={() => removeScopedTrackId(trackId)}
                        >
                          {trackId}
                        </button>
                      ))}
                      {scopedTrackIds.length > 60 && (
                        <span className="rounded border border-line bg-ink px-2 py-0.5 text-xs text-muted">
                          +{(scopedTrackIds.length - 60).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <FileManagementNavigator
            sections={fileManagementSections}
            visibleSectionIds={visibleSectionIds}
            activeCategory={toolCategory}
            setActiveCategory={setToolCategory}
            query={toolSearch}
            setQuery={setToolSearch}
          />

          <OperationQueuePanel items={operationQueueItems} />

          {visibleSectionIds.size === 0 && (
            <div className="rounded border border-dashed border-line bg-panel px-4 py-8 text-center text-sm text-muted">
              No file-management tools match that filter.
            </div>
          )}

          {showTool("optionalDependencies") && (
            <OptionalDependenciesSection
              audioConversionSetup={audioConversionSetup}
              audioConversionInstallProgress={audioConversionInstallProgress}
              clapStatus={clapStatus}
              clapInstallProgress={clapInstallProgress}
              isClapInstalling={isClapInstalling}
              defaultOpen={initialFocusToolId === "optionalDependencies"}
              openSignal={openSignalFor("optionalDependencies") ?? undefined}
              onRefreshAudioConversionSetup={onRefreshAudioConversionSetup}
              onInstallAudioConversionFfmpeg={onInstallAudioConversionFfmpeg}
              onRefreshClapStatus={onRefreshClapStatus}
              onInstallClap={onInstallClap}
              setStatus={setStatus}
            />
          )}

          <FileManagementTagPreparationSections model={model} />
          {showTool("volumeTags") && (
          <VolumeTagsSection
            scopedTrackIds={scopedTrackIds}
            ffmpegSetup={audioConversionSetup}
            defaultOpen={initialFocusToolId === "volumeTags"}
            openSignal={openSignalFor("volumeTags") ?? undefined}
            onRefreshFfmpeg={onRefreshAudioConversionSetup}
            onInstallFfmpeg={onInstallAudioConversionFfmpeg}
            onLibraryChanged={onAdvancedTagLibraryChanged}
            setStatus={setStatus}
          />
          )}

          <FileManagementTransferSections model={model} />
          <FileManagementMetadataReviewSections model={model} />
          {showTool("reportViewer") && (
          <ReportViewerSection
            reportPath={reportPath}
            setReportPath={setReportPath}
            fileOrganizationReport={fileOrganizationReport}
            metadataCsvImportReport={metadataCsvImportReport}
            duplicateActionResult={duplicateActionResult}
            reportFile={reportFile}
            onReadReportFile={onReadReportFile}
          />
          )}

          {showTool("cacheUndo") && (
          <CacheUndoLogSection
            bulkUndoLog={bulkUndoLog}
            bulkUndoBatches={bulkUndoBatches}
            bulkUndoRestoreResult={bulkUndoRestoreResult}
            onRefreshUndoLog={onRefreshUndoLog}
            onRestoreUndoEntry={onRestoreUndoEntry}
            onRestoreUndoBatch={onRestoreUndoBatch}
            onClearArtistCache={onClearArtistCache}
            onClearLibraryCaches={onClearLibraryCaches}
          />
          )}
        </div>
        </DisclosureAccordionProvider>
      </section>
    </main>
  );
}
