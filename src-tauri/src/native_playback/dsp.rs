use super::{
    fade_frame_count, smooth_fade_progress, NativeGainControl, NativeVisualizerState,
    CLICKLESS_START_RAMP_MS, DSP_SETTINGS_CHECK_SAMPLES, EQ_FREQUENCIES_10, EQ_FREQUENCIES_15,
    EQ_GAIN_MAX_DB, EQ_GAIN_MIN_DB, EQ_PREAMP_MAX_DB, EQ_PREAMP_MIN_DB, VISUALIZER_FLUSH_SAMPLES,
};
use rodio::{source::SeekError, ChannelCount, Player, SampleRate, Source};
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeDspSettings {
    #[serde(default = "default_normalization_gain")]
    pub(crate) normalization_gain: f32,
    #[serde(default)]
    pub(crate) equalizer_enabled: bool,
    #[serde(default = "default_equalizer_band_mode")]
    pub(crate) equalizer_band_mode: String,
    #[serde(default)]
    pub(crate) equalizer_preamp_db: f32,
    #[serde(default)]
    pub(crate) equalizer_gains: Vec<f32>,
    #[serde(default = "default_limiter_enabled")]
    pub(crate) limiter_enabled: bool,
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
pub(super) struct NormalizedDspSettings {
    pub(crate) normalization_gain: f32,
    pub(crate) equalizer_enabled: bool,
    pub(crate) frequencies: Vec<f32>,
    pub(crate) equalizer_preamp_db: f32,
    pub(crate) equalizer_gains: Vec<f32>,
    pub(crate) limiter_enabled: bool,
}

impl NativeDspSettings {
    pub(super) fn normalized(&self) -> NormalizedDspSettings {
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

pub(super) fn append_dsp_source<S>(
    player: &Player,
    source: S,
    dsp_settings: Arc<Mutex<NativeDspSettings>>,
    gain: NativeGainControl,
    visualizer: Arc<Mutex<NativeVisualizerState>>,
) where
    S: Source<Item = f32> + Send + 'static,
{
    player.append(NativeDspSource::new(source, dsp_settings, gain, visualizer));
}

#[derive(Clone, Copy)]
pub(super) enum NativeEqBandKind {
    LowShelf,
    Peaking,
    HighShelf,
}

#[derive(Clone, Copy, Debug, Default)]
pub(super) struct BiquadCoefficients {
    pub(crate) b0: f32,
    pub(crate) b1: f32,
    pub(crate) b2: f32,
    pub(crate) a1: f32,
    pub(crate) a2: f32,
}

#[derive(Clone, Copy, Debug, Default)]
struct BiquadState {
    pub(crate) x1: f32,
    pub(crate) x2: f32,
    pub(crate) y1: f32,
    pub(crate) y2: f32,
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

pub(super) fn biquad_coefficients(
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

pub(super) struct NativeDspSource<S>
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
    startup_ramp_total_frames: u64,
    startup_ramp_elapsed_frames: u64,
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
    pub(super) fn new(
        input: S,
        settings: Arc<Mutex<NativeDspSettings>>,
        gain_control: NativeGainControl,
        visualizer: Arc<Mutex<NativeVisualizerState>>,
    ) -> Self {
        let sample_rate = input.sample_rate().get();
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
            startup_ramp_total_frames: fade_frame_count(
                Duration::from_millis(CLICKLESS_START_RAMP_MS),
                sample_rate,
            ),
            startup_ramp_elapsed_frames: 0,
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
        sample *= self.output_gain * self.startup_ramp_gain();
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

    fn startup_ramp_gain(&mut self) -> f32 {
        if self.startup_ramp_total_frames == 0
            || self.startup_ramp_elapsed_frames >= self.startup_ramp_total_frames
        {
            return 1.0;
        }
        self.startup_ramp_elapsed_frames += 1;
        smooth_fade_progress(
            (self.startup_ramp_elapsed_frames as f32 / self.startup_ramp_total_frames as f32)
                .clamp(0.0, 1.0),
        )
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
        self.startup_ramp_elapsed_frames = 0;
        Ok(())
    }
}

pub(super) fn soft_limit(sample: f32) -> f32 {
    if !sample.is_finite() {
        return 0.0;
    }
    // A zero-lookahead soft limiter is enough for playback safety here: it catches
    // EQ/preamp overs without adding latency or turning the Rust audio engine into a DAW.
    let threshold = 0.96_f32;
    let magnitude = sample.abs();
    if magnitude <= threshold {
        return sample;
    }
    let excess = (magnitude - threshold) / (1.0 - threshold);
    let limited = threshold + (1.0 - threshold) * excess.tanh();
    sample.signum() * limited.min(1.0)
}
