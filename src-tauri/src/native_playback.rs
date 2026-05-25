use std::fs::File;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rodio::{
    cpal::{
        self,
        traits::{DeviceTrait, HostTrait},
    },
    source::SeekError,
    ChannelCount, Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, SampleRate, Source,
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Default)]
pub struct NativePlaybackState {
    inner: Mutex<NativePlaybackInner>,
}

struct NativePlaybackInner {
    sink: Option<MixerDeviceSink>,
    player: Option<NativePlaybackHandle>,
    fading_player: Option<NativePlaybackHandle>,
    current_path: Option<String>,
    duration_seconds: Option<f64>,
    volume: f32,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
    prepared_next_path: Option<String>,
    prepared_next_duration_seconds: Option<f64>,
    prepared_next_at_ms: Option<u64>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
    dsp_settings: Arc<Mutex<NativeDspSettings>>,
    visualizer: Arc<Mutex<NativeVisualizerState>>,
}

#[derive(Clone)]
struct NativePlaybackHandle {
    player: Arc<Player>,
    gain: NativeGainControl,
}

#[derive(Clone)]
struct NativeGainControl {
    state: Arc<Mutex<NativeGainState>>,
}

struct NativeGainState {
    current_gain: f32,
    start_gain: f32,
    target_gain: f32,
    fade_total_frames: u64,
    fade_elapsed_frames: u64,
}

impl NativeGainControl {
    fn new(volume: f32) -> Self {
        let bounded = clamp_volume(volume);
        Self {
            state: Arc::new(Mutex::new(NativeGainState {
                current_gain: bounded,
                start_gain: bounded,
                target_gain: bounded,
                fade_total_frames: 0,
                fade_elapsed_frames: 0,
            })),
        }
    }

    fn set_immediate(&self, volume: f32) {
        let bounded = clamp_volume(volume);
        if let Ok(mut state) = self.state.lock() {
            state.current_gain = bounded;
            state.start_gain = bounded;
            state.target_gain = bounded;
            state.fade_total_frames = 0;
            state.fade_elapsed_frames = 0;
        }
    }

    fn fade_to(&self, volume: f32, duration: Duration, sample_rate: u32) {
        let bounded = clamp_volume(volume);
        let frames = fade_frame_count(duration, sample_rate);
        if let Ok(mut state) = self.state.lock() {
            if frames == 0 {
                state.current_gain = bounded;
                state.start_gain = bounded;
                state.target_gain = bounded;
                state.fade_total_frames = 0;
                state.fade_elapsed_frames = 0;
                return;
            }
            state.start_gain = state.current_gain;
            state.target_gain = bounded;
            state.fade_total_frames = frames;
            state.fade_elapsed_frames = 0;
        }
    }

    fn next_frame_gain(&self) -> f32 {
        let Ok(mut state) = self.state.lock() else {
            return 1.0;
        };
        if state.fade_total_frames == 0 {
            return state.current_gain;
        }
        let progress = ((state.fade_elapsed_frames + 1) as f32 / state.fade_total_frames as f32)
            .clamp(0.0, 1.0);
        let eased = smooth_fade_progress(progress);
        let gain = state.start_gain + (state.target_gain - state.start_gain) * eased;
        state.current_gain = gain;
        state.fade_elapsed_frames += 1;
        if state.fade_elapsed_frames >= state.fade_total_frames {
            state.current_gain = state.target_gain;
            state.start_gain = state.target_gain;
            state.fade_total_frames = 0;
            state.fade_elapsed_frames = 0;
        }
        gain
    }
}

impl Default for NativePlaybackInner {
    fn default() -> Self {
        Self {
            sink: None,
            player: None,
            fading_player: None,
            current_path: None,
            duration_seconds: None,
            volume: 1.0,
            device_id: None,
            device_name: None,
            buffer_frames: None,
            sample_rate: None,
            channel_count: None,
            sample_format: None,
            prepared_next_path: None,
            prepared_next_duration_seconds: None,
            prepared_next_at_ms: None,
            stream_errors: Arc::new(Mutex::new(Vec::new())),
            diagnostics: Arc::new(Mutex::new(Vec::new())),
            dsp_settings: Arc::new(Mutex::new(NativeDspSettings::default())),
            visualizer: Arc::new(Mutex::new(NativeVisualizerState::default())),
        }
    }
}

fn clamp_volume(volume: f32) -> f32 {
    if volume.is_finite() {
        volume.clamp(0.0, 1.5)
    } else {
        1.0
    }
}

fn fade_frame_count(duration: Duration, sample_rate: u32) -> u64 {
    if duration.is_zero() || sample_rate == 0 {
        return 0;
    }
    (duration.as_secs_f64() * sample_rate as f64)
        .round()
        .clamp(0.0, u64::MAX as f64) as u64
}

const EQ_FREQUENCIES_10: [f32; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];
const EQ_FREQUENCIES_15: [f32; 15] = [
    25.0, 40.0, 63.0, 100.0, 160.0, 250.0, 400.0, 630.0, 1000.0, 1600.0, 2500.0, 4000.0, 6300.0,
    10000.0, 16000.0,
];
const EQ_GAIN_MIN_DB: f32 = -12.0;
const EQ_GAIN_MAX_DB: f32 = 12.0;
const EQ_PREAMP_MIN_DB: f32 = -12.0;
const EQ_PREAMP_MAX_DB: f32 = 6.0;
const DSP_SETTINGS_CHECK_SAMPLES: usize = 2048;
const DIAGNOSTIC_LIMIT: usize = 50;
const VISUALIZER_RING_SAMPLES: usize = 4096;
const VISUALIZER_FLUSH_SAMPLES: usize = 1024;
const VISUALIZER_ANALYSIS_SAMPLES: usize = 2048;
const VISUALIZER_BINS: usize = 48;
const VISUALIZER_WAVEFORM_POINTS: usize = 96;
const VISUALIZER_STALE_MS: u64 = 750;
const FADE_STOP_PAD_MS: u64 = 80;

