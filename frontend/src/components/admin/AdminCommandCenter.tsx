import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Map,
  Megaphone,
  X,
  CheckCircle2,
  Trash2,
  Building2,
  DoorClosed,
  Plus,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Send,
  Info,
} from 'lucide-react';
import {
  Building,
  CampusAnnouncement,
  MapAlert,
} from '../../types/campus';
import { useTickets } from '../../hooks/useTickets';
import { AdminMapInteractionMode } from '../map/CampusMap3D';
import {
  TactileCard,
  TactileButton,
  TactileIconButton,
  StatusBadge,
} from '../ui/Primitives';

interface AdminCommandCenterProps {
  isOpen: boolean;
  buildings: Building[];
  activeAlerts: MapAlert[];
  blockedEdgeIds: string[];
  announcements: CampusAnnouncement[];
  adminMapMode: AdminMapInteractionMode;
  selectedBuildingId: string | null;
  pickedCoords: { lat: number; lon: number } | null;
  pickedEntranceCoords?: { lat: number; lon: number } | null;
  pickedSecondaryEntranceCoords?: { lat: number; lon: number } | null;
  activeEntrancePickerSlot?: 1 | 2;
  onSetActiveEntrancePickerSlot?: (slot: 1 | 2) => void;
  selectedFootprints?: { osm_way_id: number; name: string; coords: number[][] }[];
  onClearSelectedFootprints?: () => void;
  onClearPickedEntranceCoords?: () => void;
  onClearPickedSecondaryEntranceCoords?: () => void;
  drawnEdgePoints: { lat: number; lon: number }[];
  onSetAdminMapMode: (mode: AdminMapInteractionMode) => void;
  onClearDrawnEdgePoints: () => void;
  onToggleEdgeBlocked: (edgeId: string, closed: boolean, reason?: string) => Promise<void>;
  onDeleteAlert: (alertId: number) => Promise<void>;
  onAddOrUpdateBuilding: (payload: {
    id: string;
    code: string;
    name: string;
    category: string;
    floors_count: number;
    lat: number;
    lon: number;
    entrance_lat?: number;
    entrance_lon?: number;
    entrance_name?: string;
    secondary_entrance_lat?: number;
    secondary_entrance_lon?: number;
    secondary_entrance_name?: string;
    polygon_coords?: any;
    osm_way_ids?: number[];
    description?: string;
  }) => Promise<void>;
  onDeleteBuilding: (buildingId: string) => Promise<void>;
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
  activeAlerts,
  blockedEdgeIds,
  announcements,
  adminMapMode,
  selectedBuildingId,
  pickedCoords,
  pickedEntranceCoords = null,
  pickedSecondaryEntranceCoords = null,
  activeEntrancePickerSlot = 1,
  onSetActiveEntrancePickerSlot,
  selectedFootprints = [],
  onClearSelectedFootprints,
  onClearPickedEntranceCoords,
  onClearPickedSecondaryEntranceCoords,
  drawnEdgePoints,
  onSetAdminMapMode,
  onClearDrawnEdgePoints,
  onToggleEdgeBlocked,
  onDeleteAlert,
  onAddOrUpdateBuilding,
  onDeleteBuilding,
  onAddWalkwayEdge,
  onPublishAnnouncement,
  onRemoveAnnouncement,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'map_ops' | 'announcements'>('map_ops');
  const [hideSpam, setHideSpam] = useState<boolean>(true);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  const { tickets, refreshTickets, updateTicketStatus } = useTickets();

  // New building form & 3-Step Wizard state
  const [bldWizardStep, setBldWizardStep] = useState<1 | 2 | 3>(1);
  const [newBldCode, setNewBldCode] = useState<string>('');
  const [newBldName, setNewBldName] = useState<string>('');
  const [newBldCategory, setNewBldCategory] = useState<string>('academic');
  const [newBldFloors, setNewBldFloors] = useState<number>(3);
  const [newEntranceName, setNewEntranceName] = useState<string>('Ana Giriş Kapısı');
  const [newSecondaryEntranceName, setNewSecondaryEntranceName] = useState<string>('2. Giriş Kapısı');
  const [newEdgeName, setNewEdgeName] = useState<string>('Yeni Kampüs Yürüyüş Yolu');

