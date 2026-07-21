import type {
  ActualStrategy,
  RaceDetail,
  RaceSummary,
  SeasonRace,
  SimulationRequest,
  SimulationResult,
  UndercutRequest,
  UndercutResult,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listRaces: () => request<RaceSummary[]>('/races'),

  getRace: (raceId: number) => request<RaceDetail>(`/races/${raceId}`),

  getActualStrategy: (raceId: number, driverId: number) =>
    request<ActualStrategy>(`/races/${raceId}/drivers/${driverId}/actual-strategy`),

  simulate: (body: SimulationRequest) =>
    request<SimulationResult>('/simulate', { method: 'POST', body: JSON.stringify(body) }),

  evaluateUndercut: (body: UndercutRequest) =>
    request<UndercutResult>('/simulate/undercut', { method: 'POST', body: JSON.stringify(body) }),

  getSeasonCalendar: (season: number) => request<SeasonRace[]>(`/ingest/${season}/calendar`),

  ingestRace: (season: number, round: number) =>
    request<RaceSummary>(`/ingest/${season}/${round}`, { method: 'POST' }),
};
