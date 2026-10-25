import React from 'react';
import {
  CampusAnnouncement,
  SearchResultItem,
  UserSession,
} from '../../types/campus';

interface TopNavigationBarProps {
  user: UserSession;
  isAdmin: boolean;
  onSwitchRole: (role: 'student' | 'admin') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SearchResultItem[];
  onSelectSearchResult: (item: SearchResultItem) => void;
  announcements: CampusAnnouncement[];
  onOpenMarmaray: () => void;
  onOpenAlertModal: () => void;
  onOpenWrittenTicketModal: () => void;
  onToggleAdminDrawer: () => void;
  isAdminDrawerOpen: boolean;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  user,
  isAdmin,
  onSwitchRole,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult,
  announcements,
  onOpenMarmaray,
  onOpenAlertModal,
  onOpenWrittenTicketModal,
  onToggleAdminDrawer,
  isAdminDrawerOpen,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none p-3 space-y-2">
      {/* Live Campus Announcements Banner */}
      {announcements.length > 0 && (
        <div className="pointer-events-auto max-w-5xl mx-auto">
          {announcements.slice(0, 1).map((ann) => {
            const bg =
              ann.severity === 'urgent'
                ? 'bg-rose-950/95 border-rose-500/60 text-rose-100'
                : ann.severity === 'warning'
                ? 'bg-amber-950/95 border-amber-500/60 text-amber-100'
                : 'bg-sky-950/95 border-sky-500/60 text-sky-100';
            return (
              <div
                key={ann.id}
                className={`px-4 py-2 rounded-xl border shadow-lg flex items-center justify-between gap-3 text-xs backdrop-blur-md ${bg}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-black/30">
                    📢 Canlı Duyuru
                  </span>
                  <span className="font-bold">{ann.title}:</span>
                  <span>{ann.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Top Navigation Bar */}
      <div className="pointer-events-auto max-w-7xl mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-md text-sm">
            GTÜ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                GTÜ-NAV
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                Yaya & Boş Amfi Radarı
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Gebze Teknik Üniversitesi Çayırova Kampüsü Akıllı Navigasyon
            </p>
          </div>
        </div>

        {/* Course Code / Classroom / Building Omnibox Search */}
        <div className="relative flex-1 min-w-[230px] max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Ders kodu (CSE 101, MATH 101), amfi veya bina ara..."
            className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 outline-none transition"
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
                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 transition flex items-center justify-between gap-2"
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

        {/* Action Buttons & Role Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenMarmaray}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
          >
            🚆 GTÜ-Fatih Marmaray
          </button>

          <button
            type="button"
            onClick={onOpenAlertModal}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
          >
            ⚠️ Saha Uyarısı Bırak
          </button>

          <button
            type="button"
            onClick={onOpenWrittenTicketModal}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold transition"
          >
            📝 İdareye Yazılı Bildirim (AI)
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onToggleAdminDrawer}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                isAdminDrawerOpen
                  ? 'bg-purple-500 text-slate-950 border-purple-300'
                  : 'bg-purple-500/20 text-purple-200 border-purple-400/50 hover:bg-purple-500/30'
              }`}
            >
              🛠️ LiveOps Komuta Merkezi
            </button>
          )}

          {/* Demo Student / Admin Quick Switch */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => onSwitchRole('student')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                !isAdmin ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title={user.email}
            >
              🎓 Öğrenci
            </button>
            <button
              type="button"
              onClick={() => onSwitchRole('admin')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                isAdmin ? 'bg-purple-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title="Kampüs LiveOps Yöneticisi"
            >
              🛡️ Admin
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
