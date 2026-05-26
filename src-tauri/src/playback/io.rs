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

fn build_decoder(
    path: &PathBuf,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
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
    let decoder = Decoder::try_from(file).map_err(|error| {
        diagnostic_error(
            diagnostics,
            "symphonia",
            "decode_audio_file",
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

fn seek_player(
    player: &Player,
    seconds: Option<f64>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
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