static NEXT_DIAGNOSTIC_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeDspSettings {
    #[serde(default = "default_normalization_gain")]
    normalization_gain: f32,
    #[serde(default)]
    equalizer_enabled: bool,
    #[serde(default = "default_equalizer_band_mode")]
    equalizer_band_mode: String,
    #[serde(default)]
    equalizer_preamp_db: f32,
    #[serde(default)]
    equalizer_gains: Vec<f32>,
    #[serde(default = "default_limiter_enabled")]
    limiter_enabled: bool,
}

impl Default for NativeDspSettings {
    fn default() -> Self {
        Self {
            normalization_gain: default_normalization_gain(),
            equalizer_enabled: false,
            equalizer_band_mode: default_equalizer_band_mode(),
            equalizer_preamp_db: 0.0,
            equalizer_gains: Vec::new(),
            limiter_enabled: true,
        }
    }
}

fn default_equalizer_band_mode() -> String {
    "10".to_string()
}

fn default_normalization_gain() -> f32 {
    1.0
}

fn default_limiter_enabled() -> bool {
    true
}

#[derive(Clone, Debug, PartialEq)]
struct NormalizedDspSettings {
    normalization_gain: f32,
    equalizer_enabled: bool,
    frequencies: Vec<f32>,
    equalizer_preamp_db: f32,
    equalizer_gains: Vec<f32>,
    limiter_enabled: bool,
}

impl NativeDspSettings {
    fn normalized(&self) -> NormalizedDspSettings {
        let frequencies = if self.equalizer_band_mode == "15" {
            EQ_FREQUENCIES_15.to_vec()
        } else {
            EQ_FREQUENCIES_10.to_vec()
        };
        let mut gains = Vec::with_capacity(frequencies.len());
        for index in 0..frequencies.len() {
            gains.push(clamp_db(
                self.equalizer_gains.get(index).copied().unwrap_or(0.0),
                EQ_GAIN_MIN_DB,
                EQ_GAIN_MAX_DB,
            ));
        }
        NormalizedDspSettings {
            normalization_gain: clamp_gain(self.normalization_gain),
            equalizer_enabled: self.equalizer_enabled,
            frequencies,
            equalizer_preamp_db: clamp_db(
                self.equalizer_preamp_db,
                EQ_PREAMP_MIN_DB,
                EQ_PREAMP_MAX_DB,
            ),
            equalizer_gains: gains,
            limiter_enabled: self.limiter_enabled,
        }
    }
}

fn clamp_db(value: f32, min: f32, max: f32) -> f32 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        0.0
    }
}

fn clamp_gain(value: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 1.5)
    } else {
        1.0
    }
}

