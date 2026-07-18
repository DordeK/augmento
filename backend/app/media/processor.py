from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.media.selection import (
    InsertionChoice,
    LoudnessSample,
    SilenceInterval,
    choose_insertion_point,
)

SILENCE_START_RE = re.compile(r"silence_start:\s*([0-9.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*([0-9.]+)")
LOUDNESS_TIME_RE = re.compile(r"pts_time:([0-9.]+)")
LOUDNESS_VALUE_RE = re.compile(r"lavfi\.r128\.M=(-?inf|[-+0-9.]+)", re.IGNORECASE)


class MediaError(Exception):
    """An actionable error caused by invalid or unsupported media."""


@dataclass(frozen=True)
class MediaInfo:
    duration: float
    has_video: bool
    has_audio: bool
    video_duration: float | None
    audio_duration: float | None


@dataclass(frozen=True)
class RenderResult:
    insertion: InsertionChoice
    output_path: Path


def _run(command: list[str], *, timeout: float, purpose: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise MediaError(f"{command[0]} is not installed or not on PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaError(f"{purpose} timed out after {timeout:g} seconds") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "unknown FFmpeg error").strip().splitlines()
        message = detail[-1] if detail else "unknown FFmpeg error"
        raise MediaError(f"{purpose} failed: {message}") from exc


def probe_media(path: Path, *, timeout: float) -> MediaInfo:
    result = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,duration",
            "-of",
            "json",
            str(path),
        ],
        timeout=timeout,
        purpose=f"Validating {path.name}",
    )
    try:
        payload = json.loads(result.stdout)
        streams = payload.get("streams", [])
        format_duration_value = payload.get("format", {}).get("duration")
        format_duration = (
            float(format_duration_value) if format_duration_value not in (None, "N/A") else None
        )
        stream_durations = {
            codec_type: [
                float(stream["duration"])
                for stream in streams
                if stream.get("codec_type") == codec_type
                and stream.get("duration") not in (None, "N/A")
            ]
            for codec_type in ("video", "audio")
        }
        durations = [
            duration
            for duration in (
                format_duration,
                *stream_durations["video"],
                *stream_durations["audio"],
            )
            if duration is not None
        ]
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise MediaError(f"Could not read media metadata from {path.name}") from exc
    if not durations or max(durations) <= 0:
        raise MediaError(f"{path.name} has no valid positive duration")
    has_video = any(stream.get("codec_type") == "video" for stream in streams)
    has_audio = any(stream.get("codec_type") == "audio" for stream in streams)
    return MediaInfo(
        duration=max(durations),
        has_video=has_video,
        has_audio=has_audio,
        video_duration=max(
            stream_durations["video"], default=format_duration if has_video else None
        ),
        audio_duration=max(
            stream_durations["audio"], default=format_duration if has_audio else None
        ),
    )


def detect_silence(path: Path, *, duration: float, timeout: float) -> list[SilenceInterval]:
    result = _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-i",
            str(path),
            "-vn",
            "-af",
            "silencedetect=noise=-35dB:d=0.5",
            "-f",
            "null",
            "-",
        ],
        timeout=timeout,
        purpose="Silence analysis",
    )
    intervals: list[SilenceInterval] = []
    pending_start: float | None = None
    for line in result.stderr.splitlines():
        if match := SILENCE_START_RE.search(line):
            pending_start = float(match.group(1))
        elif match := SILENCE_END_RE.search(line):
            start = pending_start if pending_start is not None else 0.0
            intervals.append(SilenceInterval(start=start, end=float(match.group(1))))
            pending_start = None
    if pending_start is not None:
        intervals.append(SilenceInterval(start=pending_start, end=duration))
    return intervals


def measure_loudness(path: Path, *, timeout: float) -> list[LoudnessSample]:
    result = _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-i",
            str(path),
            "-vn",
            "-af",
            "ebur128=metadata=1,ametadata=print:file=-",
            "-f",
            "null",
            "-",
        ],
        timeout=timeout,
        purpose="Loudness analysis",
    )
    samples: list[LoudnessSample] = []
    timestamp: float | None = None
    for line in result.stdout.splitlines():
        if match := LOUDNESS_TIME_RE.search(line):
            timestamp = float(match.group(1))
        elif timestamp is not None and (match := LOUDNESS_VALUE_RE.search(line)):
            raw = match.group(1).lower()
            samples.append(
                LoudnessSample(
                    timestamp=timestamp,
                    loudness_db=float("-inf") if raw == "-inf" else float(raw),
                )
            )
            timestamp = None
    return samples


