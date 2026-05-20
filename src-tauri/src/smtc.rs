use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{State, WebviewWindow};

#[derive(Debug, Clone, Deserialize)]
pub struct SmtcTrackPayload {
    pub id: i64,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SmtcUpdatePayload {
    pub track: Option<SmtcTrackPayload>,
    pub is_playing: bool,
    pub position_seconds: f64,
    pub duration_seconds: f64,
    pub can_previous: bool,
    pub can_next: bool,
}

#[derive(Debug, Clone, Serialize)]
struct SmtcButtonEvent {
    command: String,
    position_seconds: Option<f64>,
}

#[derive(Default)]
pub struct SmtcState {
    controller: Mutex<Option<platform::Controller>>,
}

#[tauri::command]
pub fn smtc_update_state(
    window: WebviewWindow,
    state: State<'_, SmtcState>,
    payload: SmtcUpdatePayload,
) -> Result<(), String> {
    platform::update(&window, &state, payload)
}

#[tauri::command]
pub fn smtc_clear(state: State<'_, SmtcState>) -> Result<(), String> {
    platform::clear(&state)
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{SmtcButtonEvent, SmtcState, SmtcTrackPayload, SmtcUpdatePayload};
    use tauri::{Emitter, WebviewWindow};
    use windows::core::{factory, HSTRING};
    use windows::Foundation::{TimeSpan, TypedEventHandler};
    use windows::Media::{
        MediaPlaybackStatus, MediaPlaybackType, PlaybackPositionChangeRequestedEventArgs,
        SystemMediaTransportControls, SystemMediaTransportControlsButton,
        SystemMediaTransportControlsButtonPressedEventArgs,
        SystemMediaTransportControlsTimelineProperties,
    };
    use windows::Win32::System::WinRT::{
        ISystemMediaTransportControlsInterop, RoInitialize, RO_INIT_MULTITHREADED,
    };

    pub struct Controller {
        controls: SystemMediaTransportControls,
        _button_token: i64,
        _position_token: i64,
        last_track_id: Option<i64>,
    }

    pub fn update(
        window: &WebviewWindow,
        state: &SmtcState,
        payload: SmtcUpdatePayload,
    ) -> Result<(), String> {
        let mut guard = state
            .controller
            .lock()
            .map_err(|_| "SMTC state lock failed".to_string())?;
        if guard.is_none() {
            *guard = Some(Controller::new(window)?);
        }
        if let Some(controller) = guard.as_mut() {
            controller.apply(payload)?;
        }
        Ok(())
    }

    pub fn clear(state: &SmtcState) -> Result<(), String> {
        let mut guard = state
            .controller
            .lock()
            .map_err(|_| "SMTC state lock failed".to_string())?;
        if let Some(controller) = guard.as_mut() {
            controller.clear()?;
        }
        Ok(())
    }

    impl Controller {
        fn new(window: &WebviewWindow) -> Result<Self, String> {
            let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };

            let hwnd = window.hwnd().map_err(|error| error.to_string())?;
            let interop: ISystemMediaTransportControlsInterop =
                factory::<SystemMediaTransportControls, ISystemMediaTransportControlsInterop>()
                    .map_err(|error| error.to_string())?;
            let controls: SystemMediaTransportControls =
                unsafe { interop.GetForWindow(hwnd) }.map_err(|error| error.to_string())?;

            controls
                .SetIsEnabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .SetIsPlayEnabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .SetIsPauseEnabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .SetIsNextEnabled(true)
                .map_err(|error| error.to_string())?;
            controls
                .SetIsPreviousEnabled(true)
                .map_err(|error| error.to_string())?;

            let button_window = window.clone();
            let button_token = controls
                .ButtonPressed(&TypedEventHandler::<
                    SystemMediaTransportControls,
                    SystemMediaTransportControlsButtonPressedEventArgs,
                >::new(move |_sender, args| {
                    if let Some(args) = args.as_ref() {
                        if let Ok(button) = args.Button() {
                            let command = match button {
                                SystemMediaTransportControlsButton::Play => Some("play"),
                                SystemMediaTransportControlsButton::Pause => Some("pause"),
                                SystemMediaTransportControlsButton::Stop => Some("stop"),
                                SystemMediaTransportControlsButton::Next => Some("next"),
                                SystemMediaTransportControlsButton::Previous => Some("previous"),
                                _ => None,
                            };
                            if let Some(command) = command {
                                let _ = button_window.emit(
                                    "smtc-button",
                                    SmtcButtonEvent {
                                        command: command.to_string(),
                                        position_seconds: None,
                                    },
                                );
                            }
                        }
                    }
                    Ok(())
                }))
                .map_err(|error| error.to_string())?;

            let seek_window = window.clone();
            let position_token = controls
                .PlaybackPositionChangeRequested(&TypedEventHandler::<
                    SystemMediaTransportControls,
                    PlaybackPositionChangeRequestedEventArgs,
                >::new(move |_sender, args| {
                    if let Some(args) = args.as_ref() {
                        if let Ok(position) = args.RequestedPlaybackPosition() {
                            let _ = seek_window.emit(
                                "smtc-button",
                                SmtcButtonEvent {
                                    command: "seek".to_string(),
                                    position_seconds: Some(position.Duration as f64 / 10_000_000.0),
                                },
                            );
                        }
                    }
                    Ok(())
                }))
                .map_err(|error| error.to_string())?;

            Ok(Self {
                controls,
                _button_token: button_token,
                _position_token: position_token,
                last_track_id: None,
            })
        }

        fn apply(&mut self, payload: SmtcUpdatePayload) -> Result<(), String> {
            if payload.track.is_none() {
                self.clear()?;
                return Ok(());
            }

            let track = payload.track.as_ref().expect("checked above");
            self.controls
                .SetIsEnabled(true)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetIsPlayEnabled(true)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetIsPauseEnabled(true)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetIsPreviousEnabled(payload.can_previous)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetIsNextEnabled(payload.can_next)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetPlaybackStatus(if payload.is_playing {
                    MediaPlaybackStatus::Playing
                } else {
                    MediaPlaybackStatus::Paused
                })
                .map_err(|error| error.to_string())?;

            if self.last_track_id != Some(track.id) {
                self.update_display(track)?;
                self.last_track_id = Some(track.id);
            }
            self.update_timeline(payload.position_seconds, payload.duration_seconds)?;
            Ok(())
        }

        fn clear(&mut self) -> Result<(), String> {
            self.last_track_id = None;
            self.controls
                .SetPlaybackStatus(MediaPlaybackStatus::Closed)
                .map_err(|error| error.to_string())?;
            self.controls
                .SetIsEnabled(false)
                .map_err(|error| error.to_string())?;
            let updater = self
                .controls
                .DisplayUpdater()
                .map_err(|error| error.to_string())?;
            updater.ClearAll().map_err(|error| error.to_string())?;
            updater.Update().map_err(|error| error.to_string())?;
            Ok(())
        }

        fn update_display(&self, track: &SmtcTrackPayload) -> Result<(), String> {
            let updater = self
                .controls
                .DisplayUpdater()
                .map_err(|error| error.to_string())?;
            updater.ClearAll().map_err(|error| error.to_string())?;
            updater
                .SetType(MediaPlaybackType::Music)
                .map_err(|error| error.to_string())?;
            updater
                .SetAppMediaId(&HSTRING::from(format!("flac-cafe:{}", track.id)))
                .map_err(|error| error.to_string())?;

            let music = updater
                .MusicProperties()
                .map_err(|error| error.to_string())?;
            music
                .SetTitle(&HSTRING::from(track.title.as_deref().unwrap_or("Untitled")))
                .map_err(|error| error.to_string())?;
            music
                .SetArtist(&HSTRING::from(
                    track.artist.as_deref().unwrap_or("Unknown Artist"),
                ))
                .map_err(|error| error.to_string())?;
            music
                .SetAlbumTitle(&HSTRING::from(track.album.as_deref().unwrap_or("")))
                .map_err(|error| error.to_string())?;
            music
                .SetAlbumArtist(&HSTRING::from(
                    track
                        .album_artist
                        .as_deref()
                        .or(track.artist.as_deref())
                        .unwrap_or(""),
                ))
                .map_err(|error| error.to_string())?;

            if let Some(genre) = track
                .genre
                .as_deref()
                .filter(|genre| !genre.trim().is_empty())
            {
                if let Ok(genres) = music.Genres() {
                    let _ = genres.Append(&HSTRING::from(genre));
                }
            }

            updater.Update().map_err(|error| error.to_string())?;
            self.update_timeline(0.0, track.duration_seconds.unwrap_or(0.0))?;
            Ok(())
        }

        fn update_timeline(
            &self,
            position_seconds: f64,
            duration_seconds: f64,
        ) -> Result<(), String> {
            let duration = duration_seconds.max(0.0);
            let position = position_seconds.clamp(0.0, duration.max(position_seconds));
            let timeline = SystemMediaTransportControlsTimelineProperties::new()
                .map_err(|error| error.to_string())?;
            timeline
                .SetStartTime(seconds_to_timespan(0.0))
                .map_err(|error| error.to_string())?;
            timeline
                .SetMinSeekTime(seconds_to_timespan(0.0))
                .map_err(|error| error.to_string())?;
            timeline
                .SetPosition(seconds_to_timespan(position))
                .map_err(|error| error.to_string())?;
            timeline
                .SetEndTime(seconds_to_timespan(duration))
                .map_err(|error| error.to_string())?;
            timeline
                .SetMaxSeekTime(seconds_to_timespan(duration))
                .map_err(|error| error.to_string())?;
            self.controls
                .UpdateTimelineProperties(&timeline)
                .map_err(|error| error.to_string())?;
            Ok(())
        }
    }

    fn seconds_to_timespan(seconds: f64) -> TimeSpan {
        TimeSpan {
            Duration: (seconds.max(0.0) * 10_000_000.0).round() as i64,
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::{SmtcState, SmtcUpdatePayload};
    use tauri::WebviewWindow;

    pub struct Controller;

    pub fn update(
        _window: &WebviewWindow,
        _state: &SmtcState,
        _payload: SmtcUpdatePayload,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn clear(_state: &SmtcState) -> Result<(), String> {
        Ok(())
    }
}
