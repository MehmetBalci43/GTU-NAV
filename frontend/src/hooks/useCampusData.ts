import { useState, useEffect, useCallback } from 'react';
import {
  Building,
  WalkGraph,
  MapAlert,
  CampusAnnouncement,
  SearchResultItem,
} from '../types/campus';
import { api } from '../services/apiClient';

export function useCampusData() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [walkGraph, setWalkGraph] = useState<WalkGraph | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<MapAlert[]>([]);
  const [blockedEdgeIds, setBlockedEdgeIds] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<CampusAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await api.getBootstrap();
      setBuildings(data.buildings);
      setWalkGraph(data.walk_graph);
      setActiveAlerts(data.active_alerts);
      setBlockedEdgeIds(data.blocked_edge_ids);
      setAnnouncements(data.announcements);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kampüs verileri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();

    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshBootstrap();
      }
    }, 4000);

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshBootstrap();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshBootstrap]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchCampus(q);
        if (!cancelled) setSearchResults(res.results);
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const createAlert = useCallback(
    async (payload: {
      alert_type: string;
      title?: string;
      edge_id?: string | null;
      blocks_route?: boolean;
      lat: number;
      lon: number;
      is_admin_verified?: boolean;
    }) => {
      await api.createMapAlert(payload);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const voteOnAlert = useCallback(
    async (alertId: number, vote: 'up' | 'down') => {
      await api.voteMapAlert(alertId, vote);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const deleteAlert = useCallback(
    async (alertId: number) => {
      await api.deleteMapAlert(alertId);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const toggleEdgeBlocked = useCallback(
    async (edgeId: string, closed: boolean, reason: string = 'Admin müdahalesi: Yol çalışması') => {
      await api.toggleWalkwayEdge(edgeId, closed, reason);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const updateBuildingEntrance = useCallback(
    async (
      buildingId: string,
      entranceLat: number,
      entranceLon: number,
      entranceName?: string,
      entranceSlot: 1 | 2 = 1,
      clearSecondary: boolean = false
    ) => {
      await api.updateBuildingEntrance(
        buildingId,
        entranceLat,
        entranceLon,
        entranceName,
        entranceSlot,
        clearSecondary
      );
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const previewBuildingLocally = useCallback(
    (buildingId: string, patch: Partial<Building>) => {
      setBuildings((prev) =>
        prev.map((b) => (b.id === buildingId ? { ...b, ...patch } : b))
      );
    },
    []
  );

  const addOrUpdateCampusBuilding = useCallback(
    async (payload: {
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
    }) => {
      await api.createOrUpdateBuilding(payload);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const removeCampusBuilding = useCallback(
    async (buildingId: string, keepFootprint: boolean = false) => {
      await api.deleteBuilding(buildingId, keepFootprint);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const removeExtraFootprints = useCallback(
    async (osmWayIds: number[]) => {
      await api.deleteExtraFootprints(osmWayIds);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const addWalkwayEdge = useCallback(
    async (payload: {
      from_lat: number;
      from_lon: number;
      to_lat: number;
      to_lon: number;
      name: string;
    }) => {
      await api.createCustomWalkwayEdge(payload);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const publishAnnouncement = useCallback(
    async (payload: { title: string; message: string; severity: 'info' | 'warning' | 'urgent' }) => {
      await api.createAnnouncement(payload);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const removeAnnouncement = useCallback(
    async (announcementId: number) => {
      await api.deactivateAnnouncement(announcementId);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  return {
    buildings,
    walkGraph,
    activeAlerts,
    blockedEdgeIds,
    announcements,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchResults,
    refreshBootstrap,
    createAlert,
    voteOnAlert,
    deleteAlert,
    toggleEdgeBlocked,
    updateBuildingEntrance,
    previewBuildingLocally,
    addOrUpdateCampusBuilding,
    removeCampusBuilding,
    removeExtraFootprints,
    addWalkwayEdge,
    publishAnnouncement,
    removeAnnouncement,
  };
}
