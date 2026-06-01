// Windows-only direct output path. Shared CPAL remains the stable default; this
// module exists for users who want to bypass the Windows shared mixer.
use std::ffi::OsString;
use std::mem;
use std::os::windows::ffi::OsStringExt;
use std::ptr;
use std::slice;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use rodio::mixer::{mixer, Mixer, MixerSource};
use rodio::{ChannelCount, SampleRate};
use windows::core::{HRESULT, PCSTR, PCWSTR};
use windows::Win32::Devices::Properties;
use windows::Win32::Foundation::{
    CloseHandle, HANDLE, PROPERTYKEY, S_FALSE, S_OK, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows::Win32::Media::{Audio, KernelStreaming, Multimedia};
use windows::Win32::System::Com::StructuredStorage::{PropVariantClear, PROPVARIANT};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED, STGM_READ,
};
use windows::Win32::System::Threading::{
    AvRevertMmThreadCharacteristics, AvSetMmThreadCharacteristicsA, AvSetMmThreadPriority,
    CreateEventW, SetThreadPriority, WaitForSingleObject, AVRT_PRIORITY_CRITICAL,
    THREAD_PRIORITY_TIME_CRITICAL,
};
use windows::Win32::System::Variant::VT_LPWSTR;

use super::{
    diagnostic_error, remember_diagnostic, remember_stream_error, DesktopDiagnosticContext,
    DesktopOutputBackendMode, PlaybackDiagnostic, ResolvedOutput,
};

const WASAPI_EXCLUSIVE_DEFAULT_BUFFER_MS: u32 = 250;
const WASAPI_EXCLUSIVE_LATE_POLL_MS: u128 = 30;
const WASAPI_EXCLUSIVE_TIMING_WARNING_MS: u64 = 5_000;
const WASAPI_EXCLUSIVE_EVENT_WAIT_MS: u32 = 250;

#[derive(Clone, Copy)]
enum WasapiSampleFormat {
    F32,
    I16,
}

impl WasapiSampleFormat {
    fn label(self) -> &'static str {
        match self {
            WasapiSampleFormat::F32 => "F32",
            WasapiSampleFormat::I16 => "I16",
        }
    }

    fn bytes_per_sample(self) -> u16 {
        match self {
            WasapiSampleFormat::F32 => 4,
            WasapiSampleFormat::I16 => 2,
        }
    }
}

#[derive(Clone, Copy)]
struct WasapiFormat {
    channels: u16,
    sample_rate: u32,
    sample_format: WasapiSampleFormat,
}

pub(super) struct WasapiExclusiveSink {
    mixer: Mixer,
    stop: Arc<AtomicBool>,
    finished: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    log_on_drop: bool,
}

impl WasapiExclusiveSink {
    pub(super) fn open(
        requested_id: Option<&str>,
        buffer_frames: Option<u32>,
        stream_errors: Arc<Mutex<Vec<String>>>,
        diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    ) -> Result<(Self, ResolvedOutput), String> {
        let requested_id = requested_id.map(str::to_string);
        let stop = Arc::new(AtomicBool::new(false));
        let finished = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let thread_finished = finished.clone();
        let thread_diagnostics = diagnostics.clone();
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);

        let thread = thread::Builder::new()
            .name("flac-cafe-wasapi-exclusive".to_string())
            .spawn(move || {
                if let Err(message) = run_wasapi_exclusive_output(
                    requested_id,
                    buffer_frames,
                    thread_stop,
                    stream_errors,
                    thread_diagnostics,
                    ready_tx.clone(),
                ) {
                    let _ = ready_tx.send(Err(message));
                }
                thread_finished.store(true, Ordering::Release);
            })
            .map_err(|error| {
                diagnostic_error(
                    &diagnostics,
                    "wasapi",
                    "spawn_wasapi_exclusive_thread",
                    format!("Could not start WASAPI exclusive output thread: {error}"),
                    DesktopDiagnosticContext {
                        buffer_frames,
                        ..DesktopDiagnosticContext::default()
                    },
                )
            })?;

