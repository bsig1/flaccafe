import { RotateCcw } from "lucide-react";

import {
  DisclosureAccordionProvider,
} from "../../components/common";
import { CacheUndoLogSection } from "./CacheUndoLogSection";
import {
  FileManagementNavigator,
  fileManagementSections,
} from "./FileManagementNavigator";
import { OptionalDependenciesSection } from "./OptionalDependenciesSection";
import { ReportViewerSection } from "./ReportViewerSection";
import { VolumeTagsSection } from "./VolumeTagsSection";
import { FileManagementMetadataReviewSections } from "./FileManagementMetadataReviewSections";
import { FileManagementTagPreparationSections } from "./FileManagementTagPreparationSections";
import { FileManagementTransferSections } from "./FileManagementTransferSections";

export function FileManagementPageView({ model }: { model: any }) {
  const {
    onRefreshUndoLog, openFileManagementSection, setOpenFileManagementSection, scopedTrackIds, incomingTrackScopeIds, setToolTarget, onSelectLibraryTarget, visibleSectionIds, toolCategory, setToolCategory, toolSearch, setToolSearch, showTool, openSignalFor, initialFocusToolId,
    audioConversionSetup, audioConversionInstallProgress, clapStatus, clapInstallProgress, isClapInstalling, onRefreshAudioConversionSetup, onInstallAudioConversionFfmpeg, onRefreshClapStatus, onInstallClap, setStatus,
    onClearArtistCache, onClearLibraryCaches, onAdvancedTagLibraryChanged, onClearTrackScope, fileOrganizationReport, metadataCsvImportReport, duplicateActionResult, reportPath, setReportPath, reportFile, onReadReportFile, bulkUndoLog, bulkUndoBatches, bulkUndoRestoreResult, onRestoreUndoEntry, onRestoreUndoBatch,
  } = model;

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
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
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
              <div className="flex flex-wrap justify-end gap-2">
                {incomingTrackScopeIds.length > 0 && !scopedTrackIds.length && (
                  <button className="secondary-button h-9" type="button" onClick={() => setToolTarget("selected")}>
                    Use Selected
                  </button>
                )}
                <button className="secondary-button h-9" type="button" onClick={() => onSelectLibraryTarget("tracks")}>
                  Choose Tracks
                </button>
                <button className="secondary-button h-9" type="button" onClick={() => onSelectLibraryTarget("albums")}>
                  Choose Albums
                </button>
                <button
                  className="secondary-button h-9"
                  type="button"
                  disabled={!scopedTrackIds.length}
                  onClick={() => setToolTarget("tool-default")}
                >
                  Clear
                </button>
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
