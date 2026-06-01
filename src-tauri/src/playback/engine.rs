impl PlaybackInner {
    fn ensure_sink(
        &mut self,
        output_backend: Option<DesktopOutputBackendMode>,
        device_id: Option<String>,
        buffer_frames: Option<u32>,
    ) -> Result<(), String> {
        let requested_backend = output_backend.unwrap_or_default();
        let requested_device_id = normalize_device_id(device_id);
        let requested_buffer_frames = normalize_buffer_frames(buffer_frames);
        let has_stream_errors = self
            .stream_errors
            .lock()
            .map(|errors| !errors.is_empty())
            .unwrap_or(true);
        let sink_is_usable = self
            .sink
            .as_ref()
            .map(|sink| sink.is_usable())
            .unwrap_or(false)
            && !has_stream_errors;
        if sink_is_usable
            && self.output_backend == requested_backend
            && self.device_id == requested_device_id
            && self.buffer_frames == requested_buffer_frames
        {
            return Ok(());
        }

        self.stop();
        self.sink = None;
        self.output_backend = DesktopOutputBackendMode::default();
        self.device_id = None;
        self.device_name = None;
        self.sample_rate = None;
        self.channel_count = None;
        self.sample_format = None;
        if let Ok(mut errors) = self.stream_errors.lock() {
            errors.clear();
        }
        let (mut sink, resolved) = open_output_sink(
            requested_backend,
            requested_device_id.as_deref(),
            requested_buffer_frames,
            self.stream_errors.clone(),
            self.diagnostics.clone(),
        )?;
        sink.log_on_drop(false);
        self.sink = Some(sink);
        self.output_backend = resolved.output_backend;
        self.device_id = resolved.device_id;
        self.device_name = Some(resolved.device_name);
        self.buffer_frames = requested_buffer_frames;
        self.sample_rate = Some(resolved.sample_rate);
        self.channel_count = Some(resolved.channel_count);
        self.sample_format = Some(resolved.sample_format);
        Ok(())
    }

    fn status(&self, message: Option<String>) -> PlaybackStatus {
        let has_stream_errors = self
            .stream_errors
            .lock()
            .map(|errors| !errors.is_empty())
            .unwrap_or(true);
        let output_available = self
            .sink
            .as_ref()
            .map(|sink| sink.is_usable())
            .unwrap_or(false)
            && !has_stream_errors;
        let position_seconds = self
            .player
            .as_ref()
            .map(|handle| handle.player.get_pos().as_secs_f64())
            .unwrap_or(0.0);
        let is_paused = self
            .player
            .as_ref()
            .map(|handle| handle.player.is_paused())
            .unwrap_or(false);
        let ended = self
            .player
            .as_ref()
            .map(|handle| handle.player.empty() && self.current_path.is_some())
            .unwrap_or(false);
        PlaybackStatus {
            available: output_available,
            current_path: self.current_path.clone(),
            output_backend: self.output_backend.id().to_string(),
            device_id: self.device_id.clone(),
            device_name: self.device_name.clone(),
            is_playing: self.player.is_some() && output_available && !is_paused && !ended,
            is_paused,
            ended,
            position_seconds,
            duration_seconds: self.duration_seconds,
            volume: self.volume,
            buffer_frames: self.buffer_frames,
            sample_rate: self.sample_rate,
            channel_count: self.channel_count,
            sample_format: self.sample_format.clone(),
            stream_errors: self
                .stream_errors
                .lock()
                .map(|errors| errors.clone())
                .unwrap_or_default(),
            message,
        }
    }

    fn diagnostics_response(&self) -> PlaybackDiagnosticsResponse {
        PlaybackDiagnosticsResponse {
            entries: self
                .diagnostics
                .lock()
                .map(|entries| entries.clone())
                .unwrap_or_default(),
            stream_errors: self
                .stream_errors
                .lock()
                .map(|errors| errors.clone())
                .unwrap_or_default(),
            current_path: self.current_path.clone(),
            prepared_next_path: self.prepared_next_path.clone(),
            prepared_next_duration_seconds: self.prepared_next_duration_seconds,
            prepared_next_at_ms: self.prepared_next_at_ms,
            output_backend: self.output_backend.id().to_string(),
            device_id: self.device_id.clone(),
            device_name: self.device_name.clone(),
            buffer_frames: self.buffer_frames,
            sample_rate: self.sample_rate,
            channel_count: self.channel_count,
            sample_format: self.sample_format.clone(),
            dropped_frames: self
                .stream_errors
                .lock()
                .map(|errors| errors.len() as u64)
                .unwrap_or(0),
        }
    }

    fn update_dsp_settings(&self, settings: Option<DesktopDspSettings>) {
        if let Some(settings) = settings {
            if let Ok(mut current) = self.dsp_settings.lock() {
                *current = settings;
            }
        }
    }

    fn take_prepared_audio(&mut self, path: &str) -> Option<DesktopPreparedAudio> {
        let prepared = self.prepared_next_audio.take()?;
        if prepared.path == path
            && now_millis().saturating_sub(prepared.prepared_at_ms) <= 5 * 60 * 1000
        {
            self.prepared_next_path = None;
            self.prepared_next_duration_seconds = None;
            self.prepared_next_at_ms = None;
            Some(prepared)
        } else {
            self.prepared_next_audio = Some(prepared);
            None
        }
    }

    fn stop(&mut self) {
        if let Some(handle) = self.player.take() {
            handle.player.stop();
        }
        if let Some(handle) = self.fading_player.take() {
            handle.player.stop();
        }
        self.current_path = None;
        self.current_reload_path = None;
        self.duration_seconds = None;
        if let Ok(mut visualizer) = self.visualizer.lock() {
            visualizer.reset();
        }
    }

    fn release_exclusive_sink_if_idle(&mut self) {
        if self.player.is_some() || self.fading_player.is_some() {
            return;
        }
        if self
            .sink
            .as_ref()
            .map(|sink| sink.is_exclusive())
            .unwrap_or(false)
        {
            self.sink = None;
            self.output_backend = DesktopOutputBackendMode::default();
            self.device_id = None;
            self.device_name = None;
            self.buffer_frames = None;
            self.sample_rate = None;
            self.channel_count = None;
            self.sample_format = None;
        }
    }
}

