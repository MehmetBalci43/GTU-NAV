import { useState, useEffect, useCallback, useRef } from 'react';
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

  const buildingsRef = useRef<Building[]>(buildings);
  buildingsRef.current = buildings;
  const dirtyBuildingsRef = useRef<Map<string, Partial<Building>>>(new Map());
  const autoSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await api.getBootstrap();
      const mergedBuildings = data.buildings.map((b) => {
        const pendingPatch = dirtyBuildingsRef.current.get(b.id);
        return pendingPatch ? { ...b, ...pendingPatch } : b;
      });
      setBuildings((prev) =>
        JSON.stringify(prev) === JSON.stringify(mergedBuildings) ? prev : mergedBuildings
      );
      setWalkGraph((prev) =>
        JSON.stringify(prev) === JSON.stringify(data.walk_graph) ? prev : data.walk_graph
      );
      setActiveAlerts((prev) =>
        JSON.stringify(prev) === JSON.stringify(data.active_alerts) ? prev : data.active_alerts
      );
      setBlockedEdgeIds((prev) =>
        JSON.stringify(prev) === JSON.stringify(data.blocked_edge_ids) ? prev : data.blocked_edge_ids
      );
      setAnnouncements((prev) =>
        JSON.stringify(prev) === JSON.stringify(data.announcements) ? prev : data.announcements
      );
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
    }, 8000);

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
      const prevPatch = dirtyBuildingsRef.current.get(buildingId) || {};
      const nextPatch = { ...prevPatch, ...patch };
      dirtyBuildingsRef.current.set(buildingId, nextPatch);

      setBuildings((prev) => {
        const nextList = prev.map((b) => (b.id === buildingId ? { ...b, ...nextPatch } : b));
        buildingsRef.current = nextList;
        return nextList;
      });

      const prevTimer = autoSaveTimersRef.current.get(buildingId);
      if (prevTimer) clearTimeout(prevTimer);

      const timer = setTimeout(async () => {
        const target = buildingsRef.current.find((b) => b.id === buildingId);
        if (!target || target.code.trim().length < 2 || target.name.trim().length < 3) return;
        try {
          await api.createOrUpdateBuilding({
            id: target.id,
            code: target.code,
            name: target.name,
            category: target.category,
            floors_count: target.floors_count,
            lat: target.lat,
            lon: target.lon,
            entrance_lat: target.entrance_lat,
            entrance_lon: target.entrance_lon,
            entrance_name: target.entrance_name,
            secondary_entrance_lat: target.secondary_entrance_lat ?? undefined,
            secondary_entrance_lon: target.secondary_entrance_lon ?? undefined,
            secondary_entrance_name: target.secondary_entrance_name ?? undefined,
            polygon_coords: target.polygon_coords,
            description: target.description ?? undefined,
          });
          if (dirtyBuildingsRef.current.get(buildingId) === nextPatch) {
            dirtyBuildingsRef.current.delete(buildingId);
          }
        } catch {
          // Keep dirty patch in memory if network/auth temporarily fails
        }
      }, 220);

      autoSaveTimersRef.current.set(buildingId, timer);
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
      const prevTimer = autoSaveTimersRef.current.get(payload.id);
      if (prevTimer) {
        clearTimeout(prevTimer);
        autoSaveTimersRef.current.delete(payload.id);
      }
      dirtyBuildingsRef.current.delete(payload.id);
      await api.createOrUpdateBuilding(payload);
      await refreshBootstrap();
    },
    [refreshBootstrap]
  );

  const removeCampusBuilding = useCallback(
    async (buildingId: string, keepFootprint: boolean = false) => {
      const prevTimer = autoSaveTimersRef.current.get(buildingId);
      if (prevTimer) {
        clearTimeout(prevTimer);
        autoSaveTimersRef.current.delete(buildingId);
      }
      dirtyBuildingsRef.current.delete(buildingId);
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

  const updateExtraFootprints = useCallback(
    async (footprints: { osm_way_id: number; name?: string; coords: number[][] }[]) => {
      if (footprints.length === 0) return;
      setWalkGraph((prev) => {
        if (!prev) return prev;
        const fpMap = new Map(footprints.map((f) => [f.osm_way_id, f]));
        const existingIds = new Set(
          (prev.extra_building_footprints || []).map((f) => f.osm_way_id)
        );
        const updatedExisting = (prev.extra_building_footprints || []).map((fp) => {
          const patch = fpMap.get(fp.osm_way_id);
          if (!patch) return fp;
          const ring = patch.coords;
          const n = ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
          const avgLon = Number((ring.slice(0, n).reduce((s, p) => s + p[0], 0) / Math.max(1, n)).toFixed(6));
          const avgLat = Number((ring.slice(0, n).reduce((s, p) => s + p[1], 0) / Math.max(1, n)).toFixed(6));
          return {
            ...fp,
            name: patch.name || fp.name,
            coords: patch.coords,
            lat: avgLat,
            lon: avgLon,
          };
        });
        const newItems = footprints
          .filter((f) => !existingIds.has(f.osm_way_id))
          .map((f) => {
            const ring = f.coords;
            const n = ring.length > 3 ? ring.length - 1 : ring.length;
            const avgLon = Number((ring.slice(0, n).reduce((s, p) => s + p[0], 0) / Math.max(1, n)).toFixed(6));
            const avgLat = Number((ring.slice(0, n).reduce((s, p) => s + p[1], 0) / Math.max(1, n)).toFixed(6));
            return {
              osm_way_id: f.osm_way_id,
              name: f.name || 'Kampüs Ek Bina / Laboratuvar',
              coords: f.coords,
              lat: avgLat,
              lon: avgLon,
            };
          });
        return {
          ...prev,
          extra_building_footprints: [...updatedExisting, ...newItems],
        };
      });
      await api.updateExtraFootprints(footprints);
    },
    []
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
    updateExtraFootprints,
    addWalkwayEdge,
    publishAnnouncement,
    removeAnnouncement,
  };
}