        match ready_rx.recv() {
            Ok(Ok((mixer, resolved))) => Ok((
                Self {
                    mixer,
                    stop,
                    finished,
                    thread: Some(thread),
                    log_on_drop: true,
                },
                resolved,
            )),
            Ok(Err(message)) => {
                let _ = thread.join();
                Err(message)
            }
            Err(error) => {
                let _ = thread.join();
                Err(diagnostic_error(
                    &diagnostics,
                    "wasapi",
                    "open_wasapi_exclusive_sink",
                    format!("WASAPI exclusive output thread ended before it reported readiness: {error}"),
                    DesktopDiagnosticContext {
                        buffer_frames,
                        ..DesktopDiagnosticContext::default()
                    },
                ))
            }
        }
    }

    pub(super) fn mixer(&self) -> &Mixer {
        &self.mixer
    }

    pub(super) fn log_on_drop(&mut self, enabled: bool) {
        self.log_on_drop = enabled;
    }

    pub(super) fn is_finished(&self) -> bool {
        self.finished.load(Ordering::Acquire)
    }
}

impl Drop for WasapiExclusiveSink {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        if self.log_on_drop && !std::thread::panicking() {
            eprintln!("Dropping WASAPI exclusive sink, audio playing through this sink will stop");
        }
    }
}

struct EventHandle(HANDLE);

impl EventHandle {
    fn create(
        diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
        context: DesktopDiagnosticContext,
    ) -> Result<Self, String> {
        let handle =
            unsafe { CreateEventW(None, false, false, PCWSTR::null()) }.map_err(|error| {
                diagnostic_error(
                    diagnostics,
                    "wasapi",
                    "create_wasapi_exclusive_event",
                    format!("Could not create WASAPI exclusive render event: {error}"),
                    context,
                )
            })?;
        Ok(Self(handle))
    }

    fn raw(&self) -> HANDLE {
        self.0
    }
}

impl Drop for EventHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

fn run_wasapi_exclusive_output(
    requested_id: Option<String>,
    buffer_frames: Option<u32>,
    stop: Arc<AtomicBool>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    ready_tx: mpsc::SyncSender<Result<(Mixer, ResolvedOutput), String>>,
) -> Result<(), String> {
    let _com = ComApartment::initialize(&diagnostics)?;
    let _mmcss = MmcssGuard::enable();
    unsafe {
        let _ = SetThreadPriority(
            windows::Win32::System::Threading::GetCurrentThread(),
            THREAD_PRIORITY_TIME_CRITICAL,
        );
    }

    let selected_device = select_output_device(requested_id.as_deref(), &diagnostics)?;
    let (format, buffer_duration) =
        choose_exclusive_format(&selected_device.device, buffer_frames, &diagnostics)?;
    let channels = ChannelCount::new(format.channels).ok_or_else(|| {
        diagnostic_error(
            &diagnostics,
            "wasapi",
            "configure_wasapi_mixer",
            "WASAPI exclusive device reported zero output channels".to_string(),
            selected_device.context(buffer_frames),
        )
    })?;
    let sample_rate = SampleRate::new(format.sample_rate).ok_or_else(|| {
        diagnostic_error(
            &diagnostics,
            "wasapi",
            "configure_wasapi_mixer",
            "WASAPI exclusive device reported a zero sample rate".to_string(),
            selected_device.context(buffer_frames),
        )
    })?;
    let (mixer, source) = mixer(channels, sample_rate);

    let audio_client: Audio::IAudioClient = unsafe {
        selected_device
            .device
            .Activate(CLSCTX_ALL, None)
            .map_err(|error| {
                diagnostic_error(
                    &diagnostics,
                    "wasapi",
                    "activate_wasapi_audio_client",
                    format!("Could not activate WASAPI exclusive audio client: {error}"),
                    selected_device.context(buffer_frames),
                )
            })?
    };
    let wave_format = wave_format_extensible(format);
    let event_handle = EventHandle::create(&diagnostics, selected_device.context(buffer_frames))?;
    unsafe {
        audio_client
            .Initialize(
                Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                Audio::AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                buffer_duration,
                buffer_duration,
                &wave_format.Format,
                None,
            )
            .map_err(|error| {
                diagnostic_error(
                    &diagnostics,
                    "wasapi",
                    "initialize_wasapi_exclusive",
                    wasapi_initialize_error_message(error, format),
                    selected_device.context(buffer_frames),
                )
            })?;
        audio_client
            .SetEventHandle(event_handle.raw())
            .map_err(|error| {
                diagnostic_error(
                    &diagnostics,
                    "wasapi",
                    "set_wasapi_exclusive_event",
                    format!("Could not set WASAPI exclusive event callback: {error}"),
                    selected_device.context(buffer_frames),
                )
            })?;
    }
    let buffer_size = unsafe {
        audio_client.GetBufferSize().map_err(|error| {
            diagnostic_error(
                &diagnostics,
                "wasapi",
                "get_wasapi_buffer_size",
                format!("Could not read WASAPI exclusive buffer size: {error}"),
                selected_device.context(buffer_frames),
            )
        })?
    };
    let render_client: Audio::IAudioRenderClient = unsafe {
        audio_client.GetService().map_err(|error| {
            diagnostic_error(
                &diagnostics,
                "wasapi",
                "get_wasapi_render_client",
                format!("Could not create WASAPI exclusive render client: {error}"),
                selected_device.context(buffer_frames),
            )
        })?
    };
    fill_initial_silence(
        &render_client,
        buffer_size,
        &diagnostics,
        selected_device.context(buffer_frames),
    )?;
    unsafe {
        audio_client.Start().map_err(|error| {
            diagnostic_error(
                &diagnostics,
                "wasapi",
                "start_wasapi_exclusive",
                format!("Could not start WASAPI exclusive output: {error}"),
                selected_device.context(buffer_frames),
            )
        })?;
    }

    let resolved = ResolvedOutput {
        output_backend: DesktopOutputBackendMode::WasapiExclusive,
        device_id: selected_device.resolved_id,
        device_name: selected_device.name,
        sample_rate: format.sample_rate,
        channel_count: format.channels,
        sample_format: format!("{} exclusive", format.sample_format.label()),
    };
    let ready_context = resolved.clone_context(buffer_frames);
    ready_tx
        .send(Ok((mixer.clone(), resolved)))
        .map_err(|error| format!("Could not report WASAPI exclusive output readiness: {error}"))?;
    render_loop(
        audio_client,
        render_client,
        buffer_size,
        format,
        event_handle,
        source,
        stop,
        stream_errors,
        diagnostics,
        ready_context,
    );
    Ok(())
}

