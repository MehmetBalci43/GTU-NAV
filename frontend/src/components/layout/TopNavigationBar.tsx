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
}) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [localAnnOpen, setLocalAnnOpen] = useState<boolean>(false);
  const isAnnouncementsModalOpen = controlledAnnOpen ?? localAnnOpen;
  const setAnnouncementsModalOpen = onSetAnnouncementsModalOpen ?? setLocalAnnOpen;

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);

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
    return (
      <div
        className={`flex items-center gap-1.5 ${
          isMobile ? 'overflow-x-auto no-scrollbar py-0.5' : 'flex-wrap'
        }`}
      >
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shadow-[1.5px_1.5px_0px_#18181B] border border-zinc-950 transition flex items-center gap-1 select-none ${
            activeFilter === 'all'
              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Tümü</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === 'academic' ? 'all' : 'academic')
          }
          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shadow-[1.5px_1.5px_0px_#18181B] border border-zinc-950 transition flex items-center gap-1 select-none ${
            activeFilter === 'academic'
              ? 'bg-rose-400 text-zinc-950 ring-1 ring-rose-300'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-200'
          }`}
        >
          <Building2 className="w-3 h-3 text-rose-500" />
          <span>Akademik</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(activeFilter === 'free_rooms' ? 'all' : 'free_rooms')
          }
          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shadow-[1.5px_1.5px_0px_#18181B] border border-zinc-950 transition flex items-center gap-1 select-none ${
            activeFilter === 'free_rooms'
              ? 'bg-emerald-400 text-zinc-950 ring-1 ring-emerald-300'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-200'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Boş Amfi</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onFilterChange(
              activeFilter === 'dining_library' ? 'all' : 'dining_library'
            )
          }
          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shadow-[1.5px_1.5px_0px_#18181B] border border-zinc-950 transition flex items-center gap-1 select-none ${
            activeFilter === 'dining_library'
              ? 'bg-amber-400 text-zinc-950 ring-1 ring-amber-300'
              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-200'
          }`}
        >
          <UtensilsCrossed className="w-3 h-3 text-amber-600" />
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
            <TactileCard className="p-3.5 space-y-3 bg-white/95 dark:bg-[#1E222D]/95 border-2 border-zinc-950 shadow-hard-lg dark:shadow-hard-night-lg">
              {/* Brand Header & Collapse Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 border-2 border-zinc-950 flex items-center justify-center font-black text-white shadow-hard-sm text-xs">
                    GTÜ
                  </div>
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-sm font-black text-zinc-950 dark:text-zinc-100 tracking-tight">
                      GTÜ-NAV
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-300 border border-zinc-950 font-black">
                      Kampüs Maketi
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLeftCollapsed(true)}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-white border border-transparent hover:border-zinc-950/20 flex items-center justify-center transition"
                  title="Arama panelini kenara topla"
                  aria-label="Arama panelini kenara topla"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Omnibox Search Input */}
              <div className="relative">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Ders kodu (CSE 101), amfi veya bina ara..."
                    className="w-full h-9 pl-9 pr-8 bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl text-xs font-bold text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-sky-400 shadow-[2px_2px_0px_#18181B] transition"
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
              <div className="pt-0.5 border-t border-zinc-950/10 dark:border-white/10">
                {renderScopeBar(false)}
              </div>
            </TactileCard>
          </aside>
        ) : (
          <aside className="fixed top-4 left-4 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 dark:bg-[#1E222D]/95 border-2 border-zinc-950 shadow-hard-md hover:scale-105 active:scale-95 transition text-xs font-black text-zinc-900 dark:text-zinc-100"
              title="Arama ve Filtreleri Aç"
            >
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-400 to-indigo-600 border border-zinc-950 flex items-center justify-center font-black text-[9px] text-white">
                GTÜ
              </div>
              <Search className="w-3.5 h-3.5 text-sky-500" />
              <span>Arama</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </aside>
        )}

        {/* Top-Right Island: Compact Services Toolbar */}
        {!isRightCollapsed ? (
          <nav className="fixed top-4 right-4 z-30 pointer-events-auto transition-all">
            <TactileCard className="p-1.5 flex items-center gap-1.5 bg-white/95 dark:bg-[#1E222D]/95 border-2 border-zinc-950 shadow-hard-md dark:shadow-hard-night-md">
              {announcements.length > 0 && (
                <TactileButton
                  size="sm"
                  variant="secondary"
                  icon={<Megaphone className="w-3.5 h-3.5 text-amber-500" />}
                  onClick={() => setAnnouncementsModalOpen(true)}
                  title="Kampüs Duyuruları"
                >
                  Duyurular
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black">
                    {announcements.length}
                  </span>
                </TactileButton>
              )}

              <TactileButton
                size="sm"
                variant="secondary"
                icon={<Train className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                onClick={onOpenMarmaray}
                title="GTÜ - Fatih Marmaray İstasyonu Tren Saatleri ve Yürüyüş Hesabı"
              >
                Marmaray
              </TactileButton>

              <TactileButton
                size="sm"
                variant="secondary"
                icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                onClick={onOpenAlertModal}
                title="Haritaya Anlık Saha Uyarısı Bırak"
              >
                Saha Uyarısı
              </TactileButton>

              <TactileButton
                size="sm"
                variant="secondary"
                icon={<FileText className="w-3.5 h-3.5 text-sky-500" />}
                onClick={onOpenWrittenTicketModal}
                title="Yerel Türkçe NLP Yapay Zekâ Destekli Yazılı Arıza Bildirimi"
              >
                AI Bildirim
              </TactileButton>

              {isAdmin ? (
                <div className="flex items-center gap-1 pl-1 border-l-2 border-zinc-950/20 dark:border-white/20">
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
                className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-white border border-transparent hover:border-zinc-950/20 flex items-center justify-center transition ml-0.5"
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/95 dark:bg-[#1E222D]/95 border-2 border-zinc-950 shadow-hard-md hover:scale-105 active:scale-95 transition text-xs font-black text-zinc-900 dark:text-zinc-100"
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
      {/*                  MOBILE MINIMAL FLOATING TOP ISLAND                  */}
      {/* ==================================================================== */}
      <div
        className={`block md:hidden fixed top-0 inset-x-0 z-30 pt-safe px-3.5 pointer-events-none transition-all duration-200 ${
          isNavigating ? 'hidden' : ''
        }`}
      >
        <div className="pt-2 flex items-center justify-between pointer-events-auto">
          {/* Minimal GTÜ Brand Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-white/90 dark:bg-[#1E222D]/90 border border-zinc-300 dark:border-white/10 shadow-sm backdrop-blur-md">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 border border-zinc-950 flex items-center justify-center font-black text-white text-[10px] shadow-sm">
              GTÜ
            </div>
            <span className="text-xs font-black text-zinc-950 dark:text-zinc-100 tracking-tight">
              GTÜ-NAV
            </span>
          </div>

          {/* Admin Trigger / Status Pill */}
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <button
                type="button"
                onClick={onToggleAdminDrawer}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border font-black text-xs shadow-sm backdrop-blur-md transition ${
                  isAdminDrawerOpen
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'bg-white/90 dark:bg-[#1E222D]/90 text-purple-600 dark:text-purple-400 border-zinc-300 dark:border-white/10'
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
                className="w-8 h-8 rounded-2xl bg-white/90 dark:bg-[#1E222D]/90 border border-zinc-300 dark:border-white/10 text-zinc-400 flex items-center justify-center shadow-sm backdrop-blur-md active:scale-95 transition"
                title="Yönetici Girişi"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duyurular Modal (On-Demand Only, Never stuck on screen) */}
      {isAnnouncementsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <TactileCard className="w-full max-w-lg p-5 space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-zinc-950 flex items-center justify-center shadow-hard-sm">
                  <Megaphone className="w-5 h-5 text-zinc-950" />
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                    GTÜ Kampüs Duyuruları
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
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
                <div className="text-center py-8 text-xs font-bold text-zinc-500">
                  Şu an aktif bir kampüs duyurusu bulunmamaktadır.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-zinc-950 shadow-hard-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-xs text-amber-950 dark:text-amber-200">
                        {ann.title}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase">
                        {ann.severity || 'Duyuru'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold leading-relaxed">
                      {ann.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-zinc-950">
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
                  X-Admin-Key Yetki Doğrulaması
                </StatusBadge>
                <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-1">
                  GTÜ LiveOps Komuta Merkezi Girişi
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
                  Yönetici Gizli Anahtarı (`ADMIN_SECRET_KEY`)
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

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-between gap-2">
                <div className="text-[11px] text-purple-900 dark:text-purple-200 font-semibold">
                  <strong>Jüri / Demo Kolaylığı:</strong> Varsayılan anahtarı tek tıkla doldurabilirsiniz.
                </div>
                <TactileButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<KeyRound className="w-3.5 h-3.5 text-purple-600" />}
                  onClick={() => setAdminKeyInput(DEFAULT_DEMO_ADMIN_KEY)}
                  className="shrink-0"
                >
                  Doldur
                </TactileButton>
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
                  LiveOps Merkezini Aç
                </TactileButton>
              </div>
            </form>
          </TactileCard>
        </div>
      )}
    </>
  );
};
