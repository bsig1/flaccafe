use std::fs::File;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU32, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rodio::{
    cpal::{
        self,
        traits::{DeviceTrait, HostTrait},
    },
    Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source,
};
use serde::{Deserialize, Serialize};
use tauri::State;

mod dsp;

use self::dsp::{append_dsp_source, DesktopDspSettings};
#[cfg(windows)]
use self::wasapi_exclusive::WasapiExclusiveSink;
#[cfg(test)]
use self::dsp::{biquad_coefficients, soft_limit, DesktopDspSource, DesktopEqBandKind};

#[derive(Default)]
pub struct PlaybackState {
    inner: Mutex<PlaybackInner>,
}

struct PlaybackInner {
    sink: Option<DesktopOutputSink>,
    player: Option<PlaybackHandle>,
    fading_player: Option<PlaybackHandle>,
    current_path: Option<String>,
    current_reload_path: Option<String>,
    duration_seconds: Option<f64>,
    volume: f32,
    output_backend: DesktopOutputBackendMode,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
    prepared_next_path: Option<String>,
    prepared_next_duration_seconds: Option<f64>,
    prepared_next_at_ms: Option<u64>,
    prepared_next_audio: Option<DesktopPreparedAudio>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    dsp_settings: Arc<Mutex<DesktopDspSettings>>,
    visualizer: Arc<Mutex<DesktopVisualizerState>>,
}

enum DesktopOutputSink {
    Shared(MixerDeviceSink),
    #[cfg(windows)]
    WasapiExclusive(WasapiExclusiveSink),
}

impl DesktopOutputSink {
    fn mixer(&self) -> &rodio::mixer::Mixer {
        match self {
            DesktopOutputSink::Shared(sink) => sink.mixer(),
            #[cfg(windows)]
            DesktopOutputSink::WasapiExclusive(sink) => sink.mixer(),
        }
    }

    fn log_on_drop(&mut self, enabled: bool) {
        match self {
            DesktopOutputSink::Shared(sink) => sink.log_on_drop(enabled),
            #[cfg(windows)]
            DesktopOutputSink::WasapiExclusive(sink) => sink.log_on_drop(enabled),
        }
    }

    fn is_exclusive(&self) -> bool {
        match self {
            DesktopOutputSink::Shared(_) => false,
            #[cfg(windows)]
            DesktopOutputSink::WasapiExclusive(_) => true,
        }
    }

    fn is_usable(&self) -> bool {
        match self {
            DesktopOutputSink::Shared(_) => true,
            #[cfg(windows)]
            DesktopOutputSink::WasapiExclusive(sink) => !sink.is_finished(),
        }
    }
}

#[derive(Clone)]
struct PlaybackHandle {
    player: Arc<Player>,
    gain: DesktopGainControl,
    sample_rate: u32,
}

#[derive(Clone)]
struct DesktopPreparedAudio {
    path: String,
    bytes: Arc<[u8]>,
    duration_seconds: Option<f64>,
    prepared_at_ms: u64,
}

#[derive(Clone)]
struct DesktopGainControl {
    state: Arc<DesktopGainState>,
}

struct DesktopGainState {
    current_gain: AtomicU32,
    start_gain: AtomicU32,
    target_gain: AtomicU32,
    fade_total_frames: AtomicU64,
    fade_elapsed_frames: AtomicU64,
}

impl DesktopGainControl {
    fn new(volume: f32) -> Self {
        let bounded = clamp_volume(volume);
        let bits = bounded.to_bits();
        Self {
            state: Arc::new(DesktopGainState {
                current_gain: AtomicU32::new(bits),
                start_gain: AtomicU32::new(bits),
                target_gain: AtomicU32::new(bits),
                fade_total_frames: AtomicU64::new(0),
                fade_elapsed_frames: AtomicU64::new(0),
            }),
        }
    }

    fn set_immediate(&self, volume: f32) {
        let bounded = clamp_volume(volume);
        let bits = bounded.to_bits();
        self.state.current_gain.store(bits, Ordering::Release);
        self.state.start_gain.store(bits, Ordering::Release);
        self.state.target_gain.store(bits, Ordering::Release);
        self.state.fade_elapsed_frames.store(0, Ordering::Release);
        self.state.fade_total_frames.store(0, Ordering::Release);
    }

    fn fade_to(&self, volume: f32, duration: Duration, sample_rate: u32) {
        let bounded = clamp_volume(volume);
        let frames = fade_frame_count(duration, sample_rate);
        if frames == 0 {
            self.set_immediate(bounded);
            return;
        }
        let current = self.state.current_gain.load(Ordering::Acquire);
        self.state.start_gain.store(current, Ordering::Release);
        self.state
            .target_gain
            .store(bounded.to_bits(), Ordering::Release);
        self.state.fade_elapsed_frames.store(0, Ordering::Release);
        self.state.fade_total_frames.store(frames, Ordering::Release);
    }

