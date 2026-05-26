import type { AppController } from "./AppController";
import { AppOverlays } from "./AppOverlays";
import { AppPageOutlet } from "./AppPageOutlet";
import { Sidebar } from "./components/Sidebar";
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
    handleOpenCurrentTrackFromPlayer,
    handleOpenDetachedMiniPlayer,
    handleOpenLyricsViewFromPlayer,
    handleOpenQueueViewFromPlayer,
    handlePlayTrack,
    handleRating,
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
    setPlaybackMode,
    setPlaybackTime,
    setRestoredPlaybackPosition,
    setStatus,
    showCdPage,
    uiPreferences,
  } = controller;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-neutral-100" onContextMenu={openAppContextMenu}>
      <AppOverlays controller={controller} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          hasDiagnosticsIssue={backendStatus === "down"}
          hasAnalysisIssue={hasAnalysisIssue}
          showCdPage={showCdPage}
          coffeeAnimating={coffeeAnimating}
          onCoffeeClick={handleCoffeeClick}
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
        onOpenCurrentAlbum={(track) => void handleOpenCurrentAlbumFromPlayer(track)}
        setStatus={setStatus}
      />
    </div>
  );
}