fn render_loop(
    audio_client: Audio::IAudioClient,
    render_client: Audio::IAudioRenderClient,
    buffer_size: u32,
    format: WasapiFormat,
    event_handle: EventHandle,
    mut source: MixerSource,
    stop: Arc<AtomicBool>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    context: DesktopDiagnosticContext,
) {
    let mut stop_audio_client = Some(audio_client);
    let timing_warning_interval = Duration::from_millis(WASAPI_EXCLUSIVE_TIMING_WARNING_MS);
    let mut last_wake = Instant::now();
    let mut last_timing_warning = Instant::now();
    // Let WASAPI wake the thread when the endpoint wants more data. Polling with
    // sleep is much more prone to crackles because exclusive mode has no mixer
    // cushion between this loop and the device.
    while !stop.load(Ordering::Acquire) {
        let wait_result =
            unsafe { WaitForSingleObject(event_handle.raw(), WASAPI_EXCLUSIVE_EVENT_WAIT_MS) };
        if stop.load(Ordering::Acquire) {
            break;
        }
        if wait_result == WAIT_TIMEOUT {
            continue;
        }
        if wait_result == WAIT_FAILED {
            remember_stream_error(
                &stream_errors,
                &diagnostics,
                "wasapi",
                "exclusive_event_wait",
                "WASAPI exclusive event wait failed".to_string(),
                context.clone(),
            );
            break;
        }
        if wait_result != WAIT_OBJECT_0 {
            continue;
        }
        let elapsed = last_wake.elapsed();
        last_wake = Instant::now();
        let Some(audio_client) = stop_audio_client.as_ref() else {
            break;
        };
        let padding = match unsafe { audio_client.GetCurrentPadding() } {
            Ok(value) => value,
            Err(error) => {
                remember_stream_error(
                    &stream_errors,
                    &diagnostics,
                    "wasapi",
                    "exclusive_padding_query",
                    format!("WASAPI exclusive padding query failed: {error}"),
                    context.clone(),
                );
                break;
            }
        };
        let frames_available = buffer_size.saturating_sub(padding);
        if (padding == 0 || elapsed.as_millis() >= WASAPI_EXCLUSIVE_LATE_POLL_MS)
            && last_timing_warning.elapsed() >= timing_warning_interval
        {
            remember_diagnostic(
                &diagnostics,
                "warning",
                "wasapi",
                "exclusive_render_timing",
                format!(
                    "WASAPI exclusive render loop was late or drained. Wake: {} ms, buffer padding: {padding}/{buffer_size} frames.",
                    elapsed.as_millis()
                ),
                context.clone(),
            );
            last_timing_warning = Instant::now();
        }
        if frames_available == 0 {
            continue;
        }
        if let Err(error) =
            write_output_buffer(&render_client, frames_available, format, &mut source)
        {
            remember_stream_error(
                &stream_errors,
                &diagnostics,
                "wasapi",
                "exclusive_render_buffer",
                format!("WASAPI exclusive render failed: {error}"),
                context.clone(),
            );
            break;
        }
    }

    if let Some(audio_client) = stop_audio_client.take() {
        unsafe {
            let _ = audio_client.Stop();
        }
    }
}