    fn next_frame_gain(&self) -> f32 {
        let total = self.state.fade_total_frames.load(Ordering::Acquire);
        if total == 0 {
            return f32::from_bits(self.state.current_gain.load(Ordering::Acquire));
        }
        let elapsed = self
            .state
            .fade_elapsed_frames
            .fetch_add(1, Ordering::AcqRel)
            .saturating_add(1);
        let progress = (elapsed as f32 / total as f32).clamp(0.0, 1.0);
        let eased = smooth_fade_progress(progress);
        let start = f32::from_bits(self.state.start_gain.load(Ordering::Acquire));
        let target = f32::from_bits(self.state.target_gain.load(Ordering::Acquire));
        let gain = start + (target - start) * eased;
        self.state
            .current_gain
            .store(clamp_volume(gain).to_bits(), Ordering::Release);
        if elapsed >= total {
            let target_bits = target.to_bits();
            self.state.current_gain.store(target_bits, Ordering::Release);
            self.state.start_gain.store(target_bits, Ordering::Release);
            self.state.fade_elapsed_frames.store(0, Ordering::Release);
            self.state.fade_total_frames.store(0, Ordering::Release);
            return target;
        }
        gain
    }
}

impl Default for PlaybackInner {
    fn default() -> Self {
        Self {
            sink: None,
            player: None,
            fading_player: None,
            current_path: None,
            current_reload_path: None,
            duration_seconds: None,
            volume: 1.0,
            output_backend: DesktopOutputBackendMode::default(),
            device_id: None,
            device_name: None,
            buffer_frames: None,
            sample_rate: None,
            channel_count: None,
            sample_format: None,
            prepared_next_path: None,
            prepared_next_duration_seconds: None,
            prepared_next_at_ms: None,
            prepared_next_audio: None,
            stream_errors: Arc::new(Mutex::new(Vec::new())),
            diagnostics: Arc::new(Mutex::new(Vec::new())),
            dsp_settings: Arc::new(Mutex::new(DesktopDspSettings::default())),
            visualizer: Arc::new(Mutex::new(DesktopVisualizerState::default())),
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
const FADE_STOP_PAD_MS: u64 = 200;
const CLICKLESS_START_RAMP_MS: u64 = 18;
const CLICKLESS_SEEK_RAMP_MS: u64 = 28;

static NEXT_DIAGNOSTIC_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize)]
pub struct PlaybackStatus {
    available: bool,
    current_path: Option<String>,
    output_backend: String,
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
struct DesktopDiagnosticContext {
    path: Option<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DesktopOutputBackendMode {
    CpalShared,
    WasapiExclusive,
}

impl Default for DesktopOutputBackendMode {
    fn default() -> Self {
        Self::CpalShared
    }
}

impl DesktopOutputBackendMode {
    fn id(self) -> &'static str {
        match self {
            DesktopOutputBackendMode::CpalShared => "cpalShared",
            DesktopOutputBackendMode::WasapiExclusive => "wasapiExclusive",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct PlaybackDiagnostic {
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
pub struct PlaybackDiagnosticsResponse {
    entries: Vec<PlaybackDiagnostic>,
    stream_errors: Vec<String>,
    current_path: Option<String>,
    prepared_next_path: Option<String>,
    prepared_next_duration_seconds: Option<f64>,
    prepared_next_at_ms: Option<u64>,
    output_backend: String,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
    dropped_frames: u64,
}

#[derive(Serialize)]
pub struct DesktopAudioDevice {
    id: String,
    name: String,
    is_default: bool,
    default_sample_rate: Option<u32>,
    default_channels: Option<u16>,
    default_sample_format: Option<String>,
    supported_configs: usize,
}

#[derive(Serialize)]
pub struct DesktopPreparedTrack {
    path: String,
    duration_seconds: Option<f64>,
    prepared_at_ms: u64,
    message: String,
}

#[derive(Serialize)]
pub struct DesktopOutputBackend {
    id: String,
    label: String,
    available: bool,
    exclusive: bool,
    message: String,
}

#[derive(Debug)]
struct DesktopVisualizerState {
    samples: Vec<f32>,
    write_index: usize,
    filled: bool,
    sample_rate: u32,
    last_updated_ms: u64,
}

impl Default for DesktopVisualizerState {
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

impl DesktopVisualizerState {
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
pub struct DesktopVisualizerFrame {
    is_live: bool,
    level: f32,
    peak: f32,
    frequency_bins: Vec<f32>,
    waveform: Vec<f32>,
    timestamp_ms: u64,
}

