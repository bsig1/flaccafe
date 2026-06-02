#[tauri::command]
pub fn play_source(
    state: State<'_, PlaybackState>,
    source: DesktopPlaybackSource,
    volume: f32,
    start_seconds: Option<f64>,
    output_backend: Option<DesktopOutputBackendMode>,
    device_id: Option<String>,
    buffer_frames: Option<u32>,
    dsp_settings: Option<DesktopDspSettings>,
) -> Result<PlaybackStatus, String> {
    let identity = source.identity();
    let (diagnostics, prepared_audio) = {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "Rust playback lock poisoned".to_string())?;
        let diagnostics = inner.diagnostics.clone();
        let prepared_audio = inner.take_prepared_audio(&identity);
        (diagnostics, prepared_audio)
    };
    let mut resolved = resolve_playback_source(&source, prepared_audio, &diagnostics)?;
    let start_seconds = clamp_seek_option(start_seconds, resolved.duration_seconds);
    resolved
        .decoder
        .seek_to(start_seconds, &diagnostics, Some(resolved.identity.clone()))?;
    let ResolvedPlaybackSource {
        identity,
        reload_path,
        decoder,
        duration_seconds,
        sample_rate,
    } = resolved;

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    inner.ensure_sink(output_backend, device_id, buffer_frames, Some(sample_rate))?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);
    inner.stop();

    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Rust audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let player = Arc::new(Player::connect_new(&mixer));
    let bounded_volume = clamp_volume(volume);
    player.set_volume(1.0);
    let gain = DesktopGainControl::new(bounded_volume);
    decoder.append_to(
        &player,
        inner.dsp_settings.clone(),
        gain.clone(),
        inner.visualizer.clone(),
    );
    player.play();

    inner.player = Some(PlaybackHandle::new(
        player,
        gain,
        sample_rate,
        start_seconds.unwrap_or(0.0),
    ));
    remember_diagnostic(
        &inner.diagnostics,
        "info",
        "playback",
        "play_source",
        format!(
            "Started Rust playback at {:.3}s using {} output.",
            start_seconds.unwrap_or(0.0),
            inner.output_backend.id()
        ),
        DesktopDiagnosticContext {
            path: Some(identity.clone()),
            device_id: inner.device_id.clone(),
            device_name: inner.device_name.clone(),
            buffer_frames: inner.buffer_frames,
            sample_rate: inner.sample_rate,
            channel_count: inner.channel_count,
            sample_format: inner.sample_format.clone(),
        },
    );
    inner.current_path = Some(identity);
    inner.current_reload_path = reload_path;
    inner.duration_seconds = duration_seconds;
    inner.volume = bounded_volume;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn crossfade_to_source(
    state: State<'_, PlaybackState>,
    source: DesktopPlaybackSource,
    volume: f32,
    duration_ms: u64,
    start_seconds: Option<f64>,
    output_backend: Option<DesktopOutputBackendMode>,
    device_id: Option<String>,
    buffer_frames: Option<u32>,
    dsp_settings: Option<DesktopDspSettings>,
) -> Result<PlaybackStatus, String> {
    let identity = source.identity();
    let (diagnostics, prepared_audio) = {
        let mut inner = state
            .inner
            .lock()
            .map_err(|_| "Rust playback lock poisoned".to_string())?;
        let diagnostics = inner.diagnostics.clone();
        let prepared_audio = inner.take_prepared_audio(&identity);
        (diagnostics, prepared_audio)
    };
    let mut resolved = resolve_playback_source(&source, prepared_audio, &diagnostics)?;
    let start_seconds = clamp_seek_option(start_seconds, resolved.duration_seconds);
    resolved
        .decoder
        .seek_to(start_seconds, &diagnostics, Some(resolved.identity.clone()))?;
    let ResolvedPlaybackSource {
        identity,
        reload_path,
        decoder,
        duration_seconds,
        sample_rate: new_sample_rate,
    } = resolved;

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    inner.ensure_sink(
        output_backend,
        device_id,
        buffer_frames,
        Some(new_sample_rate),
    )?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);

    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Rust audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let new_player = Arc::new(Player::connect_new(&mixer));
    let target_volume = clamp_volume(volume);
    new_player.set_volume(1.0);
    let bounded_duration = duration_ms.min(20_000);
    let fade_duration = Duration::from_millis(bounded_duration);
    let new_gain = DesktopGainControl::new(if bounded_duration > 0 {
        0.0
    } else {
        target_volume
    });
    if let Ok(mut visualizer) = inner.visualizer.lock() {
        visualizer.reset();
    }
    decoder.append_to(
        &new_player,
        inner.dsp_settings.clone(),
        new_gain.clone(),
        inner.visualizer.clone(),
    );
    new_player.play();

    let new_handle = PlaybackHandle::new(
        new_player.clone(),
        new_gain.clone(),
        new_sample_rate,
        start_seconds.unwrap_or(0.0),
    );
    let old_handle = inner.player.replace(new_handle);
    inner.fading_player = old_handle.clone();
    remember_diagnostic(
        &inner.diagnostics,
        "info",
        "playback",
        "crossfade_to_source",
        format!(
            "Started Rust crossfade over {} ms using {} output.",
            bounded_duration,
            inner.output_backend.id()
        ),
        DesktopDiagnosticContext {
            path: Some(identity.clone()),
            device_id: inner.device_id.clone(),
            device_name: inner.device_name.clone(),
            buffer_frames: inner.buffer_frames,
            sample_rate: inner.sample_rate,
            channel_count: inner.channel_count,
            sample_format: inner.sample_format.clone(),
        },
    );
    inner.current_path = Some(identity);
    inner.current_reload_path = reload_path;
    inner.duration_seconds = duration_seconds;
    inner.volume = target_volume;
    let status = inner.status(None);

    if let Some(old_handle) = old_handle {
        old_handle
            .gain
            .fade_to(0.0, fade_duration, old_handle.sample_rate);
        new_gain.fade_to(target_volume, fade_duration, new_sample_rate);
        spawn_stop_after_fade(old_handle.player, bounded_duration);
    } else {
        new_gain.set_immediate(target_volume);
    }
    Ok(status)
}