struct ResolvedOutput {
    output_backend: DesktopOutputBackendMode,
    device_id: Option<String>,
    device_name: String,
    sample_rate: u32,
    channel_count: u16,
    sample_format: String,
}

fn normalize_device_id(device_id: Option<String>) -> Option<String> {
    device_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != "default")
}

fn normalize_buffer_frames(buffer_frames: Option<u32>) -> Option<u32> {
    buffer_frames.filter(|value| *value >= 128 && *value <= 16_384)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn visualizer_empty_frame(timestamp_ms: u64) -> DesktopVisualizerFrame {
    DesktopVisualizerFrame {
        is_live: false,
        level: 0.0,
        peak: 0.0,
        frequency_bins: Vec::new(),
        waveform: Vec::new(),
        timestamp_ms,
    }
}

fn goertzel_magnitude(samples: &[f32], sample_rate: f32, frequency: f32) -> f32 {
    if samples.is_empty() || sample_rate <= 0.0 || frequency <= 0.0 {
        return 0.0;
    }
    let omega = 2.0 * std::f32::consts::PI * frequency / sample_rate;
    let coefficient = 2.0 * omega.cos();
    let mut q1 = 0.0_f32;
    let mut q2 = 0.0_f32;
    let sample_count = samples.len().max(1) as f32;
    for (index, sample) in samples.iter().enumerate() {
        let window = if samples.len() > 1 {
            0.5 - 0.5 * ((2.0 * std::f32::consts::PI * index as f32) / (sample_count - 1.0)).cos()
        } else {
            1.0
        };
        let q0 = sample * window + coefficient * q1 - q2;
        q2 = q1;
        q1 = q0;
    }
    let power = q1 * q1 + q2 * q2 - coefficient * q1 * q2;
    if power.is_finite() && power > 0.0 {
        power.sqrt() / sample_count
    } else {
        0.0
    }
}

fn build_visualizer_frame(
    samples: Vec<f32>,
    sample_rate: u32,
    last_updated_ms: u64,
    is_playing: bool,
) -> DesktopVisualizerFrame {
    let timestamp_ms = now_millis();
    if !is_playing
        || samples.len() < 64
        || last_updated_ms == 0
        || timestamp_ms.saturating_sub(last_updated_ms) > VISUALIZER_STALE_MS
    {
        return visualizer_empty_frame(timestamp_ms);
    }

    let analysis_start = samples.len().saturating_sub(VISUALIZER_ANALYSIS_SAMPLES);
    let analysis = &samples[analysis_start..];
    let mut sum_squares = 0.0_f32;
    let mut peak = 0.0_f32;
    for sample in analysis {
        sum_squares += sample * sample;
        peak = peak.max(sample.abs());
    }
    let rms = (sum_squares / analysis.len().max(1) as f32).sqrt();
    let level = (rms * 2.8).clamp(0.0, 1.0);
    let peak = peak.clamp(0.0, 1.0);

    let waveform = (0..VISUALIZER_WAVEFORM_POINTS)
        .map(|index| {
            let sample_index = ((index as f32 / VISUALIZER_WAVEFORM_POINTS as f32)
                * analysis.len() as f32)
                .floor() as usize;
            analysis
                .get(sample_index.min(analysis.len().saturating_sub(1)))
                .copied()
                .unwrap_or(0.0)
                .clamp(-1.0, 1.0)
        })
        .collect();

    let sample_rate = sample_rate.max(1) as f32;
    let max_hz = (sample_rate / 2.0).min(16_000.0).max(80.0);
    let min_hz = 35.0_f32.min(max_hz * 0.5);
    let log_min = min_hz.ln();
    let log_max = max_hz.ln();
    let frequency_bins = (0..VISUALIZER_BINS)
        .map(|index| {
            let fraction = if VISUALIZER_BINS > 1 {
                index as f32 / (VISUALIZER_BINS - 1) as f32
            } else {
                0.0
            };
            let center_hz = (log_min + (log_max - log_min) * fraction).exp();
            let magnitude = goertzel_magnitude(analysis, sample_rate, center_hz);
            let compressed = (1.0 + magnitude * 48.0).ln() / (1.0 + 48.0_f32).ln();
            compressed.clamp(0.0, 1.0)
        })
        .collect();

    DesktopVisualizerFrame {
        is_live: true,
        level,
        peak,
        frequency_bins,
        waveform,
        timestamp_ms,
    }
}

