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
use windows::core::{HRESULT, PCSTR};
use windows::Win32::Devices::Properties;
use windows::Win32::Foundation::{HANDLE, PROPERTYKEY, S_FALSE, S_OK};
use windows::Win32::Media::{timeBeginPeriod, timeEndPeriod, Audio, KernelStreaming, Multimedia};
use windows::Win32::System::Com::StructuredStorage::{PropVariantClear, PROPVARIANT};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED, STGM_READ,
};
use windows::Win32::System::Threading::{
    AvRevertMmThreadCharacteristics, AvSetMmThreadCharacteristicsA, AvSetMmThreadPriority,
    SetThreadPriority, AVRT_PRIORITY_CRITICAL, THREAD_PRIORITY_TIME_CRITICAL,
};
use windows::Win32::System::Variant::{VT_BLOB, VT_LPWSTR};

use super::{
    diagnostic_error, remember_diagnostic, remember_stream_error, DesktopDiagnosticContext,
    DesktopOutputBackendMode, PlaybackDiagnostic, ResolvedOutput,
};

const WASAPI_EXCLUSIVE_DEFAULT_BUFFER_MS: u32 = 250;
const WASAPI_EXCLUSIVE_LATE_POLL_MS: u128 = 30;
const WASAPI_EXCLUSIVE_TIMING_WARNING_MS: u64 = 5_000;
const WASAPI_EXCLUSIVE_POLL_INTERVAL_MS: u64 = 1;
const WASAPI_EXCLUSIVE_RENDER_START_LOGS: u64 = 6;

#[derive(Clone, Copy, PartialEq, Eq)]
enum WasapiSampleFormat {
    F32,
    I16,
    I24,
    I24Padded,
    I24In32,
    I32,
}

