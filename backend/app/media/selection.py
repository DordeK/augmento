"""Heuristics for placing a promotion in a relatively quiet part of a video.

This deliberately estimates quietness from silence and loudness measurements. It is not speech
detection and cannot reliably distinguish speech from music or other background audio.
"""

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class SilenceInterval:
    start: float
    end: float


@dataclass(frozen=True)
class LoudnessSample:
    timestamp: float
    loudness_db: float


@dataclass(frozen=True)
class InsertionChoice:
    timestamp: float
    source: str
    score_db: float | None = None


def choose_insertion_point(
    *,
    video_duration: float,
    promotion_duration: float,
    silence_intervals: list[SilenceInterval],
    loudness_samples: list[LoudnessSample],
    edge_margin: float = 3.0,
    buffer_margin: float = 0.35,
    sample_step: float = 0.25,
) -> InsertionChoice:
    """Choose a promotion start using silence first, then rolling-window loudness."""
    if video_duration <= 0 or promotion_duration <= 0:
        raise ValueError("Media durations must be positive")

    earliest = edge_margin + buffer_margin
    latest = video_duration - edge_margin - buffer_margin - promotion_duration
    if latest < earliest:
        required = promotion_duration + 2 * (edge_margin + buffer_margin)
        raise ValueError(
            f"Video is too short: need at least {required:.2f}s for this "
            f"{promotion_duration:.2f}s promotion and safety margins"
        )

    required_window = promotion_duration + 2 * buffer_margin
    viable_silences: list[tuple[float, SilenceInterval]] = []
    for interval in silence_intervals:
        usable_start = max(interval.start, edge_margin)
        usable_end = min(interval.end, video_duration - edge_margin)
        if usable_end - usable_start >= required_window:
            center = (usable_start + usable_end) / 2
            start = min(max(center - promotion_duration / 2, earliest), latest)
            viable_silences.append((usable_end - usable_start, SilenceInterval(start, usable_end)))

    if viable_silences:
        _, best = max(viable_silences, key=lambda item: (item[0], -item[1].start))
        return InsertionChoice(timestamp=round(best.start, 3), source="silence")

    candidates: list[tuple[float, float]] = []
    position = earliest
    while position <= latest + 1e-9:
        window_start = position - buffer_margin
        window_end = position + promotion_duration + buffer_margin
        values = [
            sample.loudness_db
            for sample in loudness_samples
            if window_start <= sample.timestamp <= window_end and isfinite(sample.loudness_db)
        ]
        # EBU R128 reports -inf for digital silence; treat it as quieter than any finite sample.
        has_silence = any(
            window_start <= sample.timestamp <= window_end
            and not isfinite(sample.loudness_db)
            and sample.loudness_db < 0
            for sample in loudness_samples
        )
        if has_silence and not values:
            score = -120.0
        else:
            score = sum(values) / len(values) if values else 0.0
        candidates.append((score, position))
        position += sample_step

    score, timestamp = min(candidates, key=lambda item: (item[0], item[1]))
    return InsertionChoice(timestamp=round(timestamp, 3), source="loudness", score_db=score)
