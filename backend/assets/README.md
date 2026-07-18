# Promotion recording

Place the fixed promotion recording here with the exact filename `promotion.wav`.

A clean, dry, mono or stereo WAV recording is preferred (48 kHz PCM is a good default). The
ideal hackathon clip is 3–5 seconds long, but the backend measures the actual duration. Other
formats are supported when the installed FFmpeg can decode them; set
`AUGMENTO_PROMOTION_AUDIO_PATH` to use a different filename or location.

Do not add music, radio processing, fades, or silence padding to the recording. The backend adds
those effects while rendering.
