import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Map, X, Check } from 'lucide-react';
import { ALERT_TYPES } from '../../config/alertTypes';
import {
  TactileCard,
  TactileButton,
  TactileIconButton,
  StatusBadge,
} from '../ui/Primitives';

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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <TactileCard className="w-full max-w-lg p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-3">
          <div>
            <StatusBadge
              variant="amber"
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              Anlık Saha Uyarısı
            </StatusBadge>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
              Kampüs Haritasına Uyarı Bırak
            </h2>
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

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Type selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALERT_TYPES.map((t) => {
              const active = t.id === selectedTypeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTypeId(t.id)}
                  className={`text-left p-3 rounded-xl border-2 border-zinc-950 transition ${
                    active
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-zinc-950 dark:text-zinc-100 shadow-hard-sm ring-2 ring-amber-400'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-none'
                  }`}
                >
                  <div className="font-black flex items-center justify-between">
                    <span>{t.title}</span>
                    {active && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                    {t.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
              Kısa Açıklama (Opsiyonel)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={selectedConfig.title}
              maxLength={120}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-400 font-semibold"
            />
          </div>

          {/* Location picker */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 flex flex-wrap items-center justify-between gap-2 shadow-hard-sm">
            <div>
              <div className="font-extrabold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="tabular-nums">
                  Konum: {lat.toFixed(5)}, {lon.toFixed(5)}
                </span>
              </div>
              {pickedEdgeId && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  Seçili Yol Kenarı: {pickedEdgeId}
                </div>
              )}
            </div>
            <TactileButton
              type="button"
              variant="secondary"
              size="sm"
              icon={<Map className="w-3.5 h-3.5 text-sky-500" />}
              onClick={onStartPickOnMap}
            >
              Haritada İşaretle
            </TactileButton>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-zinc-950">
            <TactileButton
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              İptal
            </TactileButton>
            <TactileButton
              type="submit"
              variant="warning"
              loading={isSubmitting}
              icon={<AlertTriangle className="w-4 h-4" />}
            >
              Haritaya Uyarı Ekle
            </TactileButton>
          </div>
        </form>
      </TactileCard>
    </div>
  );
};