def _filter_graph(
    *, video_duration: float, promotion_duration: float, insertion: float, has_audio: bool
) -> str:
    fade = min(0.3, promotion_duration / 4)
    fade_out = max(0.0, promotion_duration - fade)
    delay_ms = round(insertion * 1000)
    if has_audio:
        attack = 0.35
        release = 0.65
        end = insertion + promotion_duration
        volume = (
            f"if(lt(t,{insertion - attack:.3f}),1,"
            f"if(lt(t,{insertion:.3f}),1-0.32*(t-{insertion - attack:.3f})/{attack},"
            f"if(lt(t,{end:.3f}),0.68,"
            f"if(lt(t,{end + release:.3f}),0.68+0.32*(t-{end:.3f})/{release},1))))"
        )
        base = (
            "[0:a:0]aresample=48000,"
            "aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"volume='{volume}':eval=frame[base]"
        )
    else:
        base = f"anullsrc=r=48000:cl=stereo,atrim=duration={video_duration:.3f}[base]"
    promotion = (
        "[1:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        "highpass=f=320,lowpass=f=3600,equalizer=f=1800:t=q:w=1.2:g=2,"
        "acompressor=threshold=0.125:ratio=3:attack=15:release=120:makeup=1.4,"
        "aecho=in_gain=0.8:out_gain=0.9:delays=35:decays=0.06,"
        f"volume=0.42,afade=t=in:st=0:d={fade:.3f},"
        f"afade=t=out:st={fade_out:.3f}:d={fade:.3f},adelay={delay_ms}|{delay_ms}[promo]"
    )
    mix = "[base][promo]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[mixed]"
    return ";".join((base, promotion, mix))


def _render_command(
    *,
    video_path: Path,
    promotion_path: Path,
    output_path: Path,
    video_duration: float,
    promotion_duration: float,
    insertion: float,
    has_audio: bool,
    copy_video: bool,
) -> list[str]:
    video_codec = (
        ["-c:v", "copy"] if copy_video else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
    )
    return [
        "ffmpeg",
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        str(video_path),
        "-i",
        str(promotion_path),
        "-filter_complex",
        _filter_graph(
            video_duration=video_duration,
            promotion_duration=promotion_duration,
            insertion=insertion,
            has_audio=has_audio,
        ),
        "-map",
        "0:v:0",
        "-map",
        "[mixed]",
        *video_codec,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        f"{video_duration:.3f}",
        "-movflags",
        "+faststart",
        str(output_path),
    ]


def process_video(
    video_path: Path, promotion_path: Path, output_path: Path, *, timeout: float
) -> RenderResult:
    video = probe_media(video_path, timeout=timeout)
    if not video.has_video:
        raise MediaError("Uploaded file does not contain a video stream")
    promotion = probe_media(promotion_path, timeout=timeout)
    if not promotion.has_audio:
        raise MediaError("Configured promotion file does not contain an audio stream")
    video_duration = video.video_duration or video.duration
    promotion_duration = promotion.audio_duration or promotion.duration

    if video.has_audio:
        silences = detect_silence(video_path, duration=video_duration, timeout=timeout)
        loudness = measure_loudness(video_path, timeout=timeout)
    else:
        silences = [SilenceInterval(0.0, video_duration)]
        loudness = []
    try:
        insertion = choose_insertion_point(
            video_duration=video_duration,
            promotion_duration=promotion_duration,
            silence_intervals=silences,
            loudness_samples=loudness,
        )
    except ValueError as exc:
        raise MediaError(str(exc)) from exc

    command_args = dict(
        video_path=video_path,
        promotion_path=promotion_path,
        output_path=output_path,
        video_duration=video_duration,
        promotion_duration=promotion_duration,
        insertion=insertion.timestamp,
        has_audio=video.has_audio,
    )
    try:
        _run(
            _render_command(**command_args, copy_video=True),
            timeout=timeout,
            purpose="Rendering augmented video",
        )
    except MediaError:
        # Some valid input video codecs cannot be muxed into MP4; transcode only in that case.
        _run(
            _render_command(**command_args, copy_video=False),
            timeout=timeout,
            purpose="Rendering augmented video with compatible H.264 video",
        )
    return RenderResult(insertion=insertion, output_path=output_path)
