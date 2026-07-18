#!/usr/bin/env python3
"""Create a spoken radio-promo MP3 with a supplied jingle at both ends."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from add_radio_promo import synthesize


DEFAULT_TEXT = (
    "Argentina or Spain? Pick your champion—but don't forget the real MVP: "
    "an ice-cold Coca-Cola. Cheers to the beautiful game!"
)
DEFAULT_VOICE_ID = "howQSp4vukBSqM6XL2q5"
DEFAULT_JINGLE = Path(
    "/Users/dkremenovic/Desktop/projects/hackathon8x/"
    "timkraaijvanger-funk-radio-jingle-i-was-the-king-of-the-desktop-computer-cover-455738.mp3"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice-id", default=DEFAULT_VOICE_ID, help="ElevenLabs voice ID")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Promotion wording")
    parser.add_argument("--jingle", type=Path, default=DEFAULT_JINGLE, help="Licensed MP3 jingle to use at the beginning and end")
    parser.add_argument("--jingle-seconds", type=float, default=3.5, help="Duration of each jingle excerpt (default: 3.5)")
    parser.add_argument("--transition-seconds", type=float, default=1.3, help="Fade duration before and after the promo (default: 1.3)")
    parser.add_argument("--output", type=Path, default=Path("coca_cola_radio_promo.mp3"), help="Output MP3 path")
    parser.add_argument("--model-id", default="eleven_multilingual_v2", help="ElevenLabs TTS model")
    args = parser.parse_args()

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required. Install it, then run the script again.")
    if not args.jingle.is_file():
        raise RuntimeError(f"Jingle not found: {args.jingle}")
    if args.jingle_seconds < 0.5:
        parser.error("--jingle-seconds must be at least 0.5.")
    if not 0 < args.transition_seconds < args.jingle_seconds:
        parser.error("--transition-seconds must be positive and shorter than --jingle-seconds.")

    raw_voice = args.output.with_suffix(".raw_voice.mp3")
    synthesize(args.text, args.voice_id, args.model_id, raw_voice)
    try:
        # Keep the jingle and announcer sequential: the intro fades fully to
        # silence before speech, then the outro rises gently after speech ends.
        filter_graph = (
            f"[0:a]aformat=channel_layouts=stereo,atrim=duration={args.jingle_seconds},asetpts=PTS-STARTPTS,afade=t=out:st={args.jingle_seconds - args.transition_seconds}:d={args.transition_seconds}[intro];"
            "[1:a]aformat=channel_layouts=stereo,highpass=f=360,lowpass=f=3600,"
            "acompressor=threshold=-20dB:ratio=3:attack=8:release=100,"
            "aecho=0.38:0.50:22:0.12,volume=1.15[voice];"
            f"[2:a]aformat=channel_layouts=stereo,atrim=duration={args.jingle_seconds},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={args.transition_seconds}[outro];"
            "[intro][voice][outro]concat=n=3:v=0:a=1[audio]"
        )
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(args.jingle),
                "-i", str(raw_voice),
                "-i", str(args.jingle),
                "-filter_complex", filter_graph,
                "-map", "[audio]", "-c:a", "libmp3lame", "-b:a", "192k", str(args.output),
            ],
            check=True,
        )
    finally:
        raw_voice.unlink(missing_ok=True)

    print(f"Created: {args.output}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
