import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Train,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Building2,
  BookOpen,
  Armchair,
  ArrowRight,
  DoorClosed,
  Navigation,
  Megaphone,
  X,
  Calendar,
  Sparkles,
  Radio,
} from 'lucide-react';
import {
  Building,
  BuildingRoomsResponse,
  CampusAnnouncement,
  SearchResultItem,
} from '../../types/campus';
import { QuickCampusFilter } from '../layout/TopNavigationBar';
import { StatusBadge } from '../ui/Primitives';

export type BottomSheetDetent = 'peek' | 'medium' | 'large';

export interface InteractiveBottomSheetProps {
  // Navigation & Search
  isNavigating: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SearchResultItem[];
  onSelectSearchResult: (item: SearchResultItem) => void;
  activeFilter: QuickCampusFilter;
  onFilterChange: (filter: QuickCampusFilter) => void;

  // Selected Building
  selectedBuilding: Building | null;
  roomsData: BuildingRoomsResponse | null;
  isLoadingRooms: boolean;
  onStartRoute: (buildingId: string) => void;
  onCloseBuilding: () => void;
  onReportRoomBusy: (classroomId: string, reason: string) => Promise<void>;
  onClearRoomBusy: (classroomId: string) => Promise<void>;
  onOpenWrittenTicketForBuilding: (buildingId: string, classroomId?: string) => void;

  // Quick Mobile Touch Actions
  onOpenMarmaray: () => void;
  onOpenAlertModal: () => void;
  onOpenWrittenTicketModal: () => void;
  onOpenAnnouncements: () => void;
  announcements: CampusAnnouncement[];
  isLiveGpsActive?: boolean;
  onToggleLiveGps?: () => void;

  // Real-time height callback for MapLibre dynamic camera padding
  onHeightChange?: (heightPx: number) => void;
}

const WEEKDAYS = [
  { day: 1, label: 'Pzt' },
  { day: 2, label: 'Sal' },
  { day: 3, label: 'Çar' },
  { day: 4, label: 'Per' },
  { day: 5, label: 'Cum' },
];

/**
 * Asymptotic Apple-standard rubber-banding calculation
 */
function rubberBand(offset: number, dimension: number, constant = 0.55): number {
  return (offset * dimension * constant) / (dimension + constant * Math.abs(offset));
}

