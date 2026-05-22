use std::fs::File;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

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
    player: Option<Arc<Player>>,
    fading_player: Option<Arc<Player>>,
    current_path: Option<String>,
    duration_seconds: Option<f64>,
    volume: f32,
    device_id: Option<String>,
    device_name: Option<String>,
    buffer_frames: Option<u32>,
    sample_rate: Option<u32>,
    channel_count: Option<u16>,
    sample_format: Option<String>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    dsp_settings: Arc<Mutex<NativeDspSettings>>,
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
            stream_errors: Arc::new(Mutex::new(Vec::new())),
            dsp_settings: Arc::new(Mutex::new(NativeDspSettings::default())),
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

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeDspSettings {
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

fn default_limiter_enabled() -> bool {
    true
}

#[derive(Clone, Debug, PartialEq)]
struct NormalizedDspSettings {
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
            .map(|player| player.get_pos().as_secs_f64())
            .unwrap_or(0.0);
        let is_paused = self
            .player
            .as_ref()
            .map(|player| player.is_paused())
            .unwrap_or(false);
        let ended = self
            .player
            .as_ref()
            .map(|player| player.empty() && self.current_path.is_some())
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

    fn update_dsp_settings(&self, settings: Option<NativeDspSettings>) {
        if let Some(settings) = settings {
            if let Ok(mut current) = self.dsp_settings.lock() {
                *current = settings;
            }
        }
    }

    fn stop(&mut self) {
        if let Some(player) = self.player.take() {
            player.stop();
        }
        if let Some(player) = self.fading_player.take() {
            player.stop();
        }
        self.current_path = None;
        self.duration_seconds = None;
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

fn remember_stream_error(stream_errors: &Arc<Mutex<Vec<String>>>, message: String) {
    if let Ok(mut errors) = stream_errors.lock() {
        errors.push(message);
        if errors.len() > 20 {
            let overflow = errors.len() - 20;
            errors.drain(0..overflow);
        }
    }
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
) -> Result<(cpal::Device, Option<String>), String> {
    let host = cpal::default_host();
    if requested_id.is_none() {
        let device = host
            .default_output_device()
            .ok_or_else(|| "No default output device is available".to_string())?;
        return Ok((device, None));
    }

    let requested_id = requested_id.unwrap_or_default();
    let devices: Vec<cpal::Device> = host
        .output_devices()
        .map_err(|error| format!("Could not list output devices: {error}"))?
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

    Err(format!(
        "Output device is no longer available: {requested_id}"
    ))
}

fn open_output_sink(
    requested_id: Option<&str>,
    buffer_frames: Option<u32>,
    stream_errors: Arc<Mutex<Vec<String>>>,
) -> Result<(MixerDeviceSink, ResolvedOutput), String> {
    let (device, resolved_id) = find_output_device(requested_id)?;
    let name = device_name(&device);
    let mut builder = DeviceSinkBuilder::from_device(device)
        .map_err(|error| format!("Could not configure output device: {error}"))?;
    if let Some(frames) = buffer_frames {
        builder = builder.with_buffer_size(cpal::BufferSize::Fixed(frames));
    }
    let callback_errors = stream_errors.clone();
    let builder = builder.with_error_callback(move |error| {
        remember_stream_error(
            &callback_errors,
            format!("Native output stream error: {error}"),
        );
    });
    let sink = builder
        .open_sink_or_fallback()
        .map_err(|error| format!("Could not open native audio output: {error}"))?;
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
) -> Result<(Decoder<std::io::BufReader<File>>, Option<f64>), String> {
    let file = File::open(path).map_err(|error| format!("Could not open audio file: {error}"))?;
    let decoder = Decoder::try_from(file)
        .map_err(|error| format!("Could not decode audio file with native engine: {error}"))?;
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
    active_settings: NormalizedDspSettings,
    coefficients: Vec<BiquadCoefficients>,
    state_by_channel: Vec<Vec<BiquadState>>,
    channel_index: usize,
    check_countdown: usize,
}

impl<S> NativeDspSource<S>
where
    S: Source<Item = f32>,
{
    // Rodio pulls interleaved samples from Source, so the EQ keeps one biquad state
    // chain per output channel. That preserves stereo imaging while avoiding a heavier
    // custom mixer or external DSP dependency.
    fn new(input: S, settings: Arc<Mutex<NativeDspSettings>>) -> Self {
        let active_settings = settings
            .lock()
            .map(|settings| settings.normalized())
            .unwrap_or_else(|_| NativeDspSettings::default().normalized());
        let mut source = Self {
            input,
            settings,
            active_settings,
            coefficients: Vec::new(),
            state_by_channel: Vec::new(),
            channel_index: 0,
            check_countdown: 0,
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
        let Ok(settings) = self.settings.lock() else {
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
        let channels = self.channel_count();
        self.channel_index = (self.channel_index + 1) % channels;
        sample
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

fn seek_player(player: &Player, seconds: Option<f64>) -> Result<(), String> {
    if let Some(seconds) = seconds {
        if seconds.is_finite() && seconds > 0.0 {
            player
                .try_seek(Duration::from_secs_f64(seconds))
                .map_err(|error| format!("Native seek failed: {error}"))?;
        }
    }
    Ok(())
}

fn spawn_crossfade(
    old_player: Arc<Player>,
    new_player: Arc<Player>,
    target_volume: f32,
    duration_ms: u64,
) {
    thread::spawn(move || {
        if duration_ms == 0 {
            old_player.stop();
            new_player.set_volume(target_volume);
            return;
        }
        let started = Instant::now();
        let duration = Duration::from_millis(duration_ms);
        while started.elapsed() < duration {
            let progress =
                (started.elapsed().as_secs_f32() / duration.as_secs_f32()).clamp(0.0, 1.0);
            old_player.set_volume(target_volume * (1.0 - progress));
            new_player.set_volume(target_volume * progress);
            thread::sleep(Duration::from_millis(16));
        }
        old_player.stop();
        new_player.set_volume(target_volume);
    });
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
    if !path_buf.exists() || !path_buf.is_file() {
        return Err("Audio file does not exist".to_string());
    }

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    inner.ensure_sink(device_id, buffer_frames)?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);
    inner.stop();

    let (decoder, duration_seconds) = build_decoder(&path_buf)?;
    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Native audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let player = Arc::new(Player::connect_new(&mixer));
    let bounded_volume = clamp_volume(volume);
    player.set_volume(bounded_volume);
    player.append(NativeDspSource::new(decoder, inner.dsp_settings.clone()));
    seek_player(&player, start_seconds)?;
    player.play();

    inner.player = Some(player);
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
    if !path_buf.exists() || !path_buf.is_file() {
        return Err("Audio file does not exist".to_string());
    }

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Native playback lock poisoned".to_string())?;
    inner.ensure_sink(device_id, buffer_frames)?;
    if let Ok(mut errors) = inner.stream_errors.lock() {
        errors.clear();
    }
    inner.update_dsp_settings(dsp_settings);

    let (decoder, duration_seconds) = build_decoder(&path_buf)?;
    let mixer = inner
        .sink
        .as_ref()
        .ok_or_else(|| "Native audio output is unavailable".to_string())?
        .mixer()
        .clone();
    let new_player = Arc::new(Player::connect_new(&mixer));
    let target_volume = clamp_volume(volume);
    new_player.set_volume(0.0);
    new_player.append(NativeDspSource::new(decoder, inner.dsp_settings.clone()));
    seek_player(&new_player, start_seconds)?;
    new_player.play();

    let old_player = inner.player.replace(new_player.clone());
    inner.fading_player = old_player.clone();
    inner.current_path = Some(path);
    inner.duration_seconds = duration_seconds;
    inner.volume = target_volume;
    let status = inner.status(None);

    if let Some(old_player) = old_player {
        let bounded_duration = duration_ms.min(20_000);
        spawn_crossfade(old_player, new_player, target_volume, bounded_duration);
    } else {
        new_player.set_volume(target_volume);
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
    player.play();
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
    player.pause();
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
        .try_seek(Duration::from_secs_f64(bounded_seconds))
        .map_err(|error| format!("Native seek failed: {error}"))?;
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
    if let Some(player) = &inner.player {
        player.set_volume(bounded);
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
pub fn native_list_output_devices() -> Result<Vec<NativeAudioDevice>, String> {
    let host = cpal::default_host();
    let default_name = default_output_device_name();
    let devices = host
        .output_devices()
        .map_err(|error| format!("Could not list output devices: {error}"))?;
    let mut response = Vec::new();
    for (index, device) in devices.enumerate() {
        let name = device_name(&device);
        let default_config = device.default_output_config().ok();
        let supported_configs = device
            .supported_output_configs()
            .map(|configs| configs.count())
            .unwrap_or(0);
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

    #[test]
    fn native_dsp_settings_normalize_band_count_and_gain_limits() {
        let settings = NativeDspSettings {
            equalizer_enabled: true,
            equalizer_band_mode: "15".to_string(),
            equalizer_preamp_db: 30.0,
            equalizer_gains: vec![18.0, -18.0, 3.5],
            limiter_enabled: true,
        };

        let normalized = settings.normalized();

        assert_eq!(normalized.frequencies.len(), 15);
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
}
