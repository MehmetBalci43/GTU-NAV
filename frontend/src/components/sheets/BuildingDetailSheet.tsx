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

const WEEKDAYS = [
  { day: 1, label: 'Pzt' },
  { day: 2, label: 'Sal' },
  { day: 3, label: 'Çar' },
  { day: 4, label: 'Per' },
  { day: 5, label: 'Cum' },
];

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
  const [activeTab, setActiveTab] = useState<'radar' | 'schedule'>('radar');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [busyReasonInput, setBusyReasonInput] = useState<Record<string, string>>({});
  const [filterOnlyFree, setFilterOnlyFree] = useState<boolean>(false);

  if (!building) return null;

  const rooms = roomsData?.rooms || [];
  const displayedRooms = filterOnlyFree
    ? rooms.filter((r) => r.is_currently_free)
    : rooms;

  const dayScheduleItems = rooms
    .flatMap((room) =>
      room.schedules
        .filter((s) => s.day_of_week === selectedDay)
        .map((s) => ({
          ...s,
          roomName: room.name,
          roomId: room.id,
          floor: room.floor,
        }))
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <aside className="fixed inset-x-0 bottom-0 md:inset-x-auto md:top-24 md:right-3 md:bottom-4 w-full md:w-[390px] max-h-[68dvh] md:max-h-none z-20 pointer-events-auto flex flex-col px-2 pb-2 md:p-0">
      <SurfaceCard className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-black text-xs border border-sky-500/30">
                {building.code}
              </span>
              {building.total_rooms_count > 0 && (
                <StatusBadge variant={building.free_rooms_count > 0 ? 'emerald' : 'rose'}>
                  {building.free_rooms_count}/{building.total_rooms_count} Boş Derslik/Amfi
                </StatusBadge>
              )}
              <span className="text-[11px] text-slate-400">
                {building.floors_count} Katlı
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-white mt-1">
              {building.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              🚪 Giriş Kapısı:{' '}
              <span className="text-slate-200 font-semibold">{building.entrance_name}</span>
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
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2">
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
            <div className="p-2.5 rounded-xl bg-sky-950/50 border border-sky-500/40 space-y-2 text-xs">
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
                  🛡️ {activeRoute.avoided_closures} kapalı yürüyüş yolundan kaçınılarak güvenli alternatif rota seçildi.
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

        {/* Spec 04 Bölüm 2.1: 2 Clean Tabs (1. Canlı Boş Amfi Radarı | 2. Haftalık Ders Programı) */}
        <div className="grid grid-cols-2 gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`py-1.5 px-2 rounded-lg font-bold transition ${
              activeTab === 'radar'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            🟢 Canlı Amfi Radarı ({rooms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`py-1.5 px-2 rounded-lg font-bold transition ${
              activeTab === 'schedule'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            📅 Haftalık Ders Programı
          </button>
        </div>

        {activeTab === 'radar' ? (
          <>
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs bg-slate-900/50">
              <span className="font-bold text-slate-300">
                Anlık Durum ({roomsData?.query_time || 'TR Saati'})
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
                        📚 Aktif Ders: <strong>{room.current_course_code}</strong> —{' '}
                        {room.current_course_name} (Bitiş: {room.current_course_ends_at})
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
          </>
        ) : (
          /* Tab 2: Weekly Course Schedule (Pazartesi - Cuma) */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2.5 border-b border-slate-800 flex items-center gap-1.5 bg-slate-900/50">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.day}
                  type="button"
                  onClick={() => setSelectedDay(w.day)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedDay === w.day
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2 text-xs">
              {dayScheduleItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Bu binada seçilen gün için kayıtlı resmi ders bulunmuyor.
                </div>
              ) : (
                dayScheduleItems.map((item) => (
                  <div
                    key={`${item.id}-${item.roomId}`}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-white">
                        <span className="text-sky-300">{item.course_code}</span> —{' '}
                        {item.course_name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        🪑 {item.roomName} (Kat {item.floor})
                        {item.instructor ? ` • 👨‍🏫 ${item.instructor}` : ''}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-bold shrink-0 tabular-nums">
                      {item.start_time} – {item.end_time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </SurfaceCard>
    </aside>
  );
};
