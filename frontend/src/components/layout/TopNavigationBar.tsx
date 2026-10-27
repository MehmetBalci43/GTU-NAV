import React, { useState } from 'react';
import {
  Train,
  AlertTriangle,
  FileText,
  Shield,
  ShieldAlert,
  Building2,
  CheckCircle2,
  UtensilsCrossed,
  MapPin,
  Megaphone,
  X,
  KeyRound,
  LogOut,
  BookOpen,
  Armchair,
  Layers,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Radio,
  Sun,
  Moon,
} from 'lucide-react';
import {
  CampusAnnouncement,
  SearchResultItem,
  UserSession,
} from '../../types/campus';
import { DEFAULT_DEMO_ADMIN_KEY } from '../../hooks/useAuth';
import {
  TactileCard,
  TactileButton,
  TactileIconButton,
  StatusBadge,
} from '../ui/Primitives';

export type QuickCampusFilter =
  | 'all'
  | 'academic'
  | 'free_rooms'
  | 'alerts'
  | 'dining_library';

interface TopNavigationBarProps {
  user: UserSession;
  isAdmin: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onSwitchRole: (role: 'student' | 'admin', adminKey?: string) => Promise<boolean>;
  activeFilter: QuickCampusFilter;
  onFilterChange: (filter: QuickCampusFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SearchResultItem[];
  onSelectSearchResult: (item: SearchResultItem) => void;
  announcements: CampusAnnouncement[];
  isNavigating?: boolean;
  onOpenMarmaray: () => void;
  onOpenAlertModal: () => void;
  onOpenWrittenTicketModal: () => void;
  onToggleAdminDrawer: () => void;
  isAdminDrawerOpen: boolean;
  isAnnouncementsModalOpen?: boolean;
  onSetAnnouncementsModalOpen?: (open: boolean) => void;
  basemapMode?: 'diorama' | 'satellite' | 'street';
  onToggleBasemap?: () => void;
  is3DPitch?: boolean;
  onTogglePitch?: () => void;
  themeMode?: 'night' | 'day';
  onToggleTheme?: () => void;
  isLiveGpsActive?: boolean;
  onToggleLiveGps?: () => void;
  showAlerts?: boolean;
  onToggleAlerts?: () => void;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  user,
  isAdmin,
  authError,
  onClearAuthError,
  onSwitchRole,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult,
  announcements,
  isNavigating = false,
  onOpenMarmaray,
  onOpenAlertModal,
  onOpenWrittenTicketModal,
  onToggleAdminDrawer,
  isAdminDrawerOpen,
  isAnnouncementsModalOpen: controlledAnnOpen,
  onSetAnnouncementsModalOpen,
  basemapMode = 'diorama',
  onToggleBasemap,
  is3DPitch = false,
  onTogglePitch,
  themeMode = 'night',
  onToggleTheme,
  isLiveGpsActive = false,
  onToggleLiveGps,
  showAlerts = true,
  onToggleAlerts,
}) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [localAnnOpen, setLocalAnnOpen] = useState<boolean>(false);
  const isAnnouncementsModalOpen = controlledAnnOpen ?? localAnnOpen;
  const setAnnouncementsModalOpen = onSetAnnouncementsModalOpen ?? setLocalAnnOpen;

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState<boolean>(false);

  const [adminKeyInput, setAdminKeyInput] = useState<string>('');
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingKey(true);
    try {
      const ok = await onSwitchRole('admin', adminKeyInput.trim());
      if (ok) {
        setIsAdminModalOpen(false);
        setAdminKeyInput('');
      }
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const renderSearchResults = () => {
    if (searchQuery.trim().length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl shadow-hard-lg max-h-72 overflow-y-auto z-50 divide-y-2 divide-zinc-950/20">
        {searchResults.length === 0 ? (
          <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400 text-center font-bold">
            Sonuç bulunamadı ("CSE 101", "BMB", "Kütüphane" deneyin)
          </div>
        ) : (
          searchResults.map((item, idx) => (
            <button
              key={`${item.building_id}-${item.title}-${idx}`}
              type="button"
              onClick={() => {
                onSelectSearchResult(item);
                // On small screens, keep it tidy
                if (window.innerWidth < 768) {
                  onSearchChange('');
                }
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 dark:hover:bg-zinc-800 transition flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-950 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300">
                  {item.result_type === 'course' && <BookOpen className="w-3.5 h-3.5" />}
                  {item.result_type === 'building' && <Building2 className="w-3.5 h-3.5" />}
                  {item.result_type === 'classroom' && <Armchair className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="text-xs font-black text-zinc-950 dark:text-zinc-100">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-black text-sky-600 dark:text-sky-400 shrink-0 flex items-center gap-1">
                <span>Rotayı Çiz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))
        )}
      </div>
    );
  };

  const renderScopeBar = (isMobile: boolean = false) => {
    const pillBase =
      'px-2.5 py-1 rounded-lg text-[11px] font-black border border-zinc-950 shadow-hard-sm transition flex items-center gap-1.5 select-none active:translate-x-[1px] active:translate-y-[1px]';
    const activeClass =
      'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950';
    const inactiveClass =
      'bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700';

    return (
      <div
        className={`flex items-center gap-1.5 ${
          isMobile ? 'overflow-x-auto no-scrollbar py-0.5' : 'flex-wrap'
        }`}
      >
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`${pillBase} ${activeFilter === 'all' ? activeClass : inactiveClass}`}
        >
          <Layers className="w-3 h-3" />
          <span>Tümü</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === 'academic' ? 'all' : 'academic')
          }
          className={`${pillBase} ${
            activeFilter === 'academic'
              ? 'bg-rose-500 text-white border-transparent'
              : inactiveClass
          }`}
        >
          <Building2 className={`w-3 h-3 ${activeFilter === 'academic' ? 'text-white' : 'text-rose-500'}`} />
          <span>Akademik</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === 'free_rooms' ? 'all' : 'free_rooms')
          }
          className={`${pillBase} ${
            activeFilter === 'free_rooms'
              ? 'bg-emerald-600 text-white border-transparent'
              : inactiveClass
          }`}
        >
          <CheckCircle2 className={`w-3 h-3 ${activeFilter === 'free_rooms' ? 'text-white' : 'text-emerald-500'}`} />
          <span>Boş Amfi</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === 'dining_library' ? 'all' : 'dining_library'
            )
          }
          className={`${pillBase} ${
            activeFilter === 'dining_library'
              ? 'bg-amber-500 text-zinc-950 border-transparent'
              : inactiveClass
          }`}
        >
          <UtensilsCrossed className={`w-3 h-3 ${activeFilter === 'dining_library' ? 'text-zinc-950' : 'text-amber-500'}`} />
          <span>Yemek/Küt.</span>
        </button>
      </div>
    );
  };

  return (
    <>
      {/* ==================================================================== */}
      {/*                 DESKTOP APPLE MAPS DECOUPLED ISLANDS                 */}
      {/* ==================================================================== */}
      <div className="hidden md:block pointer-events-none">
        {/* Top-Left Island: Unified Search & Scope Bar Hub */}
        {!isLeftCollapsed ? (
          <aside className="fixed top-4 left-4 z-30 pointer-events-auto w-[360px] lg:w-[380px] transition-all">
            <TactileCard className="p-3.5 space-y-3">
              {/* Brand Header & Collapse Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/15 dark:bg-sky-400/15 border border-sky-500/30 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                    GTÜ
                  </div>
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      GTÜ-NAV
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLeftCollapsed(true)}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition"
                  title="Arama panelini kenara topla"
                  aria-label="Arama panelini kenara topla"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Omnibox Search Input */}
              <div className="relative">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Ders kodu (CSE 101), amfi veya bina ara..."
                    className="w-full h-9 pl-9 pr-8 bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-sky-400 shadow-hard-sm transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition text-xs font-bold"
                      aria-label="Aramayı Temizle"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {renderSearchResults()}
              </div>

              {/* Scope Bar (Directly below search, integrated in island) */}
              <div className="pt-0.5 border-t-2 border-zinc-950/20">
                {renderScopeBar(false)}
              </div>
            </TactileCard>
          </aside>
        ) : (
          <aside className="fixed top-4 left-4 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-md hover:scale-105 active:scale-95 transition text-xs font-black text-zinc-900 dark:text-zinc-100"
              title="Arama ve Filtreleri Aç"
            >
              <div className="w-5 h-5 rounded-md bg-sky-400 text-zinc-950 border border-zinc-950 flex items-center justify-center font-bold text-[9px]">
                GTÜ
              </div>
              <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Arama</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </aside>
        )}

        {/* Top-Right Island: Popover Toolbar */}
        {!isRightCollapsed ? (
          <nav className="fixed top-4 right-4 z-30 pointer-events-auto transition-all">
            <TactileCard className="p-1.5 flex items-center gap-1.5">
              {/* Marmaray Quick Access */}
              <TactileButton
                size="sm"
                variant="secondary"
                icon={<Train className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                onClick={onOpenMarmaray}
                title="GTÜ - Fatih Marmaray İstasyonu Tren Saatleri ve Yürüyüş Hesabı"
              >
                Marmaray
              </TactileButton>

              {/* HIG Pull-Down Button: Bildir / Araçlar ▾ */}
              <div className="relative">
                <TactileButton
                  size="sm"
                  variant={isReportDropdownOpen ? 'primary' : 'secondary'}
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  onClick={() => setIsReportDropdownOpen((prev) => !prev)}
                  title="Bildirim, Saha Uyarısı ve Konum Menüsü"
                >
                  <span>Bildir & Araçlar</span>
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                </TactileButton>

                {isReportDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-lg z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReportDropdownOpen(false);
                        onOpenAlertModal();
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-amber-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-zinc-950">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-xs">Saha Uyarısı Bırak</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Yol kapalı, su birikintisi, arıza</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsReportDropdownOpen(false);
                        onOpenWrittenTicketModal();
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-sky-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5 transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0 border border-zinc-950">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-xs">Arıza & Talep Bildir</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">İlgili birime yazılı ilet</div>
                      </div>
                    </button>

                    {onToggleLiveGps && (
                      <>
                        <div className="border-t-2 border-zinc-950/20 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsReportDropdownOpen(false);
                            onToggleLiveGps();
                          }}
                          className="w-full text-left p-2 rounded-xl hover:bg-emerald-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5 transition"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-zinc-950 ${
                              isLiveGpsActive
                                ? 'bg-emerald-400 text-zinc-950'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <Radio className={`w-4 h-4 ${isLiveGpsActive ? 'animate-pulse' : ''}`} />
                          </div>
                          <div>
                            <div className="font-black text-xs">
                              {isLiveGpsActive ? 'Canlı GPS Takibini Kapat' : 'Canlı GPS Konumunu Aç'}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {isLiveGpsActive ? 'Aktif • Kampüs içi konum' : 'Yalnızca kampüs içinde çalışır'}
                            </div>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Duyurular (Only if active) */}
              {announcements.length > 0 && (
                <TactileButton
                  size="sm"
                  variant="secondary"
                  icon={<Megaphone className="w-3.5 h-3.5 text-amber-500" />}
                  onClick={() => setAnnouncementsModalOpen(true)}
                  title="Kampüs Duyuruları"
                >
                  <span className="hidden lg:inline">Duyurular</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black">
                    {announcements.length}
                  </span>
                </TactileButton>
              )}

              {/* Admin / LiveOps Pill */}
              {isAdmin ? (
                <div className="flex items-center gap-1 pl-1 border-l-2 border-zinc-950">
                  <TactileButton
                    size="sm"
                    variant={isAdminDrawerOpen ? 'primary' : 'warning'}
                    icon={<ShieldAlert className="w-3.5 h-3.5" />}
                    onClick={onToggleAdminDrawer}
                  >
                    LiveOps
                  </TactileButton>
                  <TactileIconButton
                    size="sm"
                    variant="ghost"
                    label="Yönetici Oturumunu Kapat"
                    onClick={() => onSwitchRole('student')}
                  >
                    <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                  </TactileIconButton>
                </div>
              ) : (
                <TactileButton
                  size="sm"
                  variant="neutral"
                  icon={<Shield className="w-3.5 h-3.5 text-zinc-400" />}
                  onClick={() => {
                    onClearAuthError();
                    setIsAdminModalOpen(true);
                  }}
                  title={`${user.email} • Yönetici Girişi`}
                >
                  Yönetici
                </TactileButton>
              )}

              {/* Collapse Button for Right Toolbar */}
              <button
                type="button"
                onClick={() => setIsRightCollapsed(true)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition ml-0.5"
                title="Hızlı menüyü kenara topla"
                aria-label="Hızlı menüyü kenara topla"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </TactileCard>
          </nav>
        ) : (
          <nav className="fixed top-4 right-4 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsRightCollapsed(false)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-md hover:scale-105 active:scale-95 transition text-xs font-black text-zinc-900 dark:text-zinc-100"
              title="Hızlı Menüyü Aç"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span>Menü</span>
              {announcements.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </nav>
        )}
      </div>

      {/* ==================================================================== */}
      {/*                  MOBILE UNIFIED TOP ISLAND                           */}
      {/* ==================================================================== */}
      <div
        className={`block md:hidden fixed top-0 inset-x-0 z-30 pt-safe px-3 pointer-events-none transition-all duration-200 ${
          isNavigating ? 'hidden' : ''
        }`}
      >
        <div className="pt-2 flex items-center justify-between pointer-events-auto">
          {/* Minimal GTÜ Brand Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm">
            <div className="w-5 h-5 rounded-lg bg-sky-400 text-zinc-950 border border-zinc-950 flex items-center justify-center font-bold text-[10px]">
              GTÜ
            </div>
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              GTÜ-NAV
            </span>
          </div>

          {/* Unified Controls: Map Layers, Alerts, 2D/3B, Duyuru & Admin in ONE Flex Row */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm">
            {onToggleBasemap && (
              <button
                type="button"
                onClick={() => onToggleBasemap()}
                title={basemapMode === 'satellite' ? 'Vektörel Haritaya Geç' : 'Uydu Görünümüne Geç'}
                aria-label={basemapMode === 'satellite' ? 'Vektörel Haritaya Geç' : 'Uydu Görünümüne Geç'}
                className={`w-8 h-8 rounded-xl border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center active:scale-95 transition ${
                  basemapMode === 'satellite'
                    ? 'bg-sky-400 text-zinc-950'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            )}

            {onToggleAlerts && (
              <button
                type="button"
                onClick={() => onToggleAlerts()}
                title={showAlerts ? 'Saha Uyarılarını Gizle' : 'Saha Uyarılarını Göster'}
                aria-label={showAlerts ? 'Saha Uyarılarını Gizle' : 'Saha Uyarılarını Göster'}
                className={`w-8 h-8 rounded-xl border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center active:scale-95 transition ${
                  showAlerts
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-white dark:bg-zinc-800 text-zinc-400 opacity-60'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
            )}

            {onTogglePitch && (
              <button
                type="button"
                onClick={() => onTogglePitch()}
                className={`px-2 py-1 text-[11px] font-black rounded-xl border-2 border-zinc-950 shadow-hard-sm active:scale-95 transition ${
                  is3DPitch
                    ? 'bg-sky-400 text-zinc-950'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {is3DPitch ? '3B' : '2B'}
              </button>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={() => onToggleTheme()}
                className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center active:scale-95 transition"
                title={themeMode === 'night' ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
                aria-label={themeMode === 'night' ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
              >
                {themeMode === 'night' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                )}
              </button>
            )}

            {announcements.length > 0 && (
              <button
                type="button"
                onClick={() => setAnnouncementsModalOpen(true)}
                className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center relative active:scale-95 transition"
                title="Kampüs Duyuruları"
                aria-label="Kampüs Duyuruları"
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-950" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
              </button>
            )}

            {isAdmin ? (
              <button
                type="button"
                onClick={onToggleAdminDrawer}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border-2 border-zinc-950 shadow-hard-sm font-black text-[11px] active:scale-95 transition ${
                  isAdminDrawerOpen
                    ? 'bg-purple-500 text-white'
                    : 'bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>LiveOps</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClearAuthError();
                  setIsAdminModalOpen(true);
                }}
                className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-center active:scale-95 transition"
                title="Yönetici Girişi"
                aria-label="Yönetici Girişi"
              >
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duyurular Modal (On-Demand Only, Never stuck on screen) */}
      {isAnnouncementsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <TactileCard className="w-full max-w-lg p-5 space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-start justify-between border-b border-black/[0.08] dark:border-white/[0.10] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    GTÜ Kampüs Duyuruları
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Rektörlük ve Fakülte Güncel Bildirimleri
                  </p>
                </div>
              </div>
              <TactileIconButton
                size="sm"
                variant="ghost"
                label="Kapat"
                onClick={() => setAnnouncementsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </TactileIconButton>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-xs font-medium text-zinc-500">
                  Şu an aktif bir kampüs duyurusu bulunmamaktadır.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3.5 rounded-xl bg-zinc-100/75 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                        {ann.title}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 uppercase">
                        {ann.severity || 'Duyuru'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 font-normal leading-relaxed">
                      {ann.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-black/[0.08] dark:border-white/[0.10]">
              <TactileButton
                variant="neutral"
                size="sm"
                onClick={() => setAnnouncementsModalOpen(false)}
              >
                Kapat
              </TactileButton>
            </div>
          </TactileCard>
        </div>
      )}

      {/* Admin Login Modal (X-Admin-Key) */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <TactileCard className="w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-3">
              <div>
                <StatusBadge
                  variant="purple"
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                >
                  Yönetici Girişi
                </StatusBadge>
                <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-1">
                  Kampüs Yönetim Paneli
                </h2>
              </div>
              <TactileIconButton
                size="sm"
                variant="ghost"
                label="Kapat"
                onClick={() => setIsAdminModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </TactileIconButton>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-900 text-rose-900 dark:text-rose-200 font-bold">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
              <div>
                <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
                  Yönetici Anahtarı
                </label>
                <input
                  type="password"
                  required
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="Yönetici anahtarını giriniz..."
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                  Test oturumu için varsayılan anahtarı kullanabilirsiniz.
                </span>
                <button
                  type="button"
                  onClick={() => setAdminKeyInput(DEFAULT_DEMO_ADMIN_KEY)}
                  className="text-[11px] font-black text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Anahtarı Doldur
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-zinc-950">
                <TactileButton
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAdminModalOpen(false)}
                >
                  İptal
                </TactileButton>
                <TactileButton
                  type="submit"
                  variant="primary"
                  loading={isVerifyingKey}
                  icon={<ShieldAlert className="w-4 h-4" />}
                >
                  Yönetim Panelini Aç
                </TactileButton>
              </div>
            </form>
          </TactileCard>
        </div>
      )}
    </>
  );
};
