import type { AppController } from "./AppController";
import {
  defaultCdRipTarget,
  defaultLibraryTrackQueryKey,
} from "./appHelpers";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ArtistPage } from "./pages/ArtistPage";
import { AudiobooksPage } from "./pages/AudiobooksPage";
import { AutoDjPage } from "./pages/AutoDjPage";
import { BackendRecoveryPage } from "./pages/BackendRecoveryPage";
import { CdPage } from "./pages/CdPage";
import { FileManagementPage } from "./pages/FileManagementPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NowPlayingPage } from "./pages/NowPlayingPage";
import { PodcastsPage } from "./pages/PodcastsPage";
import { RadioPage } from "./pages/RadioPage";
import { ScrobblingPage } from "./pages/ScrobblingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";

type AppPageOutletProps = {
  controller: AppController;
};

export function AppPageOutlet({ controller }: AppPageOutletProps) {
  const {
    acousticFingerprintResult,
    activePage,
    advancedTrackSearch,
    albums,
    artistInfo,
    artists,
    artistTracks,
    audioAnalysisCoverage,
    audioAnalysisEligibleTrackTotal,
    audioAnalysisLimit,
    audioAnalysisOnlyMissing,
    audioAnalysisOverwrite,
    audioAnalysisProgress,
    audioConversionInstallProgress,
    audioConversionPreview,
    audioConversionProgress,
    audioConversionSetup,
    autoDjAvoidRules,
    autoTagPreview,
    autoWriteFetchedLyricsSidecars,
    backendCheckedAt,
    backendLog,
    backendMessage,
    backendStatus,
    bulkUndoBatches,
    bulkUndoLog,
    bulkUndoRestoreResult,
    cdAutoLookupMetadata,
    checkBackendStatus,
    chromaprintSetup,
    clapCacheDir,
    clapInstallProgress,
    clapMaxDuration,
    clapModelId,
    clapStatus,
    clapStatusLoadMessage,
    clapStatusLoadPercent,
    continuousAutoDjBusy,
    continuousAutoDjEnabled,
    currentCdPlaybackDriveId,
    currentLibraryTrackQueryKey,
    currentRadioStation,
    currentTrack,
    detailTrack,
    deviceSyncPreview,
    dismissQuickStart,
    duplicateActionResult,
    duplicateReview,
    fileManagementFocusToolId,
    fileManagementScopeIds,
    filenameTagPreview,
    fileOrganizationPreview,
    fileOrganizationReport,
    folderPath,
    folderWatchStatus,
    handleAcknowledgeFolderWatchNotifications,
    handleAcoustIdApiKeyChange,
    handleAddToQueue,
    handleAddTracksToPlaylist,
    handleAdvancedTagLibraryChanged,
    handleAnalyzeAudio,
    handleAnalyzeTracks,
    handleApplyAutoTag,
    handleApplyFilenameTags,
    handleApplyFileOrganization,
    handleApplyFolderWatch,
    handleApplyMetadataCsv,
    handleApplyTagRegex,
    handleAutoWriteFetchedLyricsSidecars,
    handleAvoidAutoDj,
    handleBackupDatabase,
    handleBrowseAudioConversionTarget,
    handleBrowseCdRipTarget,
    handleBrowseFolder,
    handleBulkMetadata,
    handleBulkRating,
    handleCancelAudioAnalysis,
    handleCancelAudioConversion,
    handleCdAutoLookupMetadata,
    handleChooseMusicFolderAndScan,
    handleClearArtistCache,
    handleClearIgnoredDuplicateGroups,
    handleClearLibraryCaches,
    handleClearPlaybackQueue,
    handleContinuousAutoDjChange,
    handleCopySupportBundlePath,
    handleCreatePlaylist,
    handleCreateSupportBundle,
    handleDeleteAutoDjAvoidRule,
    handleDeleteInboxAutoReviewRule,
    handleDeletePlaylist,
    handleDeleteRecommendationProfile,
    handleDeleteTrack,
    handleDeviceSync,
    handleDuplicateAction,
    handleExportFileOrganizationReport,
    handleExportMetadataCsv,
    handleExportMetadataCsvReport,
    handleExportPlaylist,
    handleExportTracks,
    handleFetchLyrics,
    handleIgnoreDuplicateGroup,
    handleImportPlaylist,
    handleInstallAudioConversionFfmpeg,
    handleInstallClap,
    handleLastFmApiCredentialsChange,
    handleLibraryAutoTagTracks,
    handleLibraryClapGenreTagTracks,
    handleLibraryFingerprintTagTracks,
    handleLibraryVolumeTagTracks,
    handleLoadDuplicateReview,
    handleMovePlaybackQueueTrack,
    handleMovePlaylistTrack,
    handleOpenBackendLog,
    handleOpenCurrentAlbumFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentTrackFromPlayer,
    handleOpenExternalUrl,
    handleOpenFileManagementForTracks,
    handleOpenOptionalDependencies,
    handleOpenSourceFolder,
    handlePauseAudioAnalysis,
    handlePlayAlbum,
    handlePlayArtist,
    handlePlayCdPreviewTrack,
    handlePlayNext,
    handlePlayRadioStation,
    handlePlayTrack,
    handlePreviewAudioConversion,
    handlePreviewAutoTag,
    handlePreviewFilenameTags,
    handlePreviewFileOrganization,
    handlePreviewMetadataCsv,
    handlePreviewTagRegex,
    handleQuickAutoDj,
    handleRating,
    handleReadReportFile,
    handleRefreshFolderWatch,
    handleRemoveLibrarySource,
    handleRemovePlaybackQueueTrack,
    handleRemoveTrackFromPlaylist,
    handleRemoveTracksFromPlaylist,
    handleReorderPlaybackQueueTrack,
    handleResetLocalData,
    handleRestartBackend,
    handleRestoreBulkUndoBatch,
    handleRestoreBulkUndoEntry,
    handleRestorePlaybackQueue,
    handleResumeAudioAnalysis,
    handleRevealTrack,
    handleRevealTracksByIds,
    handleReviewInboxTracks,
    handleRunAcousticFingerprintPass,
    handleSaveAudioConversionSetup,
    handleSaveChromaprintSetup,
    handleSaveClapConfig,
    handleSaveInboxAutoReviewRule,
    handleSaveLyrics,
    handleSavePlaybackQueue,
    handleSaveRecommendationProfile,
    handleScan,
    handleSelectAlbum,
    handleSelectArtist,
    handleSelectPlaylist,
    handleSetDefaultRecommendationProfile,
    handleShuffleTracks,
    handleStartAudioConversion,
    handleStartFolderWatch,
    handleStopFolderWatch,
    handleStopRadioStation,
    handleSyncFileMetadata,
    handleUpdateInboxNote,
    handleUseSuggestedFolder,
    handleWriteRatingsToFiles,
    hasLoadedInitialLibrary,
    hasMoreTracks,
    hideFilePaths,
    historyEvents,
    historyStats,
    importPlaylistPath,
    inbox,
    isArtistLoading,
    isAudioAnalyzing,
    isCdPlaybackActive,
    isClapInstalling,
    isClapStatusLoading,
    isLibraryLoading,
    isLyricsLoading,
    isScanning,
    libraryAlbumScrollTop,
    libraryArtistScrollTop,
    libraryCompletionScrollTop,
    libraryFolders,
    libraryHealth,
    libraryPlaylistScrollTop,
    libraryScrollTop,
    librarySort,
    libraryStats,
    libraryTotal,
    libraryView,
    libraryVisibleColumns,
    loadAlbums,
    loadAnalysisClapReadiness,
    loadArtistInfo,
    loadAudioConversionSetup,
    loadBulkUndoLog,
    loadChromaprintSetup,
    loadClapStatus,
    loadHistory,
    loadMoreTracks,
    loadRecommendationHistory,
    loadRecommendationProfiles,
    loadStartupDiagnostics,
    loadTrackWindow,
    lyrics,
    metadataCsvExport,
    metadataCsvImportPreview,
    metadataCsvImportReport,
    newPlaylistName,
    openApiKeysSettings,
    openMetadataEditor,
    playbackQueue,
    playbackTime,
    playlists,
    queue,
    queueHistory,
    queueUpcomingPlaybackTracks,
    quickStartDismissed,
    recommendationDrift,
    recommendationHistory,
    recommendationProfiles,
    refreshTracks,
    reportFile,
    requestDeleteTracks,
    scanProgress,
    scanResult,
    search,
    selectedAlbumId,
    selectedAlbumTracks,
    selectedArtistName,
    selectedArtistTracks,
    selectedPlaylistId,
    selectedPlaylistTracks,
    setActivePage,
    setAdvancedTrackSearch,
    setAudioAnalysisLimit,
    setAudioAnalysisOnlyMissing,
    setAudioAnalysisOverwrite,
    setClapCacheDir,
    setClapMaxDuration,
    setClapModelId,
    setContinuousAutoDjSettings,
    setDetailTrack,
    setFileManagementScopeIds,
    setFolderPath,
    setHideFilePaths,
    setImportPlaylistPath,
    setLibraryAlbumScrollTop,
    setLibraryArtistScrollTop,
    setLibraryCompletionScrollTop,
    setLibraryFolders,
    setLibraryPlaylistScrollTop,
    setLibraryScrollTop,
    setLibrarySort,
    setLibraryView,
    setLibraryVisibleColumns,
    setNewPlaylistName,
    setQueue,
    setRecommendationDrift,
    setSearch,
    setSettingsFocusSection,
    setStatus,
    setTargetPlaylistId,
    settings,
    settingsFocusSection,
    setUiPreferences,
    startupDiagnostics,
    supportBundlePath,
    tagRegexPreview,
    targetPlaylistId,
    trackIndexCache,
    tracks,
    uiPreferences,
    writeRatingsToFiles,
  } = controller;

  return (
  <div className="min-h-0 flex flex-1">
    {backendStatus === "down" ? (
      <BackendRecoveryPage
        backendMessage={backendMessage}
        backendCheckedAt={backendCheckedAt}
        onCheckBackend={() => void checkBackendStatus(true)}
        onRestartBackend={() => void handleRestartBackend()}
        onOpenBackendLog={() => void handleOpenBackendLog()}
      />
    ) : activePage === "library" ? (
      <LibraryPage
        tracks={tracks}
        trackIndexCache={trackIndexCache}
        totalTracks={libraryTotal}
        albums={albums}
        artists={artists}
        playlists={playlists}
        selectedAlbumId={selectedAlbumId}
        selectedAlbumTracks={selectedAlbumTracks}
        selectedArtistName={selectedArtistName}
        selectedArtistTracks={selectedArtistTracks}
        selectedPlaylistId={selectedPlaylistId}
        selectedPlaylistTracks={selectedPlaylistTracks}
        libraryStats={libraryStats}
        libraryHealth={libraryHealth}
        inbox={inbox}
        targetPlaylistId={targetPlaylistId}
        newPlaylistName={newPlaylistName}
        importPlaylistPath={importPlaylistPath}
        libraryView={libraryView}
        setLibraryView={setLibraryView}
        search={search}
        setSearch={setSearch}
        advancedTrackSearch={advancedTrackSearch}
        setAdvancedTrackSearch={setAdvancedTrackSearch}
        refreshTracks={refreshTracks}
        refreshAlbums={loadAlbums}
        loadMoreTracks={loadMoreTracks}
        loadTrackWindow={loadTrackWindow}
        isLoading={isLibraryLoading}
        hasMoreTracks={hasMoreTracks}
        sort={librarySort}
        setSort={setLibrarySort}
        scrollTop={libraryScrollTop}
        setScrollTop={setLibraryScrollTop}
        artistScrollTop={libraryArtistScrollTop}
        setArtistScrollTop={setLibraryArtistScrollTop}
        albumScrollTop={libraryAlbumScrollTop}
        setAlbumScrollTop={setLibraryAlbumScrollTop}
        completionScrollTop={libraryCompletionScrollTop}
        setCompletionScrollTop={setLibraryCompletionScrollTop}
        playlistScrollTop={libraryPlaylistScrollTop}
        setPlaylistScrollTop={setLibraryPlaylistScrollTop}
        onRating={handleRating}
        onBulkRating={handleBulkRating}
        onPlayTrack={handlePlayTrack}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onSelectAlbum={handleSelectAlbum}
        onSelectArtist={handleSelectArtist}
        onPlayAlbum={handlePlayAlbum}
        onPlayArtist={handlePlayArtist}
        onSelectPlaylist={handleSelectPlaylist}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onAddTracksToPlaylist={handleAddTracksToPlaylist}
        onDeleteTrack={handleDeleteTrack}
        onEditTrack={openMetadataEditor}
        onBulkMetadata={handleBulkMetadata}
        onAutoTagTracks={handleLibraryAutoTagTracks}
        onSyncFileMetadata={handleSyncFileMetadata}
        onFingerprintTagTracks={handleLibraryFingerprintTagTracks}
        onClapGenreTagTracks={handleLibraryClapGenreTagTracks}
        onVolumeTagTracks={handleLibraryVolumeTagTracks}
        onOpenFileManagementTracks={handleOpenFileManagementForTracks}
        onRequestDeleteTracks={requestDeleteTracks}
        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
        onRemoveTracksFromPlaylist={handleRemoveTracksFromPlaylist}
        onMovePlaylistTrack={handleMovePlaylistTrack}
        onExportTracks={handleExportTracks}
        onExportPlaylist={handleExportPlaylist}
        onImportPlaylist={handleImportPlaylist}
        onReviewInboxTracks={handleReviewInboxTracks}
        onUpdateInboxNote={handleUpdateInboxNote}
        onSaveInboxAutoReviewRule={handleSaveInboxAutoReviewRule}
        onDeleteInboxAutoReviewRule={handleDeleteInboxAutoReviewRule}
        onShuffleTracks={handleShuffleTracks}
        onQuickAutoDj={handleQuickAutoDj}
        onAvoidAutoDj={handleAvoidAutoDj}
        onRevealTrack={handleRevealTrack}
        detailTrack={detailTrack}
        setDetailTrack={setDetailTrack}
        onAnalyzeTracks={handleAnalyzeTracks}
        onIgnoreDuplicateGroup={handleIgnoreDuplicateGroup}
        onClearIgnoredDuplicateGroups={handleClearIgnoredDuplicateGroups}
        isAudioAnalyzing={isAudioAnalyzing}
        currentTrackId={currentTrack?.id ?? null}
        currentTrack={currentTrack}
        hideFilePaths={hideFilePaths}
        compactRows={uiPreferences.compactLibraryRows}
        albumGrid={uiPreferences.albumGrid}
        writeRatingsToFiles={writeRatingsToFiles}
        libraryVisibleColumns={libraryVisibleColumns}
        setLibraryVisibleColumns={setLibraryVisibleColumns}
        onAlbumGridChange={(enabled) => setUiPreferences((current) => ({ ...current, albumGrid: enabled }))}
        setTargetPlaylistId={setTargetPlaylistId}
        setNewPlaylistName={setNewPlaylistName}
        setImportPlaylistPath={setImportPlaylistPath}
        showQuickStart={
          hasLoadedInitialLibrary &&
          !quickStartDismissed &&
          currentLibraryTrackQueryKey() === defaultLibraryTrackQueryKey() &&
          (libraryStats?.total_tracks ?? libraryTotal) === 0
        }
        isScanning={isScanning}
        suggestedMusicPath={settings?.suggested_music_path}
        onChooseMusicFolder={() => void handleChooseMusicFolderAndScan()}
        onUseSuggestedFolder={(path) => void handleUseSuggestedFolder(path)}
        onDismissQuickStart={dismissQuickStart}
        onOpenSettings={() => setActivePage("settings")}
      />
    ) : activePage === "analysis" ? (
      <AnalysisPage
        clapStatus={clapStatus}
        coverage={audioAnalysisCoverage}
        eligibleTrackTotal={audioAnalysisEligibleTrackTotal}
        progress={audioAnalysisProgress}
        audioAnalysisLimit={audioAnalysisLimit}
        setAudioAnalysisLimit={setAudioAnalysisLimit}
        audioAnalysisOverwrite={audioAnalysisOverwrite}
        setAudioAnalysisOverwrite={setAudioAnalysisOverwrite}
        audioAnalysisOnlyMissing={audioAnalysisOnlyMissing}
        setAudioAnalysisOnlyMissing={setAudioAnalysisOnlyMissing}
        isAudioAnalyzing={isAudioAnalyzing}
        currentTrack={currentTrack}
        clapModelId={clapModelId}
        setClapModelId={setClapModelId}
        clapCacheDir={clapCacheDir}
        setClapCacheDir={setClapCacheDir}
        clapMaxDuration={clapMaxDuration}
        setClapMaxDuration={setClapMaxDuration}
        installProgress={clapInstallProgress}
        isClapStatusLoading={isClapStatusLoading}
        clapStatusLoadPercent={clapStatusLoadPercent}
        clapStatusLoadMessage={clapStatusLoadMessage}
        isClapInstalling={isClapInstalling}
        onRefresh={() => {
          void loadAnalysisClapReadiness(true);
        }}
        onInstallClap={(device, force) => void handleInstallClap(device, force)}
        onSaveClapConfig={handleSaveClapConfig}
        onAnalyzeLibrary={() => void handleAnalyzeAudio()}
        onAnalyzeCurrentTrack={() => currentTrack && handleAnalyzeTracks([currentTrack.id])}
        onPause={() => void handlePauseAudioAnalysis()}
        onResume={() => void handleResumeAudioAnalysis()}
        onCancel={() => void handleCancelAudioAnalysis()}
      />
    ) : activePage === "nowPlaying" ? (
      <NowPlayingPage
        currentTrack={currentTrack}
        lyrics={lyrics}
        isLyricsLoading={isLyricsLoading}
        playbackTime={playbackTime}
        queue={playbackQueue}
        uiPreferences={uiPreferences}
        setUiPreferences={setUiPreferences}
        onFetchLyrics={handleFetchLyrics}
        onSaveLyrics={handleSaveLyrics}
        onPlayTrack={handlePlayTrack}
        onMoveQueueTrack={handleMovePlaybackQueueTrack}
        onReorderQueueTrack={handleReorderPlaybackQueueTrack}
        onRemoveQueueTrack={handleRemovePlaybackQueueTrack}
        onClearQueue={handleClearPlaybackQueue}
        onSaveQueue={handleSavePlaybackQueue}
        onRestoreQueue={handleRestorePlaybackQueue}
        canRestoreQueue={queueHistory.length > 0}
        onOpenCurrentTrack={handleOpenCurrentTrackFromPlayer}
        onOpenCurrentArtist={handleOpenCurrentArtistFromPlayer}
        onOpenCurrentAlbum={(track) => void handleOpenCurrentAlbumFromPlayer(track)}
      />
    ) : activePage === "artist" ? (
      <ArtistPage
        currentTrack={currentTrack}
        artistInfo={artistInfo}
        artistTracks={artistTracks}
        isArtistLoading={isArtistLoading}
        onRefresh={() => void loadArtistInfo(true)}
        onPlayTrack={handlePlayTrack}
        onOpenExternalUrl={(url) => void handleOpenExternalUrl(url)}
      />
    ) : activePage === "audiobooks" ? (
      <AudiobooksPage
        setStatus={setStatus}
        onPlayTrack={handlePlayTrack}
        onAddToQueue={handleAddToQueue}
      />
    ) : activePage === "podcasts" ? (
      <PodcastsPage
        setStatus={setStatus}
        onPlayTrack={handlePlayTrack}
        onAddToQueue={handleAddToQueue}
        showFilePaths={uiPreferences.showPodcastFilePaths}
      />
    ) : activePage === "radio" ? (
      <RadioPage
        setStatus={setStatus}
        playingStationId={currentRadioStation?.id ?? null}
        onPlayStation={handlePlayRadioStation}
        onStopStation={handleStopRadioStation}
      />
    ) : activePage === "scrobbling" ? (
      <ScrobblingPage setStatus={setStatus} onOpenApiKeysSettings={openApiKeysSettings} />
    ) : activePage === "cd" ? (
      <CdPage
        currentCdPlaybackDriveId={currentCdPlaybackDriveId}
        cdAutoLookupMetadata={cdAutoLookupMetadata}
        defaultTargetFolder={defaultCdRipTarget(folderPath)}
        isCdPlaybackActive={isCdPlaybackActive}
        onBrowseTarget={handleBrowseCdRipTarget}
        onOpenOptionalDependencies={handleOpenOptionalDependencies}
        onPlayPreviewTrack={handlePlayCdPreviewTrack}
        setStatus={setStatus}
      />
    ) : activePage === "history" ? (
      <HistoryPage
        events={historyEvents}
        stats={libraryStats}
        historyStats={historyStats}
        onPlayTrack={handlePlayTrack}
        onRefresh={() => void loadHistory()}
      />
    ) : activePage === "autodj" ? (
      <AutoDjPage
        queue={queue}
        setQueue={setQueue}
        setRecommendationDrift={setRecommendationDrift}
        setStatus={setStatus}
        onPlayTrack={handlePlayTrack}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onUseGeneratedQueue={queueUpcomingPlaybackTracks}
        onQuickAutoDj={(track) => void handleQuickAutoDj(track)}
        onRevealTrack={(track) => void handleRevealTrack(track)}
        onAddTracksToPlaylist={handleAddTracksToPlaylist}
        currentTrackId={currentTrack?.id ?? null}
        currentTrack={currentTrack}
        uiPreferences={uiPreferences}
        continuousAutoDjEnabled={continuousAutoDjEnabled}
        continuousAutoDjBusy={continuousAutoDjBusy}
        onContinuousAutoDjChange={handleContinuousAutoDjChange}
        onContinuousSettingsChange={setContinuousAutoDjSettings}
        avoidRules={autoDjAvoidRules}
        onDeleteAvoidRule={(ruleId) => void handleDeleteAutoDjAvoidRule(ruleId)}
        recommendationProfiles={recommendationProfiles}
        recommendationDrift={recommendationDrift}
        recommendationHistory={recommendationHistory}
        onRefreshProfiles={loadRecommendationProfiles}
        onRefreshHistory={loadRecommendationHistory}
        onSaveRecommendationProfile={handleSaveRecommendationProfile}
        onDeleteRecommendationProfile={handleDeleteRecommendationProfile}
        onSetDefaultRecommendationProfile={handleSetDefaultRecommendationProfile}
      />
    ) : activePage === "sources" ? (
      <SourcesPage
        folderPath={folderPath}
        setFolderPath={setFolderPath}
        libraryFolders={libraryFolders}
        setLibraryFolders={setLibraryFolders}
        suggestedMusicPath={settings?.suggested_music_path ?? null}
        onBrowse={handleBrowseFolder}
        onScan={handleScan}
        onRemoveSource={handleRemoveLibrarySource}
        scanResult={scanResult}
        scanProgress={scanProgress}
        isScanning={isScanning}
        folderWatchStatus={folderWatchStatus}
        onStartFolderWatch={handleStartFolderWatch}
        onStopFolderWatch={handleStopFolderWatch}
        onRefreshFolderWatch={handleRefreshFolderWatch}
        onApplyFolderWatch={handleApplyFolderWatch}
        onAcknowledgeFolderWatchNotifications={handleAcknowledgeFolderWatchNotifications}
      />
    ) : activePage === "fileManagement" ? (
      <FileManagementPage
        initialFocusToolId={fileManagementFocusToolId}
        initialTrackScopeIds={fileManagementScopeIds}
        folderPath={folderPath}
        playlists={playlists}
        onClearArtistCache={handleClearArtistCache}
        onClearLibraryCaches={handleClearLibraryCaches}
        filenameTagPreview={filenameTagPreview}
        onPreviewFilenameTags={handlePreviewFilenameTags}
        onApplyFilenameTags={handleApplyFilenameTags}
        tagRegexPreview={tagRegexPreview}
        onPreviewTagRegex={handlePreviewTagRegex}
        onApplyTagRegex={handleApplyTagRegex}
        autoTagPreview={autoTagPreview}
        onPreviewAutoTag={handlePreviewAutoTag}
        onApplyAutoTag={handleApplyAutoTag}
        fileOrganizationPreview={fileOrganizationPreview}
        fileOrganizationReport={fileOrganizationReport}
        onPreviewFileOrganization={handlePreviewFileOrganization}
        onApplyFileOrganization={handleApplyFileOrganization}
        onExportFileOrganizationReport={handleExportFileOrganizationReport}
        deviceSyncPreview={deviceSyncPreview}
        onDeviceSync={handleDeviceSync}
        audioConversionSetup={audioConversionSetup}
        audioConversionInstallProgress={audioConversionInstallProgress}
        audioConversionPreview={audioConversionPreview}
        audioConversionProgress={audioConversionProgress}
        onRefreshAudioConversionSetup={loadAudioConversionSetup}
        onSaveAudioConversionSetup={handleSaveAudioConversionSetup}
        onInstallAudioConversionFfmpeg={handleInstallAudioConversionFfmpeg}
        onBrowseAudioConversionTarget={handleBrowseAudioConversionTarget}
        onBrowseCdRipTarget={handleBrowseCdRipTarget}
        cdAutoLookupMetadata={cdAutoLookupMetadata}
        currentCdPlaybackDriveId={currentCdPlaybackDriveId}
        isCdPlaybackActive={isCdPlaybackActive}
        onPlayCdPreviewTrack={handlePlayCdPreviewTrack}
        onPreviewAudioConversion={handlePreviewAudioConversion}
        onStartAudioConversion={handleStartAudioConversion}
        onCancelAudioConversion={handleCancelAudioConversion}
        metadataCsvExport={metadataCsvExport}
        metadataCsvImportPreview={metadataCsvImportPreview}
        metadataCsvImportReport={metadataCsvImportReport}
        onExportMetadataCsv={handleExportMetadataCsv}
        onPreviewMetadataCsv={handlePreviewMetadataCsv}
        onApplyMetadataCsv={handleApplyMetadataCsv}
        onExportMetadataCsvReport={handleExportMetadataCsvReport}
        duplicateActionResult={duplicateActionResult}
        duplicateReview={duplicateReview}
        onDuplicateAction={handleDuplicateAction}
        onLoadDuplicateReview={handleLoadDuplicateReview}
        onRevealTracksByIds={handleRevealTracksByIds}
        clapStatus={clapStatus}
        clapInstallProgress={clapInstallProgress}
        isClapInstalling={isClapInstalling}
        onRefreshClapStatus={() => void loadClapStatus()}
        onInstallClap={handleInstallClap}
        chromaprintSetup={chromaprintSetup}
        onRefreshChromaprintSetup={loadChromaprintSetup}
        onSaveChromaprintSetup={handleSaveChromaprintSetup}
        acousticFingerprintResult={acousticFingerprintResult}
        onRunAcousticFingerprintPass={handleRunAcousticFingerprintPass}
        bulkUndoLog={bulkUndoLog}
        bulkUndoBatches={bulkUndoBatches}
        bulkUndoRestoreResult={bulkUndoRestoreResult}
        onRefreshUndoLog={loadBulkUndoLog}
        onRestoreUndoEntry={handleRestoreBulkUndoEntry}
        onRestoreUndoBatch={handleRestoreBulkUndoBatch}
        reportFile={reportFile}
        onReadReportFile={handleReadReportFile}
        onAdvancedTagLibraryChanged={handleAdvancedTagLibraryChanged}
        onClearTrackScope={() => setFileManagementScopeIds(null)}
        onOpenApiKeysSettings={openApiKeysSettings}
        onSelectLibraryTarget={(view) => {
          setLibraryView(view);
          setActivePage("library");
          setStatus(
            view === "albums"
              ? "Choose an album, then select or right-click tracks to send them to tagging tools."
              : "Select tracks, then use the File Management button or track menu tools.",
          );
        }}
        setStatus={setStatus}
      />
    ) : activePage === "settings" ? (
      <SettingsPage
        settings={settings}
        focusSectionId={settingsFocusSection}
        onFocusSectionConsumed={() => setSettingsFocusSection(null)}
        backendStatus={backendStatus}
        backendMessage={backendMessage}
        backendCheckedAt={backendCheckedAt}
        startupDiagnostics={startupDiagnostics}
        backendLog={backendLog}
        onCheckBackend={() => void checkBackendStatus(true)}
        onRunStartupDiagnostics={() => void loadStartupDiagnostics(true)}
        onOpenBackendLog={() => void handleOpenBackendLog()}
        onRestartBackend={() => void handleRestartBackend()}
        hideFilePaths={hideFilePaths}
        setHideFilePaths={setHideFilePaths}
        uiPreferences={uiPreferences}
        setUiPreferences={setUiPreferences}
        writeRatingsToFiles={writeRatingsToFiles}
        onWriteRatingsToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
        autoWriteFetchedLyricsSidecars={autoWriteFetchedLyricsSidecars}
        onAutoWriteFetchedLyricsSidecarsChange={(value) => void handleAutoWriteFetchedLyricsSidecars(value)}
        cdAutoLookupMetadata={cdAutoLookupMetadata}
        onCdAutoLookupMetadataChange={(value) => void handleCdAutoLookupMetadata(value)}
        onAcoustIdApiKeyChange={(apiKey) => void handleAcoustIdApiKeyChange(apiKey)}
        onLastFmApiCredentialsChange={(apiKey, apiSecret) => void handleLastFmApiCredentialsChange(apiKey, apiSecret)}
        setStatus={setStatus}
        onBackupDatabase={handleBackupDatabase}
        onResetLocalData={handleResetLocalData}
        onCreateSupportBundle={handleCreateSupportBundle}
        supportBundlePath={supportBundlePath}
        onCopySupportBundlePath={handleCopySupportBundlePath}
        onOpenSourceFolder={() => void handleOpenSourceFolder("source")}
        onOpenThemeFolder={() => void handleOpenSourceFolder("themes")}
        onClearArtistCache={handleClearArtistCache}
      />
    ) : null}
  </div>
  );
}