export const InteractiveBottomSheet: React.FC<InteractiveBottomSheetProps> = ({
  isNavigating,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult,
  activeFilter,
  onFilterChange,
  selectedBuilding,
  roomsData,
  isLoadingRooms,
  onStartRoute,
  onCloseBuilding,
  onReportRoomBusy,
  onClearRoomBusy,
  onOpenWrittenTicketForBuilding,
  onOpenMarmaray,
  onOpenAlertModal,
  onOpenWrittenTicketModal,
  onOpenAnnouncements,
  announcements,
  isLiveGpsActive = false,
  onToggleLiveGps,
  onHeightChange,
}) => {
  const [detent, setDetent] = useState<BottomSheetDetent>('peek');
  const [activeBuildingTab, setActiveBuildingTab] = useState<'radar' | 'schedule'>('radar');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [filterOnlyFree, setFilterOnlyFree] = useState<boolean>(false);

  // Gesture state refs (GPU translate3d driven, 0 re-render on move)
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const currentHeightRef = useRef<number>(94);

  const bodyTouchStartYRef = useRef<number>(0);
  const isBodyDraggingSheetRef = useRef<boolean>(false);

  // Compute detent heights based on viewport
  const getDetentHeight = useCallback(
    (targetDetent: BottomSheetDetent): number => {
      if (typeof window === 'undefined') return 96;
      const vh = window.innerHeight;
      switch (targetDetent) {
        case 'peek':
          return selectedBuilding ? 104 : 94;
        case 'medium':
          return Math.round(vh * 0.44);
        case 'large':
          return Math.round(vh * 0.86);
      }
    },
    [selectedBuilding]
  );

  const getMaxHeightPx = useCallback((): number => {
    if (typeof window === 'undefined') return 600;
    return Math.round(window.innerHeight * 0.86);
  }, []);

  const onHeightChangeRef = useRef(onHeightChange);
  useEffect(() => {
    onHeightChangeRef.current = onHeightChange;
  }, [onHeightChange]);

  const setSheetVisualHeight = useCallback((heightPx: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el || typeof window === 'undefined') return;
    const maxH = Math.round(window.innerHeight * 0.86);
    const rawOffset = Math.max(0, maxH - heightPx);
    el.style.transition = animate
      ? 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1)'
      : 'none';
    el.style.transform = `translate3d(0, ${Math.round(rawOffset)}px, 0)`;
  }, []);

  // Sync detent changes
  const applyDetent = useCallback(
    (nextDetent: BottomSheetDetent, withHaptic: boolean = false) => {
      setDetent(nextDetent);
      const h = getDetentHeight(nextDetent);
      currentHeightRef.current = h;
      setSheetVisualHeight(h, true);
      onHeightChangeRef.current?.(h);
      if (withHaptic && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(8);
        } catch {
          // Ignore vibration errors if blocked
        }
      }
    },
    [getDetentHeight, setSheetVisualHeight]
  );

  // When a building is selected, open sheet to medium or keep peek
  useEffect(() => {
    if (selectedBuilding) {
      applyDetent('medium');
    } else {
      applyDetent('peek');
    }
  }, [selectedBuilding?.id, applyDetent]);

  // When user types in search box, expand to large detent automatically
  useEffect(() => {
    if (searchQuery.trim().length > 0 && detent === 'peek') {
      applyDetent('large');
    }
  }, [searchQuery, detent, applyDetent]);

  // Sync sheet position on mount, detent change, or resize
  useEffect(() => {
    const h = getDetentHeight(detent);
    currentHeightRef.current = h;
    setSheetVisualHeight(h, false);
    onHeightChangeRef.current?.(h);
  }, [detent, getDetentHeight, setSheetVisualHeight]);

  // ---------------------------------------------------------------------------
  // Touch Drag Listeners (GPU translate3d & Asymptotic Rubber-Band)
  // ---------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.touches[0].clientY;
    dragStartHeightRef.current = currentHeightRef.current;
    dragStartTimeRef.current = Date.now();
    setSheetVisualHeight(currentHeightRef.current, false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartYRef.current - currentY; // positive = dragging up
    const peekH = getDetentHeight('peek');
    const largeH = getDetentHeight('large');

    let nextHeight = dragStartHeightRef.current + deltaY;
    if (nextHeight > largeH) {
      const over = nextHeight - largeH;
      nextHeight = largeH + rubberBand(over, largeH * 0.35);
    } else if (nextHeight < peekH) {
      const under = peekH - nextHeight;
      nextHeight = peekH - rubberBand(under, peekH * 0.5);
    }

    currentHeightRef.current = nextHeight;
    setSheetVisualHeight(nextHeight, false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const duration = Math.max(1, Date.now() - dragStartTimeRef.current);
    const endY = e.changedTouches[0].clientY;
    const deltaY = dragStartYRef.current - endY;
    const velocity = deltaY / duration; // px / ms

    const peekH = getDetentHeight('peek');
    const mediumH = getDetentHeight('medium');
    const largeH = getDetentHeight('large');
    const currentH = currentHeightRef.current;

    let targetDetent: BottomSheetDetent;
    if (velocity > 0.35) {
      targetDetent = currentH < mediumH ? 'medium' : 'large';
    } else if (velocity < -0.35) {
      if (currentH > mediumH) {
        targetDetent = 'medium';
      } else if (selectedBuilding && currentH <= mediumH + 40) {
        onCloseBuilding();
        targetDetent = 'peek';
      } else {
        targetDetent = 'peek';
      }
    } else {
      const distToPeek = Math.abs(currentH - peekH);
      const distToMed = Math.abs(currentH - mediumH);
      const distToLarge = Math.abs(currentH - largeH);

      if (distToPeek <= distToMed && distToPeek <= distToLarge) {
        targetDetent = 'peek';
      } else if (distToMed <= distToLarge) {
        targetDetent = 'medium';
      } else {
        targetDetent = 'large';
      }
    }

    applyDetent(targetDetent, true);
  };

  // Scrollable container handoff
  const handleBodyTouchStart = (e: React.TouchEvent) => {
    bodyTouchStartYRef.current = e.touches[0].clientY;
    isBodyDraggingSheetRef.current = false;
  };

  const handleBodyTouchMove = (e: React.TouchEvent) => {
    const el = scrollContainerRef.current;
    const currentY = e.touches[0].clientY;
    const delta = currentY - bodyTouchStartYRef.current; // pulling down = positive delta

    if (el && el.scrollTop <= 0 && delta > 4) {
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        isBodyDraggingSheetRef.current = true;
        dragStartYRef.current = currentY;
        dragStartHeightRef.current = currentHeightRef.current;
        dragStartTimeRef.current = Date.now();
      }
      handleTouchMove(e);
    }
  };

  const handleBodyTouchEnd = (e: React.TouchEvent) => {
    if (isBodyDraggingSheetRef.current || isDraggingRef.current) {
      isBodyDraggingSheetRef.current = false;
      handleTouchEnd(e);
    }
  };

  // Cycle detent on grabber tap
  const handleGrabberTap = () => {
    if (detent === 'peek') applyDetent('medium', true);
    else if (detent === 'medium') applyDetent('large', true);
    else applyDetent('peek', true);
  };

  // While full active navigation is underway, hide this sheet so map is 100% visible
  if (isNavigating) return null;

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
    <div
      ref={sheetRef}
      className={`md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-auto flex flex-col bg-white dark:bg-zinc-900 border-t-2 border-zinc-950 rounded-t-[26px] shadow-hard-lg dark:shadow-hard-night-lg overflow-hidden will-change-transform ${
        isNavigating ? 'hidden' : ''
      }`}
      style={{
        height: `${getMaxHeightPx()}px`,
      }}
    >
      {/* -------------------------------------------------------------------- */}
      {/* 1. NATIVE TOUCH GRABBER & DRAG AREA                                  */}
      {/* -------------------------------------------------------------------- */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleGrabberTap}
        className="w-full flex flex-col items-center pt-2.5 pb-1.5 cursor-grab select-none active:cursor-grabbing touch-none"
        aria-label="Alt çekmece tutamacı"
      >
        <div className="w-10 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 border border-zinc-950 transition-colors" />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. PEEK HEADER BAR (ALWAYS VISIBLE AT DETENT 1)                      */}
      {/* -------------------------------------------------------------------- */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="px-4 pb-2.5 touch-none select-none"
      >
        {selectedBuilding ? (
          /* ================================================================ */
          /* PEEK HEADER: SELECTED BUILDING MODE                              */
          /* ================================================================ */
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-1 rounded-lg bg-sky-400 text-zinc-950 font-black text-xs border border-zinc-950 shrink-0">
                {selectedBuilding.code}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedBuilding.name}
                </h3>
                <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 truncate flex items-center gap-1.5">
                  <DoorClosed className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span>{selectedBuilding.entrance_name}</span>
                  {selectedBuilding.free_rooms_count > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      • {selectedBuilding.free_rooms_count} Boş Amfi
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onStartRoute(selectedBuilding.id)}
                className="h-10 px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black text-xs border-2 border-zinc-950 shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                <span>Yürü</span>
              </button>

              <button
                type="button"
                onClick={onCloseBuilding}
                aria-label="Kapat"
                className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center active:translate-x-[1px] active:translate-y-[1px] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================ */
          /* PEEK HEADER: EXPLORE & SEARCH MODE                               */
          /* ================================================================ */
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (detent === 'peek') applyDetent('large');
              }}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ders kodu (CSE 101), amfi veya bina ara..."
              className="w-full h-11 pl-10 pr-9 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-950 rounded-2xl text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-sky-400 shadow-hard-sm transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. SCROLLABLE EXPANDED BODY (MEDIUM & LARGE DETENTS)                 */}
      {/* -------------------------------------------------------------------- */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleBodyTouchStart}
        onTouchMove={handleBodyTouchMove}
        onTouchEnd={handleBodyTouchEnd}
        className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4 touch-pan-y overscroll-contain"
      >
        {selectedBuilding ? (
          /* ================================================================ */
          /* VIEW A: BUILDING DETAILS (RADAR & SCHEDULE)                      */
          /* ================================================================ */
          <div className="space-y-3.5 pt-1">
            {/* Building Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/80 dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setActiveBuildingTab('radar')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeBuildingTab === 'radar'
                    ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100 shadow-sm border border-black/[0.05] dark:border-transparent'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Amfi Durumları</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBuildingTab('schedule')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeBuildingTab === 'schedule'
                    ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100 shadow-sm border border-black/[0.05] dark:border-transparent'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Haftalık Program</span>
              </button>
            </div>

            {/* TAB CONTENT: RADAR */}
            {activeBuildingTab === 'radar' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500 px-1">
                  <span>Derslikler ({displayedRooms.length})</span>
                  <button
                    type="button"
                    onClick={() => setFilterOnlyFree((prev) => !prev)}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition ${
                      filterOnlyFree
                        ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-600 border-black/[0.06] dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/[0.08]'
                    }`}
                  >
                    {filterOnlyFree ? '✓ Sadece Boşlar' : 'Tümü'}
                  </button>
                </div>

                {isLoadingRooms ? (
                  <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                    Derslik doluluk bilgisi yükleniyor...
                  </div>
                ) : displayedRooms.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-100/75 dark:bg-[#222736] border border-black/[0.05] dark:border-white/[0.07] text-center text-xs text-zinc-400 font-medium">
                    {filterOnlyFree
                      ? 'Bu binada şu an boş amfi bulunamadı.'
                      : 'Kayıtlı derslik bulunamadı.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayedRooms.map((room) => (
                      <div
                        key={room.id}
                        className="p-3 rounded-2xl bg-zinc-100/75 dark:bg-[#222736] border border-black/[0.05] dark:border-white/[0.07] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {room.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                              Kat {room.floor} • {room.capacity} Kişilik
                              {room.has_outlets ? ' • Priz Var' : ''}
                            </div>
                          </div>

                          <StatusBadge
                            variant={room.is_currently_free ? 'emerald' : 'rose'}
                          >
                            {room.is_currently_free ? 'Şu An Boş' : 'Ders Var'}
                          </StatusBadge>
                        </div>

                        {/* Room actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-black/[0.05] dark:border-white/[0.06] text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenWrittenTicketForBuilding(selectedBuilding.id, room.id)
                            }
                            className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            Arıza / İstek Bildir →
                          </button>

                          {room.is_currently_free ? (
                            <button
                              type="button"
                              onClick={() => onReportRoomBusy(room.id, 'Öğrenci bildirimiyle dolu')}
                              className="px-2.5 py-0.5 rounded-lg bg-zinc-200/80 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 font-medium active:scale-95 transition"
                            >
                              Dolu Bildir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onClearRoomBusy(room.id)}
                              className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium active:scale-95 transition"
                            >
                              Boşalt
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SCHEDULE */}
            {activeBuildingTab === 'schedule' && (
              <div className="space-y-3">
                {/* Day selector */}
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {WEEKDAYS.map((wd) => (
                    <button
                      key={wd.day}
                      type="button"
                      onClick={() => setSelectedDay(wd.day)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
                        selectedDay === wd.day
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                          : 'bg-zinc-100/80 dark:bg-white/[0.06] text-zinc-500'
                      }`}
                    >
                      {wd.label}
                    </button>
                  ))}
                </div>

                {dayScheduleItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-100/75 dark:bg-[#222736] border border-black/[0.05] dark:border-white/[0.07] text-center text-xs text-zinc-400 font-medium">
                    Bu gün için kayıtlı ders programı bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayScheduleItems.map((item, idx) => (
                      <div
                        key={`${item.roomId}-${item.course_code}-${idx}`}
                        className="p-2.5 rounded-xl bg-zinc-100/75 dark:bg-[#222736] border border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.course_code} - {item.course_name}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-medium">
                            {item.roomName} • {item.instructor || 'Öğretim Görevlisi'}
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                          {item.start_time}-{item.end_time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : searchQuery.trim().length > 0 ? (
          /* ================================================================ */
          /* VIEW B: LIVE SEARCH RESULTS                                      */
          /* ================================================================ */
          <div className="space-y-2 pt-1">
            <div className="text-xs font-medium text-zinc-500">
              Arama Sonuçları ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 font-medium">
                "{searchQuery}" için sonuç bulunamadı. Farklı bir ders kodu veya bina adı deneyin.
              </div>
            ) : (
              searchResults.map((item, idx) => (
                <button
                  key={`${item.building_id}-${item.title}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelectSearchResult(item);
                    applyDetent('medium');
                  }}
                  className="w-full text-left p-3 rounded-2xl bg-zinc-100/75 dark:bg-[#222736] border border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-3 active:bg-zinc-200/50 dark:active:bg-white/[0.08] transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-zinc-200/70 dark:bg-white/[0.08] flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300">
                      {item.result_type === 'course' && <BookOpen className="w-4 h-4" />}
                      {item.result_type === 'building' && <Building2 className="w-4 h-4" />}
                      {item.result_type === 'classroom' && <Armchair className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 shrink-0 flex items-center gap-1">
                    <span>Rotayı Çiz</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          /* ================================================================ */
          /* VIEW C: EXPLORE HUBS (GENEROUS TOUCH TILES & FILTERS)             */
          /* ================================================================ */
          <div className="space-y-4 pt-1">
            {/* Quick Campus Services */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                  Hızlı Kampüs Hizmetleri
                </div>
                {onToggleLiveGps && (
                  <button
                    type="button"
                    onClick={onToggleLiveGps}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border-2 border-zinc-950 shadow-hard-sm text-[11px] font-black active:translate-x-[1px] active:translate-y-[1px] transition ${
                      isLiveGpsActive
                        ? 'bg-emerald-400 text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Radio className={`w-3 h-3 ${isLiveGpsActive ? 'text-zinc-950 animate-pulse' : ''}`} />
                    <span>{isLiveGpsActive ? 'GPS: Açık' : 'GPS: Kapalı'}</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Marmaray */}
                <button
                  type="button"
                  onClick={onOpenMarmaray}
                  className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-950 shadow-hard-sm flex flex-col justify-between text-left active:translate-x-[1px] active:translate-y-[1px] transition min-h-[78px]"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-400 text-zinc-950 border border-zinc-950 flex items-center justify-center">
                    <Train className="w-4 h-4" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Marmaray Tren
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">
                      Fatih Durağı Saatleri
                    </div>
                  </div>
                </button>

                {/* 2. Boş Amfiler */}
                <button
                  type="button"
                  onClick={() => onFilterChange(activeFilter === 'free_rooms' ? 'all' : 'free_rooms')}
                  className={`p-3.5 rounded-2xl border-2 border-zinc-950 shadow-hard-sm flex flex-col justify-between text-left active:translate-x-[1px] active:translate-y-[1px] transition min-h-[78px] ${
                    activeFilter === 'free_rooms'
                      ? 'bg-emerald-400 text-zinc-950 ring-2 ring-emerald-300'
                      : 'bg-zinc-50 dark:bg-zinc-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-400 text-zinc-950 border border-zinc-950 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Boş Amfiler
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">
                      Ders Olmayan Sınıflar
                    </div>
                  </div>
                </button>

                {/* 3. Saha Uyarısı Bırak */}
                <button
                  type="button"
                  onClick={onOpenAlertModal}
                  className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-950 shadow-hard-sm flex flex-col justify-between text-left active:translate-x-[1px] active:translate-y-[1px] transition min-h-[78px]"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 border border-zinc-950 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Saha Uyarısı
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">
                      Yol Çalışması / Arıza
                    </div>
                  </div>
                </button>

                {/* 4. Arıza & Talep */}
                <button
                  type="button"
                  onClick={onOpenWrittenTicketModal}
                  className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-950 shadow-hard-sm flex flex-col justify-between text-left active:translate-x-[1px] active:translate-y-[1px] transition min-h-[78px]"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-400 text-zinc-950 border border-zinc-950 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Arıza & Talep
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">
                      Birimlere Yazılı İlet
                    </div>
                  </div>
                </button>
              </div>

              {/* 5. Kampüs Duyuruları */}
              {announcements.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenAnnouncements}
                  className="mt-2.5 w-full p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/70 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-between text-left active:translate-x-[1px] active:translate-y-[1px] transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 border border-zinc-950 flex items-center justify-center font-bold shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-amber-950 dark:text-amber-200 truncate">
                        Kampüs Duyuruları ({announcements.length})
                      </div>
                      <div className="text-[10px] font-semibold text-amber-800/80 dark:text-amber-300/80 truncate">
                        {announcements[0]?.title}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-black shrink-0">
                    Görüntüle →
                  </span>
                </button>
              )}
            </div>

            {/* Scope Bar Filters */}
            <div>
              <div className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-2">
                Harita Filtreleri
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => onFilterChange('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition ${
                    activeFilter === 'all'
                      ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/5'
                  }`}
                >
                  Tüm Binalar
                </button>

                <button
                  type="button"
                  onClick={() => onFilterChange('academic')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition ${
                    activeFilter === 'academic'
                      ? 'bg-sky-400 text-zinc-950 border-sky-500 ring-1 ring-sky-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/5'
                  }`}
                >
                  Akademik Bölümler
                </button>

                <button
                  type="button"
                  onClick={() => onFilterChange('dining_library')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition ${
                    activeFilter === 'dining_library'
                      ? 'bg-amber-400 text-zinc-950 border-amber-500 ring-1 ring-amber-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/5'
                  }`}
                >
                  Yemekhane & Kütüphane
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
