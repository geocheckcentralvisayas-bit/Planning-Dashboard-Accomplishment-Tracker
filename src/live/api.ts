import type { LivePayload } from './types';

export async function loadLivePayload(signal?: AbortSignal): Promise<LivePayload> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}live-data.json?ts=${Date.now()}`,
    { cache: 'no-store', signal },
  );

  if (!response.ok) {
    throw new Error(
      `Live snapshot could not be loaded (HTTP ${response.status}). Run "npm run sync:live" and try again.`,
    );
  }

  return (await response.json()) as LivePayload;
}
