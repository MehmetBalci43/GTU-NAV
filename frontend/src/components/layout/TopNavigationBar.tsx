import React, { useState } from 'react';
import {
  CampusAnnouncement,
  SearchResultItem,
  UserSession,
} from '../../types/campus';
import { DEFAULT_DEMO_ADMIN_KEY } from '../../hooks/useAuth';

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
  isPickingUserStart?: boolean;
  onTogglePickUserStart?: () => void;
  onOpenMarmaray: () => void;
  onOpenAlertModal: () => void;
  onOpenWrittenTicketModal: () => void;
  onToggleAdminDrawer: () => void;
  isAdminDrawerOpen: boolean;
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
  isPickingUserStart = false,
  onTogglePickUserStart,
  onOpenMarmaray,
  onOpenAlertModal,
  onOpenWrittenTicketModal,
  onToggleAdminDrawer,
  isAdminDrawerOpen,
}) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
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

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none px-3 pt-2.5 space-y-1.5">
        {/* Row 1: Compact Single-Line Top Bar */}
        <div className="pointer-events-auto max-w-6xl mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center font-black text-white shadow text-xs">
              GTÜ
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-white tracking-tight">
                  GTÜ-NAV
                </span>
                <span className="hidden lg:inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  3B Kampüs
                </span>
              </div>
            </div>
          </div>

          {/* Center Omnibox Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="🔍 Ders kodu (CSE 101, MATH 101), amfi veya bina ara..."
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-400 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}

            {/* Dropdown Search Results */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-50 divide-y divide-slate-800">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">
                    Sonuç bulunamadı ("CSE 101", "BMB", "Kütüphane" deneyin)
                  </div>
                ) : (
                  searchResults.map((item, idx) => (
                    <button
                      key={`${item.building_id}-${item.title}-${idx}`}
                      type="button"
                      onClick={() => onSelectSearchResult(item)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-800/90 transition flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          {item.result_type === 'course' && '📚 '}
                          {item.result_type === 'building' && '🏛️ '}
                          {item.result_type === 'classroom' && '🪑 '}
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                      </div>
                      <span className="text-[11px] font-bold text-sky-400 shrink-0">
                        Rotayı Çiz →
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenMarmaray}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
              title="GTÜ - Fatih Marmaray İstasyonu Tren Saatleri ve Yürüyüş Hesabı"
            >
              🚆 Marmaray
            </button>

            <button
              type="button"
              onClick={onOpenAlertModal}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
              title="Haritaya Anlık Saha Uyarısı Bırak"
            >
              ⚠️ Saha Uyarısı
            </button>

            <button
              type="button"
              onClick={onOpenWrittenTicketModal}
              className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold transition"
              title="Yerel Türkçe NLP Yapay Zekâ Destekli Yazılı Arıza Bildirimi"
            >
              📝 AI Bildirim
            </button>

            {isAdmin ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleAdminDrawer}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                    isAdminDrawerOpen
                      ? 'bg-purple-500 text-slate-950 border-purple-300'
                      : 'bg-purple-500/20 text-purple-200 border-purple-400/50 hover:bg-purple-500/30'
                  }`}
                >
                  🛠️ LiveOps
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchRole('student')}
                  className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition"
                  title="Yönetici oturumunu kapat"
                >
                  Çıkış
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClearAuthError();
                  setIsAdminModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950/70 text-slate-200 hover:text-purple-200 border border-slate-700 text-xs font-bold transition"
                title={`${user.email} • Yönetici Girişi`}
              >
                🛡️ Yönetici
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Lightweight Floating Filter Chips (Does NOT block map background) */}
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-1.5 px-1">
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🗺️ Tüm Binalar
            </button>
            <button
              type="button"
              onClick={() =>
                onFilterChange(activeFilter === 'academic' ? 'all' : 'academic')
              }
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition ${
                activeFilter === 'academic'
                  ? 'bg-sky-400 text-slate-950 border-sky-300'
                  : 'bg-slate-900/90 text-sky-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🏛️ Akademik
            </button>
            <button
              type="button"
              onClick={() =>
                onFilterChange(activeFilter === 'free_rooms' ? 'all' : 'free_rooms')
              }
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition ${
                activeFilter === 'free_rooms'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                  : 'bg-slate-900/90 text-emerald-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🟢 Boş Amfiler
            </button>
            <button
              type="button"
              onClick={() =>
                onFilterChange(activeFilter === 'dining_library' ? 'all' : 'dining_library')
              }
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition ${
                activeFilter === 'dining_library'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900/90 text-amber-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🍽️ Yemek & Kütüphane
            </button>

            {onTogglePickUserStart && (
              <button
                type="button"
                onClick={onTogglePickUserStart}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition ${
                  isPickingUserStart
                    ? 'bg-sky-500 text-slate-950 border-white ring-2 ring-sky-300'
                    : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40 hover:bg-slate-800'
                }`}
                title="Haritada herhangi bir noktaya tıklayarak başlangıç konumunuzu taşıyın ve Snap-to-Path mıknatıslanmasını test edin"
              >
                {isPickingUserStart ? '🎯 Haritada Nokta Seçiliyor...' : '📍 Konumumu Haritadan Seç'}
              </button>
            )}
          </div>

          {/* Compact Announcement Pill if active */}
          {announcements.length > 0 && (
            <div className="pointer-events-auto">
              {announcements.slice(0, 1).map((ann) => (
                <div
                  key={ann.id}
                  className="px-3 py-1 rounded-full bg-amber-950/95 border border-amber-500/50 text-amber-200 text-[11px] font-semibold shadow-lg flex items-center gap-1.5 max-w-md truncate"
                >
                  <span className="font-extrabold text-amber-400">📢 Duyuru:</span>
                  <span className="font-bold">{ann.title}</span>
                  <span className="text-amber-200/80 truncate">— {ann.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Encrypted Admin Login Modal (X-Admin-Key) */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                  🔒 X-Admin-Key Yetki Doğrulaması
                </span>
                <h2 className="text-base font-extrabold text-white mt-0.5">
                  🛡️ GTÜ LiveOps Komuta Merkezi Girişi
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 font-semibold">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Yönetici Gizli Anahtarı (`ADMIN_SECRET_KEY`)
                </label>
                <input
                  type="password"
                  required
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="Yönetici anahtarını giriniz..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-purple-400 rounded-xl px-3.5 py-2 text-slate-100 outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between gap-2">
                <div className="text-[11px] text-purple-200">
                  🏆 <strong>Jüri / Demo Değerlendirme Kolaylığı:</strong> Varsayılan yönetici anahtarını tek tıkla doldurabilirsiniz.
                </div>
                <button
                  type="button"
                  onClick={() => setAdminKeyInput(DEFAULT_DEMO_ADMIN_KEY)}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-400/40 font-bold shrink-0"
                >
                  🔑 Demo Anahtarı Doldur
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingKey}
                  className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-extrabold transition"
                >
                  {isVerifyingKey ? 'Doğrulanıyor...' : '🔓 LiveOps Merkezini Aç'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