  // Auto-switch to Map/Building tab and appropriate step when footprints are clicked on the map
  useEffect(() => {
    if (selectedFootprints.length > 0 || adminMapMode === 'add_building' || adminMapMode === 'pick_building_entrance') {
      setActiveTab('map_ops');
    }
  }, [selectedFootprints.length, adminMapMode]);

  // Auto-fill suggested name from selected footprint
  useEffect(() => {
    if (selectedFootprints.length > 0 && !newBldName) {
      const candidate = selectedFootprints[0].name;
      if (candidate && !candidate.startsWith('Kampüs Ek Bina')) {
        setNewBldName(candidate);
      }
    }
  }, [selectedFootprints, newBldName]);

  // Selected building edit state
  const [editBldName, setEditBldName] = useState<string>('');
  const [editEntranceName, setEditEntranceName] = useState<string>('');
  const [editBldFloors, setEditBldFloors] = useState<number>(3);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annMessage, setAnnMessage] = useState<string>('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'urgent'>('warning');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) || null;

  useEffect(() => {
    if (isOpen) {
      refreshTickets();
    }
  }, [isOpen, refreshTickets]);

  useEffect(() => {
    if (selectedBuilding) {
      setEditBldName(selectedBuilding.name);
      setEditEntranceName(selectedBuilding.entrance_name);
      setEditBldFloors(selectedBuilding.floors_count);
    }
  }, [selectedBuilding]);

  if (!isOpen) return null;

  // Auto-hide drawer when user needs unobstructed map access
  const isWaitingForMapClick =
    adminMapMode === 'move_entrance' ||
    adminMapMode === 'add_building' ||
    adminMapMode === 'pick_building_entrance' ||
    adminMapMode === 'pick_alert_coords' ||
    (adminMapMode === 'draw_edge' && drawnEdgePoints.length < 2);

  const visibleTickets = hideSpam ? tickets.filter((t) => !t.ai_is_spam) : tickets;

  const handleTicketStatus = async (
    ticketId: number,
    status: 'pending' | 'in_progress' | 'resolved' | 'rejected'
  ) => {
    const note = adminNotes[ticketId];
    await updateTicketStatus(ticketId, status, note);
    setStatusMessage(`Ticket #${ticketId} durumu (${status}) güncellendi.`);
  };

  const handleUpdateSelectedBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) return;
    await onAddOrUpdateBuilding({
      id: selectedBuilding.id,
      code: selectedBuilding.code,
      name: editBldName.trim() || selectedBuilding.name,
      category: selectedBuilding.category,
      floors_count: editBldFloors,
      lat: selectedBuilding.lat,
      lon: selectedBuilding.lon,
      entrance_lat: selectedBuilding.entrance_lat,
      entrance_lon: selectedBuilding.entrance_lon,
      entrance_name: editEntranceName.trim() || selectedBuilding.entrance_name,
      polygon_coords: selectedBuilding.polygon_coords,
      description: selectedBuilding.description || undefined,
    });
    setStatusMessage(`${selectedBuilding.code} bina bilgisi kalıcı kaydedildi.`);
  };

  const handleDeleteSelectedBuilding = async () => {
    if (!selectedBuilding) return;
    await onDeleteBuilding(selectedBuilding.id);
    setStatusMessage(`${selectedBuilding.code} binası haritadan kaldırıldı.`);
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedCoords && selectedFootprints.length === 0) {
      setStatusMessage('Lütfen önce haritadan en az bir bina ayak izi seçin veya araziye tıklayın.');
      return;
    }

    let bLat = 0;
    let bLon = 0;
    let polyCoords: any = null;

    if (selectedFootprints.length > 0) {
      if (selectedFootprints.length === 1) {
        polyCoords = [selectedFootprints[0].coords];
      } else {
        // Multi-part facility (multiple polygons)
        polyCoords = selectedFootprints.map((fp) => [fp.coords]);
      }
      const allPoints = selectedFootprints.flatMap((fp) => fp.coords);
      bLon = allPoints.reduce((acc, p) => acc + p[0], 0) / allPoints.length;
      bLat = allPoints.reduce((acc, p) => acc + p[1], 0) / allPoints.length;
    } else if (pickedCoords) {
      bLat = pickedCoords.lat;
      bLon = pickedCoords.lon;
    }

    const cleanId = `b_${newBldCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-3)}`;
    await onAddOrUpdateBuilding({
      id: cleanId,
      code: newBldCode.toUpperCase(),
      name: newBldName,
      category: newBldCategory,
      floors_count: newBldFloors,
      lat: Number(bLat.toFixed(6)),
      lon: Number(bLon.toFixed(6)),
      entrance_lat: pickedEntranceCoords ? pickedEntranceCoords.lat : undefined,
      entrance_lon: pickedEntranceCoords ? pickedEntranceCoords.lon : undefined,
      entrance_name: newEntranceName || `${newBldCode.toUpperCase()} Ana Giriş Kapısı`,
      secondary_entrance_lat: pickedSecondaryEntranceCoords ? pickedSecondaryEntranceCoords.lat : undefined,
      secondary_entrance_lon: pickedSecondaryEntranceCoords ? pickedSecondaryEntranceCoords.lon : undefined,
      secondary_entrance_name: pickedSecondaryEntranceCoords
        ? newSecondaryEntranceName || `${newBldCode.toUpperCase()} 2. Giriş Kapısı`
        : undefined,
      polygon_coords: polyCoords,
      osm_way_ids: selectedFootprints.length > 0 ? selectedFootprints.map((fp) => fp.osm_way_id) : undefined,
    });

    setNewBldCode('');
    setNewBldName('');
    setBldWizardStep(1);
    onClearSelectedFootprints?.();
    onClearPickedEntranceCoords?.();
    onClearPickedSecondaryEntranceCoords?.();
    onSetAdminMapMode('none');
    setStatusMessage(`Yeni kampüs binası (${newBldCode.toUpperCase()}) başarıyla eklendi ve JSON'a senkronize edildi.`);
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
    setStatusMessage('Yeni yürüyüş yolu graf ve A* rotalamaya eklendi.');
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
    setStatusMessage('Canlı duyuru yayınlandı.');
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 md:inset-auto md:top-24 md:left-4 md:bottom-6 z-40 pointer-events-none flex flex-col justify-end md:justify-start p-2 sm:p-3 md:p-0 animate-sheet-left ${
        isWaitingForMapClick ? 'hidden md:flex' : 'flex'
      }`}
    >
      <aside className="w-full md:w-[420px] max-h-[82dvh] md:max-h-full flex flex-col pointer-events-auto">
        <TactileCard className="flex-1 flex flex-col overflow-hidden p-0 border border-zinc-300 dark:border-white/10 shadow-hard-lg dark:shadow-hard-night-lg bg-white dark:bg-[#1A1D27] rounded-[24px]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b-2 border-zinc-950 flex items-start justify-between gap-3 bg-purple-50 dark:bg-purple-950/40">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge
                variant="purple"
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
              >
                GTÜ LiveOps Komuta Merkezi
              </StatusBadge>
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-300 border border-zinc-950 font-black">
                Kalıcı JSON Senkronize
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 mt-1">
              Canlı Harita Müdahale & AI Triyaj
            </h2>
          </div>
          <TactileIconButton
            size="sm"
            variant="ghost"
            label="Kapat"
            onClick={() => {
              onSetAdminMapMode('none');
              onClose();
            }}
          >
            <X className="w-4 h-4" />
          </TactileIconButton>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-zinc-100 dark:bg-zinc-950 border-b-2 border-zinc-950 text-xs">
          <TactileButton
            size="sm"
            variant={activeTab === 'tickets' ? 'primary' : 'ghost'}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab('tickets')}
          >
            Talepler ({visibleTickets.length})
          </TactileButton>

          <TactileButton
            size="sm"
            variant={activeTab === 'map_ops' ? 'accent' : 'ghost'}
            icon={<Map className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab('map_ops')}
          >
            Harita/Bina
          </TactileButton>

          <TactileButton
            size="sm"
            variant={activeTab === 'announcements' ? 'warning' : 'ghost'}
            icon={<Megaphone className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab('announcements')}
          >
            Duyuru
          </TactileButton>
        </div>

        {statusMessage && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border-2 border-zinc-950 text-emerald-900 dark:text-emerald-200 text-xs font-black shadow-hard-sm flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs font-black px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
          {activeTab === 'tickets' && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-black text-zinc-700 dark:text-zinc-300">
                  AI Aciliyet Skoruna Göre Sıralı
                </span>
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideSpam}
                    onChange={(e) => setHideSpam(e.target.checked)}
                    className="rounded border-zinc-400 accent-purple-600"
                  />
                  <span>Spamları Gizle</span>
                </label>
              </div>

              {visibleTickets.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 font-bold">
                  Henüz yazılı bildirim kaydı bulunmuyor.
                </div>
              ) : (
                visibleTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-zinc-900 dark:text-zinc-100">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {t.description}
                        </div>
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

                    {/* Admin Response Note Input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={adminNotes[t.id] ?? (t.admin_note || '')}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        placeholder="Öğrenciye yanıt notu yazın (Örn: Teknik ekip yönlendirildi)..."
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-[11px] text-zinc-900 dark:text-zinc-100 font-semibold outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] font-black text-purple-700 dark:text-purple-300">
                        {t.ai_department}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleTicketStatus(t.id, 'in_progress')}
                          className={`px-2 py-0.5 rounded-lg border border-zinc-950 font-black text-[11px] ${
                            t.status === 'in_progress'
                              ? 'bg-amber-400 text-zinc-950'
                              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          İnceleniyor
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTicketStatus(t.id, 'resolved')}
                          className={`px-2 py-0.5 rounded-lg border border-zinc-950 font-black text-[11px] ${
                            t.status === 'resolved'
                              ? 'bg-emerald-400 text-zinc-950'
                              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          Çözüldü
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTicketStatus(t.id, 'rejected')}
                          className={`px-2 py-0.5 rounded-lg border border-zinc-950 font-black text-[11px] ${
                            t.status === 'rejected'
                              ? 'bg-rose-500 text-white'
                              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          Reddet
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
              {/* 1. STEP-BY-STEP PERSISTENT BUILDING CREATION WIZARD */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-sky-800 dark:text-sky-300 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
                    <span>Adım Adım Yeni Bina Ekle</span>
                  </div>
                  {(selectedFootprints.length > 0 || pickedCoords || pickedEntranceCoords) && (
                    <button
                      type="button"
                      onClick={() => {
                        setBldWizardStep(1);
                        onClearSelectedFootprints?.();
                        onClearPickedEntranceCoords?.();
                        onClearPickedSecondaryEntranceCoords?.();
                        onSetAdminMapMode('none');
                      }}
                      className="text-[11px] font-black text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>

                {/* 3-Step Visual Stepper Header */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setBldWizardStep(1);
                      onSetAdminMapMode('add_building');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition flex items-center justify-center gap-1 ${
                      bldWizardStep === 1
                        ? 'bg-sky-400 text-zinc-950 border border-zinc-950 shadow-sm'
                        : selectedFootprints.length > 0 || pickedCoords
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    <span>1. Bina Seç</span>
                    {(selectedFootprints.length > 0 || pickedCoords) && bldWizardStep !== 1 && (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={selectedFootprints.length === 0 && !pickedCoords}
                    onClick={() => {
                      setBldWizardStep(2);
                      onSetActiveEntrancePickerSlot?.(1);
                      onSetAdminMapMode('pick_building_entrance');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition flex items-center justify-center gap-1 disabled:opacity-40 ${
                      bldWizardStep === 2
                        ? 'bg-sky-400 text-zinc-950 border border-zinc-950 shadow-sm'
                        : pickedEntranceCoords
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    <span>2. Kapılar</span>
                    {pickedEntranceCoords && bldWizardStep !== 2 && (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={selectedFootprints.length === 0 && !pickedCoords}
                    onClick={() => {
                      setBldWizardStep(3);
                      onSetAdminMapMode('none');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition flex items-center justify-center gap-1 disabled:opacity-40 ${
                      bldWizardStep === 3
                        ? 'bg-sky-400 text-zinc-950 border border-zinc-950 shadow-sm'
                        : 'text-zinc-500'
                    }`}
                  >
                    <span>3. Bilgiler</span>
                  </button>
                </div>

                {/* STEP 1: FOOTPRINT & BLOCK SELECTION */}
                {bldWizardStep === 1 && (
                  <div className="space-y-2.5 pt-0.5">
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
                      Haritadaki binalara tıklayarak 1 veya birden fazla bina bloğu seçin. Bu panel açık kalır; seçtiğiniz bloklar anında aşağıya eklenir.
                    </p>

                    <TactileButton
                      type="button"
                      size="sm"
                      variant={adminMapMode === 'add_building' ? 'accent' : 'secondary'}
                      onClick={() =>
                        onSetAdminMapMode(adminMapMode === 'add_building' ? 'none' : 'add_building')
                      }
                      className="w-full justify-center"
                    >
                      {adminMapMode === 'add_building'
                        ? '🟢 Haritada Bina Seçim Modu Aktif (Bloklara Tıklayın)'
                        : 'Haritada Bina Bloğu Seçimini Başlat'}
                    </TactileButton>

                    {selectedFootprints.length > 0 ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500/50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{selectedFootprints.length} Bina Bloğu Seçildi</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onClearSelectedFootprints?.()}
                            className="text-[10px] font-black text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Seçimi Temizle
                          </button>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
                          {selectedFootprints.map((fp) => `${fp.name} (#${fp.osm_way_id})`).join(' • ')}
                        </div>
                      </div>
                    ) : pickedCoords ? (
                      <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-400/50 text-xs font-bold text-sky-800 dark:text-sky-300">
                        📍 Özel Arazi Konumu Seçildi: {pickedCoords.lat.toFixed(5)}, {pickedCoords.lon.toFixed(5)}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-950/60 border border-dashed border-zinc-300 dark:border-zinc-700 text-[11px] font-bold text-zinc-500 text-center">
                        Henüz bina bloğu seçilmedi. Haritadan bir binaya tıklayın.
                      </div>
                    )}

                    <TactileButton
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={selectedFootprints.length === 0 && !pickedCoords}
                      onClick={() => {
                        setBldWizardStep(2);
                        onSetActiveEntrancePickerSlot?.(1);
                        onSetAdminMapMode('pick_building_entrance');
                      }}
                      className="w-full justify-center"
                    >
                      2. Adıma Geç: Giriş Kapılarını Seç →
                    </TactileButton>
                  </div>
                )}

                {/* STEP 2: 1st & OPTIONAL 2nd ENTRANCE PIN SELECTION */}
                {bldWizardStep === 2 && (
                  <div className="space-y-2.5 pt-0.5">
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
                      Haritaya tıklayarak binanın <strong>1. Giriş Kapısını</strong> ve varsa <strong>2. Ek Giriş Kapısını</strong> işaretleyin.
                    </p>

                    {/* 1. Kapı (Ana Giriş) */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-emerald-400 text-zinc-950 font-black text-[11px] flex items-center justify-center border border-zinc-950">
                            1
                          </span>
                          <span>1. Giriş Kapısı (Ana Giriş)</span>
                        </span>
                        {pickedEntranceCoords && (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            ✓ {pickedEntranceCoords.lat.toFixed(5)}, {pickedEntranceCoords.lon.toFixed(5)}
                          </span>
                        )}
                      </div>
                      <TactileButton
                        type="button"
                        size="sm"
                        variant={
                          adminMapMode === 'pick_building_entrance' && activeEntrancePickerSlot === 1
                            ? 'accent'
                            : 'secondary'
                        }
                        onClick={() => {
                          onSetActiveEntrancePickerSlot?.(1);
                          onSetAdminMapMode('pick_building_entrance');
                        }}
                        className="w-full justify-center"
                      >
                        {adminMapMode === 'pick_building_entrance' && activeEntrancePickerSlot === 1
                          ? '🟢 Haritada 1. Kapı Noktasına Tıklayın...'
                          : pickedEntranceCoords
                          ? '1. Kapı Noktasını Haritada Değiştir'
                          : 'Haritadan 1. Kapı Noktasını Seç'}
                      </TactileButton>
                    </div>

                    {/* 2. Kapı (Opsiyonel Ek Giriş) */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-sky-400 text-zinc-950 font-black text-[11px] flex items-center justify-center border border-zinc-950">
                            2
                          </span>
                          <span>2. Giriş Kapısı (Opsiyonel)</span>
                        </span>
                        {pickedSecondaryEntranceCoords && (
                          <button
                            type="button"
                            onClick={() => onClearPickedSecondaryEntranceCoords?.()}
                            className="text-[10px] font-black text-rose-500 hover:underline"
                          >
                            Kaldır ✕
                          </button>
                        )}
                      </div>
                      {pickedSecondaryEntranceCoords && (
                        <div className="text-[10px] font-black text-sky-600 dark:text-sky-400">
                          ✓ 2. Kapı: {pickedSecondaryEntranceCoords.lat.toFixed(5)}, {pickedSecondaryEntranceCoords.lon.toFixed(5)}
                        </div>
                      )}
                      <TactileButton
                        type="button"
                        size="sm"
                        variant={
                          adminMapMode === 'pick_building_entrance' && activeEntrancePickerSlot === 2
                            ? 'accent'
                            : 'secondary'
                        }
                        onClick={() => {
                          onSetActiveEntrancePickerSlot?.(2);
                          onSetAdminMapMode('pick_building_entrance');
                        }}
                        className="w-full justify-center"
                      >
                        {adminMapMode === 'pick_building_entrance' && activeEntrancePickerSlot === 2
                          ? '🟢 Haritada 2. Kapı Noktasına Tıklayın...'
                          : pickedSecondaryEntranceCoords
                          ? '2. Kapı Noktasını Haritada Değiştir'
                          : '+ Haritadan 2. Kapı (Ek Giriş) Seç'}
                      </TactileButton>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <TactileButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setBldWizardStep(1);
                          onSetAdminMapMode('add_building');
                        }}
                      >
                        ← 1. Adım
                      </TactileButton>
                      <TactileButton
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setBldWizardStep(3);
                          onSetAdminMapMode('none');
                        }}
                        className="flex-1 justify-center"
                      >
                        3. Adıma Geç: Bina Bilgileri →
                      </TactileButton>
                    </div>
                  </div>
                )}

                {/* STEP 3: BUILDING METADATA & SAVE */}
                {bldWizardStep === 3 && (
                  <form onSubmit={handleCreateBuilding} className="space-y-2.5 pt-0.5">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span>
                        ✓ {selectedFootprints.length > 0 ? `${selectedFootprints.length} Blok` : 'Özel Konum'} •{' '}
                        {pickedSecondaryEntranceCoords ? '2 Giriş Kapısı' : pickedEntranceCoords ? '1 Giriş Kapısı' : 'Otomatik Kapı'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 mb-1">
                          Bina Kodu *
                        </label>
                        <input
                          type="text"
                          required
                          value={newBldCode}
                          onChange={(e) => setNewBldCode(e.target.value)}
                          placeholder="Örn: YDB, SKS"
                          className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 mb-1">
                          Kategori
                        </label>
                        <select
                          value={newBldCategory}
                          onChange={(e) => setNewBldCategory(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                        >
                          <option value="academic">Akademik</option>
                          <option value="dining">Sosyal / Yemek</option>
                          <option value="admin">İdari / Yurt</option>
                          <option value="library">Kütüphane</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 mb-1">
                        Bina Tam Adı *
                      </label>
                      <input
                        type="text"
                        required
                        value={newBldName}
                        onChange={(e) => setNewBldName(e.target.value)}
                        placeholder="Örn: Yabancı Diller Bölümü"
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-zinc-500 mb-1">
                          1. Giriş Kapısı Adı
                        </label>
                        <input
                          type="text"
                          value={newEntranceName}
                          onChange={(e) => setNewEntranceName(e.target.value)}
                          placeholder="Ana Giriş Kapısı"
                          className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 mb-1">
                          Kat Sayısı
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={newBldFloors}
                          onChange={(e) => setNewBldFloors(Number(e.target.value))}
                          className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none text-center"
                        />
                      </div>
                    </div>

                    {pickedSecondaryEntranceCoords && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 mb-1">
                          2. Giriş Kapısı Adı
                        </label>
                        <input
                          type="text"
                          value={newSecondaryEntranceName}
                          onChange={(e) => setNewSecondaryEntranceName(e.target.value)}
                          placeholder="2. Giriş Kapısı"
                          className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <TactileButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setBldWizardStep(2);
                          onSetActiveEntrancePickerSlot?.(1);
                          onSetAdminMapMode('pick_building_entrance');
                        }}
                      >
                        ← 2. Adım
                      </TactileButton>

                      <TactileButton
                        type="submit"
                        size="sm"
                        variant="primary"
                        className="flex-1 justify-center"
                      >
                        Binayı Kaydet & Haritaya Ekle
                      </TactileButton>
                    </div>
                  </form>
                )}
              </div>

              {/* 2. Walkway Closure Toggle */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2">
                <div className="font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>2. Yürüyüş Yolu Kapat / Aç (Dinamik A*)</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold">
                  Modu aktif edip haritadaki herhangi bir yürüyüş yoluna tıklayarak yolu kapatabilir veya açabilirsiniz.
                </p>

                <TactileButton
                  variant={adminMapMode === 'toggle_edge' ? 'warning' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    onSetAdminMapMode(adminMapMode === 'toggle_edge' ? 'none' : 'toggle_edge')
                  }
                  className="w-full"
                >
                  {adminMapMode === 'toggle_edge'
                    ? 'Yol Seçim Modu Aktif (Kapatmak İçin Yola Tıklayın)'
                    : 'Haritada Yol Kapatma / Açma Modu'}
                </TactileButton>

                {blockedEdgeIds.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <div className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                      Kapalı Yollar ({blockedEdgeIds.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blockedEdgeIds.map((eid) => (
                        <button
                          key={eid}
                          type="button"
                          onClick={() => onToggleEdgeBlocked(eid, false)}
                          className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-950 border border-zinc-950 font-black text-[11px] hover:bg-rose-200"
                        >
                          ⛔ {eid} (Aç ✕)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Selected Existing Building Edit */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2.5">
                <div className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <DoorClosed className="w-4 h-4 text-emerald-500" />
                  <span>3. Mevcut Binayı Düzenle / Sil</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Seçili Bina:{' '}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {selectedBuilding
                      ? `${selectedBuilding.code} — ${selectedBuilding.name}`
                      : 'Haritadan kayıtlı bir binaya tıklayın'}
                  </strong>
                </p>

                {selectedBuilding && (
                  <form onSubmit={handleUpdateSelectedBuilding} className="space-y-2 pt-2 border-t-2 border-zinc-950/20">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={editBldName}
                        onChange={(e) => setEditBldName(e.target.value)}
                        placeholder="Bina Adı"
                        className="col-span-2 bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 font-bold"
                      />
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={editBldFloors}
                        onChange={(e) => setEditBldFloors(Number(e.target.value))}
                        className="bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 font-bold"
                        title="Kat Sayısı"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editEntranceName}
                        onChange={(e) => setEditEntranceName(e.target.value)}
                        placeholder="Giriş Kapısı Adı"
                        className="flex-1 bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 font-bold"
                      />
                      <TactileButton
                        type="submit"
                        size="sm"
                        variant="primary"
                      >
                        Güncelle
                      </TactileButton>
                      <TactileButton
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={handleDeleteSelectedBuilding}
                      >
                        Sil
                      </TactileButton>
                    </div>
                  </form>
                )}
              </div>

              {/* 4. Draw New Walkway Path */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2">
                <div className="font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-indigo-500" />
                  <span>4. Yeni Yürüyüş Patikası Çiz</span>
                </div>
                <input
                  type="text"
                  value={newEdgeName}
                  onChange={(e) => setNewEdgeName(e.target.value)}
                  placeholder="Yol Adı"
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 font-bold"
                />
                <div className="flex items-center gap-2">
                  <TactileButton
                    type="button"
                    size="sm"
                    variant={adminMapMode === 'draw_edge' ? 'accent' : 'secondary'}
                    onClick={() => {
                      onClearDrawnEdgePoints();
                      onSetAdminMapMode(adminMapMode === 'draw_edge' ? 'none' : 'draw_edge');
                    }}
                    className="flex-1"
                  >
                    {adminMapMode === 'draw_edge'
                      ? `Haritada 2 Noktaya Tıklayın (${drawnEdgePoints.length}/2)`
                      : 'Patika Çizim Modu'}
                  </TactileButton>
                  {drawnEdgePoints.length >= 2 && (
                    <TactileButton
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleSaveDrawnEdge}
                    >
                      Yolu Ekle
                    </TactileButton>
                  )}
                </div>
              </div>

              {/* 5. Manage Active Map Alerts */}
              {activeAlerts.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2">
                  <div className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>5. Aktif Saha Uyarıları ({activeAlerts.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {activeAlerts.map((al) => (
                      <div
                        key={al.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-950"
                      >
                        <div>
                          <div className="font-black text-zinc-900 dark:text-zinc-100">
                            {al.title}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-bold">
                            👍 {al.upvotes} • 👎 {al.downvotes}
                            {al.edge_id ? ` • Kenar: ${al.edge_id}` : ''}
                          </div>
                        </div>
                        <TactileButton
                          size="sm"
                          variant="danger"
                          onClick={() => onDeleteAlert(al.id)}
                          className="text-[10px] py-0.5 px-2 min-h-0"
                        >
                          Kaldır
                        </TactileButton>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <form
                onSubmit={handleCreateAnnouncement}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm space-y-2.5"
              >
                <div className="font-black text-zinc-900 dark:text-zinc-100">
                  Yeni Kampüs Geneli Canlı Duyuru
                </div>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Başlık (Örn: Ring Seferi / Kütüphane 24 Saat Açık)"
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-3 py-1.5 font-bold"
                />
                <textarea
                  required
                  rows={2}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Duyuru metni..."
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-3 py-1.5 font-semibold"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={annSeverity}
                    onChange={(e) =>
                      setAnnSeverity(e.target.value as 'info' | 'warning' | 'urgent')
                    }
                    className="bg-white dark:bg-zinc-950 border-2 border-zinc-950 rounded-xl px-2.5 py-1.5 font-bold"
                  >
                    <option value="info">Bilgi (Mavi)</option>
                    <option value="warning">Uyarı (Kehribar)</option>
                    <option value="urgent">Acil (Kırmızı)</option>
                  </select>
                  <TactileButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Yayınla
                  </TactileButton>
                </div>
              </form>

              <div className="space-y-2">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-black text-zinc-900 dark:text-zinc-100">
                        {a.title}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {a.message}
                      </div>
                    </div>
                    <TactileButton
                      size="sm"
                      variant="danger"
                      onClick={() => onRemoveAnnouncement(a.id)}
                      className="text-[10px] py-0.5 px-2 min-h-0"
                    >
                      Kaldır
                    </TactileButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </TactileCard>
    </aside>
  </div>
);
};
