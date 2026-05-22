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
    Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source,
};
use serde::Serialize;
use tauri::State;

#[derive(Default)]
pub struct NativePlaybackState {
    inner: Mutex<NativePlaybackInner>,
}

#[derive(Default)]
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
}

fn clamp_volume(volume: f32) -> f32 {
    if volume.is_finite() {
        volume.clamp(0.0, 1.5)
    } else {
        1.0
    }
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
    player.append(decoder);
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
    new_player.append(decoder);
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
