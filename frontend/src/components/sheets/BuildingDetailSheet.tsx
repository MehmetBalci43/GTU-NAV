import React, { useState } from 'react';
import {
  Building,
  BuildingRoomsResponse,
  RouteResponse,
} from '../../types/campus';
import { SurfaceCard, StatusBadge } from '../ui/Primitives';

interface BuildingDetailSheetProps {
  building: Building | null;
  roomsData: BuildingRoomsResponse | null;
  isLoadingRooms: boolean;
  activeRoute: RouteResponse | null;
  isCalculatingRoute: boolean;
  isSimulatingWalk: boolean;
  isLiveGpsActive: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onStartRoute: (buildingId: string) => void;
  onToggleSimulateWalk: () => void;
  onToggleLiveGps: () => void;
  onClearRoute: () => void;
  onReportRoomBusy: (classroomId: string, reason: string) => Promise<void>;
  onClearRoomBusy: (classroomId: string) => Promise<void>;
  onOpenWrittenTicketForBuilding: (buildingId: string, classroomId?: string) => void;
  onAdminStartMoveEntrance: (buildingId: string) => void;
}

export const BuildingDetailSheet: React.FC<BuildingDetailSheetProps> = ({
  building,
  roomsData,
  isLoadingRooms,
  activeRoute,
  isCalculatingRoute,
  isSimulatingWalk,
  isLiveGpsActive,
  isAdmin,
  onClose,
  onStartRoute,
  onToggleSimulateWalk,
  onToggleLiveGps,
  onClearRoute,
  onReportRoomBusy,
  onClearRoomBusy,
  onOpenWrittenTicketForBuilding,
  onAdminStartMoveEntrance,
}) => {
  const [busyReasonInput, setBusyReasonInput] = useState<Record<string, string>>({});
  const [filterOnlyFree, setFilterOnlyFree] = useState<boolean>(false);

  if (!building) return null;

  const rooms = roomsData?.rooms || [];
  const displayedRooms = filterOnlyFree
    ? rooms.filter((r) => r.is_currently_free)
    : rooms;

  return (
    <aside className="absolute top-24 right-3 bottom-4 w-full max-w-md z-20 pointer-events-auto flex flex-col">
      <SurfaceCard className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-black text-xs border border-sky-500/30">
                {building.code}
              </span>
              <StatusBadge variant={building.free_rooms_count > 0 ? 'emerald' : 'rose'}>
                {building.free_rooms_count}/{building.total_rooms_count} Boş Derslik/Amfi
              </StatusBadge>
            </div>
            <h2 className="text-base font-extrabold text-white mt-1">{building.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              🚪 Giriş Kapısı: <span className="text-slate-200 font-semibold">{building.entrance_name}</span>
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

        {/* Navigation & Simulator Controls */}
        <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isCalculatingRoute}
              onClick={() => onStartRoute(building.id)}
              className="flex-1 py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow-lg transition"
            >
              {isCalculatingRoute ? 'Rota Hesaplanıyor...' : '🧭 Bina Girişine Yaya Rotası Çiz (A*)'}
            </button>

            <button
              type="button"
              onClick={() => onOpenWrittenTicketForBuilding(building.id)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
            >
              📝 Arıza/Talep Yaz
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onAdminStartMoveEntrance(building.id)}
              className="w-full py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition"
            >
              🚪 Admin: Bu Binanın Giriş Kapısını Haritada Taşı
            </button>
          )}

          {activeRoute && (
            <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-500/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-200">
                  🎯 {activeRoute.target_entrance_name}
                </span>
                <span className="font-extrabold text-white">
                  {activeRoute.distance_m} m • ~{activeRoute.duration_min} dk
                </span>
              </div>

              {activeRoute.avoided_closures > 0 && (
                <div className="text-[11px] text-amber-300 font-semibold">
                  🛡️ Kapalı yürüyüş yollarından kaçınılarak güvenli alternatif rota seçildi.
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={onToggleSimulateWalk}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition ${
                    isSimulatingWalk
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  {isSimulatingWalk ? '⏸️ Yürüyüşü Duraklat' : '🚶 Yürüyüş Simülatörünü Başlat'}
                </button>

                <button
                  type="button"
                  onClick={onToggleLiveGps}
                  className={`py-1.5 px-2.5 rounded-lg font-bold border transition ${
                    isLiveGpsActive
                      ? 'bg-sky-500 text-slate-950 border-sky-300'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {isLiveGpsActive ? '📡 Canlı GPS Açık' : '📍 Canlı GPS'}
                </button>

                <button
                  type="button"
                  onClick={onClearRoute}
                  className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Temizle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empty Amphitheater & Classroom Radar List */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-200">
            🪑 Boş Amfi & Derslik Radarı ({rooms.length})
          </span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterOnlyFree}
              onChange={(e) => setFilterOnlyFree(e.target.checked)}
              className="rounded border-slate-600"
            />
            <span>Sadece Boş Olanlar</span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {isLoadingRooms ? (
            <div className="text-xs text-slate-400 text-center py-8">
              Derslik ve amfi programı yükleniyor...
            </div>
          ) : displayedRooms.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              Bu binada gösterilecek derslik kaydı bulunmuyor.
            </div>
          ) : (
            displayedRooms.map((room) => (
              <div
                key={room.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{room.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Kat {room.floor} • {room.capacity} Kişi)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {room.has_outlets ? '🔌 Priz Mevcut' : 'Priz Yok'} •{' '}
                      {room.room_type === 'amphitheater'
                        ? 'Amfi'
                        : room.room_type === 'lab'
                        ? 'Laboratuvar'
                        : 'Derslik'}
                    </div>
                  </div>

                  {room.is_currently_free ? (
                    <StatusBadge variant="emerald">
                      🟢 Boş {room.free_until ? `(${room.free_until}'a kadar)` : ''}
                    </StatusBadge>
                  ) : room.is_crowd_busy ? (
                    <StatusBadge variant="amber">🟠 Öğrenci Bildirimi: Dolu</StatusBadge>
                  ) : (
                    <StatusBadge variant="rose">
                      🔴 Ders Var ({room.current_course_code})
                    </StatusBadge>
                  )}
                </div>

                {!room.is_currently_free && room.current_course_name && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-500/20">
                    📚 Aktif Ders: <strong>{room.current_course_code}</strong> — {room.current_course_name} (Bitiş: {room.current_course_ends_at})
                  </div>
                )}

                {room.is_crowd_busy && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-amber-200 bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-500/30">
                    <span>👥 {room.crowd_busy_reason}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onClearRoomBusy(room.id)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold shrink-0"
                      >
                        Sıfırla
                      </button>
                    )}
                  </div>
                )}

                {/* Crowdsourced "İçerisi Dolu Bildir" Override */}
                <div className="flex items-center gap-1.5 pt-1">
                  {room.is_currently_free && (
                    <>
                      <input
                        type="text"
                        value={busyReasonInput[room.id] || ''}
                        onChange={(e) =>
                          setBusyReasonInput((prev) => ({
                            ...prev,
                            [room.id]: e.target.value,
                          }))
                        }
                        placeholder="Örn: Kulüp toplantısı / telafi dersi var..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onReportRoomBusy(
                            room.id,
                            busyReasonInput[room.id] ||
                              'Öğrenci bildirimi: İçeride kulüp etkinliği / yoğunluk var'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-[11px] shrink-0"
                      >
                        🙋 İçerisi Dolu Bildir
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenWrittenTicketForBuilding(building.id, room.id)}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] shrink-0"
                  >
                    🔧 Donanım Bildir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>
    </aside>
  );
};