fn db_to_gain(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

#[derive(Serialize)]
pub struct NativePlaybackStatus {
    available: bool,
    current_path: Option<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    is_playing: bool,
    is_paused: bool,
    ended: bool,
    position_seconds: f64,
    duration_seconds: Option<f64>,
    volume: f32,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
    stream_errors: Vec<String>,
    message: Option<String>,
}

#[derive(Clone, Debug, Default)]
struct NativeDiagnosticContext {
    path: Option<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct NativePlaybackDiagnostic {
    id: u64,
    timestamp_ms: u64,
    severity: String,
    category: String,
    operation: String,
    message: String,
    path: Option<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
}

#[derive(Serialize)]
pub struct NativePlaybackDiagnosticsResponse {
    entries: Vec<NativePlaybackDiagnostic>,
    stream_errors: Vec<String>,
    current_path: Option<String>,
    prepared_next_path: Option<String>,
    prepared_next_duration_seconds: Option<f64>,
    prepared_next_at_ms: Option<u64>,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudioDevice {
    id: String,
    name: String,
    is_default: bool,
    default_sample_rate: Option<u32>,
    default_channels: Option<u16>,
    default_sample_format: Option<String>,
    supported_configs: usize,
}

#[derive(Serialize)]
pub struct NativePreparedTrack {
    path: String,
    duration_seconds: Option<f64>,
    prepared_at_ms: u64,
    message: String,
}

#[derive(Serialize)]
pub struct NativeOutputBackend {
    id: String,
    label: String,
    available: bool,
    exclusive: bool,
    message: String,
}

#[derive(Debug)]
struct NativeVisualizerState {
    samples: Vec<f32>,
    write_index: usize,
    filled: bool,
    sample_rate: u32,
    last_updated_ms: u64,
}

impl Default for NativeVisualizerState {
    fn default() -> Self {
        Self {
            samples: Vec::with_capacity(VISUALIZER_RING_SAMPLES),
            write_index: 0,
            filled: false,
            sample_rate: 44_100,
            last_updated_ms: 0,
        }
    }
}

impl NativeVisualizerState {
    fn reset(&mut self) {
        self.samples.clear();
        self.write_index = 0;
        self.filled = false;
        self.last_updated_ms = 0;
    }

    fn push_samples(&mut self, samples: &[f32], sample_rate: u32) {
        if samples.is_empty() {
            return;
        }
        self.sample_rate = sample_rate.max(1);
        for sample in samples {
            let bounded = if sample.is_finite() {
                sample.clamp(-1.0, 1.0)
            } else {
                0.0
            };
            if self.samples.len() < VISUALIZER_RING_SAMPLES {
                self.samples.push(bounded);
                self.write_index = self.samples.len() % VISUALIZER_RING_SAMPLES;
            } else {
                self.samples[self.write_index] = bounded;
                self.write_index = (self.write_index + 1) % VISUALIZER_RING_SAMPLES;
                self.filled = true;
            }
        }
        self.last_updated_ms = now_millis();
    }

    fn ordered_samples(&self) -> Vec<f32> {
        if !self.filled || self.samples.len() < VISUALIZER_RING_SAMPLES {
            return self.samples.clone();
        }
        let mut ordered = Vec::with_capacity(self.samples.len());
        ordered.extend_from_slice(&self.samples[self.write_index..]);
        ordered.extend_from_slice(&self.samples[..self.write_index]);
        ordered
    }

    fn snapshot(&self) -> (Vec<f32>, u32, u64) {
        (
            self.ordered_samples(),
            self.sample_rate,
            self.last_updated_ms,
        )
    }
}

#[derive(Serialize)]
pub struct NativeVisualizerFrame {
    is_live: bool,
    level: f32,
    peak: f32,
    frequency_bins: Vec<f32>,
    waveform: Vec<f32>,
    timestamp_ms: u64,
}

impl NativePlaybackInner {
    fn ensure_sink(
        &mut self,
        device_id: Option<String>,
        buffer_frames: Option<u32>,
    ) -> Result<(), String> {
        let requested_device_id = normalize_device_id(device_id);
        let requested_buffer_frames = normalize_buffer_frames(buffer_frames);
        if self.sink.is_some()
            && self.device_id == requested_device_id
            && self.buffer_frames == requested_buffer_frames
        {
            return Ok(());
        }

        self.stop();
        if let Ok(mut errors) = self.stream_errors.lock() {
            errors.clear();
        }
        let (mut sink, resolved) = open_output_sink(
            requested_device_id.as_deref(),
            requested_buffer_frames,
            self.stream_errors.clone(),
            self.diagnostics.clone(),
        )?;
        sink.log_on_drop(false);
        self.sink = Some(sink);
        self.device_id = resolved.device_id;
        self.device_name = Some(resolved.device_name);
        self.buffer_frames = requested_buffer_frames;
        self.sample_rate = Some(resolved.sample_rate);
        self.channel_count = Some(resolved.channel_count);
        self.sample_format = Some(resolved.sample_format);
        Ok(())
    }

    fn status(&self, message: Option<String>) -> NativePlaybackStatus {
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
        NativePlaybackStatus {
            available: self.sink.is_some(),
            current_path: self.current_path.clone(),
            device_id: self.device_id.clone(),
            device_name: self.device_name.clone(),
            is_playing: self.player.is_some() && !is_paused && !ended,
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

    fn diagnostics_response(&self) -> NativePlaybackDiagnosticsResponse {
        NativePlaybackDiagnosticsResponse {
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
            device_id: self.device_id.clone(),
            device_name: self.device_name.clone(),
            buffer_frames: self.buffer_frames,
            sample_rate: self.sample_rate,
            channel_count: self.channel_count,
            sample_format: self.sample_format.clone(),
        }
    }

    fn update_dsp_settings(&self, settings: Option<NativeDspSettings>) {
        if let Some(settings) = settings {
            if let Ok(mut current) = self.dsp_settings.lock() {
                *current = settings;
            }
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
        self.duration_seconds = None;
        if let Ok(mut visualizer) = self.visualizer.lock() {
            visualizer.reset();
        }
    }
}

struct ResolvedOutput {
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

fn native_visualizer_empty_frame(timestamp_ms: u64) -> NativeVisualizerFrame {
    NativeVisualizerFrame {
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

fn build_native_visualizer_frame(
    samples: Vec<f32>,
    sample_rate: u32,
    last_updated_ms: u64,
    is_playing: bool,
) -> NativeVisualizerFrame {
    let timestamp_ms = now_millis();
    if !is_playing
        || samples.len() < 64
        || last_updated_ms == 0
        || timestamp_ms.saturating_sub(last_updated_ms) > VISUALIZER_STALE_MS
    {
        return native_visualizer_empty_frame(timestamp_ms);
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

    NativeVisualizerFrame {
        is_live: true,
        level,
        peak,
        frequency_bins,
        waveform,
        timestamp_ms,
    }
}

fn remember_diagnostic(
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
    severity: &str,
    category: &str,
    operation: &str,
    message: String,
    context: NativeDiagnosticContext,
) {
    if let Ok(mut entries) = diagnostics.lock() {
        entries.push(NativePlaybackDiagnostic {
            id: NEXT_DIAGNOSTIC_ID.fetch_add(1, Ordering::Relaxed),
            timestamp_ms: now_millis(),
            severity: severity.to_string(),
            category: category.to_string(),
            operation: operation.to_string(),
            message,
            path: context.path,
            device_id: context.device_id,
            device_name: context.device_name,
            buffer_frames: context.buffer_frames,
            sample_rate: context.sample_rate,
            channel_count: context.channel_count,
            sample_format: context.sample_format,
        });
        if entries.len() > DIAGNOSTIC_LIMIT {
            let overflow = entries.len() - DIAGNOSTIC_LIMIT;
            entries.drain(0..overflow);
        }
    }
}

fn diagnostic_error(
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
    category: &str,
    operation: &str,
    message: String,
    context: NativeDiagnosticContext,
) -> String {
    remember_diagnostic(
        diagnostics,
        "error",
        category,
        operation,
        message.clone(),
        context,
    );
    message
}

fn remember_stream_error(
    stream_errors: &Arc<Mutex<Vec<String>>>,
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
    message: String,
    context: NativeDiagnosticContext,
) {
    if let Ok(mut errors) = stream_errors.lock() {
        errors.push(message.clone());
        if errors.len() > 20 {
            let overflow = errors.len() - 20;
            errors.drain(0..overflow);
        }
    }
    remember_diagnostic(
        diagnostics,
        "error",
        "cpal",
        "output_stream_callback",
        message,
        context,
    );
}

fn device_id(index: usize, name: &str) -> String {
    format!("{index}|{name}")
}

fn device_name(device: &cpal::Device) -> String {
    device
        .description()
        .map(|description| description.name().to_string())
        .unwrap_or_else(|_| "Unknown output device".to_string())
}

fn default_output_device_name() -> Option<String> {
    cpal::default_host()
        .default_output_device()
        .map(|device| device_name(&device))
}

fn find_output_device(
    requested_id: Option<&str>,
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
) -> Result<(cpal::Device, Option<String>), String> {
    let host = cpal::default_host();
    if requested_id.is_none() {
        let device = host.default_output_device().ok_or_else(|| {
            diagnostic_error(
                diagnostics,
                "cpal",
                "select_default_output_device",
                "No default output device is available".to_string(),
                NativeDiagnosticContext::default(),
            )
        })?;
        return Ok((device, None));
    }

    let requested_id = requested_id.unwrap_or_default();
    let devices: Vec<cpal::Device> = host
        .output_devices()
        .map_err(|error| {
            diagnostic_error(
                diagnostics,
                "cpal",
                "list_output_devices",
                format!("Could not list output devices: {error}"),
                NativeDiagnosticContext {
                    device_id: Some(requested_id.to_string()),
                    ..NativeDiagnosticContext::default()
                },
            )
        })?
        .collect();

    if let Some((index_text, expected_name)) = requested_id.split_once('|') {
        if let Ok(index) = index_text.parse::<usize>() {
            if let Some(device) = devices.get(index) {
                if device_name(device) == expected_name {
                    return Ok((device.clone(), Some(requested_id.to_string())));
                }
            }
        }
        for (index, device) in devices.iter().enumerate() {
            if device_name(device) == expected_name {
                return Ok((device.clone(), Some(device_id(index, expected_name))));
            }
        }
    }

    for (index, device) in devices.iter().enumerate() {
        let name = device_name(device);
        if name == requested_id {
            return Ok((device.clone(), Some(device_id(index, &name))));
        }
    }

    Err(diagnostic_error(
        diagnostics,
        "cpal",
        "select_output_device",
        format!("Output device is no longer available: {requested_id}"),
        NativeDiagnosticContext {
            device_id: Some(requested_id.to_string()),
            ..NativeDiagnosticContext::default()
        },
    ))
}

fn open_output_sink(
    requested_id: Option<&str>,
    buffer_frames: Option<u32>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
) -> Result<(MixerDeviceSink, ResolvedOutput), String> {
    let (device, resolved_id) = find_output_device(requested_id, &diagnostics)?;
    let name = device_name(&device);
    let mut builder = DeviceSinkBuilder::from_device(device).map_err(|error| {
        diagnostic_error(
            &diagnostics,
            "cpal",
            "configure_output_device",
            format!("Could not configure output device: {error}"),
            NativeDiagnosticContext {
                device_id: resolved_id
                    .clone()
                    .or_else(|| requested_id.map(str::to_string)),
                device_name: Some(name.clone()),
                buffer_frames,
                ..NativeDiagnosticContext::default()
            },
        )
    })?;
    if let Some(frames) = buffer_frames {
        builder = builder.with_buffer_size(cpal::BufferSize::Fixed(frames));
    }
    let callback_errors = stream_errors.clone();
    let callback_diagnostics = diagnostics.clone();
    let callback_context = NativeDiagnosticContext {
        device_id: resolved_id
            .clone()
            .or_else(|| requested_id.map(str::to_string)),
        device_name: Some(name.clone()),
        buffer_frames,
        ..NativeDiagnosticContext::default()
    };
    let builder = builder.with_error_callback(move |error| {
        remember_stream_error(
            &callback_errors,
            &callback_diagnostics,
            format!("Native output stream error: {error}"),
            callback_context.clone(),
        );
    });
    let sink = builder.open_sink_or_fallback().map_err(|error| {
        diagnostic_error(
            &diagnostics,
            "cpal",
            "open_output_sink",
            format!("Could not open native audio output: {error}"),
            NativeDiagnosticContext {
                device_id: resolved_id
                    .clone()
                    .or_else(|| requested_id.map(str::to_string)),
                device_name: Some(name.clone()),
                buffer_frames,
                ..NativeDiagnosticContext::default()
            },
        )
    })?;
    let config = sink.config();
    let resolved = ResolvedOutput {
        device_id: resolved_id,
        device_name: name,
        sample_rate: config.sample_rate().get(),
        channel_count: config.channel_count().get(),
        sample_format: format!("{:?}", config.sample_format()),
    };
    Ok((sink, resolved))
}

fn build_decoder(
    path: &PathBuf,
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
) -> Result<(Decoder<std::io::BufReader<File>>, Option<f64>), String> {
    let path_text = path.display().to_string();
    let file = File::open(path).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "file",
            "open_audio_file",
            format!("Could not open audio file: {error}"),
            NativeDiagnosticContext {
                path: Some(path_text.clone()),
                ..NativeDiagnosticContext::default()
            },
        )
    })?;
    let decoder = Decoder::try_from(file).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "symphonia",
            "decode_audio_file",
            format!("Could not decode audio file with native engine: {error}"),
            NativeDiagnosticContext {
                path: Some(path_text),
                ..NativeDiagnosticContext::default()
            },
        )
    })?;
    let duration_seconds = decoder
        .total_duration()
        .map(|duration| duration.as_secs_f64());
    Ok((decoder, duration_seconds))
}

#[derive(Clone, Copy)]
enum NativeEqBandKind {
    LowShelf,
    Peaking,
    HighShelf,
}

#[derive(Clone, Copy, Debug, Default)]
struct BiquadCoefficients {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

#[derive(Clone, Copy, Debug, Default)]
struct BiquadState {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadState {
    fn process(&mut self, sample: f32, coefficients: BiquadCoefficients) -> f32 {
        let output =
            coefficients.b0 * sample + coefficients.b1 * self.x1 + coefficients.b2 * self.x2
                - coefficients.a1 * self.y1
                - coefficients.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = sample;
        self.y2 = self.y1;
        self.y1 = output;
        if output.is_finite() {
            output
        } else {
            0.0
        }
    }

    fn reset(&mut self) {
        *self = Self::default();
    }
}

fn biquad_coefficients(
    kind: NativeEqBandKind,
    frequency: f32,
    gain_db: f32,
    sample_rate: u32,
) -> BiquadCoefficients {
    let nyquist = sample_rate as f32 / 2.0;
    let bounded_frequency = frequency.clamp(10.0, nyquist * 0.92);
    let w0 = 2.0 * std::f32::consts::PI * bounded_frequency / sample_rate as f32;
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let a = 10.0_f32.powf(gain_db / 40.0);
    let q = 1.0_f32;

    let (b0, b1, b2, a0, a1, a2) = match kind {
        NativeEqBandKind::LowShelf => {
            let sqrt_a = a.sqrt();
            let alpha = sin_w0 / 2.0 * 2.0_f32.sqrt();
            (
                a * ((a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha),
                2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0),
                a * ((a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha),
                (a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha,
                -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0),
                (a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha,
            )
        }
        NativeEqBandKind::HighShelf => {
            let sqrt_a = a.sqrt();
            let alpha = sin_w0 / 2.0 * 2.0_f32.sqrt();
            (
                a * ((a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha),
                -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0),
                a * ((a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha),
                (a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha,
                2.0 * ((a - 1.0) - (a + 1.0) * cos_w0),
                (a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha,
            )
        }
        NativeEqBandKind::Peaking => {
            let alpha = sin_w0 / (2.0 * q);
            (
                1.0 + alpha * a,
                -2.0 * cos_w0,
                1.0 - alpha * a,
                1.0 + alpha / a,
                -2.0 * cos_w0,
                1.0 - alpha / a,
            )
        }
    };

    if !a0.is_finite() || a0.abs() < f32::EPSILON {
        return BiquadCoefficients {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        };
    }
    BiquadCoefficients {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
    }
}

struct NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    input: S,
    settings: Arc<Mutex<NativeDspSettings>>,
    gain_control: NativeGainControl,
    visualizer: Arc<Mutex<NativeVisualizerState>>,
    active_settings: NormalizedDspSettings,
    coefficients: Vec<BiquadCoefficients>,
    state_by_channel: Vec<Vec<BiquadState>>,
    channel_index: usize,
    check_countdown: usize,
    output_gain: f32,
    visualizer_pending_samples: Vec<f32>,
    visualizer_frame_sum: f32,
}

impl<S> NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    // Rodio pulls interleaved samples from Source, so the EQ keeps one biquad state
    // chain per output channel. That preserves stereo imaging while avoiding a heavier
    // custom mixer or external DSP dependency.
    fn new(
        input: S,
        settings: Arc<Mutex<NativeDspSettings>>,
        gain_control: NativeGainControl,
        visualizer: Arc<Mutex<NativeVisualizerState>>,
    ) -> Self {
        let active_settings = settings
            .lock()
            .map(|settings| settings.normalized())
            .unwrap_or_else(|_| NativeDspSettings::default().normalized());
        let mut source = Self {
            input,
            settings,
            gain_control,
            visualizer,
            active_settings,
            coefficients: Vec::new(),
            state_by_channel: Vec::new(),
            channel_index: 0,
            check_countdown: 0,
            output_gain: 1.0,
            visualizer_pending_samples: Vec::with_capacity(VISUALIZER_FLUSH_SAMPLES),
            visualizer_frame_sum: 0.0,
        };
        source.rebuild_filters(true);
        source
    }

    fn channel_count(&self) -> usize {
        usize::from(self.input.channels().get()).max(1)
    }

    fn rebuild_filters(&mut self, reset_state: bool) {
        let sample_rate = self.input.sample_rate().get();
        let band_count = self.active_settings.frequencies.len();
        self.coefficients.clear();
        self.coefficients.reserve(band_count);
        for (index, frequency) in self.active_settings.frequencies.iter().enumerate() {
            let kind = if index == 0 {
                NativeEqBandKind::LowShelf
            } else if index + 1 == band_count {
                NativeEqBandKind::HighShelf
            } else {
                NativeEqBandKind::Peaking
            };
            self.coefficients.push(biquad_coefficients(
                kind,
                *frequency,
                self.active_settings.equalizer_gains[index],
                sample_rate,
            ));
        }

        let channels = self.channel_count();
        if reset_state || self.state_by_channel.len() != channels {
            self.state_by_channel = vec![vec![BiquadState::default(); band_count]; channels];
            self.channel_index = 0;
            return;
        }

        for channel_state in &mut self.state_by_channel {
            channel_state.resize(band_count, BiquadState::default());
            if reset_state {
                for state in channel_state {
                    state.reset();
                }
            }
        }
    }

    fn refresh_settings_if_needed(&mut self) {
        if self.check_countdown > 0 {
            self.check_countdown -= 1;
            return;
        }
        self.check_countdown = DSP_SETTINGS_CHECK_SAMPLES;
        // DSP setting updates are applied opportunistically so a settings write cannot
        // hold up the real-time audio callback.
        let Ok(settings) = self.settings.try_lock() else {
            return;
        };
        let normalized = settings.normalized();
        drop(settings);
        if normalized != self.active_settings {
            let reset_state =
                normalized.frequencies.len() != self.active_settings.frequencies.len();
            self.active_settings = normalized;
            self.rebuild_filters(reset_state);
        }
    }

    fn process_sample(&mut self, mut sample: f32) -> f32 {
        self.refresh_settings_if_needed();
        let channels = self.channel_count();
        if self.channel_index == 0 {
            self.output_gain = self.gain_control.next_frame_gain();
        }
        sample *= self.active_settings.normalization_gain;
        if self.active_settings.equalizer_enabled {
            sample *= db_to_gain(self.active_settings.equalizer_preamp_db);
            if let Some(channel_state) = self.state_by_channel.get_mut(self.channel_index) {
                for (state, coefficients) in channel_state.iter_mut().zip(self.coefficients.iter())
                {
                    sample = state.process(sample, *coefficients);
                }
            }
        }
        if self.active_settings.limiter_enabled {
            sample = soft_limit(sample);
        }
        sample *= self.output_gain;
        self.visualizer_frame_sum += sample;
        let frame_complete = self.channel_index + 1 >= channels;
        self.channel_index = (self.channel_index + 1) % channels;
        if frame_complete {
            let mono = self.visualizer_frame_sum / channels as f32;
            self.visualizer_frame_sum = 0.0;
            self.push_visualizer_sample(mono);
        }
        sample
    }

    fn push_visualizer_sample(&mut self, sample: f32) {
        self.visualizer_pending_samples.push(sample);
        if self.visualizer_pending_samples.len() >= VISUALIZER_FLUSH_SAMPLES {
            self.flush_visualizer_samples();
        }
    }

    fn flush_visualizer_samples(&mut self) {
        if self.visualizer_pending_samples.is_empty() {
            return;
        }
        // Visualization is best-effort: the audio source must never wait for the UI
        // thread while it is trying to draw a graph.
        if let Ok(mut visualizer) = self.visualizer.try_lock() {
            visualizer.push_samples(
                &self.visualizer_pending_samples,
                self.input.sample_rate().get(),
            );
        }
        self.visualizer_pending_samples.clear();
    }
}

impl<S> Drop for NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    fn drop(&mut self) {
        self.flush_visualizer_samples();
    }
}

impl<S> Iterator for NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        self.input.next().map(|sample| self.process_sample(sample))
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.input.size_hint()
    }
}

impl<S> Source for NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    fn current_span_len(&self) -> Option<usize> {
        self.input.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.input.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.input.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.input.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.input.try_seek(pos)?;
        self.rebuild_filters(true);
        Ok(())
    }
}

fn soft_limit(sample: f32) -> f32 {
    if !sample.is_finite() {
        return 0.0;
    }
    // A zero-lookahead soft limiter is enough for playback safety here: it catches
    // EQ/preamp overs without adding latency or turning the native engine into a DAW.
    let threshold = 0.96_f32;
    let magnitude = sample.abs();
    if magnitude <= threshold {
        return sample;
    }
    let excess = (magnitude - threshold) / (1.0 - threshold);
    let limited = threshold + (1.0 - threshold) * excess.tanh();
    sample.signum() * limited.min(1.0)
}

fn seek_player(
    player: &Player,
    seconds: Option<f64>,
    diagnostics: &Arc<Mutex<Vec<NativePlaybackDiagnostic>>>,
    path: Option<String>,
) -> Result<(), String> {
    if let Some(seconds) = seconds {
        if seconds.is_finite() && seconds > 0.0 {
            player
                .try_seek(Duration::from_secs_f64(seconds))
                .map_err(|error| {
                    diagnostic_error(
                        diagnostics,
                        "rodio",
                        "seek",
                        format!("Native seek failed: {error}"),
                        NativeDiagnosticContext {
                            path,
                            ..NativeDiagnosticContext::default()
                        },
                    )
                })?;
        }
    }
    Ok(())
}

fn spawn_stop_after_fade(old_player: Arc<Player>, duration_ms: u64) {
    thread::spawn(move || {
        if duration_ms == 0 {
            old_player.stop();
            return;
        }
        thread::sleep(Duration::from_millis(
            duration_ms.saturating_add(FADE_STOP_PAD_MS),
        ));
        old_player.stop();
    });
}

fn smooth_fade_progress(progress: f32) -> f32 {
    let bounded = progress.clamp(0.0, 1.0);
    bounded * bounded * (3.0 - 2.0 * bounded)
}

#[tauri::command]
pub fn native_play_file(
    state: State<'_, NativePlaybackState>,
    path: String,
    volume: f32,
    start_seconds: Option<f64>,
    device_id: Option<String>,
    buffer_frames: Option<u32>,
    dsp_settings: Option<NativeDspSettings>,
) -> Result<NativePlaybackStatus, String> {
    let path_buf = PathBuf::from(&path);
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    if !path_buf.exists() || !path_buf.is_file() {
        let message = "Audio file does not exist".to_string();
        remember_diagnostic(
            &inner.diagnostics,
            "error",
            "file",
            "validate_audio_file",
            message.clone(),
            NativeDiagnosticContext {
                path: Some(path.clone()),
                ..NativeDiagnosticContext::default()
            },
        );
        return Err(message);
    }
    inner.ensure_sink(device_id, buffer_frames)?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);
    inner.stop();

    let (decoder, duration_seconds) = build_decoder(&path_buf, &inner.diagnostics)?;
    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Native audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let player = Arc::new(Player::connect_new(&mixer));
    let bounded_volume = clamp_volume(volume);
    player.set_volume(1.0);
    let gain = NativeGainControl::new(bounded_volume);
    player.append(NativeDspSource::new(
        decoder,
        inner.dsp_settings.clone(),
        gain.clone(),
        inner.visualizer.clone(),
    ));
    seek_player(
        &player,
        start_seconds,
        &inner.diagnostics,
        Some(path.clone()),
    )?;
    player.play();

    inner.player = Some(NativePlaybackHandle { player, gain });
    inner.current_path = Some(path);
    inner.duration_seconds = duration_seconds;
    inner.volume = bounded_volume;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_crossfade_to_file(
    state: State<'_, NativePlaybackState>,
    path: String,
    volume: f32,
    duration_ms: u64,
    start_seconds: Option<f64>,
    device_id: Option<String>,
    buffer_frames: Option<u32>,
    dsp_settings: Option<NativeDspSettings>,
) -> Result<NativePlaybackStatus, String> {
    let path_buf = PathBuf::from(&path);
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    if !path_buf.exists() || !path_buf.is_file() {
        let message = "Audio file does not exist".to_string();
        remember_diagnostic(
            &inner.diagnostics,
            "error",
            "file",
            "validate_crossfade_audio_file",
            message.clone(),
            NativeDiagnosticContext {
                path: Some(path.clone()),
                ..NativeDiagnosticContext::default()
            },
        );
        return Err(message);
    }
    inner.ensure_sink(device_id, buffer_frames)?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);

    let (decoder, duration_seconds) = build_decoder(&path_buf, &inner.diagnostics)?;
    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Native audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let new_player = Arc::new(Player::connect_new(&mixer));
    let target_volume = clamp_volume(volume);
    new_player.set_volume(1.0);
    let bounded_duration = duration_ms.min(20_000);
    let fade_duration = Duration::from_millis(bounded_duration);
    let sample_rate = inner.sample_rate.unwrap_or(48_000);
    let new_gain = NativeGainControl::new(if bounded_duration > 0 {
        0.0
    } else {
        target_volume
    });
    if let Ok(mut visualizer) = inner.visualizer.lock() {
        visualizer.reset();
    }
    new_player.append(NativeDspSource::new(
        decoder,
        inner.dsp_settings.clone(),
        new_gain.clone(),
        inner.visualizer.clone(),
    ));
    seek_player(
        &new_player,
        start_seconds,
        &inner.diagnostics,
        Some(path.clone()),
    )?;
    new_player.play();

    let new_handle = NativePlaybackHandle {
        player: new_player.clone(),
        gain: new_gain.clone(),
    };
    let old_handle = inner.player.replace(new_handle);
    inner.fading_player = old_handle.clone();
    inner.current_path = Some(path);
    inner.duration_seconds = duration_seconds;
    inner.volume = target_volume;
    let status = inner.status(None);

    if let Some(old_handle) = old_handle {
        old_handle.gain.fade_to(0.0, fade_duration, sample_rate);
        new_gain.fade_to(target_volume, fade_duration, sample_rate);
        spawn_stop_after_fade(old_handle.player, bounded_duration);
    } else {
        new_gain.set_immediate(target_volume);
    }
    Ok(status)
}

#[tauri::command]
pub fn native_resume(
    state: State<'_, NativePlaybackState>,
) -> Result<NativePlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    let player = inner
        .player
        .as_ref()
        .ok_or_else(|| "No native track is loaded".to_string())?;
    player.player.play();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_pause(state: State<'_, NativePlaybackState>) -> Result<NativePlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    let player = inner
        .player
        .as_ref()
        .ok_or_else(|| "No native track is loaded".to_string())?;
    player.player.pause();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_stop(state: State<'_, NativePlaybackState>) -> Result<NativePlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    inner.stop();
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_seek(
    state: State<'_, NativePlaybackState>,
    seconds: f64,
) -> Result<NativePlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    let player = inner
        .player
        .as_ref()
        .ok_or_else(|| "No native track is loaded".to_string())?;
    let bounded_seconds = if seconds.is_finite() && seconds > 0.0 {
        seconds
    } else {
        0.0
    };
    player
        .player
        .try_seek(Duration::from_secs_f64(bounded_seconds))
        .map_err(|error| {
            diagnostic_error(
                &inner.diagnostics,
                "rodio",
                "seek",
                format!("Native seek failed: {error}"),
                NativeDiagnosticContext {
                    path: inner.current_path.clone(),
                    ..NativeDiagnosticContext::default()
                },
            )
        })?;
    if let Ok(mut visualizer) = inner.visualizer.lock() {
        visualizer.reset();
    }
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_set_volume(
    state: State<'_, NativePlaybackState>,
    volume: f32,
) -> Result<NativePlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    let bounded = clamp_volume(volume);
    if let Some(handle) = &inner.player {
        handle.gain.set_immediate(bounded);
    }
    inner.volume = bounded;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_fade_volume(
    state: State<'_, NativePlaybackState>,
    volume: f32,
    duration_ms: u64,
) -> Result<NativePlaybackStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    let bounded = clamp_volume(volume);
    let sample_rate = inner.sample_rate.unwrap_or(48_000);
    if let Some(handle) = &inner.player {
        handle.gain.fade_to(
            bounded,
            Duration::from_millis(duration_ms.min(20_000)),
            sample_rate,
        );
    }
    inner.volume = bounded;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_set_dsp(
    state: State<'_, NativePlaybackState>,
    dsp_settings: NativeDspSettings,
) -> Result<NativePlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    if let Ok(mut current) = inner.dsp_settings.lock() {
        *current = dsp_settings;
    }
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_status(
    state: State<'_, NativePlaybackState>,
) -> Result<NativePlaybackStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    Ok(inner.status(None))
}

#[tauri::command]
pub fn native_visualizer_frame(
    state: State<'_, NativePlaybackState>,
) -> Result<NativeVisualizerFrame, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
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
    Ok(build_native_visualizer_frame(
        samples,
        sample_rate,
        last_updated_ms,
        is_playing,
    ))
}

#[tauri::command]
pub fn native_diagnostics(
    state: State<'_, NativePlaybackState>,
) -> Result<NativePlaybackDiagnosticsResponse, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    Ok(inner.diagnostics_response())
}

#[tauri::command]
pub fn native_clear_diagnostics(
    state: State<'_, NativePlaybackState>,
) -> Result<NativePlaybackDiagnosticsResponse, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    if let Ok(mut entries) = inner.diagnostics.lock() {
        entries.clear();
    }
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    Ok(inner.diagnostics_response())
}

#[tauri::command]
pub fn native_prepare_next_file(
    state: State<'_, NativePlaybackState>,
    path: String,
) -> Result<NativePreparedTrack, String> {
    let path_buf = PathBuf::from(&path);
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    if !path_buf.exists() || !path_buf.is_file() {
        let message = "Next audio file does not exist".to_string();
        remember_diagnostic(
            &inner.diagnostics,
            "warning",
            "file",
            "prepare_next_file",
            message.clone(),
            NativeDiagnosticContext {
                path: Some(path.clone()),
                ..NativeDiagnosticContext::default()
            },
        );
        return Err(message);
    }
    let (_decoder, duration_seconds) = build_decoder(&path_buf, &inner.diagnostics)?;
    let prepared_at_ms = now_millis();
    inner.prepared_next_path = Some(path.clone());
    inner.prepared_next_duration_seconds = duration_seconds;
    inner.prepared_next_at_ms = Some(prepared_at_ms);
    Ok(NativePreparedTrack {
        path,
        duration_seconds,
        prepared_at_ms,
        message: "Next native track decoded successfully.".to_string(),
    })
}

#[tauri::command]
pub fn native_output_backends() -> Result<Vec<NativeOutputBackend>, String> {
    Ok(vec![
        NativeOutputBackend {
            id: "cpalShared".to_string(),
            label: "CPAL / WASAPI shared".to_string(),
            available: true,
            exclusive: false,
            message: "Current native backend; supports output-device selection and buffer tuning.".to_string(),
        },
        NativeOutputBackend {
            id: "wasapiExclusive".to_string(),
            label: "WASAPI exclusive".to_string(),
            available: false,
            exclusive: true,
            message: "Requires a dedicated Windows WASAPI engine outside the current rodio/cpal shared-mode bridge.".to_string(),
        },
        NativeOutputBackend {
            id: "asio".to_string(),
            label: "ASIO".to_string(),
            available: false,
            exclusive: true,
            message: "Requires an ASIO-specific backend and driver setup; the current app reports this as a future backend.".to_string(),
        },
    ])
}

#[tauri::command]
pub fn native_list_output_devices(
    state: State<'_, NativePlaybackState>,
) -> Result<Vec<NativeAudioDevice>, String> {
    let diagnostics = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?
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
            NativeDiagnosticContext::default(),
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
                    NativeDiagnosticContext {
                        device_id: Some(device_id(index, &name)),
                        device_name: Some(name.clone()),
                        ..NativeDiagnosticContext::default()
                    },
                );
                0
            }
        };
        response.push(NativeAudioDevice {
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
    fn native_dsp_settings_normalize_band_count_and_gain_limits() {
        let settings = NativeDspSettings {
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
    fn native_biquad_coefficients_are_finite() {
        for kind in [
            NativeEqBandKind::LowShelf,
            NativeEqBandKind::Peaking,
            NativeEqBandKind::HighShelf,
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
    fn native_soft_limiter_caps_extreme_samples() {
        assert_eq!(soft_limit(f32::NAN), 0.0);
        assert!(soft_limit(8.0) <= 1.0);
        assert!(soft_limit(-8.0) >= -1.0);
        assert_eq!(soft_limit(0.5), 0.5);
    }

    #[test]
    fn native_fade_progress_eases_without_overshoot() {
        assert_eq!(smooth_fade_progress(-1.0), 0.0);
        assert_eq!(smooth_fade_progress(0.0), 0.0);
        assert_eq!(smooth_fade_progress(1.0), 1.0);
        assert_eq!(smooth_fade_progress(2.0), 1.0);
        assert!(smooth_fade_progress(0.25) < 0.25);
        assert!(smooth_fade_progress(0.75) > 0.75);
    }

    #[test]
    fn native_visualizer_frame_uses_recent_audio_samples() {
        let sample_rate = 48_000_u32;
        let samples: Vec<f32> = (0..VISUALIZER_ANALYSIS_SAMPLES)
            .map(|index| {
                let phase = 2.0 * std::f32::consts::PI * 440.0 * index as f32 / sample_rate as f32;
                phase.sin() * 0.65
            })
            .collect();

        let frame = build_native_visualizer_frame(samples, sample_rate, now_millis(), true);

        assert!(frame.is_live);
        assert!(frame.level > 0.05);
        assert_eq!(frame.frequency_bins.len(), VISUALIZER_BINS);
        assert_eq!(frame.waveform.len(), VISUALIZER_WAVEFORM_POINTS);
        assert!(frame.frequency_bins.iter().any(|value| *value > 0.05));
    }

    #[test]
    fn native_dsp_source_does_not_block_when_visualizer_is_busy() {
        let channels = 2_u16;
        let frames = VISUALIZER_FLUSH_SAMPLES + 32;
        let samples: Vec<f32> = (0..frames * usize::from(channels))
            .map(|index| ((index % 23) as f32 - 11.0) / 100.0)
            .collect();
        let visualizer = Arc::new(Mutex::new(NativeVisualizerState::default()));
        let _held_visualizer_lock = visualizer.lock().unwrap();

        let source = NativeDspSource::new(
            VecSource::new(samples.clone(), channels, 48_000),
            Arc::new(Mutex::new(NativeDspSettings::default())),
            NativeGainControl::new(1.0),
            visualizer.clone(),
        );
        let rendered: Vec<f32> = source.collect();

        assert_eq!(rendered.len(), samples.len());
        for (actual, expected) in rendered.iter().zip(samples.iter()) {
            assert!((actual - expected).abs() < f32::EPSILON);
        }
    }

    #[test]
    fn native_diagnostics_keep_recent_entries() {
        let diagnostics = Arc::new(Mutex::new(Vec::new()));
        for index in 0..(DIAGNOSTIC_LIMIT + 5) {
            remember_diagnostic(
                &diagnostics,
                "error",
                "cpal",
                "test_operation",
                format!("failure {index}"),
                NativeDiagnosticContext::default(),
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
}
