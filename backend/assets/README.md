# Promotion recording

Place the fixed promotion recording here with the exact filename `promotion.mpeg`.

The file must contain an audio stream that FFmpeg can decode. A clean, dry, mono or stereo
recording is preferred. The ideal hackathon clip is 3–5 seconds long, but the backend measures
the actual duration. Set `AUGMENTO_PROMOTION_AUDIO_PATH` to use a different format, filename,
or location.

Do not add music, radio processing, fades, or silence padding to the recording. The backend adds
those effects while rendering.
