import React, { useState, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCampusData } from './hooks/useCampusData';
import { useNavigation } from './hooks/useNavigation';
import { useBuildingRooms } from './hooks/useBuildingRooms';
import { SearchResultItem } from './types/campus';
import { MARMARAY_SCHEDULE_CONFIG } from './config/marmaraySchedule';
import { CampusMap3D, AdminMapInteractionMode } from './components/map/CampusMap3D';
import { TopNavigationBar, QuickCampusFilter } from './components/layout/TopNavigationBar';
import { BuildingDetailSheet } from './components/sheets/BuildingDetailSheet';
import { MarmaraySheet } from './components/sheets/MarmaraySheet';
import { ReportAlertModal } from './components/tickets/ReportAlertModal';
import { WrittenTicketModal } from './components/tickets/WrittenTicketModal';
import { AdminCommandCenter } from './components/admin/AdminCommandCenter';

export const App: React.FC = () => {
  const { user, isAdmin, error: authError, clearAuthError, switchRoleQuick } = useAuth();
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
    deleteAlert,
    toggleEdgeBlocked,
    updateBuildingEntrance,
    addOrUpdateCampusBuilding,
    removeCampusBuilding,
    addWalkwayEdge,
    publishAnnouncement,
    removeAnnouncement,
  } = useCampusData();

  const {
    userPos,
    targetBuildingId,
    activeRoute,
    isCalculatingRoute,
    routeError,
    rerouteNotice,
    isSimulatingWalk,
    setIsSimulatingWalk,
    isLiveGpsActive,
    toggleLiveGps,
    computeRouteToBuilding,
    applyRawCoordinates,
    clearNavigation,
  } = useNavigation(blockedEdgeIds);

  const [activeFilter, setActiveFilter] = useState<QuickCampusFilter>('all');
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
    setTimeout(() => setToastBanner(null), 4000);
  };

  // Apply quick filter chips to buildings shown on map
  const filteredBuildings = useMemo(() => {
    if (activeFilter === 'academic') {
      return buildings.filter((b) => b.category === 'academic');
    }
    if (activeFilter === 'free_rooms') {
      return buildings.filter((b) => b.free_rooms_count > 0);
    }
    if (activeFilter === 'dining_library') {
      return buildings.filter(
        (b) => b.category === 'dining' || b.category === 'library'
      );
    }
    return buildings;
  }, [buildings, activeFilter]);

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
    showToast('✅ Bina giriş kapısı taşındı ve gtu_buildings.json dosyasına kalıcı kaydedildi!');
  };

  const handleUserPickStartOnMap = async (lat: number, lon: number) => {
    setAdminMapMode('none');
    applyRawCoordinates(lat, lon, 'simulator', 3.5);
    const destId = targetBuildingId || selectedBuildingId;
    if (destId) {
      await computeRouteToBuilding(
        destId,
        lat,
        lon,
        '📍 Yeni başlangıç konumunuza göre Snap-to-Path ve A* rotası güncellendi!'
      );
    } else {
      showToast('📍 Başlangıç konumunuz seçilen noktaya taşındı.');
    }
  };

  const isLeftPanelVisible = isAdmin && isAdminDrawerOpen && adminMapMode === 'none';
  const isRightPanelVisible = Boolean(selectedBuilding) && adminMapMode !== 'move_entrance';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Compact Top Navbar & Floating Filter Pills */}
      <TopNavigationBar
        user={user}
        isAdmin={isAdmin}
        authError={authError}
        onClearAuthError={clearAuthError}
        onSwitchRole={async (r, adminKey) => {
          const ok = await switchRoleQuick(r, adminKey);
          if (ok) {
            if (r === 'admin') {
              setIsAdminDrawerOpen(true);
              showToast('🛡️ Yönetici (LiveOps) Komuta Merkezi aktif edildi.');
            } else {
              setIsAdminDrawerOpen(false);
              setAdminMapMode('none');
            }
          }
          return ok;
        }}
        activeFilter={activeFilter}
        onFilterChange={(nextFilter) => {
          setActiveFilter(nextFilter);
          if (nextFilter === 'academic') {
            showToast('🏛️ Akademik bölüm binaları filtrelendi.');
          } else if (nextFilter === 'free_rooms') {
            showToast('🟢 Şu an boş amfisi/dersliği bulunan binalar filtrelendi.');
          } else if (nextFilter === 'dining_library') {
            showToast('🍽️ Kütüphane ve sosyal/yemekhane binaları filtrelendi.');
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        announcements={announcements}
        isPickingUserStart={adminMapMode === 'pick_user_start'}
        onTogglePickUserStart={() =>
          setAdminMapMode((prev) =>
            prev === 'pick_user_start' ? 'none' : 'pick_user_start'
          )
        }
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

      {/* Non-intrusive Toast / Reroute Alert Banner */}
      {(rerouteNotice || routeError || toastBanner) && adminMapMode === 'none' && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-slate-900/95 border border-sky-400/60 text-sky-200 text-xs font-bold shadow-2xl pointer-events-none">
          {rerouteNotice || routeError || toastBanner}
        </div>
      )}

      {/* Bottom-Center Active Navigation & Walk Simulator HUD (Never collides with left/right drawers) */}
      {activeRoute && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-sky-500/50 shadow-2xl text-xs">
          <div>
            <div className="font-extrabold text-sky-300 flex items-center gap-2">
              <span>🧭 Hedef: {activeRoute.target_entrance_name}</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-white">
                {userPos.remainingMeters} m (~{userPos.remainingMinutes} dk)
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {userPos.isSnapped ? (
                <span className="text-emerald-400 font-semibold">
                  🧲 Snap-to-Path + Kalman Kilitli ({userPos.offRouteDistanceMeters}m sapma düzeltildi)
                </span>
              ) : (
                <span>Serbest Konum • Yürüyüş Simülatörünü başlatarak test edin</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSimulatingWalk((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition ${
              isSimulatingWalk
                ? 'bg-amber-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isSimulatingWalk ? '⏸️ Duraklat' : '▶️ Yürüyüşü Simüle Et'}
          </button>

          <button
            type="button"
            onClick={clearNavigation}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            title="Aktif rotayı temizle"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 3D MapLibre Campus Map */}
      <CampusMap3D
        buildings={filteredBuildings}
        walkGraph={walkGraph}
        activeAlerts={activeAlerts}
        blockedEdgeIds={blockedEdgeIds}
        selectedBuildingId={selectedBuildingId}
        activeRoute={activeRoute}
        userPos={userPos}
        adminMapMode={adminMapMode}
        isLeftDrawerOpen={isLeftPanelVisible}
        isRightDrawerOpen={isRightPanelVisible}
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
        onPickUserStartCoords={handleUserPickStartOnMap}
        onCancelMapMode={() => setAdminMapMode('none')}
      />

      {/* Right Drawer: Building Empty Amphitheater & Weekly Schedule */}
      {adminMapMode !== 'move_entrance' && (
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
      )}

      {/* Left Drawer: LiveOps Admin Command Center */}
      <AdminCommandCenter
        isOpen={isAdmin && isAdminDrawerOpen}
        buildings={buildings}
        activeAlerts={activeAlerts}
        blockedEdgeIds={blockedEdgeIds}
        announcements={announcements}
        adminMapMode={adminMapMode}
        selectedBuildingId={selectedBuildingId}
        pickedCoords={pickedBuildingCoords}
        drawnEdgePoints={drawnEdgePoints}
        onSetAdminMapMode={setAdminMapMode}
        onClearDrawnEdgePoints={() => setDrawnEdgePoints([])}
        onToggleEdgeBlocked={toggleEdgeBlocked}
        onDeleteAlert={async (alertId) => {
          await deleteAlert(alertId);
          showToast('🗑️ Saha uyarısı kaldırıldı.');
        }}
        onAddOrUpdateBuilding={addOrUpdateCampusBuilding}
        onDeleteBuilding={async (bId) => {
          await removeCampusBuilding(bId);
          if (selectedBuildingId === bId) setSelectedBuildingId(null);
        }}
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
