# Augmento

Augmento is a mobile-first creator sponsorship prototype built for a hackathon. It explores
context-aware sponsor placements for existing audio and video content.

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

Backend checks:

```bash
cd backend
.venv/bin/ruff check .
.venv/bin/pytest
```

## Current scope

The repository contains the frontend and backend foundations. Media ingestion and processing,
database integration, authentication, and deployment configuration will be added only when the
product workflow requires them.
