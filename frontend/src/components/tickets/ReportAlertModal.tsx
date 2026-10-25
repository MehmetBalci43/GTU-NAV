import React, { useState, useEffect } from 'react';
import { ALERT_TYPES } from '../../config/alertTypes';
import { SurfaceCard } from '../ui/Primitives';

interface ReportAlertModalProps {
  isOpen: boolean;
  defaultLat: number;
  defaultLon: number;
  pickedEdgeId?: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onStartPickOnMap: () => void;
  onSubmitAlert: (payload: {
    alert_type: string;
    title?: string;
    edge_id?: string | null;
    blocks_route?: boolean;
    lat: number;
    lon: number;
    is_admin_verified?: boolean;
  }) => Promise<void>;
}

export const ReportAlertModal: React.FC<ReportAlertModalProps> = ({
  isOpen,
  defaultLat,
  defaultLon,
  pickedEdgeId,
  isAdmin,
  onClose,
  onStartPickOnMap,
  onSubmitAlert,
}) => {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(ALERT_TYPES[0].id);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [lat, setLat] = useState<number>(defaultLat);
  const [lon, setLon] = useState<number>(defaultLon);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setLat(defaultLat);
    setLon(defaultLon);
  }, [defaultLat, defaultLon]);

  if (!isOpen) return null;

  const selectedConfig = ALERT_TYPES.find((a) => a.id === selectedTypeId) || ALERT_TYPES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitAlert({
        alert_type: selectedConfig.id,
        title: customTitle.trim() || selectedConfig.title,
        edge_id: pickedEdgeId || null,
        blocks_route: selectedConfig.blocksRoute,
        lat,
        lon,
        is_admin_verified: isAdmin,
      });
      setCustomTitle('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <SurfaceCard className="w-full max-w-lg p-5 space-y-4">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Katman 1 • Harita Saha Uyarısı
            </span>
            <h2 className="text-base font-extrabold text-white mt-0.5">
              ⚠️ Kampüs Haritasına Anlık Uyarı Bırak
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALERT_TYPES.map((t) => {
              const active = t.id === selectedTypeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTypeId(t.id)}
                  className={`text-left p-3 rounded-xl border transition ${
                    active
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">{t.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{t.subtitle}</div>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Kısa Açıklama (Opsiyonel)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={selectedConfig.title}
              maxLength={120}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-amber-400"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-200">
                📍 Konum: {lat.toFixed(5)}, {lon.toFixed(5)}
              </div>
              {pickedEdgeId && (
                <div className="text-[11px] text-amber-300">
                  Seçili Yürüyüş Yolu Kenarı: <strong>{pickedEdgeId}</strong>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onStartPickOnMap}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold border border-slate-700"
            >
              🗺️ Haritadan Nokta Seç
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold transition"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Haritaya Uyarı Ekle'}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};
