import React, { useState } from 'react';
import {
  Navigation,
  FileText,
  DoorClosed,
  CheckCircle2,
  Calendar,
  Play,
  Pause,
  Radio,
  X,
  Zap,
  Users,
  Wrench,
  MapPin,
  Clock,
  BookOpen,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  Building,
  BuildingRoomsResponse,
  RouteResponse,
} from '../../types/campus';
import {
  TactileCard,
  TactileButton,
  TactileIconButton,
  StatusBadge,
  GrabberHandle,
} from '../ui/Primitives';

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
  onAdminStartMoveEntrance: (buildingId: string, slot: 1 | 2) => void;
  onAdminClearSecondaryEntrance?: (buildingId: string) => void;
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
  onAdminClearSecondaryEntrance,
}) => {
  const [activeTab, setActiveTab] = useState<'radar' | 'schedule'>('radar');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [busyReasonInput, setBusyReasonInput] = useState<Record<string, string>>({});
  const [filterOnlyFree, setFilterOnlyFree] = useState<boolean>(false);
  const [isAdminEntranceMenuOpen, setIsAdminEntranceMenuOpen] = useState<boolean>(false);

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

  const hasSecondaryEntrance =
    building.secondary_entrance_lat != null && building.secondary_entrance_lon != null;

  return (
    <aside className="hidden md:flex fixed md:top-20 md:right-4 md:bottom-6 md:w-[404px] z-40 pointer-events-auto flex-col animate-in slide-in-from-right-6 fade-in duration-200 ease-out">
      <TactileCard className="flex-1 flex flex-col overflow-hidden p-0 border border-zinc-300 dark:border-white/10 shadow-hard-lg dark:shadow-hard-night-lg bg-white dark:bg-[#1E222D]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex items-start justify-between gap-3 bg-zinc-50/80 dark:bg-zinc-900/60 relative">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-sky-400 text-zinc-950 font-black text-xs border border-zinc-950 shadow-[1px_1px_0px_#18181B]">
                {building.code}
              </span>
              {building.total_rooms_count > 0 && (
                <StatusBadge
                  variant={building.free_rooms_count > 0 ? 'emerald' : 'rose'}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  {building.free_rooms_count}/{building.total_rooms_count} Boş Amfi
                </StatusBadge>
              )}
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                {building.floors_count} Katlı
              </span>
            </div>

            <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-1.5 leading-snug">
              {building.name}
            </h2>

            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <DoorClosed className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>1. Kapı:</span>
                <strong className="text-zinc-900 dark:text-zinc-200 truncate">
                  {building.entrance_name}
                </strong>
              </p>
              {hasSecondaryEntrance && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <DoorClosed className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>2. Kapı:</span>
                  <strong className="text-zinc-900 dark:text-zinc-200 truncate">
                    {building.secondary_entrance_name || `${building.code} 2. Giriş Kapısı`}
                  </strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <div className="relative">
                <TactileIconButton
                  size="sm"
                  variant={isAdminEntranceMenuOpen ? 'warning' : 'ghost'}
                  label="Giriş Kapısı Ayarları (Admin)"
                  onClick={() => setIsAdminEntranceMenuOpen((prev) => !prev)}
                >
                  <MapPin className="w-4 h-4 text-amber-500" />
                </TactileIconButton>

                {isAdminEntranceMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-lg z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      Bina Giriş Kapıları (Admin)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminEntranceMenuOpen(false);
                        onAdminStartMoveEntrance(building.id, 1);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 transition"
                    >
                      <span className="w-5 h-5 rounded-md bg-emerald-400 text-zinc-950 font-black text-[11px] flex items-center justify-center border border-zinc-950 shrink-0">
                        1
                      </span>
                      <div>
                        <div className="font-black text-xs">1. Kapıyı Haritada Seç</div>
                        <div className="text-[10px] text-zinc-500">Ana giriş kapısını taşı</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminEntranceMenuOpen(false);
                        onAdminStartMoveEntrance(building.id, 2);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 transition"
                    >
                      <span className="w-5 h-5 rounded-md bg-sky-400 text-zinc-950 font-black text-[11px] flex items-center justify-center border border-zinc-950 shrink-0">
                        2
                      </span>
                      <div>
                        <div className="font-black text-xs">
                          {hasSecondaryEntrance ? '2. Kapıyı Haritada Güncelle' : '2. Kapı (Ek Giriş) Ekle'}
                        </div>
                        <div className="text-[10px] text-zinc-500">İkinci giriş kapısı tanımla</div>
                      </div>
                    </button>

                    {hasSecondaryEntrance && onAdminClearSecondaryEntrance && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdminEntranceMenuOpen(false);
                          onAdminClearSecondaryEntrance(building.id);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 transition"
                      >
                        <X className="w-4 h-4 shrink-0" />
                        <span>2. Giriş Kapısını Kaldır</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <TactileIconButton
              size="sm"
              variant="ghost"
              label="Kapat"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </TactileIconButton>
          </div>
        </div>

        {/* Navigation & Route Actions (Symmetrical 2-Column Grid) */}
        <div className="p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/10 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <TactileButton
              variant="accent"
              loading={isCalculatingRoute}
              icon={<Navigation className="w-3.5 h-3.5 shrink-0" />}
              onClick={() => onStartRoute(building.id)}
              className="w-full justify-center text-xs"
            >
              Bina Girişine Yürü
            </TactileButton>

            <TactileButton
              variant="secondary"
              icon={<FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
              onClick={() => onOpenWrittenTicketForBuilding(building.id)}
              className="w-full justify-center text-xs"
            >
              Talep / Arıza Yaz
            </TactileButton>
          </div>

          {activeRoute && (
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 border-2 border-zinc-950 shadow-hard-sm space-y-2 text-xs">
              <div className="flex items-center justify-between font-extrabold text-sky-950 dark:text-sky-200">
                <span className="flex items-center gap-1.5 truncate">
                  <Navigation className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>{activeRoute.target_entrance_name}</span>
                </span>
                <span className="font-black tabular-nums bg-sky-400 text-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-950 shrink-0">
                  {activeRoute.distance_m} m • ~{activeRoute.duration_min} dk
                </span>
              </div>

              {activeRoute.avoided_closures > 0 && (
                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                  🛡️ {activeRoute.avoided_closures} kapalı yürüyüş yolundan kaçınılarak alternatif rota seçildi.
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
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
                  className="flex-1"
                >
                  {isSimulatingWalk ? 'Duraklat' : 'Simülatörü Başlat'}
                </TactileButton>

                {isLiveGpsActive && (
                  <TactileButton
                    size="sm"
                    variant="accent"
                    icon={<Radio className="w-3.5 h-3.5 animate-pulse" />}
                    onClick={onToggleLiveGps}
                  >
                    GPS Kapat
                  </TactileButton>
                )}

                <TactileButton
                  size="sm"
                  variant="ghost"
                  onClick={onClearRoute}
                >
                  Rotayı Temizle
                </TactileButton>
              </div>
            </div>
          )}
        </div>

        {/* Apple HIG Segmented Control (1. Amfi Durumları | 2. Ders Programı) */}
        <div className="px-3 pt-2.5 pb-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/10">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`py-1.5 px-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-300 dark:border-white/15'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'radar' ? 'text-emerald-500' : ''}`} />
              <span>Amfi Durumları ({rooms.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`py-1.5 px-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'schedule'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-300 dark:border-white/15'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'schedule' ? 'text-sky-500' : ''}`} />
              <span>Ders Programı</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Live Amphitheater Radar */}
        {activeTab === 'radar' ? (
          <>
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-900/50">
              <span className="font-extrabold text-zinc-700 dark:text-zinc-300">
                Anlık Durum ({roomsData?.query_time || 'TR Saati'})
              </span>
              <label className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyFree}
                  onChange={(e) => setFilterOnlyFree(e.target.checked)}
                  className="rounded border-zinc-400 accent-emerald-500"
                />
                <span>Sadece Boş Olanlar</span>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {isLoadingRooms ? (
                <div className="text-xs text-zinc-500 text-center py-8 font-bold">
                  Derslik ve amfi doluluk verisi taranıyor...
                </div>
              ) : displayedRooms.length === 0 ? (
                <div className="text-xs text-zinc-500 text-center py-8 font-bold">
                  Bu binada gösterilecek derslik kaydı bulunmuyor.
                </div>
              ) : (
                displayedRooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border-2 border-zinc-950 shadow-hard-sm space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>{room.name}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">
                            (Kat {room.floor} • {room.capacity} Kişi)
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                          {room.has_outlets ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <Zap className="w-3 h-3" /> Priz Var
                            </span>
                          ) : (
                            <span className="text-zinc-400">Priz Yok</span>
                          )}
                          <span>•</span>
                          <span>
                            {room.room_type === 'amphitheater'
                              ? 'Amfi'
                              : room.room_type === 'lab'
                              ? 'Laboratuvar'
                              : 'Derslik'}
                          </span>
                        </div>
                      </div>

                      {room.is_currently_free ? (
                        <StatusBadge
                          variant="emerald"
                          icon={<CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        >
                          Boş {room.free_until ? `(${room.free_until}'a kadar)` : ''}
                        </StatusBadge>
                      ) : room.is_crowd_busy ? (
                        <StatusBadge
                          variant="amber"
                          icon={<Users className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                        >
                          Öğrenci Bildirimi: Dolu
                        </StatusBadge>
                      ) : (
                        <StatusBadge
                          variant="rose"
                          icon={<BookOpen className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                        >
                          Ders Var ({room.current_course_code})
                        </StatusBadge>
                      )}
                    </div>

                    {!room.is_currently_free && room.current_course_name && (
                      <div className="text-[11px] text-rose-900 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 p-2 rounded-lg border border-rose-300 dark:border-rose-800 font-medium">
                        Aktif Ders: <strong>{room.current_course_code}</strong> —{' '}
                        {room.current_course_name} (Bitiş: {room.current_course_ends_at})
                      </div>
                    )}

                    {room.is_crowd_busy && (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 p-2 rounded-lg border border-amber-300 dark:border-amber-800">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{room.crowd_busy_reason}</span>
                        </span>
                        {isAdmin && (
                          <TactileButton
                            size="sm"
                            variant="secondary"
                            onClick={() => onClearRoomBusy(room.id)}
                            className="text-[10px] py-0.5 px-2 min-h-0"
                          >
                            Sıfırla
                          </TactileButton>
                        )}
                      </div>
                    )}

                    {/* Crowdsourced "İçerisi Dolu Bildir" Override */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
                            placeholder="Örn: Kulüp toplantısı / etüt var..."
                            className="flex-1 min-w-[130px] bg-white dark:bg-zinc-950 border border-zinc-950 rounded-lg px-2.5 py-1 text-[11px] text-zinc-900 dark:text-zinc-100 font-semibold outline-none"
                          />
                          <TactileButton
                            size="sm"
                            variant="warning"
                            icon={<Users className="w-3 h-3" />}
                            onClick={() =>
                              onReportRoomBusy(
                                room.id,
                                busyReasonInput[room.id] ||
                                  'Öğrenci bildirimi: İçeride kulüp etkinliği / yoğunluk var'
                              )
                            }
                            className="text-[11px] py-1 px-2.5 min-h-0"
                          >
                            İçerisi Dolu Bildir
                          </TactileButton>
                        </>
                      )}
                      <TactileButton
                        size="sm"
                        variant="ghost"
                        icon={<Wrench className="w-3 h-3 text-zinc-500" />}
                        onClick={() => onOpenWrittenTicketForBuilding(building.id, room.id)}
                        className="text-[11px] py-1 px-2 min-h-0"
                      >
                        Arıza Bildir
                      </TactileButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Tab 2: Weekly Course Schedule (Pazartesi - Cuma) */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2 border-b-2 border-zinc-950 flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.day}
                  type="button"
                  onClick={() => setSelectedDay(w.day)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition border-2 border-zinc-950 ${
                    selectedDay === w.day
                      ? 'bg-sky-400 text-zinc-950 shadow-hard-sm'
                      : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-none'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {dayScheduleItems.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 font-bold">
                  Bu binada seçilen gün için kayıtlı resmi ders bulunmuyor.
                </div>
              ) : (
                dayScheduleItems.map((item) => (
                  <div
                    key={`${item.id}-${item.roomId}`}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-black text-zinc-900 dark:text-zinc-100">
                        <span className="text-sky-600 dark:text-sky-300 font-black">
                          {item.course_code}
                        </span>{' '}
                        — {item.course_name}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>
                          {item.roomName} (Kat {item.floor})
                        </span>
                        {item.instructor ? (
                          <span className="flex items-center gap-1 text-zinc-500">
                            <GraduationCap className="w-3 h-3" />
                            {item.instructor}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-950 text-zinc-900 dark:text-zinc-100 font-black shrink-0 tabular-nums">
                      {item.start_time} – {item.end_time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </TactileCard>
    </aside>
  );
};
