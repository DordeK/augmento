from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from starlette.background import BackgroundTask
from starlette.responses import FileResponse

from app.core.config import Settings, get_settings
from app.media.processor import MediaError, process_video

router = APIRouter(tags=["media"])


def _safe_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    is_safe = (
        suffix.isascii() and suffix.startswith(".") and suffix[1:].isalnum() and len(suffix) <= 10
    )
    return suffix if is_safe else ".upload"


async def _save_upload(upload: UploadFile, destination: Path, *, max_bytes: int) -> None:
    size = 0
    with destination.open("xb") as output:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Uploaded video exceeds the {max_bytes // (1024 * 1024)} MiB limit",
                )
            output.write(chunk)
    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Uploaded video is empty",
        )


@router.post(
    "/augment",
    response_class=FileResponse,
    responses={
        200: {
            "content": {"video/mp4": {}},
            "description": "Playable MP4 with the promotion mixed into its audio track.",
            "headers": {
                "X-Augmento-Insertion-Seconds": {
                    "description": "Promotion start time in seconds.",
                    "schema": {"type": "number"},
                }
            },
        },
        422: {"description": "Invalid or unsuitable media."},
        503: {"description": "Promotion asset or media tools are unavailable."},
    },
)
async def augment(
    video: Annotated[UploadFile, File(description="One video file to augment")],
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    promotion_path = settings.promotion_audio_path.expanduser().resolve()
    if not promotion_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Promotion audio is missing. Put a decodable recording at {promotion_path} "
                "or set AUGMENTO_PROMOTION_AUDIO_PATH to its path."
            ),
        )

    temporary_directory = TemporaryDirectory(prefix="augmento-")
    working_directory = Path(temporary_directory.name)
    input_path = working_directory / f"input{_safe_suffix(video.filename)}"
    output_path = working_directory / "augmented.mp4"
    try:
        await _save_upload(video, input_path, max_bytes=settings.max_upload_bytes)
        result = await run_in_threadpool(
            process_video,
            input_path,
            promotion_path,
            output_path,
            timeout=settings.media_timeout_seconds,
        )
    except HTTPException:
        temporary_directory.cleanup()
        raise
    except MediaError as exc:
        temporary_directory.cleanup()
        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "not installed or not on PATH" in str(exc)
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception:
        temporary_directory.cleanup()
        raise
    finally:
        await video.close()

    return FileResponse(
        result.output_path,
        media_type="video/mp4",
        filename="augmented.mp4",
        headers={"X-Augmento-Insertion-Seconds": f"{result.insertion.timestamp:.3f}"},
        background=BackgroundTask(temporary_directory.cleanup),
    )
