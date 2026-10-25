import React from 'react';
import { getNextMarmarayDepartures } from '../../services/marmarayService';
import { haversineDistanceM } from '../../services/snapToPath';
import { MARMARAY_SCHEDULE_CONFIG } from '../../config/marmaraySchedule';
import { SurfaceCard, StatusBadge } from '../ui/Primitives';

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
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <SurfaceCard className="w-full max-w-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <StatusBadge variant="emerald">🚆 Sıfır Dış API • Yerel İstasyon Hesaplayıcı</StatusBadge>
            <h2 className="text-base font-extrabold text-white mt-1.5">
              {MARMARAY_SCHEDULE_CONFIG.stationName}
            </h2>
            <p className="text-xs text-slate-400">
              Konumunuzdan istasyona tahmini yürüyüş mesafesi:{' '}
              <strong className="text-white">{summary.walkingDistanceM} m (~{summary.walkingMinutes} dk)</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Direction 1: Istanbul / Halkalı */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="text-xs font-extrabold text-sky-300">
              ⬅️ İstanbul (Pendik / Söğütlüçeşme / Halkalı) Yönü
            </div>
            <div className="space-y-1.5">
              {summary.toHalkali.map((dep) => (
                <div
                  key={dep.timeStr}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900 border border-slate-800"
                >
                  <span className="font-bold text-white">{dep.timeStr}</span>
                  <span
                    className={`font-semibold ${
                      dep.canCatchByWalking ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {dep.minutesLeft} dk kaldı{' '}
                    {dep.canCatchByWalking ? '✅ Yetişir' : '⚡ Koşmalısın'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Direction 2: Gebze */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="text-xs font-extrabold text-amber-300">
              ➡️ Gebze Merkez Yönü
            </div>
            <div className="space-y-1.5">
              {summary.toGebze.map((dep) => (
                <div
                  key={dep.timeStr}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900 border border-slate-800"
                >
                  <span className="font-bold text-white">{dep.timeStr}</span>
                  <span
                    className={`font-semibold ${
                      dep.canCatchByWalking ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {dep.minutesLeft} dk kaldı{' '}
                    {dep.canCatchByWalking ? '✅ Yetişir' : '⚡ Koşmalısın'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onRouteToStation();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition"
          >
            🧭 Marmaray Üst Geçit Çıkışına Rota Çiz
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
};