impl WasapiSampleFormat {
    fn label(self) -> &'static str {
        match self {
            WasapiSampleFormat::F32 => "F32",
            WasapiSampleFormat::I16 => "I16",
            WasapiSampleFormat::I24 => "I24",
            WasapiSampleFormat::I24Padded => "I24-padded",
            WasapiSampleFormat::I24In32 => "I24-in-32",
            WasapiSampleFormat::I32 => "I32",
        }
    }

    fn bytes_per_sample(self) -> u16 {
        match self {
            WasapiSampleFormat::F32 => 4,
            WasapiSampleFormat::I16 => 2,
            WasapiSampleFormat::I24 => 3,
            WasapiSampleFormat::I24Padded
            | WasapiSampleFormat::I24In32
            | WasapiSampleFormat::I32 => 4,
        }
    }

    fn bits_per_sample(self) -> u16 {
        match self {
            WasapiSampleFormat::I24Padded => 24,
            _ => self.bytes_per_sample() * 8,
        }
    }

    fn valid_bits_per_sample(self) -> u16 {
        match self {
            WasapiSampleFormat::I24Padded => 24,
            WasapiSampleFormat::I24In32 => 24,
            _ => self.bits_per_sample(),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum WasapiFormatContainer {
    Plain,
    Extensible,
}

impl WasapiFormatContainer {
    fn label(self) -> &'static str {
        match self {
            WasapiFormatContainer::Plain => "WAVEFORMATEX",
            WasapiFormatContainer::Extensible => "WAVEFORMATEXTENSIBLE",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct WasapiFormat {
    channels: u16,
    sample_rate: u32,
    sample_format: WasapiSampleFormat,
    container: WasapiFormatContainer,
    channel_mask: Option<u32>,
}

impl WasapiFormat {
    fn label(self) -> String {
        let mut label = format!("{} {}", self.sample_format.label(), self.container.label());
        if matches!(self.container, WasapiFormatContainer::Extensible) {
            if let Some(mask) = self.channel_mask {
                label.push_str(&format!(" mask=0x{mask:08x}"));
            }
        }
        label
    }
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
        preferred_sample_rate: Option<u32>,
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
                    preferred_sample_rate,
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

fn run_wasapi_exclusive_output(
    requested_id: Option<String>,
    buffer_frames: Option<u32>,
    preferred_sample_rate: Option<u32>,
    stop: Arc<AtomicBool>,
    stream_errors: Arc<Mutex<Vec<String>>>,
    diagnostics: Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    ready_tx: mpsc::SyncSender<Result<(Mixer, ResolvedOutput), String>>,
) -> Result<(), String> {
    let _com = ComApartment::initialize(&diagnostics)?;
    let _mmcss = MmcssGuard::enable();
    let _timer_period = TimerPeriodGuard::enable(1);
    unsafe {
        let _ = SetThreadPriority(
            windows::Win32::System::Threading::GetCurrentThread(),
            THREAD_PRIORITY_TIME_CRITICAL,
        );
    }

    let selected_device = select_output_device(requested_id.as_deref(), &diagnostics)?;
    let (format, buffer_duration) = choose_exclusive_format(
        &selected_device.device,
        buffer_frames,
        preferred_sample_rate,
        &diagnostics,
    )?;
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
    let wave_format = wave_format(format);
    unsafe {
        audio_client
            .Initialize(
                Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                0,
                buffer_duration,
                0,
                wave_format.as_ptr(),
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
        format,
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
        sample_format: format!("{} exclusive", format.label()),
    };
    let ready_context = resolved.clone_context(buffer_frames);
    remember_diagnostic(
        &diagnostics,
        "info",
        "wasapi",
        "open_wasapi_exclusive",
        format!(
            "Opened WASAPI exclusive output at {} Hz, {} channel(s), {}, {} frame buffer.",
            format.sample_rate,
            format.channels,
            format.label(),
            buffer_size
        ),
        DesktopDiagnosticContext {
            buffer_frames: Some(buffer_size),
            ..ready_context.clone()
        },
    );
    ready_tx
        .send(Ok((mixer.clone(), resolved)))
        .map_err(|error| format!("Could not report WASAPI exclusive output readiness: {error}"))?;
    render_loop(
        audio_client,
        render_client,
        buffer_size,
        format,
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
    let mut render_log_state = WasapiRenderLogState::new();
    // Some Windows drivers accept event-callback exclusive streams but never
    // keep signaling the event. Polling the exclusive padding is less elegant,
    // but it is predictable across more USB/DAC-style devices.
    while !stop.load(Ordering::Acquire) {
        thread::sleep(Duration::from_millis(WASAPI_EXCLUSIVE_POLL_INTERVAL_MS));
        if stop.load(Ordering::Acquire) {
            break;
        }
        let elapsed = last_wake.elapsed();
        last_wake = Instant::now();
        let Some(audio_client) = stop_audio_client.as_ref() else {
            break;
        };
        if matches!(
            write_available_output(
                audio_client,
                &render_client,
                buffer_size,
                format,
                &mut source,
                &stream_errors,
                &diagnostics,
                &context,
                elapsed,
                timing_warning_interval,
                &mut last_timing_warning,
                &mut render_log_state,
            ),
            WasapiRenderLoopAction::Break
        ) {
            break;
        }
    }

    if let Some(audio_client) = stop_audio_client.take() {
        unsafe {
            let _ = audio_client.Stop();
        }
    }
}

enum WasapiRenderWriteError {
    Transient(String),
    Fatal(String),
}

enum WasapiRenderLoopAction {
    Idle,
    Wrote,
    Break,
}

struct WasapiRenderLogState {
    last_activity_log: Instant,
    write_count: u64,
    nonzero_logged: bool,
}

impl WasapiRenderLogState {
    fn new() -> Self {
        Self {
            last_activity_log: Instant::now(),
            write_count: 0,
            nonzero_logged: false,
        }
    }
}

#[derive(Clone, Copy, Default)]
struct WasapiRenderStats {
    frames: u32,
    sample_count: usize,
    nonzero_samples: usize,
    peak: f32,
}

impl WasapiRenderStats {
    fn observe(&mut self, sample: f32) {
        let magnitude = sample.abs();
        if magnitude > 0.000_001 {
            self.nonzero_samples = self.nonzero_samples.saturating_add(1);
        }
        if magnitude > self.peak {
            self.peak = magnitude;
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn write_available_output(
    audio_client: &Audio::IAudioClient,
    render_client: &Audio::IAudioRenderClient,
    buffer_size: u32,
    format: WasapiFormat,
    source: &mut MixerSource,
    stream_errors: &Arc<Mutex<Vec<String>>>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    context: &DesktopDiagnosticContext,
    elapsed: Duration,
    timing_warning_interval: Duration,
    last_timing_warning: &mut Instant,
    render_log_state: &mut WasapiRenderLogState,
) -> WasapiRenderLoopAction {
    let padding = match unsafe { audio_client.GetCurrentPadding() } {
        Ok(value) => value,
        Err(error) => {
            remember_stream_error(
                stream_errors,
                diagnostics,
                "wasapi",
                "exclusive_padding_query",
                format!("WASAPI exclusive padding query failed: {error}"),
                context.clone(),
            );
            return WasapiRenderLoopAction::Break;
        }
    };
    let frames_available = buffer_size.saturating_sub(padding);
    if (padding == 0 || elapsed.as_millis() >= WASAPI_EXCLUSIVE_LATE_POLL_MS)
        && last_timing_warning.elapsed() >= timing_warning_interval
    {
        remember_diagnostic(
            diagnostics,
            "warning",
            "wasapi",
            "exclusive_render_timing",
            format!(
                "WASAPI exclusive render loop was late or drained. Wake: {} ms, buffer padding: {padding}/{buffer_size} frames.",
                elapsed.as_millis()
            ),
            context.clone(),
        );
        *last_timing_warning = Instant::now();
    }
    if frames_available == 0 {
        if padding >= buffer_size && last_timing_warning.elapsed() >= timing_warning_interval {
            remember_diagnostic(
                diagnostics,
                "warning",
                "wasapi",
                "exclusive_render_buffer_full",
                format!(
                    "WASAPI exclusive buffer stayed full at {padding}/{buffer_size} frames; the output device is not draining the stream."
                ),
                context.clone(),
            );
            *last_timing_warning = Instant::now();
        }
        return WasapiRenderLoopAction::Idle;
    }
    let frames_to_write = render_write_frames(frames_available, buffer_size, format);
    if frames_to_write == 0 {
        return WasapiRenderLoopAction::Idle;
    }
    match write_output_buffer(render_client, frames_to_write, format, source) {
        Ok(stats) => {
            log_render_write(diagnostics, context, render_log_state, stats);
            WasapiRenderLoopAction::Wrote
        }
        Err(error) => match error {
            WasapiRenderWriteError::Transient(message) => {
                if last_timing_warning.elapsed() >= timing_warning_interval {
                    remember_diagnostic(
                        diagnostics,
                        "warning",
                        "wasapi",
                        "exclusive_render_buffer_retry",
                        message,
                        context.clone(),
                    );
                    *last_timing_warning = Instant::now();
                }
                WasapiRenderLoopAction::Idle
            }
            WasapiRenderWriteError::Fatal(message) => {
                remember_stream_error(
                    stream_errors,
                    diagnostics,
                    "wasapi",
                    "exclusive_render_buffer",
                    format!("WASAPI exclusive render failed: {message}"),
                    context.clone(),
                );
                WasapiRenderLoopAction::Break
            }
        },
    }
}

fn render_write_frames(frames_available: u32, buffer_size: u32, format: WasapiFormat) -> u32 {
    if frames_available == 0 {
        return 0;
    }
    if frames_available >= buffer_size / 2 {
        return frames_available;
    }
    let minimum_packet = match format.sample_format {
        WasapiSampleFormat::I24 => 1024,
        _ if format.sample_rate >= 88_200 => 512,
        _ => 256,
    };
    if frames_available < minimum_packet {
        0
    } else {
        frames_available
    }
}

fn log_render_write(
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    context: &DesktopDiagnosticContext,
    state: &mut WasapiRenderLogState,
    stats: WasapiRenderStats,
) {
    state.write_count = state.write_count.saturating_add(1);
    let should_log_start = state.write_count <= WASAPI_EXCLUSIVE_RENDER_START_LOGS;
    let should_log_nonzero = stats.nonzero_samples > 0 && !state.nonzero_logged;
    let should_log_activity =
        stats.nonzero_samples > 0 && state.last_activity_log.elapsed() >= Duration::from_secs(5);
    if should_log_start || should_log_nonzero || should_log_activity {
        remember_diagnostic(
            diagnostics,
            "info",
            "wasapi",
            "exclusive_render_write",
            format!(
                "WASAPI exclusive wrote {} frame(s), peak {:.6}, nonzero samples {}/{}.",
                stats.frames, stats.peak, stats.nonzero_samples, stats.sample_count
            ),
            context.clone(),
        );
        if stats.nonzero_samples > 0 {
            state.nonzero_logged = true;
            state.last_activity_log = Instant::now();
        }
    }
}

fn write_output_buffer(
    render_client: &Audio::IAudioRenderClient,
    frames_available: u32,
    format: WasapiFormat,
    source: &mut MixerSource,
) -> Result<WasapiRenderStats, WasapiRenderWriteError> {
    let buffer = unsafe { render_client.GetBuffer(frames_available) }.map_err(|error| {
        let message = format!("GetBuffer failed: {error}");
        if error.code() == Audio::AUDCLNT_E_BUFFER_ERROR {
            WasapiRenderWriteError::Transient(message)
        } else {
            WasapiRenderWriteError::Fatal(message)
        }
    })?;
    let sample_count = usize::from(format.channels).saturating_mul(frames_available as usize);
    let mut stats = WasapiRenderStats {
        frames: frames_available,
        sample_count,
        ..WasapiRenderStats::default()
    };
    match format.sample_format {
        WasapiSampleFormat::F32 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut f32, sample_count);
            for sample in samples {
                *sample = next_sample_with_stats(source, &mut stats);
            }
        },
        WasapiSampleFormat::I16 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut i16, sample_count);
            for sample in samples {
                *sample = sample_to_i16(next_sample_with_stats(source, &mut stats));
            }
        },
        WasapiSampleFormat::I24 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut u8, sample_count * 3);
            for chunk in samples.chunks_exact_mut(3) {
                let bytes = sample_to_i24(next_sample_with_stats(source, &mut stats)).to_le_bytes();
                chunk.copy_from_slice(&bytes[..3]);
            }
        },
        WasapiSampleFormat::I24Padded => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut i32, sample_count);
            for sample in samples {
                *sample = sample_to_i24(next_sample_with_stats(source, &mut stats));
            }
        },
        WasapiSampleFormat::I24In32 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut i32, sample_count);
            for sample in samples {
                *sample = sample_to_i24(next_sample_with_stats(source, &mut stats)) << 8;
            }
        },
        WasapiSampleFormat::I32 => unsafe {
            let samples = slice::from_raw_parts_mut(buffer as *mut i32, sample_count);
            for sample in samples {
                *sample = sample_to_i32(next_sample_with_stats(source, &mut stats));
            }
        },
    }
    unsafe {
        render_client
            .ReleaseBuffer(frames_available, 0)
            .map_err(|error| {
                WasapiRenderWriteError::Fatal(format!("ReleaseBuffer failed: {error}"))
            })?;
    }
    Ok(stats)
}

