import React, { useMemo } from 'react';
import {
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  CheckCircle2,
  Navigation,
  Play,
  Pause,
  X,
  Compass,
  Magnet,
  Radio,
  LocateFixed,
} from 'lucide-react';
import { RouteResponse } from '../../types/campus';
import { UserPositionState } from '../../hooks/useNavigation';
import { TactileButton, TactileCard } from '../ui/Primitives';

interface NavigationManeuverHUDProps {
  activeRoute: RouteResponse;
  userPos: UserPositionState;
  isSimulatingWalk: boolean;
  onToggleSimulateWalk: () => void;
  isLiveGpsActive?: boolean;
  onToggleLiveGps?: () => void;
  onClearRoute: () => void;
}

/**
 * Calculates turn direction and distance to the next significant angle change
 * along the route's polyline from the current snapped user position.
 */
function computeNextManeuver(
  coords: [number, number][],
  userLat: number,
  userLon: number,
  remainingMeters: number
): {
  type: 'straight' | 'right' | 'left' | 'arrive';
  distanceToTurnM: number;
  instruction: string;
} {
  if (remainingMeters <= 15 || coords.length < 2) {
    return {
      type: 'arrive',
      distanceToTurnM: 0,
      instruction: 'Hedef Giriş Kapısına Vardınız',
    };
  }

  // Find nearest segment index along the route coordinates
  let nearestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const midLat = (lat1 + lat2) / 2;
    const midLon = (lon1 + lon2) / 2;
    const d = Math.hypot(userLat - midLat, userLon - midLon);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  // Look ahead for the first angle deflection > 30 degrees
  for (let i = nearestIdx; i < coords.length - 2; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const [x3, y3] = coords[i + 2];

    const bearing1 = Math.atan2(x2 - x1, y2 - y1) * (180 / Math.PI);
    const bearing2 = Math.atan2(x3 - x2, y3 - y2) * (180 / Math.PI);
    let diff = bearing2 - bearing1;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    if (Math.abs(diff) >= 32) {
      // Calculate approximate meter distance to this corner
      const turnLat = coords[i + 1][1];
      const turnLon = coords[i + 1][0];
      const distM = Math.round(
        Math.hypot((userLat - turnLat) * 111000, (userLon - turnLon) * 85000)
      );

      return {
        type: diff > 0 ? 'right' : 'left',
        distanceToTurnM: Math.max(10, Math.min(distM, remainingMeters)),
        instruction: diff > 0 ? 'Kavşaktan sağa dönün' : 'Kavşaktan sola dönün',
      };
    }
  }

  return {
    type: 'straight',
    distanceToTurnM: remainingMeters,
    instruction: 'Yürüyüş yolundan düz ilerleyin',
  };
}

export const NavigationManeuverHUD: React.FC<NavigationManeuverHUDProps> = ({
  activeRoute,
  userPos,
  isSimulatingWalk,
  onToggleSimulateWalk,
  isLiveGpsActive = false,
  onToggleLiveGps,
  onClearRoute,
}) => {
  const maneuver = useMemo(() => {
    return computeNextManeuver(
      activeRoute.coordinates,
      userPos.snappedLat,
      userPos.snappedLon,
      userPos.remainingMeters
    );
  }, [
    activeRoute.coordinates,
    userPos.snappedLat,
    userPos.snappedLon,
    userPos.remainingMeters,
  ]);

  return (
    <>
      {/* 1. TOP MANEUVER BANNER (Visible on both Mobile & Desktop) */}
      <div className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 sm:w-[460px] pointer-events-auto">
        <div className="bg-emerald-400 dark:bg-emerald-500 text-zinc-950 border-2 border-zinc-950 shadow-hard-lg rounded-2xl p-3 flex items-center gap-3">
          {/* Turn Icon Box */}
          <div className="w-11 h-11 rounded-xl bg-zinc-950 text-emerald-400 border border-zinc-950 flex items-center justify-center shrink-0 shadow-sm">
            {maneuver.type === 'arrive' && <CheckCircle2 className="w-6 h-6" />}
            {maneuver.type === 'right' && <CornerUpRight className="w-6 h-6" />}
            {maneuver.type === 'left' && <CornerUpLeft className="w-6 h-6" />}
            {maneuver.type === 'straight' && <ArrowUp className="w-6 h-6" />}
          </div>

          {/* Maneuver Text */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              {maneuver.type === 'arrive' ? (
                <span>Hedefe Ulaşıldı</span>
              ) : (
                <span className="tabular-nums">
                  {maneuver.distanceToTurnM} metre sonra
                </span>
              )}
            </div>
            <div className="text-sm sm:text-base font-black truncate leading-tight mt-0.5">
              {maneuver.type === 'arrive'
                ? activeRoute.target_entrance_name
                : maneuver.instruction}
            </div>
          </div>

          {/* Quick Exit Navigation */}
          <button
            type="button"
            onClick={onClearRoute}
            className="w-8 h-8 rounded-xl bg-zinc-950/20 hover:bg-zinc-950/30 text-zinc-950 font-black flex items-center justify-center transition shrink-0"
            title="Navigasyonu Bitir"
            aria-label="Navigasyonu Bitir"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. BOTTOM ACTIVE NAVIGATION & SENSOR ISLAND */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[92vw] sm:w-auto max-w-xl">
        <TactileCard className="p-3 sm:px-4 sm:py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 bg-white dark:bg-[#1E222D]">
          {/* Destination & Remaining Summary */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs sm:text-sm text-zinc-950 dark:text-zinc-100 truncate">
                {activeRoute.target_entrance_name}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-sky-400 text-zinc-950 font-black text-xs tabular-nums border border-zinc-950 shrink-0">
                {userPos.remainingMeters} m (~{userPos.remainingMinutes} dk)
              </span>

              {/* Real-time GPS vs Simulator Status Badge */}
              {isLiveGpsActive ? (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-[10px] border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Canlı GPS Devrede</span>
                </span>
              ) : isSimulatingWalk ? (
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-black text-[10px] border border-amber-500/40 flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Simülatör Yürüyor</span>
                </span>
              ) : null}
            </div>

              <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {userPos.isSnapped ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Magnet className="w-3.5 h-3.5 shrink-0" />
                  <span>Snap-to-Path Yola Kilitli ({userPos.offRouteDistanceMeters}m sapma düzeltildi)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>{isLiveGpsActive ? 'Canlı GPS sinyali alınıyor...' : 'Serbest Konum • Simülatörle test edin'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Controls: Simulator, End Route (Live GPS only shown if already activated from menu) */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {isLiveGpsActive && onToggleLiveGps && (
              <TactileButton
                size="sm"
                variant="primary"
                icon={<Radio className="w-3.5 h-3.5 animate-pulse" />}
                onClick={onToggleLiveGps}
                title="Canlı GPS Takibini Durdur"
              >
                GPS Kapat
              </TactileButton>
            )}

            <TactileButton
              size="sm"
              variant={isSimulatingWalk ? 'warning' : 'primary'}
              icon={
                isSimulatingWalk ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )
              }
              onClick={onToggleSimulateWalk}
              title="Masaüstü Yürüyüş Simülatörünü Aç/Kapat"
            >
              {isSimulatingWalk ? 'Duraklat' : 'Simüle Et'}
            </TactileButton>

            <TactileButton
              size="sm"
              variant="secondary"
              onClick={onClearRoute}
            >
              Rotayı Bitir
            </TactileButton>
          </div>
        </TactileCard>
      </div>
    </>
  );
};
