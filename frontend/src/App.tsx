import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCampusData } from './hooks/useCampusData';
import { useNavigation } from './hooks/useNavigation';
import { useBuildingRooms } from './hooks/useBuildingRooms';
import { SearchResultItem } from './types/campus';
import { MARMARAY_SCHEDULE_CONFIG } from './config/marmaraySchedule';
import { CampusMap3D, AdminMapInteractionMode } from './components/map/CampusMap3D';
import { TopNavigationBar } from './components/layout/TopNavigationBar';
import { BuildingDetailSheet } from './components/sheets/BuildingDetailSheet';
import { MarmaraySheet } from './components/sheets/MarmaraySheet';
import { ReportAlertModal } from './components/tickets/ReportAlertModal';
import { WrittenTicketModal } from './components/tickets/WrittenTicketModal';
import { AdminCommandCenter } from './components/admin/AdminCommandCenter';

export const App: React.FC = () => {
  const { user, isAdmin, switchRoleQuick } = useAuth();
  const {
    buildings,
    walkGraph,
    activeAlerts,
    blockedEdgeIds,
    announcements,
    searchQuery,
    setSearchQuery,
    searchResults,
    createAlert,
    voteOnAlert,
    toggleEdgeBlocked,
    updateBuildingEntrance,
    addOrUpdateCampusBuilding,
    addWalkwayEdge,
    publishAnnouncement,
    removeAnnouncement,
  } = useCampusData();

  const {
    userPos,
    activeRoute,
    isCalculatingRoute,
    routeError,
    rerouteNotice,
    isSimulatingWalk,
    setIsSimulatingWalk,
    isLiveGpsActive,
    toggleLiveGps,
    computeRouteToBuilding,
    clearNavigation,
  } = useNavigation(blockedEdgeIds);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const { roomsData, isLoadingRooms, reportBusy, clearBusy } =
    useBuildingRooms(selectedBuildingId);

  const [isMarmarayOpen, setIsMarmarayOpen] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [alertCoords, setAlertCoords] = useState<{
    lat: number;
    lon: number;
    edgeId?: string | null;
  } | null>(null);

  const [isWrittenTicketOpen, setIsWrittenTicketOpen] = useState<boolean>(false);
  const [ticketTarget, setTicketTarget] = useState<{
    buildingId?: string | null;
    classroomId?: string | null;
  }>({});

  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState<boolean>(false);
  const [adminMapMode, setAdminMapMode] = useState<AdminMapInteractionMode>('none');
  const [pickedBuildingCoords, setPickedBuildingCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [drawnEdgePoints, setDrawnEdgePoints] = useState<{ lat: number; lon: number }[]>([]);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 4500);
  };

  const selectedBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || null;

  const handleSelectSearchResult = (item: SearchResultItem) => {
    setSearchQuery('');
    setSelectedBuildingId(item.building_id);
    computeRouteToBuilding(item.building_id);
  };

  const handleAdminMoveEntranceOnMap = async (lat: number, lon: number) => {
    if (!selectedBuildingId) return;
    await updateBuildingEntrance(selectedBuildingId, lat, lon);
    setAdminMapMode('none');
    showToast('✅ Bina giriş kapısı en yakın yürüyüş yolu düğümüne taşındı!');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Omnibox Search, Live Announcements & Role Switcher */}
      <TopNavigationBar
        user={user}
        isAdmin={isAdmin}
        onSwitchRole={(r) => {
          switchRoleQuick(r);
          if (r === 'admin') {
            setIsAdminDrawerOpen(true);
          } else {
            setIsAdminDrawerOpen(false);
            setAdminMapMode('none');
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        announcements={announcements}
        onOpenMarmaray={() => setIsMarmarayOpen(true)}
        onOpenAlertModal={() => {
          setAlertCoords({ lat: userPos.snappedLat, lon: userPos.snappedLon });
          setIsAlertModalOpen(true);
        }}
        onOpenWrittenTicketModal={() => {
          setTicketTarget({ buildingId: selectedBuildingId });
          setIsWrittenTicketOpen(true);
        }}
        onToggleAdminDrawer={() => setIsAdminDrawerOpen((prev) => !prev)}
        isAdminDrawerOpen={isAdminDrawerOpen}
      />

      {/* Dynamic Toast / Reroute Alert Banner */}
      {(rerouteNotice || routeError || toastBanner) && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900/95 border border-sky-400/50 text-sky-200 text-xs font-bold shadow-2xl">
          {rerouteNotice || routeError || toastBanner}
        </div>
      )}

      {/* Active Navigation Telemetry Pill (Bottom Center) */}
      {activeRoute && (
        <div className="absolute bottom-5 right-14 z-20 hidden md:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-sky-500/40 shadow-2xl text-xs">
          <div>
            <div className="font-extrabold text-sky-300">
              🧭 Aktif Rota: {activeRoute.target_entrance_name}
            </div>
            <div className="text-[11px] text-slate-300">
              Kalan: <strong>{userPos.remainingMeters} m</strong> (~{userPos.remainingMinutes} dk) •{' '}
              {userPos.isSnapped ? (
                <span className="text-emerald-400 font-semibold">
                  🧲 Snap-to-Path Aktif ({userPos.offRouteDistanceMeters}m dik izdüşüm)
                </span>
              ) : (
                <span>Serbest Konum</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSimulatingWalk((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold transition"
          >
            {isSimulatingWalk ? '⏸️ Duraklat' : '🚶 Simüle Et'}
          </button>
        </div>
      )}

      {/* Main 3D MapLibre Campus Map */}
      <CampusMap3D
        buildings={buildings}
        walkGraph={walkGraph}
        activeAlerts={activeAlerts}
        blockedEdgeIds={blockedEdgeIds}
        selectedBuildingId={selectedBuildingId}
        activeRoute={activeRoute}
        userPos={userPos}
        adminMapMode={adminMapMode}
        onSelectBuilding={(bId) => setSelectedBuildingId(bId)}
        onQuickRouteToBuilding={(bId) => {
          setSelectedBuildingId(bId);
          computeRouteToBuilding(bId);
        }}
        onVoteAlert={voteOnAlert}
        onAdminToggleEdge={async (edgeId, currentlyBlocked) => {
          await toggleEdgeBlocked(edgeId, !currentlyBlocked);
          showToast(
            !currentlyBlocked
              ? `🚧 Yürüyüş yolu (${edgeId}) kapatıldı. Aktif rotalar güncellendi.`
              : `✅ Yürüyüş yolu (${edgeId}) tekrar ulaşıma açıldı.`
          );
        }}
        onAdminMoveEntrance={handleAdminMoveEntranceOnMap}
        onAdminPickBuildingCoords={(lat, lon) => {
          setPickedBuildingCoords({ lat, lon });
          setAdminMapMode('none');
          showToast(`📍 Yeni bina konumu seçildi: ${lat}, ${lon}`);
        }}
        onAdminDrawWalkwayPoint={(lat, lon) => {
          setDrawnEdgePoints((prev) => [...prev.slice(-1), { lat, lon }]);
        }}
        onPickAlertCoords={(lat, lon, nearestEdgeId) => {
          setAlertCoords({ lat, lon, edgeId: nearestEdgeId });
          setAdminMapMode('none');
          setIsAlertModalOpen(true);
        }}
      />

      {/* Building Empty Amphitheater & Route Drawer */}
      <BuildingDetailSheet
        building={selectedBuilding}
        roomsData={roomsData}
        isLoadingRooms={isLoadingRooms}
        activeRoute={activeRoute}
        isCalculatingRoute={isCalculatingRoute}
        isSimulatingWalk={isSimulatingWalk}
        isLiveGpsActive={isLiveGpsActive}
        isAdmin={isAdmin}
        onClose={() => setSelectedBuildingId(null)}
        onStartRoute={(bId) => computeRouteToBuilding(bId)}
        onToggleSimulateWalk={() => setIsSimulatingWalk((prev) => !prev)}
        onToggleLiveGps={toggleLiveGps}
        onClearRoute={clearNavigation}
        onReportRoomBusy={async (classroomId, reason) => {
          await reportBusy(classroomId, reason);
          showToast('🟠 Derslik öğrenci bildirimiyle geçici dolu olarak işaretlendi.');
        }}
        onClearRoomBusy={async (classroomId) => {
          await clearBusy(classroomId);
          showToast('🟢 Derslik doluluk bildirimi sıfırlandı.');
        }}
        onOpenWrittenTicketForBuilding={(bId, cId) => {
          setTicketTarget({ buildingId: bId, classroomId: cId || null });
          setIsWrittenTicketOpen(true);
        }}
        onAdminStartMoveEntrance={(bId) => {
          setSelectedBuildingId(bId);
          setAdminMapMode('move_entrance');
        }}
      />

      {/* LiveOps Admin Command Center Drawer */}
      <AdminCommandCenter
        isOpen={isAdmin && isAdminDrawerOpen}
        buildings={buildings}
        blockedEdgeIds={blockedEdgeIds}
        announcements={announcements}
        adminMapMode={adminMapMode}
        selectedBuildingId={selectedBuildingId}
        pickedCoords={pickedBuildingCoords}
        drawnEdgePoints={drawnEdgePoints}
        onSetAdminMapMode={setAdminMapMode}
        onClearDrawnEdgePoints={() => setDrawnEdgePoints([])}
        onToggleEdgeBlocked={toggleEdgeBlocked}
        onAddOrUpdateBuilding={addOrUpdateCampusBuilding}
        onAddWalkwayEdge={addWalkwayEdge}
        onPublishAnnouncement={publishAnnouncement}
        onRemoveAnnouncement={removeAnnouncement}
        onClose={() => setIsAdminDrawerOpen(false)}
      />

      {/* GTÜ-Fatih Marmaray Schedule Modal */}
      <MarmaraySheet
        isOpen={isMarmarayOpen}
        userLat={userPos.snappedLat}
        userLon={userPos.snappedLon}
        onClose={() => setIsMarmarayOpen(false)}
        onRouteToStation={() => {
          const stationId = MARMARAY_SCHEDULE_CONFIG.stationBuildingId;
          setSelectedBuildingId(stationId);
          computeRouteToBuilding(stationId);
        }}
      />

      {/* Layer 1: Map Alert Modal */}
      <ReportAlertModal
        isOpen={isAlertModalOpen}
        defaultLat={alertCoords?.lat ?? userPos.snappedLat}
        defaultLon={alertCoords?.lon ?? userPos.snappedLon}
        pickedEdgeId={alertCoords?.edgeId}
        isAdmin={isAdmin}
        onClose={() => setIsAlertModalOpen(false)}
        onStartPickOnMap={() => {
          setIsAlertModalOpen(false);
          setAdminMapMode('pick_alert_coords');
        }}
        onSubmitAlert={async (payload) => {
          await createAlert(payload);
          showToast('⚠️ Harita saha uyarısı eklendi!');
        }}
      />

      {/* Layer 2: Written Admin Ticket Modal (Local CPU NLP AI) */}
      <WrittenTicketModal
        isOpen={isWrittenTicketOpen}
        buildings={buildings}
        reporterEmail={user.email}
        initialBuildingId={ticketTarget.buildingId}
        initialClassroomId={ticketTarget.classroomId}
        onClose={() => setIsWrittenTicketOpen(false)}
      />
    </div>
  );
};

export default App;