fn next_sample(source: &mut MixerSource) -> f32 {
    output_safe_sample(source.next().unwrap_or(0.0))
}

fn next_sample_with_stats(source: &mut MixerSource, stats: &mut WasapiRenderStats) -> f32 {
    let sample = next_sample(source);
    stats.observe(sample);
    sample
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

fn sample_to_i16(sample: f32) -> i16 {
    (output_safe_sample(sample) * i16::MAX as f32).round() as i16
}

fn sample_to_i24(sample: f32) -> i32 {
    (output_safe_sample(sample) * 8_388_607.0).round() as i32
}

fn sample_to_i32(sample: f32) -> i32 {
    (output_safe_sample(sample) * i32::MAX as f32).round() as i32
}

fn fill_initial_silence(
    render_client: &Audio::IAudioRenderClient,
    buffer_size: u32,
    format: WasapiFormat,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
    context: DesktopDiagnosticContext,
) -> Result<(), String> {
    let buffer = unsafe { render_client.GetBuffer(buffer_size) }.map_err(|error| {
        diagnostic_error(
            diagnostics,
            "wasapi",
            "prime_wasapi_exclusive_buffer",
            format!("Could not prime WASAPI exclusive buffer: {error}"),
            context.clone(),
        )
    })?;
    let bytes = buffer_size as usize
        * usize::from(format.channels)
        * usize::from(format.sample_format.bytes_per_sample());
    unsafe {
        ptr::write_bytes(buffer, 0, bytes);
    }
    unsafe {
        render_client
            .ReleaseBuffer(buffer_size, 0)
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
    preferred_sample_rate: Option<u32>,
    diagnostics: &Arc<Mutex<Vec<PlaybackDiagnostic>>>,
) -> Result<(WasapiFormat, i64), String> {
    let mix = default_mix_format(device).unwrap_or(WasapiFormat {
        channels: 2,
        sample_rate: 48_000,
        sample_format: WasapiSampleFormat::F32,
        container: WasapiFormatContainer::Plain,
        channel_mask: None,
    });
    let device_format = property_wave_format(device, &Audio::PKEY_AudioEngine_DeviceFormat);
    let oem_format = property_wave_format(device, &Audio::PKEY_AudioEngine_OEMFormat);
    let format_candidates = exclusive_format_candidates(mix, preferred_sample_rate);
    let mut first_initialize_error: Option<String> = None;
    let mut high_quality_rejections: Vec<String> = Vec::new();
    remember_diagnostic(
        diagnostics,
        "info",
        "wasapi",
        "choose_wasapi_exclusive_format",
        format!(
            "Probing WASAPI exclusive formats. Shared mix reports {} Hz, {} channel(s), {}.",
            mix.sample_rate,
            mix.channels,
            mix.label()
        ),
        DesktopDiagnosticContext {
            sample_rate: Some(mix.sample_rate),
            channel_count: Some(mix.channels),
            sample_format: Some(mix.label()),
            ..DesktopDiagnosticContext::default()
        },
    );
    if let Some(format) = device_format {
        remember_diagnostic(
            diagnostics,
            "info",
            "wasapi",
            "choose_wasapi_exclusive_format",
            format!(
                "Windows endpoint device format reports {} Hz, {} channel(s), {}.",
                format.sample_rate,
                format.channels,
                format.label()
            ),
            DesktopDiagnosticContext {
                sample_rate: Some(format.sample_rate),
                channel_count: Some(format.channels),
                sample_format: Some(format.label()),
                ..DesktopDiagnosticContext::default()
            },
        );
    }
    if let Some(format) = oem_format {
        remember_diagnostic(
            diagnostics,
            "info",
            "wasapi",
            "choose_wasapi_exclusive_format",
            format!(
                "Windows endpoint OEM format reports {} Hz, {} channel(s), {}.",
                format.sample_rate,
                format.channels,
                format.label()
            ),
            DesktopDiagnosticContext {
                sample_rate: Some(format.sample_rate),
                channel_count: Some(format.channels),
                sample_format: Some(format.label()),
                ..DesktopDiagnosticContext::default()
            },
        );
    }

    for format in format_candidates {
        let wave_format = wave_format(format);
        let audio_client: Audio::IAudioClient = unsafe {
            match device.Activate(CLSCTX_ALL, None) {
                Ok(client) => client,
                Err(error) => {
                    return Err(diagnostic_error(
                        diagnostics,
                        "wasapi",
                        "activate_wasapi_audio_client",
                        format!("Could not activate WASAPI exclusive audio client: {error}"),
                        DesktopDiagnosticContext::default(),
                    ));
                }
            }
        };
        let _supported = unsafe {
            audio_client.IsFormatSupported(
                Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                wave_format.as_ptr(),
                None,
            )
        };
        for buffer_frames in buffer_frame_candidates(requested_buffer_frames, format.sample_rate) {
            let test_client: Audio::IAudioClient = unsafe {
                match device.Activate(CLSCTX_ALL, None) {
                    Ok(client) => client,
                    Err(error) => {
                        first_initialize_error.get_or_insert_with(|| error.to_string());
                        continue;
                    }
                }
            };
            let buffer_duration = buffer_duration_100ns(buffer_frames, format.sample_rate);
            let init_result = unsafe {
                test_client.Initialize(
                    Audio::AUDCLNT_SHAREMODE_EXCLUSIVE,
                    0,
                    buffer_duration,
                    0,
                    wave_format.as_ptr(),
                    None,
                )
            };
            match init_result {
                Ok(()) => {
                    if matches!(format.sample_format, WasapiSampleFormat::I16)
                        && !high_quality_rejections.is_empty()
                    {
                        remember_diagnostic(
                            diagnostics,
                            "info",
                            "wasapi",
                            "choose_wasapi_exclusive_format",
                            format!(
                                "High-quality exclusive candidates were rejected before fallback: {}.",
                                high_quality_rejections.join("; ")
                            ),
                            DesktopDiagnosticContext {
                                sample_rate: Some(format.sample_rate),
                                channel_count: Some(format.channels),
                                sample_format: Some(format.label()),
                                ..DesktopDiagnosticContext::default()
                            },
                        );
                    }
                    remember_diagnostic(
                        diagnostics,
                        "info",
                        "wasapi",
                        "choose_wasapi_exclusive_format",
                        format!(
                            "Selected WASAPI exclusive format: {} Hz, {} channel(s), {}, {} frame buffer.",
                            format.sample_rate,
                            format.channels,
                            format.label(),
                            buffer_frames
                        ),
                        DesktopDiagnosticContext {
                            buffer_frames: Some(buffer_frames),
                            sample_rate: Some(format.sample_rate),
                            channel_count: Some(format.channels),
                            sample_format: Some(format.label()),
                            ..DesktopDiagnosticContext::default()
                        },
                    );
                    return Ok((format, buffer_duration));
                }
                Err(error) => {
                    if error.code() == Audio::AUDCLNT_E_DEVICE_IN_USE {
                        return Err(wasapi_device_in_use_message());
                    }
                    if high_quality_rejections.len() < 16
                        && format.channels == 2
                        && (format.sample_rate == mix.sample_rate || format.sample_rate == 96_000)
                        && !matches!(format.sample_format, WasapiSampleFormat::I16)
                    {
                        high_quality_rejections.push(format!(
                            "{} Hz {} {} frames -> {}",
                            format.sample_rate,
                            format.label(),
                            buffer_frames,
                            error
                        ));
                    }
                    first_initialize_error.get_or_insert_with(|| error.to_string());
                }
            }
        }
    }

    let reason = first_initialize_error
        .map(|error| format!(" Last WASAPI initialize error: {error}"))
        .unwrap_or_default();
    Err(
        format!(
            "The selected output device rejected FLAC Cafe's stable WASAPI exclusive formats. Shared output will be used if available.{reason}"
        )
    )
}

fn wasapi_initialize_error_message(error: windows::core::Error, format: WasapiFormat) -> String {
    if error.code() == Audio::AUDCLNT_E_DEVICE_IN_USE {
        return wasapi_device_in_use_message();
    }
    format!(
        "Could not open WASAPI exclusive output at {} Hz, {} channel(s), {}: {error}",
        format.sample_rate,
        format.channels,
        format.label()
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

fn property_wave_format(device: &Audio::IMMDevice, key: &PROPERTYKEY) -> Option<WasapiFormat> {
    unsafe {
        let store = device.OpenPropertyStore(STGM_READ).ok()?;
        let mut value = store.GetValue(key as *const PROPERTYKEY).ok()?;
        let format = propvariant_wave_format(&mut value);
        let _ = PropVariantClear(&mut value as *mut PROPVARIANT);
        format
    }
}

unsafe fn propvariant_wave_format(value: &mut PROPVARIANT) -> Option<WasapiFormat> {
    let prop_variant = &value.Anonymous.Anonymous;
    if prop_variant.vt != VT_BLOB {
        return None;
    }
    let blob = prop_variant.Anonymous.blob;
    if blob.pBlobData.is_null() || (blob.cbSize as usize) < mem::size_of::<Audio::WAVEFORMATEX>() {
        return None;
    }
    parse_wave_format(blob.pBlobData as *const Audio::WAVEFORMATEX)
}

unsafe fn parse_wave_format(format_ptr: *const Audio::WAVEFORMATEX) -> Option<WasapiFormat> {
    if format_ptr.is_null() {
        return None;
    }
    let base = ptr::read_unaligned(format_ptr);
    let mut channel_mask = None;
    let (sample_format, container) =
        if u32::from(base.wFormatTag) == Multimedia::WAVE_FORMAT_IEEE_FLOAT {
            (WasapiSampleFormat::F32, WasapiFormatContainer::Plain)
        } else if u32::from(base.wFormatTag) == Audio::WAVE_FORMAT_PCM {
            (
                pcm_sample_format(
                    base.wBitsPerSample,
                    base.wBitsPerSample,
                    base.nBlockAlign,
                    base.nChannels,
                )?,
                WasapiFormatContainer::Plain,
            )
        } else if u32::from(base.wFormatTag) == KernelStreaming::WAVE_FORMAT_EXTENSIBLE {
            let extensible_ptr = format_ptr as *const Audio::WAVEFORMATEXTENSIBLE;
            let extensible = ptr::read_unaligned(extensible_ptr);
            channel_mask = Some(extensible.dwChannelMask);
            let sub_format = ptr::addr_of!((*extensible_ptr).SubFormat).read_unaligned();
            if sub_format == Multimedia::KSDATAFORMAT_SUBTYPE_IEEE_FLOAT {
                (WasapiSampleFormat::F32, WasapiFormatContainer::Extensible)
            } else if sub_format == KernelStreaming::KSDATAFORMAT_SUBTYPE_PCM {
                let valid_bits = extensible.Samples.wValidBitsPerSample;
                (
                    pcm_sample_format(
                        base.wBitsPerSample,
                        valid_bits,
                        base.nBlockAlign,
                        base.nChannels,
                    )?,
                    WasapiFormatContainer::Extensible,
                )
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
        container,
        channel_mask,
    })
}

enum WasapiWaveFormat {
    Plain(Audio::WAVEFORMATEX),
    Extensible(Audio::WAVEFORMATEXTENSIBLE),
}

impl WasapiWaveFormat {
    fn as_ptr(&self) -> *const Audio::WAVEFORMATEX {
        match self {
            WasapiWaveFormat::Plain(format) => format as *const Audio::WAVEFORMATEX,
            WasapiWaveFormat::Extensible(format) => &format.Format as *const Audio::WAVEFORMATEX,
        }
    }
}

fn wave_format(format: WasapiFormat) -> WasapiWaveFormat {
    match format.container {
        WasapiFormatContainer::Plain => WasapiWaveFormat::Plain(wave_format_plain(format)),
        WasapiFormatContainer::Extensible => {
            WasapiWaveFormat::Extensible(wave_format_extensible(format))
        }
    }
}

fn wave_format_plain(format: WasapiFormat) -> Audio::WAVEFORMATEX {
    let format_tag = match format.sample_format {
        WasapiSampleFormat::F32 => Multimedia::WAVE_FORMAT_IEEE_FLOAT,
        WasapiSampleFormat::I16 | WasapiSampleFormat::I24 | WasapiSampleFormat::I32 => {
            Audio::WAVE_FORMAT_PCM
        }
        WasapiSampleFormat::I24Padded | WasapiSampleFormat::I24In32 => {
            KernelStreaming::WAVE_FORMAT_EXTENSIBLE
        }
    };
    let sample_bytes = format.sample_format.bytes_per_sample();
    let bits_per_sample = format.sample_format.bits_per_sample();
    Audio::WAVEFORMATEX {
        wFormatTag: format_tag as u16,
        nChannels: format.channels,
        nSamplesPerSec: format.sample_rate,
        nAvgBytesPerSec: u32::from(format.channels) * format.sample_rate * u32::from(sample_bytes),
        nBlockAlign: format.channels * sample_bytes,
        wBitsPerSample: bits_per_sample,
        cbSize: 0,
    }
}

fn wave_format_extensible(format: WasapiFormat) -> Audio::WAVEFORMATEXTENSIBLE {
    let sample_bytes = format.sample_format.bytes_per_sample();
    let bits_per_sample = format.sample_format.bits_per_sample();
    let valid_bits_per_sample = format.sample_format.valid_bits_per_sample();
    let waveformatex = Audio::WAVEFORMATEX {
        wFormatTag: KernelStreaming::WAVE_FORMAT_EXTENSIBLE as u16,
        nChannels: format.channels,
        nSamplesPerSec: format.sample_rate,
        nAvgBytesPerSec: u32::from(format.channels) * format.sample_rate * u32::from(sample_bytes),
        nBlockAlign: format.channels * sample_bytes,
        wBitsPerSample: bits_per_sample,
        cbSize: (mem::size_of::<Audio::WAVEFORMATEXTENSIBLE>()
            - mem::size_of::<Audio::WAVEFORMATEX>()) as u16,
    };
    let sub_format = match format.sample_format {
        WasapiSampleFormat::I16
        | WasapiSampleFormat::I24
        | WasapiSampleFormat::I24Padded
        | WasapiSampleFormat::I24In32
        | WasapiSampleFormat::I32 => KernelStreaming::KSDATAFORMAT_SUBTYPE_PCM,
        WasapiSampleFormat::F32 => Multimedia::KSDATAFORMAT_SUBTYPE_IEEE_FLOAT,
    };
    Audio::WAVEFORMATEXTENSIBLE {
        Format: waveformatex,
        Samples: Audio::WAVEFORMATEXTENSIBLE_0 {
            wValidBitsPerSample: valid_bits_per_sample,
        },
        dwChannelMask: format
            .channel_mask
            .unwrap_or_else(|| channel_mask(format.channels)),
        SubFormat: sub_format,
    }
}

fn pcm_sample_format(
    container_bits: u16,
    valid_bits: u16,
    block_align: u16,
    channels: u16,
) -> Option<WasapiSampleFormat> {
    let bytes_per_sample = if channels > 0 {
        block_align / channels
    } else {
        0
    };
    match (container_bits, valid_bits, bytes_per_sample) {
        (16, _, _) => Some(WasapiSampleFormat::I16),
        (24, _, 4) => Some(WasapiSampleFormat::I24Padded),
        (24, _, _) => Some(WasapiSampleFormat::I24),
        (32, 24, _) => Some(WasapiSampleFormat::I24In32),
        (32, _, _) => Some(WasapiSampleFormat::I32),
        _ => None,
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

fn exclusive_format_candidates(
    mix: WasapiFormat,
    preferred_sample_rate: Option<u32>,
) -> Vec<WasapiFormat> {
    let sample_rates = unique_u32([
        mix.sample_rate,
        96_000,
        48_000,
        44_100,
        88_200,
        192_000,
        176_400,
        preferred_sample_rate.unwrap_or(0),
    ]);
    let channel_counts = unique_u16([mix.channels, 2, 1]);
    let mut candidates = Vec::new();
    push_unique_format(&mut candidates, mix);
    for sample_rate in sample_rates.iter().copied() {
        for channels in channel_counts.iter().copied() {
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::F32,
            );
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::I24Padded,
            );
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::I24In32,
            );
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::I24,
            );
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::I32,
            );
        }
    }
    for sample_rate in sample_rates.iter().copied() {
        for channels in channel_counts.iter().copied() {
            push_format_variants(
                &mut candidates,
                channels,
                sample_rate,
                WasapiSampleFormat::I16,
            );
        }
    }
    candidates
}

fn push_format_variants(
    candidates: &mut Vec<WasapiFormat>,
    channels: u16,
    sample_rate: u32,
    sample_format: WasapiSampleFormat,
) {
    if matches!(
        sample_format,
        WasapiSampleFormat::F32 | WasapiSampleFormat::I16 | WasapiSampleFormat::I24
    ) {
        push_unique_format(
            candidates,
            WasapiFormat {
                channels,
                sample_rate,
                sample_format,
                container: WasapiFormatContainer::Plain,
                channel_mask: None,
            },
        );
    }
    for channel_mask in channel_mask_candidates(channels, sample_format) {
        push_unique_format(
            candidates,
            WasapiFormat {
                channels,
                sample_rate,
                sample_format,
                container: WasapiFormatContainer::Extensible,
                channel_mask,
            },
        );
    }
}

fn push_unique_format(candidates: &mut Vec<WasapiFormat>, format: WasapiFormat) {
    if !candidates.contains(&format) {
        candidates.push(format);
    }
}

fn channel_mask_candidates(channels: u16, sample_format: WasapiSampleFormat) -> Vec<Option<u32>> {
    let mut masks = Vec::new();
    if matches!(sample_format, WasapiSampleFormat::I24) && channels <= 2 {
        masks.push(Some(0));
        masks.push(None);
        return masks;
    }
    masks.push(None);
    if channels <= 2 {
        masks.push(Some(0));
    }
    masks
}

fn buffer_frame_candidates(requested: Option<u32>, sample_rate: u32) -> Vec<u32> {
    let default_frames = ((sample_rate / 1000) * WASAPI_EXCLUSIVE_DEFAULT_BUFFER_MS)
        .next_power_of_two()
        .clamp(8192, 32_768);
    let minimum_stable_frames = ((sample_rate / 1000) * 150)
        .next_power_of_two()
        .clamp(8192, 32_768);
    let mut candidates = Vec::new();
    candidates.push(default_frames);
    if let Some(requested) =
        requested.filter(|value| *value >= minimum_stable_frames && *value <= 32_768)
    {
        candidates.push(requested);
    }
    for value in [32_768, 16_384, 8192] {
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

struct TimerPeriodGuard(Option<u32>);

impl TimerPeriodGuard {
    fn enable(milliseconds: u32) -> Self {
        let result = unsafe { timeBeginPeriod(milliseconds) };
        if result == 0 {
            Self(Some(milliseconds))
        } else {
            Self(None)
        }
    }
}

impl Drop for TimerPeriodGuard {
    fn drop(&mut self) {
        if let Some(milliseconds) = self.0.take() {
            unsafe {
                let _ = timeEndPeriod(milliseconds);
            }
        }
    }
}
