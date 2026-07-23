import type {
  ActualStrategy,
  CautionPeriod,
  GridInfoResponse,
  PredictRequest,
  PredictionResponse,
  QualifyingResponse,
  RaceDetail,
  RaceSummary,
  SeasonRace,
  SimulationRequest,
  SimulationResult,
  TracksResponse,
  UndercutRequest,
  UndercutResult,
  Weather,
} from '../types';

const BASE = '/api';
const ML = '/ml';

async function requestTo<T>(root: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${root}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    // FastAPI validation errors come back under `detail`, Spring under `message`.
    throw new Error(body.message ?? body.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestTo<T>(BASE, path, init);
}

export const api = {
  listRaces: () => request<RaceSummary[]>('/races'),

  getRace: (raceId: number) => request<RaceDetail>(`/races/${raceId}`),

  getActualStrategy: (raceId: number, driverId: number) =>
    request<ActualStrategy>(`/races/${raceId}/drivers/${driverId}/actual-strategy`),

  getCautionPeriods: (raceId: number) => request<CautionPeriod[]>(`/races/${raceId}/caution-periods`),

  simulate: (body: SimulationRequest) =>
    request<SimulationResult>('/simulate', { method: 'POST', body: JSON.stringify(body) }),

  evaluateUndercut: (body: UndercutRequest) =>
    request<UndercutResult>('/simulate/undercut', { method: 'POST', body: JSON.stringify(body) }),

  getSeasonCalendar: (season: number) => request<SeasonRace[]>(`/ingest/${season}/calendar`),

  ingestRace: (season: number, round: number) =>
    request<RaceSummary>(`/ingest/${season}/${round}`, { method: 'POST' }),

  // --- 2026 race-winner ML predictor (Python FastAPI service, proxied at /ml) ---

  getGridInfo: () => requestTo<GridInfoResponse>(ML, '/grid'),

  getTracks: () => requestTo<TracksResponse>(ML, '/tracks'),

  generateQualifying: (weather: Weather, trackRound?: number, seed?: number) =>
    requestTo<QualifyingResponse>(ML, '/qualifying', {
      method: 'POST',
      body: JSON.stringify({ weather, trackRound, seed }),
    }),

  predictRaceWinner: (body: PredictRequest) =>
    requestTo<PredictionResponse>(ML, '/predict', { method: 'POST', body: JSON.stringify(body) }),
};
