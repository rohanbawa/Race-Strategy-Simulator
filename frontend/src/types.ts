export type TireCompound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';

export const COMPOUND_LABEL: Record<TireCompound, string> = {
  SOFT: 'Soft',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  INTERMEDIATE: 'Inter',
  WET: 'Wet',
};

export const COMPOUND_COLOR_VAR: Record<TireCompound, string> = {
  SOFT: '--tire-soft',
  MEDIUM: '--tire-medium',
  HARD: '--tire-hard',
  INTERMEDIATE: '--tire-inter',
  WET: '--tire-wet',
};

export interface SeasonRace {
  season: number;
  round: number;
  name: string;
  circuitName: string;
  country: string;
  raceDate: string | null;
  ingested: boolean;
  raceId: number | null;
}

export interface RaceSummary {
  id: number;
  season: number;
  round: number;
  name: string;
  circuitName: string;
  country: string;
  raceDate: string;
  totalLaps: number | null;
}

export interface DriverSummary {
  id: number;
  code: string;
  fullName: string;
  constructorName: string;
}

export interface RaceDetail {
  race: RaceSummary;
  drivers: DriverSummary[];
}

export interface StintInfo {
  stintNumber: number;
  compound: TireCompound;
  startLap: number;
  endLap: number;
  avgLapTimeSeconds: number | null;
}

export interface PitStopInfo {
  stopNumber: number;
  lap: number;
  stationaryTimeSeconds: number;
  totalTimeLossSeconds: number | null;
}

export interface ActualStrategy {
  raceId: number;
  driverId: number;
  driverCode: string;
  stints: StintInfo[];
  pitStops: PitStopInfo[];
  totalRaceTimeSeconds: number;
  finishPosition: number | null;
}

export interface PlannedStint {
  compound: TireCompound;
  lengthLaps: number;
}

export interface SimulationRequest {
  raceId: number;
  driverId: number;
  plannedStints: PlannedStint[];
  assumedStationaryTimeSeconds?: number | null;
}

export interface LapSim {
  lap: number;
  simulatedLapTimeSeconds: number;
  actualLapTimeSeconds: number | null;
  cumulativeDeltaSeconds: number;
  isPitLap: boolean;
  cautionType: 'SC' | 'VSC' | null;
}

export interface CautionPeriod {
  startLap: number;
  endLap: number;
  type: 'SC' | 'VSC';
  fieldPaceSecondsPerLap: number;
  baselinePaceSecondsPerLap: number;
  driversAffected: number;
}

export interface SimulationResult {
  raceId: number;
  driverId: number;
  driverCode: string;
  plannedStints: StintInfo[];
  laps: LapSim[];
  simulatedTotalTimeSeconds: number;
  actualTotalTimeSeconds: number | null;
  deltaSeconds: number | null;
  pitStopCount: number;
  actualDataComplete: boolean;
  projectedFinishPosition: number | null;
  actualFinishPosition: number | null;
}

export interface UndercutRequest {
  raceId: number;
  attackingDriverId: number;
  defendingDriverId: number;
  attackingPitLap: number;
  attackingCompound: TireCompound;
}

export interface UndercutResult {
  raceId: number;
  attackingDriverCode: string;
  defendingDriverCode: string;
  attackingPitLap: number;
  defendingActualPitLap: number;
  gapAtAttackingPitLapSeconds: number;
  gapAfterSequenceSeconds: number;
  undercutSucceeds: boolean;
  marginSeconds: number;
}

// --- 2026 race-winner ML prediction ---

export type Weather = 'DRY' | 'MIXED' | 'WET';

export interface GridEntry {
  id: number;
  code: string;
  name: string;
  team: string;
  teamColor: string;
  powerUnit: string;
  gridPosition: number;
  carRating: number;
  driverRating: number;
  wetSkill: number;
}

export interface QualifyingResponse {
  weather: Weather;
  grid: GridEntry[];
}

export interface DriverPrediction {
  id: number;
  code: string;
  name: string;
  team: string;
  teamColor: string;
  gridPosition: number;
  winProbability: number;
  podiumProbability: number;
  pointsProbability: number;
  meanFinish: number;
  carRating: number;
  driverRating: number;
}

export interface ScenarioEcho {
  safetyCarProbability: number;
  weather: Weather;
  wetness: number;
  tyreOffsetSeconds: number;
  monteCarloSims: number;
}

export interface ModelSummary {
  type: string;
  version: string;
  trainedAt: string;
  nTrainRaces: number;
  top1Accuracy: number;
  logLoss: number;
}

export interface PredictionResponse {
  scenario: ScenarioEcho;
  predictions: DriverPrediction[];
  model: ModelSummary;
  regulationNotes: string[];
}

export interface PredictRequest {
  safetyCarProbability: number;
  weather: Weather;
  tyreOffsetSeconds: number;
  grid?: { driverId: number; position: number }[];
  qualifyingSeed?: number;
  monteCarloSims?: number;
}

export interface GridInfoResponse {
  season: number;
  regulationNotes: string[];
  overtakingEase: number;
  tyreSensitivity: number;
  drivers: (GridEntry & { puAdaptation: number })[];
  model: {
    version: string;
    model_type: string;
    trained_at: string;
    n_train_races: number;
    n_train_rows: number;
    metrics: { top1_accuracy: number; log_loss: number; mean_prob_on_actual_winner: number };
    feature_importances: Record<string, number>;
    features: string[];
  };
}