fn write_output_buffer(
    render_client: &Audio::IAudioRenderClient,
    frames_available: u32,
    format: WasapiFormat,
    source: &mut MixerSource,
) -> Result<(), String> {
    let buffer = unsafe { render_client.GetBuffer(frames_available) }
        .map_err(|error| format!("GetBuffer failed: {error}"))?;
    let sample_count = usize::from(format.channels).saturating_mul(frames_available as usize);
    match format.sample_format {
        WasapiSampleFormat::F32 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut f32, sample_count);
            for sample in samples {
                *sample = next_sample(source);
            }
        },
        WasapiSampleFormat::I16 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut i16, sample_count);
            for sample in samples {
                *sample = (next_sample(source) * i16::MAX as f32).round() as i16;
            }
        },
    }
    unsafe {
        render_client
            .ReleaseBuffer(frames_available, 0)
            .map_err(|error| format!("ReleaseBuffer failed: {error}"))?;
    }
    Ok(())
}

fn next_sample(source: &mut MixerSource) -> f32 {
    output_safe_sample(source.next().unwrap_or(0.0))
}

fn output_safe_sample(sample: f32) -> f32 {
    if !sample.is_finite() {
        return 0.0;
    }
    let threshold = 0.985_f32;
    let magnitude = sample.abs();
    if magnitude <= threshold {
        return sample;
    }
    let excess = (magnitude - threshold) / (1.0 - threshold);
    sample.signum() * (threshold + (1.0 - threshold) * excess.tanh()).min(1.0)
}

fn fill_initial_silence(
    render_client: &Audio::IAudioRenderClient,
    buffer_size: u32,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    context: DesktopDiagnosticContext,
) -> Result<(), String> {
    let _buffer = unsafe { render_client.GetBuffer(buffer_size) }.map_err(|error| {
        diagnostic_error(
            diagnostics,
            "wasapi",
            "prime_wasapi_exclusive_buffer",
            format!("Could not prime WASAPI exclusive buffer: {error}"),
            context.clone(),
        )
    })?;
    unsafe {
        render_client
            .ReleaseBuffer(buffer_size, Audio::AUDCLNT_BUFFERFLAGS_SILENT.0 as u32)
            .map_err(|error| {
                diagnostic_error(
                    diagnostics,
                    "wasapi",
                    "release_wasapi_exclusive_silence",
                    format!("Could not release WASAPI exclusive silence buffer: {error}"),
                    context,
                )
            })?;
    }
    Ok(())
}

#[derive(Clone)]
struct SelectedWasapiDevice {
    device: Audio::IMMDevice,
    resolved_id: Option<String>,
    name: String,
}

impl SelectedWasapiDevice {
    fn context(&self, buffer_frames: Option<u32>) -> DesktopDiagnosticContext {
        DesktopDiagnosticContext {
            device_id: self.resolved_id.clone(),
            device_name: Some(self.name.clone()),
            buffer_frames,
            ..DesktopDiagnosticContext::default()
        }
    }
}

trait ResolvedOutputContext {
    fn clone_context(&self, buffer_frames: Option<u32>) -> DesktopDiagnosticContext;
}

impl ResolvedOutputContext for ResolvedOutput {
    fn clone_context(&self, buffer_frames: Option<u32>) -> DesktopDiagnosticContext {
        DesktopDiagnosticContext {
            device_id: self.device_id.clone(),
            device_name: Some(self.device_name.clone()),
            buffer_frames,
            sample_rate: Some(self.sample_rate),
            channel_count: Some(self.channel_count),
            sample_format: Some(self.sample_format.clone()),
            ..DesktopDiagnosticContext::default()
        }
    }
}