#[tauri::command]
pub fn resume(state: State<'_, PlaybackState>) -> Result<PlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    let player = inner
        .player
        .as_ref()
        .ok_or_else(|| "No Rust audio track is loaded".to_string())?;
    player.player.play();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn pause(state: State<'_, PlaybackState>) -> Result<PlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    let player = inner
        .player
        .as_ref()
        .ok_or_else(|| "No Rust audio track is loaded".to_string())?;
    player.player.pause();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn stop(state: State<'_, PlaybackState>) -> Result<PlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    inner.stop();
    inner.release_exclusive_sink_if_idle();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn seek(state: State<'_, PlaybackState>, seconds: f64) -> Result<PlaybackStatus, String> {
    let (identity, reload_path, diagnostics, was_paused, bounded_seconds) = {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "Rust playback lock poisoned".to_string())?;
        let player = inner
            .player
            .as_ref()
            .ok_or_else(|| "No Rust audio track is loaded".to_string())?;
        let bounded_seconds = clamp_seek_seconds(seconds, inner.duration_seconds);
        player.gain.set_immediate(0.0);
        match player
            .player
            .try_seek(Duration::from_secs_f64(bounded_seconds))
        {
            Ok(()) => {
                player.set_position_offset_seconds(0.0);
                player.gain.fade_to(
                    inner.volume,
                    Duration::from_millis(CLICKLESS_SEEK_RAMP_MS),
                    player.sample_rate,
                );
                if let Ok(mut visualizer) = inner.visualizer.lock() {
                    visualizer.reset();
                }
                return Ok(inner.status(None));
            }
            Err(error) => {
                player.gain.set_immediate(inner.volume);
                let identity = inner
                    .current_path
                    .clone()
                    .ok_or_else(|| "No Rust audio track is loaded".to_string())?;
                let reload_path = inner.current_reload_path.clone().ok_or_else(|| {
                    "This Rust playback source does not support seeking yet.".to_string()
                })?;
                let diagnostics = inner.diagnostics.clone();
                remember_diagnostic(
                    &diagnostics,
                    "warning",
                    "rodio",
                    "seek_reload_fallback",
                    format!("Rust live seek failed; reloading current file at requested position: {error}"),
                    DesktopDiagnosticContext {
                        path: Some(identity.clone()),
                        ..DesktopDiagnosticContext::default()
                    },
                );
                (
                    identity,
                    reload_path,
                    diagnostics,
                    player.player.is_paused(),
                    bounded_seconds,
                )
            }
        }
    };

    let path_buf = PathBuf::from(&reload_path);
    if !path_buf.exists() || !path_buf.is_file() {
        let message = "Current audio file does not exist".to_string();
        remember_diagnostic(
            &diagnostics,
            "error",
            "file",
            "seek_reload_validate_audio_file",
            message.clone(),
            DesktopDiagnosticContext {
                path: Some(reload_path.clone()),
                ..DesktopDiagnosticContext::default()
            },
        );
        return Err(message);
    }
    let (mut decoder, duration_seconds) = build_seek_fallback_decoder(&path_buf, &diagnostics)?;
    let bounded_seconds = clamp_seek_seconds(bounded_seconds, duration_seconds);
    let sample_rate = decoder.sample_rate().get();
    seek_source(
        &mut decoder,
        clamp_seek_option(Some(bounded_seconds), duration_seconds),
        &diagnostics,
        Some(identity.clone()),
    )?;

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    if inner.current_path.as_deref() != Some(identity.as_str())
        || inner.current_reload_path.as_deref() != Some(reload_path.as_str())
    {
        return Ok(inner.status(None));
    }
    let device_id = inner.device_id.clone();
    let buffer_frames = inner.buffer_frames;
    let output_backend = inner.output_backend;
    let volume = inner.volume;
    inner.ensure_sink(Some(output_backend), device_id, buffer_frames, Some(sample_rate))?;
    inner.stop();

    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Rust audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let player = Arc::new(Player::connect_new(&mixer));
    player.set_volume(1.0);
    let gain = DesktopGainControl::new(0.0);
    append_dsp_source(
        &player,
        decoder,
        inner.dsp_settings.clone(),
        gain.clone(),
        inner.visualizer.clone(),
    );
    if was_paused {
        player.pause();
    } else {
        player.play();
    }
    gain.fade_to(
        volume,
        Duration::from_millis(CLICKLESS_SEEK_RAMP_MS),
        sample_rate,
    );

    inner.player = Some(PlaybackHandle::new(
        player,
        gain,
        sample_rate,
        bounded_seconds,
    ));
    inner.current_path = Some(identity);
    inner.current_reload_path = Some(reload_path);
    inner.duration_seconds = duration_seconds;
    inner.volume = volume;
    if let Ok(mut visualizer) = inner.visualizer.lock() {
        visualizer.reset();
    }
    Ok(inner.status(None))
}
#[tauri::command]
pub fn set_volume(state: State<'_, PlaybackState>, volume: f32) -> Result<PlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    let bounded = clamp_volume(volume);
    if let Some(handle) = &inner.player {
        handle.gain.set_immediate(bounded);
    }
    inner.volume = bounded;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn fade_volume(
    state: State<'_, PlaybackState>,
    volume: f32,
    duration_ms: u64,
) -> Result<PlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    let bounded = clamp_volume(volume);
    if let Some(handle) = &inner.player {
        handle.gain.fade_to(
            bounded,
            Duration::from_millis(duration_ms.min(20_000)),
            handle.sample_rate,
        );
    }
    inner.volume = bounded;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn set_dsp(
    state: State<'_, PlaybackState>,
    dsp_settings: DesktopDspSettings,
) -> Result<PlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    if let Ok(mut current) = inner.dsp_settings.lock() {
        *current = dsp_settings;
    }
    Ok(inner.status(None))
}

#[tauri::command]
pub fn status(state: State<'_, PlaybackState>) -> Result<PlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn visualizer_frame(state: State<'_, PlaybackState>) -> Result<DesktopVisualizerFrame, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    let is_playing = inner
        .player
        .as_ref()
        .map(|handle| !handle.player.is_paused() && !handle.player.empty())
        .unwrap_or(false);
    let (samples, sample_rate, last_updated_ms) = inner
        .visualizer
        .lock()
        .map(|visualizer| visualizer.snapshot())
        .unwrap_or_else(|_| (Vec::new(), 44_100, 0));
    drop(inner);
    Ok(build_visualizer_frame(
        samples,
        sample_rate,
        last_updated_ms,
        is_playing,
    ))
}

#[tauri::command]
pub fn seek_waveform(
    state: State<'_, PlaybackState>,
    source: DesktopPlaybackSource,
    points: Option<usize>,
) -> Result<Vec<f32>, String> {
    let diagnostics = {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "Rust playback lock poisoned".to_string())?;
        inner.diagnostics.clone()
    };
    match source {
        DesktopPlaybackSource::File { path } => {
            let path_buf = validate_file_source(&path, &diagnostics, "seek_waveform")?;
            build_seek_waveform(&path_buf, points.unwrap_or(64), &diagnostics)
        }
        DesktopPlaybackSource::Url { live: true, .. } => Ok(Vec::new()),
        DesktopPlaybackSource::Url { .. } | DesktopPlaybackSource::CdTrack { .. } => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn diagnostics(state: State<'_, PlaybackState>) -> Result<PlaybackDiagnosticsResponse, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    Ok(inner.diagnostics_response())
}

#[tauri::command]
pub fn clear_diagnostics(
    state: State<'_, PlaybackState>,
) -> Result<PlaybackDiagnosticsResponse, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    if let Ok(mut entries) = inner.diagnostics.lock() {
        entries.clear();
    }
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    Ok(inner.diagnostics_response())
}

#[tauri::command]
pub fn prepare_next_source(
    state: State<'_, PlaybackState>,
    source: DesktopPlaybackSource,
) -> Result<DesktopPreparedTrack, String> {
    let identity = source.identity();
    let diagnostics = {
        let inner = state
            .inner
            .lock()
            .map_err(|_| "Rust playback lock poisoned".to_string())?;
        inner.diagnostics.clone()
    };
    let resolved = resolve_playback_source(&source, None, &diagnostics)?;
    let duration_seconds = resolved.duration_seconds;
    let prepared_at_ms = now_millis();
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?;
    inner.prepared_next_path = Some(identity.clone());
    inner.prepared_next_duration_seconds = duration_seconds;
    inner.prepared_next_at_ms = Some(prepared_at_ms);
    inner.prepared_next_audio = None;
    Ok(DesktopPreparedTrack {
        path: identity,
        duration_seconds,
        prepared_at_ms,
        message: "Next Rust track metadata prepared.".to_string(),
    })
}

#[tauri::command]
pub fn output_backends() -> Result<Vec<DesktopOutputBackend>, String> {
    let mut backends = vec![DesktopOutputBackend {
        id: "cpalShared".to_string(),
        label: if cfg!(windows) {
            "CPAL / WASAPI shared"
        } else {
            "CPAL shared"
        }
        .to_string(),
        available: true,
        exclusive: false,
        message: if cfg!(windows) {
            "Standard Windows shared-mode output. Other apps can play at the same time and Windows may resample/mix the stream."
        } else {
            "Standard shared output. Other apps can play at the same time and the OS audio server may resample/mix the stream."
        }
        .to_string(),
    }];

    #[cfg(windows)]
    backends.push(DesktopOutputBackend {
        id: "wasapiExclusive".to_string(),
        label: "WASAPI exclusive".to_string(),
        available: wasapi_exclusive_enabled(),
        exclusive: true,
        message: "Experimental direct Windows exclusive output. FLAC Cafe owns the device while playing and bypasses the Windows shared mixer. If opening fails, shared Rust output is used.".to_string(),
    });

    Ok(backends)
}

#[tauri::command]
pub fn list_output_devices(
    state: State<'_, PlaybackState>,
) -> Result<Vec<DesktopAudioDevice>, String> {
    let diagnostics = state
        .inner
        .lock()
        .map_err(|_| "Rust playback lock poisoned".to_string())?
        .diagnostics
        .clone();
    let host = cpal::default_host();
    let default_name = default_output_device_name();
    let devices = host.output_devices().map_err(|error| {
        diagnostic_error(
            &diagnostics,
            "cpal",
            "list_output_devices",
            format!("Could not list output devices: {error}"),
            DesktopDiagnosticContext::default(),
        )
    })?;
    let mut response = Vec::new();
    for (index, device) in devices.enumerate() {
        let name = device_name(&device);
        let default_config = device.default_output_config().ok();
        let supported_configs = match device.supported_output_configs() {
            Ok(configs) => configs.count(),
            Err(error) => {
                remember_diagnostic(
                    &diagnostics,
                    "warning",
                    "cpal",
                    "list_supported_output_configs",
                    format!("Could not inspect supported output configs: {error}"),
                    DesktopDiagnosticContext {
                        device_id: Some(device_id(index, &name)),
                        device_name: Some(name.clone()),
                        ..DesktopDiagnosticContext::default()
                    },
                );
                0
            }
        };
        response.push(DesktopAudioDevice {
            id: device_id(index, &name),
            is_default: default_name.as_deref() == Some(name.as_str()),
            name,
            default_sample_rate: default_config.as_ref().map(|config| config.sample_rate()),
            default_channels: default_config.as_ref().map(|config| config.channels()),
            default_sample_format: default_config
                .as_ref()
                .map(|config| format!("{:?}", config.sample_format())),
            supported_configs,
        });
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rodio::{ChannelCount, SampleRate, Source};

    struct VecSource {
        samples: Vec<f32>,
        index: usize,
        channels: u16,
        sample_rate: u32,
    }

    impl VecSource {
        fn new(samples: Vec<f32>, channels: u16, sample_rate: u32) -> Self {
            Self {
                samples,
                index: 0,
                channels,
                sample_rate,
            }
        }
    }

    impl Iterator for VecSource {
        type Item = f32;

        fn next(&mut self) -> Option<Self::Item> {
            let sample = self.samples.get(self.index).copied();
            if sample.is_some() {
                self.index += 1;
            }
            sample
        }
    }

    impl Source for VecSource {
        fn current_span_len(&self) -> Option<usize> {
            Some(self.samples.len().saturating_sub(self.index))
        }

        fn channels(&self) -> ChannelCount {
            ChannelCount::new(self.channels).unwrap()
        }

        fn sample_rate(&self) -> SampleRate {
            SampleRate::new(self.sample_rate).unwrap()
        }

        fn total_duration(&self) -> Option<Duration> {
            None
        }
    }

    #[test]
    fn dsp_settings_normalize_band_count_and_gain_limits() {
        let settings = DesktopDspSettings {
            normalization_gain: 2.0,
            equalizer_enabled: true,
            equalizer_band_mode: "15".to_string(),
            equalizer_preamp_db: 30.0,
            equalizer_gains: vec![18.0, -18.0, 3.5],
            limiter_enabled: true,
        };

        let normalized = settings.normalized();

        assert_eq!(normalized.frequencies.len(), 15);
        assert_eq!(normalized.normalization_gain, 1.5);
        assert_eq!(normalized.equalizer_gains.len(), 15);
        assert_eq!(normalized.equalizer_gains[0], EQ_GAIN_MAX_DB);
        assert_eq!(normalized.equalizer_gains[1], EQ_GAIN_MIN_DB);
        assert_eq!(normalized.equalizer_gains[2], 3.5);
        assert_eq!(normalized.equalizer_preamp_db, EQ_PREAMP_MAX_DB);
    }

    #[test]
    fn dsp_coefficients_are_finite() {
        for kind in [
            DesktopEqBandKind::LowShelf,
            DesktopEqBandKind::Peaking,
            DesktopEqBandKind::HighShelf,
        ] {
            let coefficients = biquad_coefficients(kind, 1000.0, 6.0, 48_000);
            assert!(coefficients.b0.is_finite());
            assert!(coefficients.b1.is_finite());
            assert!(coefficients.b2.is_finite());
            assert!(coefficients.a1.is_finite());
            assert!(coefficients.a2.is_finite());
        }
    }

    #[test]
    fn soft_limiter_caps_extreme_samples() {
        assert_eq!(soft_limit(f32::NAN), 0.0);
        assert!(soft_limit(8.0) <= 1.0);
        assert!(soft_limit(-8.0) >= -1.0);
        assert_eq!(soft_limit(0.5), 0.5);
    }

    #[test]
    fn fade_progress_eases_without_overshoot() {
        assert_eq!(smooth_fade_progress(-1.0), 0.0);
        assert_eq!(smooth_fade_progress(0.0), 0.0);
        assert_eq!(smooth_fade_progress(1.0), 1.0);
        assert_eq!(smooth_fade_progress(2.0), 1.0);
        assert!(smooth_fade_progress(0.25) < 0.25);
        assert!(smooth_fade_progress(0.75) > 0.75);
    }

    #[test]
    fn seek_clamp_keeps_requests_before_end_of_track() {
        assert_eq!(clamp_seek_seconds(f64::NAN, Some(180.0)), 0.0);
        assert_eq!(clamp_seek_seconds(-4.0, Some(180.0)), 0.0);
        assert_eq!(clamp_seek_seconds(30.0, Some(180.0)), 30.0);
        assert_eq!(clamp_seek_seconds(180.0, Some(180.0)), 179.75);
        assert_eq!(clamp_seek_seconds(999.0, Some(180.0)), 179.75);
        assert_eq!(clamp_seek_seconds(1.0, Some(0.4)), 0.2);
    }

    #[test]
    fn visualizer_frame_uses_recent_audio_samples() {
        let sample_rate = 48_000_u32;
        let samples: Vec<f32> = (0..VISUALIZER_ANALYSIS_SAMPLES)
            .map(|index| {
                let phase =
                    2.0 * std::f32::consts::PI * 440.0 * index as f32 / sample_rate as f32;
                phase.sin() * 0.65
            })
            .collect();

        let frame = build_visualizer_frame(samples, sample_rate, now_millis(), true);

        assert!(frame.is_live);
        assert!(frame.level > 0.05);
        assert_eq!(frame.frequency_bins.len(), VISUALIZER_BINS);
        assert_eq!(frame.waveform.len(), VISUALIZER_WAVEFORM_POINTS);
        assert!(frame.frequency_bins.iter().any(|value| *value > 0.05));
    }

    #[test]
    fn dsp_source_does_not_block_when_visualizer_is_busy() {
        let channels = 2_u16;
        let frames = VISUALIZER_FLUSH_SAMPLES + 32;
        let samples: Vec<f32> = (0..frames * usize::from(channels))
            .map(|index| ((index % 23) as f32 - 11.0) / 100.0)
            .collect();
        let visualizer = Arc::new(Mutex::new(DesktopVisualizerState::default()));
        let _held_visualizer_lock = visualizer.lock().unwrap();

        let source = DesktopDspSource::new(
            VecSource::new(samples.clone(), channels, 48_000),
            Arc::new(Mutex::new(DesktopDspSettings::default())),
            DesktopGainControl::new(1.0),
            visualizer.clone(),
        );
        let rendered: Vec<f32> = source.collect();

        assert_eq!(rendered.len(), samples.len());
        let ramp_samples = fade_frame_count(Duration::from_millis(CLICKLESS_START_RAMP_MS), 48_000)
            as usize
            * usize::from(channels);
        assert!(rendered
            .iter()
            .zip(samples.iter())
            .take(ramp_samples)
            .any(|(actual, expected)| (actual - expected).abs() > f32::EPSILON));
        for (actual, expected) in rendered.iter().zip(samples.iter()).skip(ramp_samples) {
            assert!((actual - expected).abs() < f32::EPSILON);
        }
    }

    #[test]
    fn diagnostics_keep_recent_entries() {
        let diagnostics = Arc::new(Mutex::new(Vec::new()));
        for index in 0..(DIAGNOSTIC_LIMIT + 5) {
            remember_diagnostic(
                &diagnostics,
                "error",
                "cpal",
                "test_operation",
                format!("failure {index}"),
                DesktopDiagnosticContext::default(),
            );
        }

        let entries = diagnostics.lock().unwrap();
        assert_eq!(entries.len(), DIAGNOSTIC_LIMIT);
        assert_eq!(entries.first().unwrap().message, "failure 5");
        assert_eq!(
            entries.last().unwrap().message,
            format!("failure {}", DIAGNOSTIC_LIMIT + 4)
        );
    }

    #[test]
    #[ignore]
    fn decode_audio_file_from_env() {
        let path = std::env::var("FLAC_CAFE_DECODE_TEST_FILE")
            .expect("Set FLAC_CAFE_DECODE_TEST_FILE to an audio file path");
        let diagnostics = Arc::new(Mutex::new(Vec::new()));
        let (mut decoder, duration_seconds) =
            build_decoder(&PathBuf::from(&path), &diagnostics).expect("decode should start");
        let channels = usize::from(decoder.channels().get());
        let sample_rate = decoder.sample_rate().get() as f64;
        let mut sample_count = 0_usize;
        for sample in decoder.by_ref() {
            assert!(sample.is_finite());
            sample_count += 1;
        }
        assert!(sample_count > 0);
        if let Some(duration_seconds) = duration_seconds {
            let decoded_seconds = sample_count as f64 / channels as f64 / sample_rate;
            let difference_seconds = duration_seconds - decoded_seconds;
            println!(
                "decoded_seconds={decoded_seconds:.3} duration_seconds={duration_seconds:.3} difference_seconds={difference_seconds:.3} samples={sample_count} channels={channels} sample_rate={sample_rate}"
            );
            if std::env::var("FLAC_CAFE_DECODE_EXPECT_COMPLETE").is_ok() {
                assert!((decoded_seconds - duration_seconds).abs() < 1.0);
            }
        }
    }
}
