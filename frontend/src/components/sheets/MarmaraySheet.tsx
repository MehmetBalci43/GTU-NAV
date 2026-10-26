import React from 'react';
import {
  Train,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Zap,
  Navigation,
  X,
  Clock,
} from 'lucide-react';
import { getNextMarmarayDepartures } from '../../services/marmarayService';
import { haversineDistanceM } from '../../services/snapToPath';
import { MARMARAY_SCHEDULE_CONFIG } from '../../config/marmaraySchedule';
import {
  TactileCard,
  TactileButton,
  StatusBadge,
  TactileIconButton,
} from '../ui/Primitives';

interface MarmaraySheetProps {
  isOpen: boolean;
  userLat: number;
  userLon: number;
  onClose: () => void;
  onRouteToStation: () => void;
}

export const MarmaraySheet: React.FC<MarmaraySheetProps> = ({
  isOpen,
  userLat,
  userLon,
  onClose,
  onRouteToStation,
}) => {
  if (!isOpen) return null;

  const directDist = haversineDistanceM(
    userLat,
    userLon,
    MARMARAY_SCHEDULE_CONFIG.stationCoords.lat,
    MARMARAY_SCHEDULE_CONFIG.stationCoords.lon
  );
  // Multiply straight-line by 1.25 walkway factor for realistic campus footpath distance
  const walkingDistM = Math.round(directDist * 1.25);
  const summary = getNextMarmarayDepartures(new Date(), walkingDistM);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <TactileCard className="w-full max-w-lg p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-zinc-950 pb-3">
          <div>
            <StatusBadge
              variant="mint"
              icon={<Train className="w-3.5 h-3.5" />}
            >
              Yerel İstasyon Sefer Cetveli
            </StatusBadge>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
              {MARMARAY_SCHEDULE_CONFIG.stationName}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Tahmini Yürüyüş:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">
                {summary.walkingDistanceM} m (~{summary.walkingMinutes} dk)
              </strong>
            </p>
          </div>
          <TactileIconButton
            size="sm"
            variant="ghost"
            label="Kapat"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </TactileIconButton>
        </div>

        {/* Timetable Grids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Direction 1: Istanbul / Halkalı */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border-2 border-zinc-950 shadow-hard-sm space-y-2">
            <div className="text-xs font-black text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4 text-sky-500 shrink-0" />
              <span>İstanbul (Halkalı) Yönü</span>
            </div>
            <div className="space-y-1.5">
              {summary.toHalkali.map((dep) => (
                <div
                  key={dep.timeStr}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-950 shadow-sm"
                >
                  <span className="font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                    {dep.timeStr}
                  </span>
                  <span
                    className={`font-extrabold flex items-center gap-1 text-[11px] tabular-nums ${
                      dep.canCatchByWalking
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dep.canCatchByWalking ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{dep.minutesLeft} dk kaldı</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Direction 2: Gebze */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border-2 border-zinc-950 shadow-hard-sm space-y-2">
            <div className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Gebze Merkez Yönü</span>
            </div>
            <div className="space-y-1.5">
              {summary.toGebze.map((dep) => (
                <div
                  key={dep.timeStr}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-950 shadow-sm"
                >
                  <span className="font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                    {dep.timeStr}
                  </span>
                  <span
                    className={`font-extrabold flex items-center gap-1 text-[11px] tabular-nums ${
                      dep.canCatchByWalking
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dep.canCatchByWalking ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{dep.minutesLeft} dk kaldı</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2 border-t-2 border-zinc-950">
          <TactileButton
            variant="primary"
            icon={<Navigation className="w-4 h-4" />}
            onClick={() => {
              onRouteToStation();
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            Marmaray İstasyonuna Yaya Rotası Çiz
          </TactileButton>
        </div>
      </TactileCard>
    </div>
  );
};