fn select_output_device(
    requested_id: Option<&str>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<SelectedWasapiDevice, String> {
    unsafe {
        let enumerator: Audio::IMMDeviceEnumerator =
            CoCreateInstance(&Audio::MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| {
                diagnostic_error(
                    diagnostics,
                    "wasapi",
                    "create_wasapi_device_enumerator",
                    format!("Could not create WASAPI device enumerator: {error}"),
                    DesktopDiagnosticContext::default(),
                )
            })?;
        if requested_id.is_none() {
            let device = enumerator
                .GetDefaultAudioEndpoint(Audio::eRender, Audio::eConsole)
                .map_err(|error| {
                    diagnostic_error(
                        diagnostics,
                        "wasapi",
                        "select_default_wasapi_output_device",
                        format!("No default WASAPI output device is available: {error}"),
                        DesktopDiagnosticContext::default(),
                    )
                })?;
            let name =
                friendly_name(&device).unwrap_or_else(|| "Default WASAPI output".to_string());
            return Ok(SelectedWasapiDevice {
                device,
                resolved_id: None,
                name,
            });
        }

        let requested_id = requested_id.unwrap_or_default();
        let devices = enumerator
            .EnumAudioEndpoints(Audio::eRender, Audio::DEVICE_STATE_ACTIVE)
            .map_err(|error| {
                diagnostic_error(
                    diagnostics,
                    "wasapi",
                    "list_wasapi_output_devices",
                    format!("Could not list WASAPI output devices: {error}"),
                    DesktopDiagnosticContext {
                        device_id: Some(requested_id.to_string()),
                        ..DesktopDiagnosticContext::default()
                    },
                )
            })?;
        let count = devices.GetCount().map_err(|error| {
            diagnostic_error(
                diagnostics,
                "wasapi",
                "count_wasapi_output_devices",
                format!("Could not count WASAPI output devices: {error}"),
                DesktopDiagnosticContext {
                    device_id: Some(requested_id.to_string()),
                    ..DesktopDiagnosticContext::default()
                },
            )
        })?;

        let requested_parts = requested_id.split_once('|');
        if let Some((index_text, expected_name)) = requested_parts {
            if let Ok(index) = index_text.parse::<u32>() {
                if index < count {
                    let device = devices.Item(index).map_err(|error| {
                        diagnostic_error(
                            diagnostics,
                            "wasapi",
                            "select_wasapi_output_device",
                            format!("Could not inspect WASAPI output device: {error}"),
                            DesktopDiagnosticContext {
                                device_id: Some(requested_id.to_string()),
                                ..DesktopDiagnosticContext::default()
                            },
                        )
                    })?;
                    let name = friendly_name(&device)
                        .unwrap_or_else(|| "Unknown output device".to_string());
                    if name == expected_name {
                        return Ok(SelectedWasapiDevice {
                            device,
                            resolved_id: Some(requested_id.to_string()),
                            name,
                        });
                    }
                }
            }
            for index in 0..count {
                let device = devices.Item(index).map_err(|error| {
                    diagnostic_error(
                        diagnostics,
                        "wasapi",
                        "select_wasapi_output_device",
                        format!("Could not inspect WASAPI output device: {error}"),
                        DesktopDiagnosticContext {
                            device_id: Some(requested_id.to_string()),
                            ..DesktopDiagnosticContext::default()
                        },
                    )
                })?;
                let name =
                    friendly_name(&device).unwrap_or_else(|| "Unknown output device".to_string());
                if name == expected_name {
                    return Ok(SelectedWasapiDevice {
                        device,
                        resolved_id: Some(format!("{index}|{name}")),
                        name,
                    });
                }
            }
        }

        for index in 0..count {
            let device = devices.Item(index).map_err(|error| {
                diagnostic_error(
                    diagnostics,
                    "wasapi",
                    "select_wasapi_output_device",
                    format!("Could not inspect WASAPI output device: {error}"),
                    DesktopDiagnosticContext {
                        device_id: Some(requested_id.to_string()),
                        ..DesktopDiagnosticContext::default()
                    },
                )
            })?;
            let name =
                friendly_name(&device).unwrap_or_else(|| "Unknown output device".to_string());
            if name == requested_id {
                return Ok(SelectedWasapiDevice {
                    device,
                    resolved_id: Some(format!("{index}|{name}")),
                    name,
                });
            }
        }

        Err(diagnostic_error(
            diagnostics,
            "wasapi",
            "select_wasapi_output_device",
            format!("WASAPI output device is no longer available: {requested_id}"),
            DesktopDiagnosticContext {
                device_id: Some(requested_id.to_string()),
                ..DesktopDiagnosticContext::default()
            },
        ))
    }
}

fn choose_exclusive_format(
    device: &Audio::IMMDevice,
    requested_buffer_frames: Option<u32>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(WasapiFormat, i64), String> {
    let mix = default_mix_format(device).unwrap_or(WasapiFormat {
        channels: 2,
        sample_rate: 48_000,
        sample_format: WasapiSampleFormat::F32,
    });
    // Prefer the user's common high-resolution endpoint rate before the shared
    // mix rate. Some Windows devices report a 48 kHz mix format even when the
    // exclusive endpoint is configured at 96 kHz.
    let sample_rates = unique_u32([
        96_000,
        mix.sample_rate,
        48_000,
        44_100,
        88_200,
        192_000,
        176_400,
    ]);
    let channel_counts = unique_u16([2, mix.channels, 1]);
    let sample_formats = [WasapiSampleFormat::F32, WasapiSampleFormat::I16];
    let mut first_initialize_error: Option<String> = None;

    for sample_rate in sample_rates {
        for channels in channel_counts.iter().copied() {
            for sample_format in sample_formats {
                let format = WasapiFormat {
                    channels,
                    sample_rate,
                    sample_format,
                };
                let wave_format = wave_format_extensible(format);
                let audio_client: Audio::IAudioClient = unsafe {
                    match device.Activate(CLSCTX_ALL, None) {
                        Ok(client) => client,
                        Err(error) => {
                            return Err(diagnostic_error(
                                diagnostics,
                                "wasapi",
                                "activate_wasapi_audio_client",
                                format!(
                                    "Could not activate WASAPI exclusive audio client: {error}"
                                ),
                                DesktopDiagnosticContext::default(),
                            ));
                        }
                    }
                };
                let supported = unsafe {
                    audio_client.IsFormatSupported(
                        Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                        &wave_format.Format,
                        None,
                    )
                };
                if supported != S_OK {
                    continue;
                }
                for buffer_frames in buffer_frame_candidates(requested_buffer_frames, sample_rate) {
                    let test_client: Audio::IAudioClient = unsafe {
                        match device.Activate(CLSCTX_ALL, None) {
                            Ok(client) => client,
                            Err(error) => {
                                first_initialize_error.get_or_insert_with(|| error.to_string());
                                continue;
                            }
                        }
                    };
                    let buffer_duration = buffer_duration_100ns(buffer_frames, sample_rate);
                    let init_result = unsafe {
                        test_client.Initialize(
                            Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                            Audio::AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                            buffer_duration,
                            buffer_duration,
                            &wave_format.Format,
                            None,
                        )
                    };
                    match init_result {
                        Ok(()) => return Ok((format, buffer_duration)),
                        Err(error) => {
                            if error.code() == Audio::AUDCLNT_E_DEVICE_IN_USE {
                                return Err(diagnostic_error(
                                    diagnostics,
                                    "wasapi",
                                    "initialize_wasapi_exclusive",
                                    wasapi_device_in_use_message(),
                                    DesktopDiagnosticContext::default(),
                                ));
                            }
                            first_initialize_error.get_or_insert_with(|| error.to_string());
                        }
                    }
                }
            }
        }
    }

    let reason = first_initialize_error
        .map(|error| format!(" Last WASAPI initialize error: {error}"))
        .unwrap_or_default();
    Err(diagnostic_error(
        diagnostics,
        "wasapi",
        "choose_wasapi_exclusive_format",
        format!(
            "The selected output device did not accept FLAC Cafe's WASAPI exclusive formats. Try changing the device default format in Windows Sound settings or use shared mode.{reason}"
        ),
        DesktopDiagnosticContext::default(),
    ))
}

fn wasapi_initialize_error_message(error: windows::core::Error, format: WasapiFormat) -> String {
    if error.code() == Audio::AUDCLNT_E_DEVICE_IN_USE {
        return wasapi_device_in_use_message();
    }
    format!(
        "Could not open WASAPI exclusive output at {} Hz, {} channel(s), {}: {error}",
        format.sample_rate,
        format.channels,
        format.sample_format.label()
    )
}

fn wasapi_device_in_use_message() -> String {
    "Could not open WASAPI exclusive output because another app currently has exclusive access to this output device. Stop playback in that app, then press play again.".to_string()
}

fn default_mix_format(device: &Audio::IMMDevice) -> Option<WasapiFormat> {
    unsafe {
        let audio_client: Audio::IAudioClient = device.Activate(CLSCTX_ALL, None).ok()?;
        let format_ptr = audio_client.GetMixFormat().ok()?;
        let format = parse_wave_format(format_ptr);
        CoTaskMemFree(Some(format_ptr as *const _));
        format
    }
}

unsafe fn parse_wave_format(format_ptr: *const Audio::WAVEFORMATEX) -> Option<WasapiFormat> {
    if format_ptr.is_null() {
        return None;
    }
    let base = *format_ptr;
    let sample_format = if u32::from(base.wFormatTag) == Multimedia::WAVE_FORMAT_IEEE_FLOAT {
        WasapiSampleFormat::F32
    } else if u32::from(base.wFormatTag) == Audio::WAVE_FORMAT_PCM {
        WasapiSampleFormat::I16
    } else if u32::from(base.wFormatTag) == KernelStreaming::WAVE_FORMAT_EXTENSIBLE {
        let extensible_ptr = format_ptr as *const Audio::WAVEFORMATEXTENSIBLE;
        let sub_format = ptr::addr_of!((*extensible_ptr).SubFormat).read_unaligned();
        if sub_format == Multimedia::KSDATAFORMAT_SUBTYPE_IEEE_FLOAT {
            WasapiSampleFormat::F32
        } else if sub_format == KernelStreaming::KSDATAFORMAT_SUBTYPE_PCM {
            WasapiSampleFormat::I16
        } else {
            return None;
        }
    } else {
        return None;
    };
    Some(WasapiFormat {
        channels: base.nChannels.max(1),
        sample_rate: base.nSamplesPerSec.max(1),
        sample_format,
    })
}

fn wave_format_extensible(format: WasapiFormat) -> Audio::WAVEFORMATEXTENSIBLE {
    let format_tag = match format.sample_format {
        WasapiSampleFormat::I16 => Audio::WAVE_FORMAT_PCM,
        WasapiSampleFormat::F32 => KernelStreaming::WAVE_FORMAT_EXTENSIBLE,
    };
    let sample_bytes = format.sample_format.bytes_per_sample();
    let bits_per_sample = sample_bytes * 8;
    let cb_size = if format_tag == Audio::WAVE_FORMAT_PCM {
        0
    } else {
        (mem::size_of::<Audio::WAVEFORMATEXTENSIBLE>() - mem::size_of::<Audio::WAVEFORMATEX>())
            as u16
    };
    let waveformatex = Audio::WAVEFORMATEX {
        wFormatTag: format_tag as u16,
        nChannels: format.channels,
        nSamplesPerSec: format.sample_rate,
        nAvgBytesPerSec: u32::from(format.channels) * format.sample_rate * u32::from(sample_bytes),
        nBlockAlign: format.channels * sample_bytes,
        wBitsPerSample: bits_per_sample,
        cbSize: cb_size,
    };
    let sub_format = match format.sample_format {
        WasapiSampleFormat::I16 => KernelStreaming::KSDATAFORMAT_SUBTYPE_PCM,
        WasapiSampleFormat::F32 => Multimedia::KSDATAFORMAT_SUBTYPE_IEEE_FLOAT,
    };
    Audio::WAVEFORMATEXTENSIBLE {
        Format: waveformatex,
        Samples: Audio::WAVEFORMATEXTENSIBLE_0 {
            wValidBitsPerSample: bits_per_sample,
        },
        dwChannelMask: channel_mask(format.channels),
        SubFormat: sub_format,
    }
}

fn channel_mask(channels: u16) -> u32 {
    match channels {
        1 => KernelStreaming::KSAUDIO_SPEAKER_MONO,
        2 => {
            KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_RIGHT
        }
        3 => {
            KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_RIGHT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_CENTER
        }
        4 => {
            KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_RIGHT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_RIGHT
        }
        5 => {
            KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_RIGHT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_CENTER
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_RIGHT
        }
        6 => {
            KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_RIGHT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_FRONT_CENTER
                | KernelStreaming::KSAUDIO_SPEAKER_SUPER_WOOFER
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_LEFT
                | KernelStreaming::KSAUDIO_SPEAKER_GROUND_REAR_RIGHT
        }
        _ => KernelStreaming::KSAUDIO_SPEAKER_DIRECTOUT,
    }
}

fn buffer_frame_candidates(requested: Option<u32>, sample_rate: u32) -> Vec<u32> {
    let default_frames = ((sample_rate / 1000) * WASAPI_EXCLUSIVE_DEFAULT_BUFFER_MS)
        .next_power_of_two()
        .clamp(8192, 32_768);
    let mut candidates = Vec::new();
    if let Some(requested) = requested.filter(|value| *value >= 8192 && *value <= 32_768) {
        candidates.push(requested);
    }
    for value in [default_frames, 16_384, 32_768, 8192] {
        if !candidates.contains(&value) {
            candidates.push(value);
        }
    }
    candidates
}

fn buffer_duration_100ns(buffer_frames: u32, sample_rate: u32) -> i64 {
    ((u64::from(buffer_frames) * 10_000_000) / u64::from(sample_rate.max(1))) as i64
}

fn unique_u32<const N: usize>(values: [u32; N]) -> Vec<u32> {
    let mut output = Vec::new();
    for value in values {
        if value > 0 && !output.contains(&value) {
            output.push(value);
        }
    }
    output
}

fn unique_u16<const N: usize>(values: [u16; N]) -> Vec<u16> {
    let mut output = Vec::new();
    for value in values {
        if value > 0 && !output.contains(&value) {
            output.push(value);
        }
    }
    output
}

fn friendly_name(device: &Audio::IMMDevice) -> Option<String> {
    unsafe {
        let store = device.OpenPropertyStore(STGM_READ).ok()?;
        let mut value = store
            .GetValue(&Properties::DEVPKEY_Device_FriendlyName as *const _ as *const PROPERTYKEY)
            .ok()?;
        let result = propvariant_lpwstr(&mut value);
        let _ = PropVariantClear(&mut value as *mut PROPVARIANT);
        result
    }
}

unsafe fn propvariant_lpwstr(value: &mut PROPVARIANT) -> Option<String> {
    let prop_variant = &value.Anonymous.Anonymous;
    if prop_variant.vt != VT_LPWSTR {
        return None;
    }
    let ptr_utf16 = *(&prop_variant.Anonymous as *const _ as *const *const u16);
    if ptr_utf16.is_null() {
        return None;
    }
    const MAX_STRING_LEN: usize = 32768;
    let mut len = 0;
    while len < MAX_STRING_LEN && *ptr_utf16.add(len) != 0 {
        len += 1;
    }
    if len >= MAX_STRING_LEN {
        return None;
    }
    let string_slice = slice::from_raw_parts(ptr_utf16, len);
    let os_string = OsString::from_wide(string_slice);
    match os_string.into_string() {
        Ok(value) => Some(value),
        Err(value) => Some(value.to_string_lossy().into_owned()),
    }
}

struct ComApartment;

impl ComApartment {
    fn initialize(diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>) -> Result<Self, String> {
        let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if result == S_OK || result == S_FALSE {
            Ok(Self)
        } else {
            Err(diagnostic_error(
                diagnostics,
                "wasapi",
                "initialize_com",
                format!(
                    "Could not initialize COM for WASAPI exclusive output: {}",
                    hresult_message(result)
                ),
                DesktopDiagnosticContext::default(),
            ))
        }
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}

fn hresult_message(result: HRESULT) -> String {
    windows::core::Error::from(result).to_string()
}

struct MmcssGuard(Option<HANDLE>);

impl MmcssGuard {
    fn enable() -> Self {
        let mut task_index = 0_u32;
        if let Ok(handle) = unsafe {
            AvSetMmThreadCharacteristicsA(
                PCSTR(c"Pro Audio".as_ptr() as *const u8),
                &mut task_index,
            )
        } {
            unsafe {
                let _ = AvSetMmThreadPriority(handle, AVRT_PRIORITY_CRITICAL);
            }
            Self(Some(handle))
        } else {
            Self(None)
        }
    }
}

impl Drop for MmcssGuard {
    fn drop(&mut self) {
        if let Some(handle) = self.0.take() {
            unsafe {
                let _ = AvRevertMmThreadCharacteristics(handle);
            }
        }
    }
}
