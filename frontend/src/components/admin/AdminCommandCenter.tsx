import React, { useState, useEffect, useCallback } from 'react';
import {
  Building,
  CampusAnnouncement,
  WrittenTicket,
} from '../../types/campus';
import { api } from '../../services/apiClient';
import { AdminMapInteractionMode } from '../map/CampusMap3D';
import { SurfaceCard, StatusBadge } from '../ui/Primitives';

interface AdminCommandCenterProps {
  isOpen: boolean;
  buildings: Building[];
  blockedEdgeIds: string[];
  announcements: CampusAnnouncement[];
  adminMapMode: AdminMapInteractionMode;
  selectedBuildingId: string | null;
  pickedCoords: { lat: number; lon: number } | null;
  drawnEdgePoints: { lat: number; lon: number }[];
  onSetAdminMapMode: (mode: AdminMapInteractionMode) => void;
  onClearDrawnEdgePoints: () => void;
  onToggleEdgeBlocked: (edgeId: string, closed: boolean, reason?: string) => Promise<void>;
  onAddOrUpdateBuilding: (payload: {
    id: string;
    code: string;
    name: string;
    category: string;
    floors_count: number;
    lat: number;
    lon: number;
  }) => Promise<void>;
  onAddWalkwayEdge: (payload: {
    from_lat: number;
    from_lon: number;
    to_lat: number;
    to_lon: number;
    name: string;
  }) => Promise<void>;
  onPublishAnnouncement: (payload: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'urgent';
  }) => Promise<void>;
  onRemoveAnnouncement: (id: number) => Promise<void>;
  onClose: () => void;
}

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  isOpen,
  buildings,
  blockedEdgeIds,
  announcements,
  adminMapMode,
  selectedBuildingId,
  pickedCoords,
  drawnEdgePoints,
  onSetAdminMapMode,
  onClearDrawnEdgePoints,
  onToggleEdgeBlocked,
  onAddOrUpdateBuilding,
  onAddWalkwayEdge,
  onPublishAnnouncement,
  onRemoveAnnouncement,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'map_ops' | 'announcements'>('tickets');
  const [tickets, setTickets] = useState<WrittenTicket[]>([]);
  const [hideSpam, setHideSpam] = useState<boolean>(true);

  // New building form state
  const [newBldCode, setNewBldCode] = useState<string>('');
  const [newBldName, setNewBldName] = useState<string>('');
  const [newBldCategory, setNewBldCategory] = useState<string>('academic');
  const [newBldFloors, setNewBldFloors] = useState<number>(3);
  const [newEdgeName, setNewEdgeName] = useState<string>('Yeni Kampüs Yürüyüş Yolu');

  // Announcement form state
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annMessage, setAnnMessage] = useState<string>('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'urgent'>('warning');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const list = await api.listWrittenTickets();
      setTickets(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTickets();
    }
  }, [isOpen, loadTickets]);

  if (!isOpen) return null;

  const visibleTickets = hideSpam ? tickets.filter((t) => !t.ai_is_spam) : tickets;
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) || null;

  const handleTicketStatus = async (
    ticketId: number,
    status: 'pending' | 'in_progress' | 'resolved' | 'rejected'
  ) => {
    await api.updateWrittenTicketStatus(ticketId, status);
    await loadTickets();
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedCoords) {
      setStatusMessage('Lütfen önce haritadan/uydudan yeni binanın konumuna tıklayın.');
      return;
    }
    const cleanId = `b_${newBldCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-3)}`;
    await onAddOrUpdateBuilding({
      id: cleanId,
      code: newBldCode.toUpperCase(),
      name: newBldName,
      category: newBldCategory,
      floors_count: newBldFloors,
      lat: pickedCoords.lat,
      lon: pickedCoords.lon,
    });
    setNewBldCode('');
    setNewBldName('');
    onSetAdminMapMode('none');
    setStatusMessage('✅ Yeni bina haritaya eklendi ve en yakın yürüyüş düğümüne bağlandı!');
  };

  const handleSaveDrawnEdge = async () => {
    if (drawnEdgePoints.length < 2) return;
    const p1 = drawnEdgePoints[0];
    const p2 = drawnEdgePoints[1];
    await onAddWalkwayEdge({
      from_lat: p1.lat,
      from_lon: p1.lon,
      to_lat: p2.lat,
      to_lon: p2.lon,
      name: newEdgeName || 'Kampüs Yürüyüş Yolu',
    });
    onClearDrawnEdgePoints();
    onSetAdminMapMode('none');
    setStatusMessage('✅ Yeni yürüyüş yolu grafiğe eklendi ve A* rotalamaya dahil edildi!');
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await onPublishAnnouncement({
      title: annTitle,
      message: annMessage,
      severity: annSeverity,
    });
    setAnnTitle('');
    setAnnMessage('');
    setStatusMessage('📢 Canlı kampüs duyurusu üst barda yayınlandı!');
  };

  return (
    <aside className="absolute top-24 left-3 bottom-16 w-full max-w-lg z-20 pointer-events-auto flex flex-col">
      <SurfaceCard className="flex-1 flex flex-col overflow-hidden border-purple-500/40">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-purple-950/30">
          <div>
            <StatusBadge variant="purple">🛡️ GTÜ LiveOps Komuta Merkezi</StatusBadge>
            <h2 className="text-sm font-extrabold text-white mt-1">
              Canlı Harita Müdahale & AI Ticket Triyaj Paneli
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              onSetAdminMapMode('none');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`py-1.5 px-2 rounded-lg font-bold transition ${
              activeTab === 'tickets'
                ? 'bg-purple-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            🤖 AI Ticket ({visibleTickets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map_ops')}
            className={`py-1.5 px-2 rounded-lg font-bold transition ${
              activeTab === 'map_ops'
                ? 'bg-purple-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            🗺️ Harita / Bina / Kapı
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`py-1.5 px-2 rounded-lg font-bold transition ${
              activeTab === 'announcements'
                ? 'bg-purple-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            📢 Canlı Duyuru
          </button>
        </div>

        {statusMessage && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
          {activeTab === 'tickets' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">
                  AI Aciliyet Skoruna Göre Sıralı Talepler
                </span>
                <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideSpam}
                    onChange={(e) => setHideSpam(e.target.checked)}
                  />
                  <span>Spamları Gizle</span>
                </label>
              </div>

              {visibleTickets.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Henüz yazılı bildirim bulunmuyor.
                </div>
              ) : (
                visibleTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{t.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{t.description}</div>
                      </div>
                      <StatusBadge
                        variant={
                          t.ai_urgency_score >= 75
                            ? 'rose'
                            : t.ai_urgency_score >= 50
                            ? 'amber'
                            : 'sky'
                        }
                      >
                        ⚡ {t.ai_urgency_score}/100
                      </StatusBadge>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
                      <span className="text-[11px] font-semibold text-purple-300">
                        🏢 {t.ai_department}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleTicketStatus(t.id, 'in_progress')}
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            t.status === 'in_progress'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          İşlemde
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTicketStatus(t.id, 'resolved')}
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            t.status === 'resolved'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Çözüldü
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'map_ops' && (
            <div className="space-y-3.5">
              {/* 1. Walkway Closure Toggle */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-amber-300">
                  🚧 1. Yürüyüş Yolu Kapat / Aç (A* Otomatik Yeniden Rotalama)
                </div>
                <p className="text-[11px] text-slate-400">
                  Modu aktif edip haritadaki herhangi bir turuncu yürüyüş yoluna tıklayarak yolu kapatabilir veya açabilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onSetAdminMapMode(adminMapMode === 'toggle_edge' ? 'none' : 'toggle_edge')
                  }
                  className={`w-full py-2 px-3 rounded-xl font-bold transition ${
                    adminMapMode === 'toggle_edge'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {adminMapMode === 'toggle_edge'
                    ? '🟢 Yol Seçim Modu Aktif (Kapatmak İçin Tıklayın)'
                    : '🚧 Haritada Yürüyüş Yolu Kapatma Modunu Aç'}
                </button>

                {blockedEdgeIds.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <div className="text-[11px] font-semibold text-rose-300">
                      Şu An Kapalı Yürüyüş Yolları ({blockedEdgeIds.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blockedEdgeIds.map((eid) => (
                        <button
                          key={eid}
                          type="button"
                          onClick={() => onToggleEdgeBlocked(eid, false)}
                          className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-200 text-[11px] hover:bg-rose-900"
                        >
                          ⛔ {eid} (Aç ✕)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Building Entrance Relocation */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-300">
                  🚪 2. Bina Giriş Kapısı Konumunu Düzenle
                </div>
                <p className="text-[11px] text-slate-400">
                  Seçili Bina:{' '}
                  <strong className="text-white">
                    {selectedBuilding
                      ? `${selectedBuilding.code} — ${selectedBuilding.name}`
                      : 'Lütfen haritadan bir binaya tıklayın'}
                  </strong>
                </p>
                <button
                  type="button"
                  disabled={!selectedBuilding}
                  onClick={() =>
                    onSetAdminMapMode(adminMapMode === 'move_entrance' ? 'none' : 'move_entrance')
                  }
                  className={`w-full py-2 px-3 rounded-xl font-bold transition ${
                    adminMapMode === 'move_entrance'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40'
                  }`}
                >
                  {adminMapMode === 'move_entrance'
                    ? '🟢 Haritada Yeni Giriş Noktasına Tıklayın...'
                    : '🚪 Seçili Binanın Giriş Kapısını Haritada Taşı'}
                </button>
              </div>

              {/* 3. Add Missing Building on Satellite / Map */}
              <form
                onSubmit={handleCreateBuilding}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
              >
                <div className="font-bold text-sky-300">
                  🏛️ 3. Haritaya / Uyduya Eksik Kampüs Binası Ekle
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newBldCode}
                    onChange={(e) => setNewBldCode(e.target.value)}
                    placeholder="Bina Kodu (Örn: LAB-2)"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <select
                    value={newBldCategory}
                    onChange={(e) => setNewBldCategory(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="academic">Akademik / Bölüm</option>
                    <option value="dining">Sosyal / Yemekhane</option>
                    <option value="admin">İdari Bina</option>
                    <option value="library">Kütüphane / Merkez</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={newBldName}
                  onChange={(e) => setNewBldName(e.target.value)}
                  placeholder="Bina Tam Adı (Örn: İleri Araştırma Laboratuvarı)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSetAdminMapMode(adminMapMode === 'add_building' ? 'none' : 'add_building')
                    }
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold border ${
                      adminMapMode === 'add_building'
                        ? 'bg-sky-500 text-slate-950 border-sky-300'
                        : 'bg-slate-900 text-sky-300 border-slate-700'
                    }`}
                  >
                    {pickedCoords
                      ? `📍 ${pickedCoords.lat.toFixed(5)}, ${pickedCoords.lon.toFixed(5)}`
                      : '🗺️ Haritadan Konum Seç'}
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newBldFloors}
                    onChange={(e) => setNewBldFloors(Number(e.target.value))}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                    title="Kat Sayısı"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold"
                  >
                    Kaydet
                  </button>
                </div>
              </form>

              {/* 4. Draw New Walkway Path */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-300">
                  📏 4. Yeni Yürüyüş Patikası / Kaldırım Çiz
                </div>
                <input
                  type="text"
                  value={newEdgeName}
                  onChange={(e) => setNewEdgeName(e.target.value)}
                  placeholder="Yol Adı"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearDrawnEdgePoints();
                      onSetAdminMapMode(adminMapMode === 'draw_edge' ? 'none' : 'draw_edge');
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold ${
                      adminMapMode === 'draw_edge'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {adminMapMode === 'draw_edge'
                      ? `Haritada 2 Noktaya Tıklayın (${drawnEdgePoints.length}/2)`
                      : '✏️ Patika Çizim Modunu Başlat'}
                  </button>
                  {drawnEdgePoints.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleSaveDrawnEdge}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold"
                    >
                      Yolu Ekle
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <form
                onSubmit={handleCreateAnnouncement}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
              >
                <div className="font-bold text-white">📢 Yeni Kampüs Geneli Canlı Duyuru</div>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Başlık (Örn: Ring Seferi / Kütüphane 24 Saat Açık)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
                <textarea
                  required
                  rows={2}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Duyuru metni..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={annSeverity}
                    onChange={(e) =>
                      setAnnSeverity(e.target.value as 'info' | 'warning' | 'urgent')
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="info">Bilgi (Mavi)</option>
                    <option value="warning">Uyarı (Kehribar)</option>
                    <option value="urgent">Acil (Kırmızı)</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-extrabold"
                  >
                    Yayınla
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-white">{a.title}</div>
                      <div className="text-[11px] text-slate-400">{a.message}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAnnouncement(a.id)}
                      className="px-2 py-1 rounded bg-rose-950 text-rose-300 text-[11px] font-bold"
                    >
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SurfaceCard>
    </aside>
  );
};
