import { MARMARAY_SCHEDULE_CONFIG } from '../config/marmaraySchedule';

export interface MarmarayDepartureInfo {
  timeStr: string;
  minutesLeft: number;
  canCatchByWalking: boolean;
}

export interface MarmaraySummary {
  walkingMinutes: number;
  walkingDistanceM: number;
  toHalkali: MarmarayDepartureInfo[];
  toGebze: MarmarayDepartureInfo[];
  nextCatchableHalkali?: MarmarayDepartureInfo;
  nextCatchableGebze?: MarmarayDepartureInfo;
}

function computeUpcomingForDirection(
  now: Date,
  minutesPattern: number[],
  walkingMinutes: number
): MarmarayDepartureInfo[] {
  const results: MarmarayDepartureInfo[] = [];
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();

  for (let offsetHour = 0; offsetHour <= 2; offsetHour++) {
    const h = (now.getHours() + offsetHour) % 24;
    for (const m of minutesPattern) {
      const candidateTotal = (now.getHours() + offsetHour) * 60 + m;
      const diff = candidateTotal - currentTotalMin;
      if (diff >= 1 && results.length < 3) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        results.push({
          timeStr: `${hh}:${mm}`,
          minutesLeft: diff,
          canCatchByWalking: diff >= walkingMinutes,
        });
      }
    }
  }

  return results;
}

export function getNextMarmarayDepartures(
  now: Date,
  walkingDistanceM: number
): MarmaraySummary {
  const walkingMinutes = Math.max(1, Math.ceil(walkingDistanceM / 80));
  const toHalkali = computeUpcomingForDirection(
    now,
    MARMARAY_SCHEDULE_CONFIG.halkaliMinutesPastHour,
    walkingMinutes
  );
  const toGebze = computeUpcomingForDirection(
    now,
    MARMARAY_SCHEDULE_CONFIG.gebzeMinutesPastHour,
    walkingMinutes
  );

  return {
    walkingMinutes,
    walkingDistanceM: Math.round(walkingDistanceM),
    toHalkali,
    toGebze,
    nextCatchableHalkali: toHalkali.find((t) => t.canCatchByWalking) || toHalkali[0],
    nextCatchableGebze: toGebze.find((t) => t.canCatchByWalking) || toGebze[0],
  };
}
