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
