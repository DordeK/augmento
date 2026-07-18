import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type AugmentResult = {
  insertionSeconds: number;
  uri: string;
};

function apiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredUrl) return configuredUrl;

  const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${developmentHost ?? '127.0.0.1'}:8000`;
}

export const AUGMENTO_API_URL = apiBaseUrl();

export async function augmentVideo(
  uri: string,
  filename: string | null | undefined
): Promise<AugmentResult> {
  const form = new FormData();
  let response: Response;
  try {
    if (Platform.OS === 'web') {
      const selectedVideo = await globalThis.fetch(uri);
      form.append('video', await selectedVideo.blob(), filename ?? 'video.mp4');
      response = await globalThis.fetch(`${AUGMENTO_API_URL}/augment`, {
        method: 'POST',
        body: form,
      });
    } else {
      const source = new File(uri);
      if (!source.exists) {
        throw new Error('The selected video is no longer available. Please choose it again.');
      }
      form.append('video', source, filename ?? source.name ?? 'video.mp4');
      response = await fetch(`${AUGMENTO_API_URL}/augment`, {
        method: 'POST',
        body: form,
      });
    }
  } catch {
    throw new Error(
      `Could not reach ${AUGMENTO_API_URL}. Keep the backend running on 0.0.0.0:8000 ` +
        'and make sure this device is on the same network.'
    );
  }

  if (!response.ok) {
    let detail = `The backend returned HTTP ${response.status}.`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the status-based fallback when the response is not JSON.
    }
    throw new Error(detail);
  }

  const insertionHeader = response.headers.get('x-augmento-insertion-seconds');
  const insertionSeconds = insertionHeader === null ? Number.NaN : Number(insertionHeader);
  if (!Number.isFinite(insertionSeconds)) {
    throw new Error('The backend response did not include a valid insertion timestamp.');
  }

  if (Platform.OS === 'web') {
    return {
      insertionSeconds,
      uri: URL.createObjectURL(await response.blob()),
    };
  }

  const output = new File(Paths.cache, `augmento-${Date.now()}.mp4`);
  output.create({ overwrite: true });
  output.write(await response.bytes());

  return { insertionSeconds, uri: output.uri };
}
