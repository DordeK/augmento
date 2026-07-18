# Augmento API

Minimal FastAPI backend for the Augmento mobile app.

## Local setup

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/docs` for the generated API documentation or
`http://localhost:8000/health` for the health check.

Place the promotion recording at `assets/promotion.mpeg`, then call:

```bash
curl -F "video=@/absolute/path/to/input.mp4" -o augmented.mp4 http://localhost:8000/augment
```

The response header `X-Augmento-Insertion-Seconds` reports where the promotion starts. Set
`AUGMENTO_PROMOTION_AUDIO_PATH` to override the asset path.

## Verify

```bash
ruff check .
pytest
```
