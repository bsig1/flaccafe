fn remember_diagnostic(
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    severity: &str,
    category: &str,
    operation: &str,
    message: String,
    context: DesktopDiagnosticContext,
) {
    if let Ok(mut entries) = diagnostics.lock() {
        entries.push(PlaybackDiagnostic {
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
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    category: &str,
    operation: &str,
    message: String,
    context: DesktopDiagnosticContext,
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
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    message: String,
    context: DesktopDiagnosticContext,
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
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(cpal::Device, Option<String>), String> {
    let host = cpal::default_host();
    if requested_id.is_none() {
        let device = host.default_output_device().ok_or_else(|| {
            diagnostic_error(
                diagnostics,
                "cpal",
                "select_default_output_device",
                "No default output device is available".to_string(),
                DesktopDiagnosticContext::default(),
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
                DesktopDiagnosticContext {
                    device_id: Some(requested_id.to_string()),
                    ..DesktopDiagnosticContext::default()
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
        DesktopDiagnosticContext {
            device_id: Some(requested_id.to_string()),
            ..DesktopDiagnosticContext::default()
        },
    ))
}

fn open_output_sink(
    requested_id: Option<&str>,
    buffer_frames: Option<u32>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(MixerDeviceSink, ResolvedOutput), String> {
    let (device, resolved_id) = find_output_device(requested_id, &diagnostics)?;
    let name = device_name(&device);
    let mut builder = DeviceSinkBuilder::from_device(device).map_err(|error| {
        diagnostic_error(
            &diagnostics,
            "cpal",
            "configure_output_device",
            format!("Could not configure output device: {error}"),
            DesktopDiagnosticContext {
                device_id: resolved_id
                    .clone()
                    .or_else(|| requested_id.map(str::to_string)),
                device_name: Some(name.clone()),
                buffer_frames,
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    if let Some(frames) = buffer_frames {
        builder = builder.with_buffer_size(cpal::BufferSize::Fixed(frames));
    }
    let callback_errors = stream_errors.clone();
    let callback_diagnostics = diagnostics.clone();
    let callback_context = DesktopDiagnosticContext {
        device_id: resolved_id
            .clone()
            .or_else(|| requested_id.map(str::to_string)),
        device_name: Some(name.clone()),
        buffer_frames,
        ..DesktopDiagnosticContext::default()
    };
    let builder = builder.with_error_callback(move |error| {
        remember_stream_error(
            &callback_errors,
            &callback_diagnostics,
            format!("Rust output stream error: {error}"),
            callback_context.clone(),
        );
    });
    let sink = builder.open_sink_or_fallback().map_err(|error| {
        diagnostic_error(
            &diagnostics,
            "cpal",
            "open_output_sink",
            format!("Could not open Rust audio output: {error}"),
            DesktopDiagnosticContext {
                device_id: resolved_id
                    .clone()
                    .or_else(|| requested_id.map(str::to_string)),
                device_name: Some(name.clone()),
                buffer_frames,
                ..DesktopDiagnosticContext::default()
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

use std::fs;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;
use std::sync::Mutex as StdMutex;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DesktopPlaybackSource {
    File {
        path: String,
    },
    Url {
        url: String,
        cache_key: Option<String>,
        title: Option<String>,
        #[serde(default)]
        live: bool,
    },
    CdTrack {
        drive_id: String,
        track_number: u32,
        title: Option<String>,
    },
}

impl DesktopPlaybackSource {
    fn identity(&self) -> String {
        match self {
            DesktopPlaybackSource::File { path } => path.clone(),
            DesktopPlaybackSource::Url { url, .. } => url.clone(),
            DesktopPlaybackSource::CdTrack {
                drive_id,
                track_number,
                ..
            } => format!("cdda://{drive_id}/track/{track_number:02}"),
        }
    }
}

struct ResolvedPlaybackSource {
    identity: String,
    reload_path: Option<String>,
    decoder: DesktopPlaybackDecoder,
    duration_seconds: Option<f64>,
    sample_rate: u32,
}

struct HttpStreamReader {
    reader: StdMutex<Box<dyn Read + Send>>,
    position: u64,
}

impl HttpStreamReader {
    fn new(reader: Box<dyn Read + Send>) -> Self {
        Self {
            reader: StdMutex::new(reader),
            position: 0,
        }
    }
}

impl Read for HttpStreamReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut reader = self
            .reader
            .lock()
            .map_err(|_| io::Error::new(io::ErrorKind::Other, "HTTP stream lock poisoned"))?;
        let read = reader.read(buf)?;
        self.position = self.position.saturating_add(read as u64);
        Ok(read)
    }
}

impl Seek for HttpStreamReader {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        match position {
            SeekFrom::Current(0) => Ok(self.position),
            SeekFrom::Start(target) if target == self.position => Ok(self.position),
            SeekFrom::End(_) | SeekFrom::Start(_) | SeekFrom::Current(_) => Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "Live HTTP audio streams are not seekable",
            )),
        }
    }
}

enum DesktopPlaybackDecoder {
    File(Decoder<std::io::BufReader<File>>),
    Prepared(Decoder<Cursor<Arc<[u8]>>>),
    Stream(Decoder<HttpStreamReader>),
}

impl DesktopPlaybackDecoder {
    fn sample_rate(&self) -> u32 {
        match self {
            DesktopPlaybackDecoder::File(decoder) => decoder.sample_rate().get(),
            DesktopPlaybackDecoder::Prepared(decoder) => decoder.sample_rate().get(),
            DesktopPlaybackDecoder::Stream(decoder) => decoder.sample_rate().get(),
        }
    }

    fn seek_to(
        &mut self,
        seconds: Option<f64>,
        diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
        path: Option<String>,
    ) -> Result<(), String> {
        match self {
            DesktopPlaybackDecoder::File(decoder) => seek_source(decoder, seconds, diagnostics, path),
            DesktopPlaybackDecoder::Prepared(decoder) => {
                seek_source(decoder, seconds, diagnostics, path)
            }
            DesktopPlaybackDecoder::Stream(decoder) => seek_source(decoder, seconds, diagnostics, path),
        }
    }

    fn append_to(
        self,
        player: &Player,
        dsp_settings: Arc<Mutex<DesktopDspSettings>>,
        gain: DesktopGainControl,
        visualizer: Arc<Mutex<DesktopVisualizerState>>,
    ) {
        match self {
            DesktopPlaybackDecoder::File(decoder) => {
                append_dsp_source(player, decoder, dsp_settings, gain, visualizer);
            }
            DesktopPlaybackDecoder::Prepared(decoder) => {
                append_dsp_source(player, decoder, dsp_settings, gain, visualizer);
            }
            DesktopPlaybackDecoder::Stream(decoder) => {
                append_dsp_source(player, decoder, dsp_settings, gain, visualizer);
            }
        }
    }
}

fn validate_file_source(
    path: &str,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    operation: &str,
) -> Result<PathBuf, String> {
    let path_buf = PathBuf::from(path);
    if !path_buf.exists() || !path_buf.is_file() {
        return Err(diagnostic_error(
            diagnostics,
            "file",
            operation,
            "Audio file does not exist".to_string(),
            DesktopDiagnosticContext {
                path: Some(path.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        ));
    }
    Ok(path_buf)
}

fn resolve_playback_source(
    source: &DesktopPlaybackSource,
    prepared_audio: Option<DesktopPreparedAudio>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<ResolvedPlaybackSource, String> {
    let identity = source.identity();
    match source {
        DesktopPlaybackSource::File { path } => {
            let path_buf = validate_file_source(path, diagnostics, "validate_audio_file")?;
            let (decoder, duration_seconds) =
                build_playback_decoder(&path_buf, prepared_audio, diagnostics)?;
            let sample_rate = decoder.sample_rate();
            Ok(ResolvedPlaybackSource {
                identity,
                reload_path: Some(path.clone()),
                decoder,
                duration_seconds,
                sample_rate,
            })
        }
        DesktopPlaybackSource::Url {
            url,
            cache_key,
            title,
            live,
        } => {
            if *live {
                let (decoder, duration_seconds) =
                    build_stream_decoder(url, title.as_deref(), diagnostics)?;
                let sample_rate = decoder.sample_rate().get();
                return Ok(ResolvedPlaybackSource {
                    identity,
                    reload_path: None,
                    decoder: DesktopPlaybackDecoder::Stream(decoder),
                    duration_seconds,
                    sample_rate,
                });
            }
            let path_buf =
                download_url_source_to_cache(url, cache_key.as_deref(), title.as_deref(), diagnostics)?;
            let path_text = path_buf.display().to_string();
            let (decoder, duration_seconds) = build_playback_decoder(&path_buf, None, diagnostics)?;
            let sample_rate = decoder.sample_rate();
            Ok(ResolvedPlaybackSource {
                identity,
                reload_path: Some(path_text),
                decoder,
                duration_seconds,
                sample_rate,
            })
        }
        DesktopPlaybackSource::CdTrack {
            drive_id,
            track_number,
            title,
        } => {
            let path_buf = crate::library::cd::prepare_cd_playback_wav(
                drive_id,
                i64::from(*track_number),
                title.as_deref(),
            )?;
            let path_text = path_buf.display().to_string();
            let (decoder, duration_seconds) = build_playback_decoder(&path_buf, None, diagnostics)?;
            let sample_rate = decoder.sample_rate();
            Ok(ResolvedPlaybackSource {
                identity,
                reload_path: Some(path_text),
                decoder,
                duration_seconds,
                sample_rate,
            })
        }
    }
}

fn playback_cache_dir() -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join("flac-cafe").join("playback-cache");
    fs::create_dir_all(&path).map_err(|error| format!("Could not create playback cache: {error}"))?;
    Ok(path)
}

fn sanitize_cache_part(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
            output.push(character);
        } else {
            output.push('_');
        }
    }
    let trimmed = output.trim_matches('_');
    if trimmed.is_empty() {
        "source".to_string()
    } else {
        trimmed.chars().take(96).collect()
    }
}

fn extension_from_url(url: &str) -> &'static str {
    let without_query = url.split(['?', '#']).next().unwrap_or(url);
    match Path::new(without_query)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp3") => "mp3",
        Some("m4a") => "m4a",
        Some("aac") => "aac",
        Some("ogg") => "ogg",
        Some("opus") => "opus",
        Some("flac") => "flac",
        Some("wav") => "wav",
        _ => "audio",
    }
}

fn download_url_source_to_cache(
    url: &str,
    cache_key: Option<&str>,
    title: Option<&str>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<PathBuf, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(diagnostic_error(
            diagnostics,
            "url",
            "resolve_url_source",
            "Only http and https audio URLs can be played by the Rust audio engine right now".to_string(),
            DesktopDiagnosticContext {
                path: Some(url.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        ));
    }
    let cache_dir = playback_cache_dir()?;
    let base = cache_key
        .or(title)
        .map(sanitize_cache_part)
        .unwrap_or_else(|| sanitize_cache_part(url));
    let extension = extension_from_url(url);
    let target = cache_dir.join(format!("{base}.{extension}"));
    if target.exists() && target.is_file() {
        return Ok(target);
    }
    let partial = cache_dir.join(format!("{base}.{extension}.part"));
    let response = ureq::get(url)
        .set("User-Agent", "FLAC Cafe/0.6 (https://github.com/bsig1/flaccafe)")
        .call()
        .map_err(|error| {
            diagnostic_error(
                diagnostics,
                "url",
                "download_url_source",
                format!("Could not open audio URL: {error}"),
                DesktopDiagnosticContext {
                    path: Some(url.to_string()),
                    ..DesktopDiagnosticContext::default()
                },
            )
        })?;
    let mut reader = response.into_reader();
    let mut file = File::create(&partial).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "file",
            "create_url_cache_file",
            format!("Could not create audio cache file: {error}"),
            DesktopDiagnosticContext {
                path: Some(partial.display().to_string()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    io::copy(&mut reader, &mut file).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "url",
            "write_url_cache_file",
            format!("Could not cache audio URL: {error}"),
            DesktopDiagnosticContext {
                path: Some(url.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    fs::rename(&partial, &target).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "file",
            "commit_url_cache_file",
            format!("Could not finalize audio cache file: {error}"),
            DesktopDiagnosticContext {
                path: Some(target.display().to_string()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    Ok(target)
}

fn build_stream_decoder(
    url: &str,
    title: Option<&str>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(Decoder<HttpStreamReader>, Option<f64>), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(diagnostic_error(
            diagnostics,
            "url",
            "open_live_stream",
            "Only http and https radio streams can be played by the Rust audio engine right now".to_string(),
            DesktopDiagnosticContext {
                path: Some(url.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        ));
    }
    let response = ureq::get(url)
        .set("User-Agent", "FLAC Cafe/0.6 (https://github.com/bsig1/flaccafe)")
        .call()
        .map_err(|error| {
            diagnostic_error(
                diagnostics,
                "url",
                "open_live_stream",
                format!(
                    "Could not open live audio stream{}: {error}",
                    title
                        .map(|value| format!(" for {value}"))
                        .unwrap_or_default()
                ),
                DesktopDiagnosticContext {
                    path: Some(url.to_string()),
                    ..DesktopDiagnosticContext::default()
                },
            )
        })?;
    let content_type = response
        .header("content-type")
        .map(str::to_string)
        .unwrap_or_default();
    let mut builder = Decoder::builder()
        .with_data(HttpStreamReader::new(response.into_reader()))
        .with_seekable(false);
    if !content_type.is_empty() {
        builder = builder.with_mime_type(&content_type);
    } else {
        builder = builder.with_hint(extension_from_url(url));
    }
    let decoder = builder.build().map_err(|error| {
        diagnostic_error(
            diagnostics,
            "symphonia",
            "decode_live_stream",
            format!("Could not decode live audio stream with Rust audio engine: {error}"),
            DesktopDiagnosticContext {
                path: Some(url.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    Ok((decoder, None))
}

fn build_playback_decoder(
    path: &PathBuf,
    prepared_audio: Option<DesktopPreparedAudio>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(DesktopPlaybackDecoder, Option<f64>), String> {
    if let Some(prepared) = prepared_audio {
        let decoder = build_prepared_decoder(&prepared, diagnostics)?;
        return Ok((
            DesktopPlaybackDecoder::Prepared(decoder),
            prepared.duration_seconds,
        ));
    }
    let (decoder, duration_seconds) = build_decoder(path, diagnostics)?;
    Ok((DesktopPlaybackDecoder::File(decoder), duration_seconds))
}

fn build_decoder(
    path: &PathBuf,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(Decoder<std::io::BufReader<File>>, Option<f64>), String> {
    build_decoder_with_seek_mode(path, diagnostics, false)
}

fn build_seek_fallback_decoder(
    path: &PathBuf,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(Decoder<std::io::BufReader<File>>, Option<f64>), String> {
    build_decoder_with_seek_mode(path, diagnostics, true)
}

fn build_decoder_with_seek_mode(
    path: &PathBuf,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    coarse_seek: bool,
) -> Result<(Decoder<std::io::BufReader<File>>, Option<f64>), String> {
    let path_text = path.display().to_string();
    let file = File::open(path).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "file",
            "open_audio_file",
            format!("Could not open audio file: {error}"),
            DesktopDiagnosticContext {
                path: Some(path_text.clone()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    let byte_len = file.metadata().map_err(|error| {
        diagnostic_error(
            diagnostics,
            "file",
            "read_audio_file_metadata",
            format!("Could not read audio file metadata: {error}"),
            DesktopDiagnosticContext {
                path: Some(path_text.clone()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    let mut builder = Decoder::builder()
        .with_data(std::io::BufReader::new(file))
        .with_byte_len(byte_len.len())
        .with_seekable(true)
        .with_coarse_seek(coarse_seek);
    if let Some(extension) = path.extension().and_then(|value| value.to_str()) {
        builder = builder.with_hint(extension);
    }
    let decoder = builder.build().map_err(|error| {
        diagnostic_error(
            diagnostics,
            "symphonia",
            if coarse_seek {
                "decode_audio_file_seek_fallback"
            } else {
                "decode_audio_file"
            },
            format!("Could not decode audio file with Rust audio engine: {error}"),
            DesktopDiagnosticContext {
                path: Some(path_text),
                ..DesktopDiagnosticContext::default()
            },
        )
    })?;
    let duration_seconds = decoder
        .total_duration()
        .map(|duration| duration.as_secs_f64());
    Ok((decoder, duration_seconds))
}

fn build_prepared_decoder(
    prepared: &DesktopPreparedAudio,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<Decoder<Cursor<Arc<[u8]>>>, String> {
    Decoder::try_from(Cursor::new(prepared.bytes.clone())).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "symphonia",
            "decode_prepared_audio",
            format!("Could not decode prepared Rust audio: {error}"),
            DesktopDiagnosticContext {
                path: Some(prepared.path.clone()),
                ..DesktopDiagnosticContext::default()
            },
        )
    })
}

const SEEK_END_GUARD_SECONDS: f64 = 0.25;

fn clamp_seek_seconds(seconds: f64, duration_seconds: Option<f64>) -> f64 {
    let mut bounded = if seconds.is_finite() && seconds > 0.0 {
        seconds
    } else {
        0.0
    };
    if let Some(duration) = duration_seconds {
        if duration.is_finite() && duration > 0.0 {
            let end_guard = SEEK_END_GUARD_SECONDS.min(duration / 2.0);
            let max_seek = (duration - end_guard).max(0.0);
            if bounded > max_seek {
                bounded = max_seek;
            }
        }
    }
    bounded
}

fn clamp_seek_option(seconds: Option<f64>, duration_seconds: Option<f64>) -> Option<f64> {
    let seconds = seconds?;
    let bounded = clamp_seek_seconds(seconds, duration_seconds);
    if bounded > 0.0 {
        Some(bounded)
    } else {
        None
    }
}

fn seek_source<S>(
    source: &mut S,
    seconds: Option<f64>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    path: Option<String>,
) -> Result<(), String>
where
    S: Source<Item = f32>,
{
    if let Some(seconds) = seconds {
        if seconds.is_finite() && seconds > 0.0 {
            source
                .try_seek(Duration::from_secs_f64(seconds))
                .map_err(|error| {
                    diagnostic_error(
                        diagnostics,
                        "rodio",
                        "seek",
                        format!("Rust seek failed: {error}"),
                        DesktopDiagnosticContext {
                            path,
                            ..DesktopDiagnosticContext::default()
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

