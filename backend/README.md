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

## Verify

```bash
ruff check .
pytest
```
