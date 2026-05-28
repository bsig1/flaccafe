import { useEffect } from "react";

import type { AppController } from "./AppController";
import { AppOverlays } from "./AppOverlays";
import { AppPageOutlet } from "./AppPageOutlet";
import { Sidebar } from "./components/Sidebar";
import type { SidebarSearchTarget } from "./components/sidebarSearch";
import {
  themeAccentValues,
} from "../config/theme";
import { closeFloatingMenus, listenForCloseFloatingMenus } from "./menuEvents";
import { PlayerBar } from "./player/PlayerBar";

type AppViewProps = {
  controller: AppController;
};

export function AppView({ controller }: AppViewProps) {
  const {
    activePage,
    autoPlayOnTrackChange,
    backendStatus,
    coffeeAnimating,
    currentRadioStation,
    currentTrack,
    externalTrackRequest,
    handleCoffeeClick,
    handleCommitExternalTrackRequest,
    handleOpenCurrentAlbumFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentArtistInfoFromPlayer,
    handleOpenCurrentTrackFromPlayer,
    handleOpenDetachedMiniPlayer,
    handleOpenLyricsViewFromPlayer,
    handleOpenQueueViewFromPlayer,
    handlePlayTrack,
    handleRating,
    handleSelectAlbum,
    handleSelectArtist,
    handleSelectPlaylist,
    handleTrackEnded,
    handleTrackSkipped,
    hasAnalysisIssue,
    openAppContextMenu,
    playbackMode,
    playbackQueue,
    queue,
    radioPlaybackRequestId,
    restoredPlaybackPosition,
    setActivePage,
    setAppContextMenu,
    setDetailTrack,
    setFileManagementFocusToolId,
    setLibraryView,
    setPlaybackMode,
    setPlaybackTime,
    setRestoredPlaybackPosition,
    setSearch,
    setSettingsFocusSection,
    setStatus,
    showCdPage,
    uiPreferences,
  } = controller;
  const themeDefaults = themeAccentValues[uiPreferences.themeAccent] ?? themeAccentValues.cafe;
  const sidebarWidthPx =
    uiPreferences.sidebarWidthPx === "theme" ? themeDefaults.sidebarWidthPx : uiPreferences.sidebarWidthPx;
  const sidebarPlacement = uiPreferences.sidebarPlacement;

  useEffect(() => listenForCloseFloatingMenus(() => setAppContextMenu(null)), [setAppContextMenu]);

  function openSidebarSearchTarget(target: SidebarSearchTarget) {
    if (target.kind === "settings") {
      setSettingsFocusSection(target.sectionId);
      setActivePage("settings");
      return;
    }
    if (target.kind === "fileManagement") {
      setFileManagementFocusToolId(target.toolId);
      setActivePage("fileManagement");
      return;
    }
    if (target.kind === "track") {
      setLibraryView("tracks");
      setSearch(target.label);
      setDetailTrack(target.track);
      setActivePage("library");
      return;
    }
    if (target.kind === "album") {
      setSearch("");
      setLibraryView("albums");
      setActivePage("library");
      void handleSelectAlbum(target.album.id);
      return;
    }
    if (target.kind === "artist") {
      setSearch("");
      setLibraryView("artists");
      setActivePage("library");
      void handleSelectArtist(target.artist.name);
      return;
    }
    if (target.kind === "playlist") {
      setSearch("");
      setLibraryView("playlists");
      setActivePage("library");
      void handleSelectPlaylist(target.playlist.id);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-neutral-100" onContextMenuCapture={closeFloatingMenus} onContextMenu={openAppContextMenu}>
      <AppOverlays controller={controller} />
      <div className={`relative flex min-h-0 flex-1 ${sidebarPlacement === "right" ? "flex-row-reverse" : ""}`}>
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          hasDiagnosticsIssue={backendStatus === "down"}
          hasAnalysisIssue={hasAnalysisIssue}
          showCdPage={showCdPage}
          sidebarWidthPx={sidebarWidthPx}
          sidebarPlacement={sidebarPlacement}
          librarySearchEnabled={backendStatus === "ok"}
          coffeeAnimating={coffeeAnimating}
          onCoffeeClick={handleCoffeeClick}
          onOpenSearchTarget={openSidebarSearchTarget}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppPageOutlet controller={controller} />
        </div>
      </div>
      <PlayerBar
        currentTrack={currentTrack}
        currentRadioStation={currentRadioStation}
        radioPlaybackRequestId={radioPlaybackRequestId}
        queue={playbackQueue}
        externalTrackRequest={externalTrackRequest}
        onSelectTrack={handlePlayTrack}
        onCommitExternalTrackRequest={handleCommitExternalTrackRequest}
        onTrackEnded={handleTrackEnded}
        onTrackSkipped={handleTrackSkipped}
        onPlaybackTime={setPlaybackTime}
        resumePositionSeconds={restoredPlaybackPosition}
        onResumePositionApplied={() => setRestoredPlaybackPosition(null)}
        onRating={handleRating}
        autoPlay={autoPlayOnTrackChange}
        fadeMs={uiPreferences.playerFadeMs}
        skipThresholdPercent={uiPreferences.skipThresholdPercent}
        playbackEngine={uiPreferences.playbackEngine}
        desktopOutputDeviceId={uiPreferences.desktopOutputDeviceId}
        desktopBufferFrames={uiPreferences.desktopBufferFrames}
        miniPlayer={false}
        replayGainMode={uiPreferences.replayGainMode}
        replayGainTargetVolumePercent={uiPreferences.replayGainTargetVolumePercent}
        replayGainPreampDb={uiPreferences.replayGainPreampDb}
        replayGainPreventClipping={uiPreferences.replayGainPreventClipping}
        equalizerEnabled={uiPreferences.equalizerEnabled}
        equalizerBandMode={uiPreferences.equalizerBandMode}
        equalizerPreampDb={uiPreferences.equalizerPreampDb}
        equalizerGains={uiPreferences.equalizerGains}
        dspLimiterEnabled={uiPreferences.dspLimiterEnabled}
        keyboardShortcuts={uiPreferences.keyboardShortcuts}
        playbackMode={playbackMode}
        setPlaybackMode={setPlaybackMode}
        onOpenMiniPlayer={handleOpenDetachedMiniPlayer}
        onOpenLyricsView={handleOpenLyricsViewFromPlayer}
        onOpenQueueView={handleOpenQueueViewFromPlayer}
        onOpenCurrentTrack={handleOpenCurrentTrackFromPlayer}
        onOpenCurrentArtist={handleOpenCurrentArtistFromPlayer}
        onOpenCurrentArtistInfo={handleOpenCurrentArtistInfoFromPlayer}
        onOpenCurrentAlbum={(track) => void handleOpenCurrentAlbumFromPlayer(track)}
        setStatus={setStatus}
      />
    </div>
  );
}
