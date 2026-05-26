import {
  Clock3,
  Coffee,
  ExternalLink,
  FileText,
  Library,
  Settings,
  UserRound,
  Wand2,
  X,
} from "lucide-react";

import type { AppController } from "./AppController";
import {
  DeleteTrackDialog,
  MetadataEditorModal,
} from "./components/modals";

type AppOverlaysProps = {
  controller: AppController;
};

export function AppOverlays({ controller }: AppOverlaysProps) {
  const {
    appContextMenu,
    confirmDeleteTracks,
    deletePrompt,
    handleCycleTheme,
    handleOpenDetachedMiniPlayer,
    handleSaveTrackMetadata,
    handleUndoAction,
    handleWriteRatingsToFiles,
    metadataEditInitialField,
    metadataEditTrack,
    setActivePage,
    setAppContextMenu,
    setDeletePrompt,
    setMetadataEditInitialField,
    setMetadataEditTrack,
    setUndoAction,
    status,
    uiPreferences,
    undoAction,
    writeRatingsToFiles,
  } = controller;

  return (
    <>
      {uiPreferences.showToasts && status && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded border border-line bg-panel px-4 py-3 text-sm text-white shadow-xl">
          {status}
        </div>
      )}
      {undoAction && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded border border-line bg-[rgb(var(--color-popover))] px-4 py-3 text-sm text-white shadow-2xl">
          <span className="text-muted">Removed {undoAction.label}</span>
          <button className="text-moss hover:text-white" type="button" onClick={() => void handleUndoAction()}>
            Undo
          </button>
          <button className="text-muted hover:text-white" type="button" onClick={() => setUndoAction(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {metadataEditTrack && (
        <MetadataEditorModal
          track={metadataEditTrack}
          initialField={metadataEditInitialField}
          writeToFiles={writeRatingsToFiles}
          onWriteToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
          onClose={() => {
            setMetadataEditTrack(null);
            setMetadataEditInitialField(null);
          }}
          onSave={handleSaveTrackMetadata}
        />
      )}
      {deletePrompt && (
        <DeleteTrackDialog
          prompt={deletePrompt}
          onCancel={() => setDeletePrompt(null)}
          onConfirm={confirmDeleteTracks}
        />
      )}
      {appContextMenu && (
        <div
          className="fixed z-[80] w-56 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: appContextMenu.x, top: appContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {(
            [
              ["library", "Library", Library],
              ["nowPlaying", "Now Playing", FileText],
              ["autodj", "AutoDJ", Wand2],
              ["artist", "Artist", UserRound],
              ["history", "History", Clock3],
              ["settings", "Settings", Settings],
            ] as const
          ).map(([page, label, Icon]) => (
            <button
              key={page}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
              type="button"
              onClick={() => {
                setActivePage(page);
                setAppContextMenu(null);
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => {
              setAppContextMenu(null);
              void handleOpenDetachedMiniPlayer();
            }}
          >
            <ExternalLink size={15} />
            Mini Player
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => {
              setAppContextMenu(null);
              handleCycleTheme();
            }}
          >
            <Coffee size={15} />
            Cycle Theme
          </button>
        </div>
      )}
    </>
  );
}
