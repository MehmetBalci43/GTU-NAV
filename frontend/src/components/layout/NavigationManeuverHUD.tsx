import React, { useMemo, useState } from 'react';
import {
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  CheckCircle2,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Compass,
  Magnet,
  Radio,
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
  const [isManeuverBannerCollapsed, setIsManeuverBannerCollapsed] = useState<boolean>(false);

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
      {/* 1. TOP MANEUVER BANNER (Compact & Non-Destructive Collapse, Never Overlaps Top Bars) */}
      <div className="fixed top-3 md:top-4 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 flex justify-center pointer-events-none">
        {isManeuverBannerCollapsed ? (
          <button
            type="button"
            onClick={() => setIsManeuverBannerCollapsed(false)}
            className="pointer-events-auto px-3.5 py-2 rounded-full bg-emerald-400 dark:bg-emerald-500 text-zinc-950 border-2 border-zinc-950 shadow-hard-sm hover:brightness-95 active:scale-95 transition flex items-center gap-2 text-xs font-black"
            title="Adım Adım Dönüş Talimatını Göster"
          >
            {maneuver.type === 'arrive' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {maneuver.type === 'right' && <CornerUpRight className="w-4 h-4 shrink-0" />}
            {maneuver.type === 'left' && <CornerUpLeft className="w-4 h-4 shrink-0" />}
            {maneuver.type === 'straight' && <ArrowUp className="w-4 h-4 shrink-0" />}
            <span className="truncate max-w-[200px]">
              {maneuver.type === 'arrive'
                ? 'Hedefe Ulaşıldı'
                : `${maneuver.distanceToTurnM}m • ${maneuver.instruction}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" />
          </button>
        ) : (
          <div className="pointer-events-auto w-full max-w-[360px] bg-emerald-400 dark:bg-emerald-500 text-zinc-950 border-2 border-zinc-950 shadow-hard-md rounded-2xl px-3 py-2 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Turn Icon Box */}
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-emerald-400 border border-zinc-950 flex items-center justify-center shrink-0 shadow-sm">
              {maneuver.type === 'arrive' && <CheckCircle2 className="w-5 h-5" />}
              {maneuver.type === 'right' && <CornerUpRight className="w-5 h-5" />}
              {maneuver.type === 'left' && <CornerUpLeft className="w-5 h-5" />}
              {maneuver.type === 'straight' && <ArrowUp className="w-5 h-5" />}
            </div>

            {/* Maneuver Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-950/80 flex items-center gap-1">
                {maneuver.type === 'arrive' ? (
                  <span>Hedefe Ulaşıldı</span>
                ) : (
                  <span className="tabular-nums">
                    {maneuver.distanceToTurnM} metre sonra
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-black truncate leading-tight">
                {maneuver.type === 'arrive'
                  ? activeRoute.target_entrance_name
                  : maneuver.instruction}
              </div>
            </div>

            {/* Collapse Maneuver Banner (Does NOT cancel the route!) */}
            <button
              type="button"
              onClick={() => setIsManeuverBannerCollapsed(true)}
              className="w-7 h-7 rounded-lg bg-zinc-950/15 hover:bg-zinc-950/25 text-zinc-950 font-black flex items-center justify-center transition shrink-0"
              title="Dönüş bildirimini küçült (Rotayı kapatmaz)"
              aria-label="Dönüş bildirimini küçült"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. BOTTOM ACTIVE NAVIGATION & SENSOR ISLAND (Bottom-Left on Desktop so it never overlaps Bottom-Right Map Dock) */}
      <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-30 pointer-events-auto w-[92vw] sm:w-auto max-w-md">
        <TactileCard className="p-3 sm:px-3.5 sm:py-2.5 flex flex-col gap-2.5 bg-white dark:bg-[#1E222D]">
          {/* Destination & Remaining Summary */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm text-zinc-950 dark:text-zinc-100 truncate">
                  {activeRoute.target_entrance_name}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-sky-400 text-zinc-950 font-black text-[11px] tabular-nums border border-zinc-950 shrink-0">
                  {userPos.remainingMeters} m (~{userPos.remainingMinutes} dk)
                </span>
              </div>

              <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
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

            {/* Real-time GPS vs Simulator Status Badge */}
            {isLiveGpsActive ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-[10px] border border-emerald-500/40 flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Canlı GPS</span>
              </span>
            ) : isSimulatingWalk ? (
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-black text-[10px] border border-amber-500/40 flex items-center gap-1 shrink-0">
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Yürüyor</span>
              </span>
            ) : null}
          </div>

          {/* Action Controls: Simulator, End Route */}
          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-zinc-200/80 dark:border-white/10">
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
