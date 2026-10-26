import React, { useState, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCampusData } from './hooks/useCampusData';
import { useNavigation } from './hooks/useNavigation';
import { useLiveGeolocation } from './hooks/useLiveGeolocation';
import { useBuildingRooms } from './hooks/useBuildingRooms';
import { SearchResultItem } from './types/campus';
import { MARMARAY_SCHEDULE_CONFIG } from './config/marmaraySchedule';
import { CampusMap3D, AdminMapInteractionMode, MapControlActions } from './components/map/CampusMap3D';
import { TopNavigationBar, QuickCampusFilter } from './components/layout/TopNavigationBar';
import { BuildingDetailSheet } from './components/sheets/BuildingDetailSheet';
import { InteractiveBottomSheet } from './components/sheets/InteractiveBottomSheet';
import { MarmaraySheet } from './components/sheets/MarmaraySheet';
import { ReportAlertModal } from './components/tickets/ReportAlertModal';
import { WrittenTicketModal } from './components/tickets/WrittenTicketModal';
import { AdminCommandCenter } from './components/admin/AdminCommandCenter';
import { NavigationManeuverHUD } from './components/layout/NavigationManeuverHUD';

export type AppState =
  | 'IDLE'
  | 'SEARCHING'
  | 'BUILDING_SELECTED'
  | 'NAVIGATING'
  | 'REPORTING_ALERT'
  | 'PICKING_ORIGIN'
  | 'ADMIN_LIVEOPS';

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
    setRerouteNotice,
    isSimulatingWalk,
    setIsSimulatingWalk,
    simProgress,
    computeRouteToBuilding,
    applyRawCoordinates,
    setUserStartCoords,
    clearNavigation,
  } = useNavigation(blockedEdgeIds);

  const {
    isLiveGpsActive,
    gpsErrorModal,
    clearGpsErrorModal,
    toggleLiveGps,
    stopLiveGps,
  } = useLiveGeolocation({
    onPositionUpdate: (lat, lon, accuracyM) => {
      applyRawCoordinates(lat, lon, 'gps', accuracyM);
    },
    onNotice: (notice) => {
      setRerouteNotice(notice);
      setTimeout(() => setRerouteNotice((prev) => (prev === notice ? null : prev)), 5000);
    },
  });

  const [activeFilter, setActiveFilter] = useState<QuickCampusFilter>('all');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [mapControls, setMapControls] = useState<MapControlActions | null>(null);
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
  const [adminEntranceSlot, setAdminEntranceSlot] = useState<1 | 2>(1);
  const [mobileSheetHeight, setMobileSheetHeight] = useState<number>(94);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState<boolean>(false);
  const [pickedBuildingCoords, setPickedBuildingCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [selectedFootprints, setSelectedFootprints] = useState<
    { osm_way_id: number; name: string; coords: number[][] }[]
  >([]);
  const [pickedEntranceCoords, setPickedEntranceCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [drawnEdgePoints, setDrawnEdgePoints] = useState<{ lat: number; lon: number }[]>([]);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 4000);
  };

  const handleToggleFootprint = (osmWayId: number, name: string) => {
    setSelectedFootprints((prev) => {
      const exists = prev.some((fp) => fp.osm_way_id === osmWayId);
      if (exists) {
        showToast(`Ayak izi seçimi kaldırıldı (#${osmWayId})`);
        return prev.filter((fp) => fp.osm_way_id !== osmWayId);
      }
      const rawFp = walkGraph?.extra_building_footprints?.find(
        (f) => f.osm_way_id === osmWayId
      );
      if (rawFp) {
        showToast(`Ayak izi seçildi: ${name || rawFp.name}`);
        return [...prev, rawFp];
      }
      return prev;
    });
  };

  // Finite State Machine (FSM) State Resolution
  const currentState: AppState = useMemo(() => {
    if (isAdmin && isAdminDrawerOpen) return 'ADMIN_LIVEOPS';
    if (isAlertModalOpen) return 'REPORTING_ALERT';
    if (adminMapMode === 'pick_user_start') return 'PICKING_ORIGIN';
    if (activeRoute) return 'NAVIGATING';
    if (searchQuery.trim().length > 0) return 'SEARCHING';
    if (selectedBuildingId) return 'BUILDING_SELECTED';
    return 'IDLE';
  }, [
    isAdmin,
    isAdminDrawerOpen,
    isAlertModalOpen,
    adminMapMode,
    activeRoute,
    searchQuery,
    selectedBuildingId,
  ]);

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

  const handleStartNavigation = async (buildingId: string) => {
    const route = await computeRouteToBuilding(buildingId);
    return route;
  };

  const handleSelectSearchResult = async (item: SearchResultItem) => {
    setSearchQuery('');
    setSelectedBuildingId(item.building_id);
    await handleStartNavigation(item.building_id);
  };

  const handleAdminMoveEntranceOnMap = async (lat: number, lon: number) => {
    if (!selectedBuildingId) return;
    await updateBuildingEntrance(
      selectedBuildingId,
      lat,
      lon,
      undefined,
      adminEntranceSlot,
      false
    );
    setAdminMapMode('none');
    showToast(
      adminEntranceSlot === 2
        ? 'Binanın 2. giriş kapısı kaydedildi'
        : 'Binanın 1. giriş kapısı taşındı ve kaydedildi'
    );
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
        'Yeni başlangıç konumunuza göre Snap-to-Path rotası güncellendi'
      );
    } else {
      showToast('Başlangıç konumunuz seçilen noktaya taşındı');
    }
  };

  // State-enforced drawer visibility: Never allow panel collision!
  const isLeftPanelVisible = currentState === 'ADMIN_LIVEOPS' && adminMapMode === 'none';
  // Building detail sheet is visible when selected, BUT hidden while navigating so map is 100% visible on mobile
  const isRightPanelVisible =
    currentState === 'BUILDING_SELECTED' &&
    adminMapMode !== 'move_entrance' &&
    !isAdminDrawerOpen;

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-[#1E222D] text-slate-100 font-sans">
      {/* Top Navigation & Omnibox Header (Hidden or minimized during full active navigation on mobile) */}
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
              setSelectedBuildingId(null); // Close building panel to prevent collision
              showToast('Yönetici (LiveOps) Komuta Merkezi aktif edildi');
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
            showToast('Akademik bölüm binaları filtrelendi');
          } else if (nextFilter === 'free_rooms') {
            showToast('Boş amfisi/dersliği bulunan binalar filtrelendi');
          } else if (nextFilter === 'dining_library') {
            showToast('Kütüphane ve yemekhane binaları filtrelendi');
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        announcements={announcements}
        isNavigating={currentState === 'NAVIGATING'}
        onOpenMarmaray={() => setIsMarmarayOpen(true)}
        onOpenAlertModal={() => {
          setAlertCoords({ lat: userPos.snappedLat, lon: userPos.snappedLon });
          setIsAlertModalOpen(true);
        }}
        onOpenWrittenTicketModal={() => {
          setTicketTarget({ buildingId: selectedBuildingId });
          setIsWrittenTicketOpen(true);
        }}
        onToggleAdminDrawer={() => {
          if (!isAdminDrawerOpen) setSelectedBuildingId(null);
          setIsAdminDrawerOpen((prev) => !prev);
        }}
        isAdminDrawerOpen={isAdminDrawerOpen}
        isAnnouncementsModalOpen={isAnnouncementsModalOpen}
        onSetAnnouncementsModalOpen={setIsAnnouncementsModalOpen}
        basemapMode={mapControls?.basemapMode ?? 'diorama'}
        onToggleBasemap={mapControls?.toggleBasemap}
        is3DPitch={mapControls?.is3DPitch ?? false}
        onTogglePitch={mapControls?.togglePitch}
        isLiveGpsActive={isLiveGpsActive}
        onToggleLiveGps={() => {
          if (!isLiveGpsActive) {
            setIsSimulatingWalk(false);
          }
          toggleLiveGps();
        }}
      />

      {/* Tactile Toast / Reroute Notification Pill */}
      {(rerouteNotice || routeError || toastBanner) && adminMapMode === 'none' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 text-zinc-950 dark:text-zinc-100 font-black text-xs shadow-hard-md pointer-events-none transition-all">
          {rerouteNotice || routeError || toastBanner}
        </div>
      )}

      {/* ACTIVE TURN-BY-TURN NAVIGATION HUD (Visible on both Mobile & Desktop) */}
      {activeRoute && currentState === 'NAVIGATING' && (
        <NavigationManeuverHUD
          activeRoute={activeRoute}
          userPos={userPos}
          isSimulatingWalk={isSimulatingWalk}
          onToggleSimulateWalk={() => {
            if (!isSimulatingWalk) {
              stopLiveGps();
            }
            setIsSimulatingWalk((prev) => !prev);
          }}
          isLiveGpsActive={isLiveGpsActive}
          onToggleLiveGps={() => {
            if (!isLiveGpsActive) {
              setIsSimulatingWalk(false);
            }
            toggleLiveGps();
          }}
          onClearRoute={() => {
            clearNavigation();
            stopLiveGps();
            setSelectedBuildingId(null);
            showToast('Navigasyon sonlandırıldı');
          }}
        />
      )}

      {/* Main Mini Motorways Campus Map Canvas */}
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
        bottomSheetHeight={mobileSheetHeight}
        isPickingUserStart={adminMapMode === 'pick_user_start'}
        onTogglePickUserStart={() =>
          setAdminMapMode((prev) =>
            prev === 'pick_user_start' ? 'none' : 'pick_user_start'
          )
        }
        selectedFootprintIds={selectedFootprints.map((fp) => fp.osm_way_id)}
        onAdminToggleFootprintSelection={handleToggleFootprint}
        onAdminPickEntranceCoords={(lat, lon) => {
          setPickedEntranceCoords({ lat, lon });
          setAdminMapMode('none');
          showToast(`Giriş kapısı seçildi: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        }}
        onSelectBuilding={(bId) => {
          if (isAdminDrawerOpen) setIsAdminDrawerOpen(false);
          setSelectedBuildingId(bId);
        }}
        onQuickRouteToBuilding={async (bId) => {
          setSelectedBuildingId(bId);
          await handleStartNavigation(bId);
        }}
        onVoteAlert={voteOnAlert}
        onAdminToggleEdge={async (edgeId, currentlyBlocked) => {
          await toggleEdgeBlocked(edgeId, !currentlyBlocked);
          showToast(
            !currentlyBlocked
              ? `Yürüyüş yolu (${edgeId}) kapatıldı. Aktif rotalar güncellendi.`
              : `Yürüyüş yolu (${edgeId}) tekrar ulaşıma açıldı.`
          );
        }}
        onAdminMoveEntrance={handleAdminMoveEntranceOnMap}
        onAdminPickBuildingCoords={(lat, lon) => {
          setPickedBuildingCoords({ lat, lon });
          setAdminMapMode('none');
          showToast(`Yeni bina konumu seçildi: ${lat}, ${lon}`);
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
        onControlsReady={setMapControls}
      />

      {/* Mobile Native Apple Maps Interactive Bottom Sheet (Peek / Medium / Large Detents) */}
      <InteractiveBottomSheet
        isNavigating={currentState === 'NAVIGATING'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        selectedBuilding={selectedBuilding}
        roomsData={roomsData}
        isLoadingRooms={isLoadingRooms}
        onStartRoute={async (bId) => {
          await handleStartNavigation(bId);
          setSelectedBuildingId(null);
        }}
        onCloseBuilding={() => setSelectedBuildingId(null)}
        onReportRoomBusy={async (classroomId, reason) => {
          await reportBusy(classroomId, reason);
          showToast('Derslik öğrenci bildirimiyle geçici dolu olarak işaretlendi');
        }}
        onClearRoomBusy={async (classroomId) => {
          await clearBusy(classroomId);
          showToast('Derslik doluluk bildirimi sıfırlandı');
        }}
        onOpenWrittenTicketForBuilding={(bId, cId) => {
          setTicketTarget({ buildingId: bId, classroomId: cId || null });
          setIsWrittenTicketOpen(true);
        }}
        onOpenMarmaray={() => setIsMarmarayOpen(true)}
        onOpenAlertModal={() => {
          setAlertCoords({ lat: userPos.snappedLat, lon: userPos.snappedLon });
          setIsAlertModalOpen(true);
        }}
        onOpenWrittenTicketModal={() => {
          setTicketTarget({ buildingId: selectedBuildingId });
          setIsWrittenTicketOpen(true);
        }}
        onOpenAnnouncements={() => setIsAnnouncementsModalOpen(true)}
        announcements={announcements}
        isLiveGpsActive={isLiveGpsActive}
        onToggleLiveGps={() => {
          if (!isLiveGpsActive) {
            setIsSimulatingWalk(false);
          }
          toggleLiveGps();
        }}
        onHeightChange={setMobileSheetHeight}
      />

      {/* Right Drawer: Building Detail Sheet (Single Stage, Never Collides!) */}
      {isRightPanelVisible && (
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
          onStartRoute={async (bId) => {
            await handleStartNavigation(bId);
            // On mobile, automatically collapse sheet so the student can walk and see map!
            if (window.innerWidth < 768) {
              setSelectedBuildingId(null);
            }
          }}
          onToggleSimulateWalk={() => setIsSimulatingWalk((prev) => !prev)}
          onToggleLiveGps={toggleLiveGps}
          onClearRoute={() => {
            clearNavigation();
            setSelectedBuildingId(null);
          }}
          onReportRoomBusy={async (classroomId, reason) => {
            await reportBusy(classroomId, reason);
            showToast('Derslik öğrenci bildirimiyle geçici dolu olarak işaretlendi');
          }}
          onClearRoomBusy={async (classroomId) => {
            await clearBusy(classroomId);
            showToast('Derslik doluluk bildirimi sıfırlandı');
          }}
          onOpenWrittenTicketForBuilding={(bId, cId) => {
            setTicketTarget({ buildingId: bId, classroomId: cId || null });
            setIsWrittenTicketOpen(true);
          }}
          onAdminStartMoveEntrance={(bId, slot = 1) => {
            setSelectedBuildingId(bId);
            setAdminEntranceSlot(slot);
            setAdminMapMode('move_entrance');
          }}
          onAdminClearSecondaryEntrance={async (bId) => {
            await updateBuildingEntrance(bId, 0, 0, undefined, 2, true);
            showToast('Binanın 2. giriş kapısı kaldırıldı');
          }}
        />
      )}

      {/* Left Drawer: LiveOps Admin Command Center */}
      <AdminCommandCenter
        isOpen={isLeftPanelVisible}
        buildings={buildings}
        activeAlerts={activeAlerts}
        blockedEdgeIds={blockedEdgeIds}
        announcements={announcements}
        adminMapMode={adminMapMode}
        selectedBuildingId={selectedBuildingId}
        pickedCoords={pickedBuildingCoords}
        pickedEntranceCoords={pickedEntranceCoords}
        selectedFootprints={selectedFootprints}
        onClearSelectedFootprints={() => setSelectedFootprints([])}
        onClearPickedEntranceCoords={() => setPickedEntranceCoords(null)}
        drawnEdgePoints={drawnEdgePoints}
        onSetAdminMapMode={setAdminMapMode}
        onClearDrawnEdgePoints={() => setDrawnEdgePoints([])}
        onToggleEdgeBlocked={toggleEdgeBlocked}
        onDeleteAlert={async (alertId) => {
          await deleteAlert(alertId);
          showToast('Saha uyarısı kaldırıldı');
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
        onRouteToStation={async () => {
          const stationId = MARMARAY_SCHEDULE_CONFIG.stationBuildingId;
          setSelectedBuildingId(stationId);
          await handleStartNavigation(stationId);
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
          showToast('Harita saha uyarısı eklendi');
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

      {/* Out-of-Campus / GPS Error Modal */}
      {gpsErrorModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={clearGpsErrorModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E222D] border-2 border-zinc-950 shadow-hard-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 border-2 border-zinc-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-black text-lg">
                !
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950 dark:text-zinc-100">
                  {gpsErrorModal.title}
                </h3>
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {gpsErrorModal.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={clearGpsErrorModal}
                className="px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-500 text-zinc-950 font-black text-xs border-2 border-zinc-950 shadow-hard-sm active:scale-95 transition"
              >
                Tamam, Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
