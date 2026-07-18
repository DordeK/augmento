# Augmento

Augmento is a mobile-first creator sponsorship prototype built for a hackathon. It explores
context-aware sponsor placements for existing audio and video content.

## Demo

<video controls width="360" src="ScreenRecording_07-18-2026%2016-24-47_1.MP4">
  Your browser does not support embedded video.
</video>

## Repository structure

```text
src/        Expo and React Native application
backend/    FastAPI backend
assets/     App icons, splash screen, and web assets
```

## Mobile app

Requirements:

- Node.js 24
- Expo Go with SDK 54 support

Install and start:

```bash
npm install
npm start
```

Scan the QR code with Expo Go. To clear the Metro cache, run:

```bash
npm start -- --clear
```

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
```

## Backend

Requirements:

- Python 3.12
- FFmpeg

Install and start:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API documentation is available at `http://localhost:8000/docs`, and the health check is
available at `http://localhost:8000/health`.

FFmpeg and FFprobe perform media analysis and audio/video mixing. On macOS, install them with:

```bash
brew install ffmpeg
```

The backend Docker image installs FFmpeg automatically.

Put the fixed promotion recording at `backend/assets/promotion.mpeg` (see the README in that
directory), then send one multipart video:

```bash
curl --fail-with-body \
  -F "video=@/absolute/path/to/input.mp4" \
  -D headers.txt \
  --output augmented.mp4 \
  http://localhost:8000/augment
```

The response is an MP4 with AAC audio. Its `X-Augmento-Insertion-Seconds` header contains the
chosen promotion start time. Override the fixed asset with `AUGMENTO_PROMOTION_AUDIO_PATH`.

The mobile app calls this endpoint when **Create augmented video** is pressed. During local Expo
development it derives the computer's LAN address from the Expo development host. If that address
is not suitable for your simulator or device, start Expo with an explicit backend URL:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8000 npm start
```

After completing the frontend and backend setup once, start both development servers together:

```bash
npm run dev
```

Pass any Expo options after `--`, for example `npm run dev -- --tunnel`. Press Ctrl+C to stop both
servers.

Run Uvicorn with `--host 0.0.0.0`, and keep the phone and computer on the same network. The result
screen plays the returned MP4 and can share it or save it to the device photo library.

Backend checks:

```bash
cd backend
.venv/bin/ruff check .
.venv/bin/pytest
```

## Current scope and limitations

Promotion placement is a hackathon quietness heuristic: it prefers FFmpeg-detected silence and
otherwise compares rolling loudness windows. It cannot reliably distinguish speech from music,
and short videos without room for the promotion plus edge/buffer margins are rejected. Processing
is synchronous and intended for short uploads; it has no authentication, persistence, database,
queue, transcription, VAD, or real product matching.

Advertiser matching and phrase generation are intentionally mocked for the MVP. The demo path
selects Coca-Cola and the matching football phrase before the backend injects the fixed recording
from `promotion.mpeg`.
