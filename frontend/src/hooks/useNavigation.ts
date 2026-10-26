import { useState, useEffect, useCallback, useRef } from 'react';
import { RouteResponse } from '../types/campus';
import { api } from '../services/apiClient';
import {
  snapLocationToRoute,
  haversineDistanceM,
  resetGpsKalmanFilter,
} from '../services/snapToPath';
import { CAMPUS_CONFIG } from '../config/campusConfig';
import { isWithinCampusBounds } from '../services/campusBounds';

export interface UserPositionState {
  rawLat: number;
  rawLon: number;
  snappedLat: number;
  snappedLon: number;
  isSnapped: boolean;
  offRouteDistanceMeters: number;
  remainingMeters: number;
  remainingMinutes: number;
  source: 'default' | 'simulator' | 'gps';
}

function interpolateAlongPolyline(coords: [number, number][], fraction: number): [number, number] {
  if (coords.length === 0) return [CAMPUS_CONFIG.defaultSimStartCoord.lon, CAMPUS_CONFIG.defaultSimStartCoord.lat];
  if (coords.length === 1 || fraction <= 0) return coords[0];
  if (fraction >= 1) return coords[coords.length - 1];

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const d = haversineDistanceM(lat1, lon1, lat2, lon2);
    segLengths.push(d);
    total += d;
  }
  if (total <= 0.1) return coords[0];

  const targetDist = fraction * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (acc + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - acc) / segLen : 0;
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      return [lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)];
    }
    acc += segLen;
  }
  return coords[coords.length - 1];
}

/**
 * Core Campus Navigation & A* Routing Engine.
 * 100% isolated from direct hardware geolocation to guarantee rock-solid stability.
 * Safe fallback to default campus entrance (Marmaray) if coordinates are outside GTÜ.
 */
export function useNavigation(blockedEdgeIds: string[]) {
  const [userPos, setUserPos] = useState<UserPositionState>({
    rawLat: CAMPUS_CONFIG.defaultSimStartCoord.lat,
    rawLon: CAMPUS_CONFIG.defaultSimStartCoord.lon,
    snappedLat: CAMPUS_CONFIG.defaultSimStartCoord.lat,
    snappedLon: CAMPUS_CONFIG.defaultSimStartCoord.lon,
    isSnapped: false,
    offRouteDistanceMeters: 0,
    remainingMeters: 0,
    remainingMinutes: 0,
    source: 'default',
  });

  const [targetBuildingId, setTargetBuildingId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [isSimulatingWalk, setIsSimulatingWalk] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);

  const lastRerouteTimeRef = useRef<number>(0);
  const offRouteStrikeCountRef = useRef<number>(0);

  const computeRouteToBuilding = useCallback(
    async (buildingId: string, startLat?: number, startLon?: number, reasonBanner?: string) => {
      // Defensive origin determination:
      // 1. Explicit start coords if within campus
      // 2. Current snapped userPos if within campus
      // 3. Fallback to default campus entrance (Marmaray station exit)
      let originLat = CAMPUS_CONFIG.defaultSimStartCoord.lat;
      let originLon = CAMPUS_CONFIG.defaultSimStartCoord.lon;

      if (
        typeof startLat === 'number' &&
        typeof startLon === 'number' &&
        isWithinCampusBounds(startLat, startLon)
      ) {
        originLat = startLat;
        originLon = startLon;
      } else if (isWithinCampusBounds(userPos.snappedLat, userPos.snappedLon)) {
        originLat = userPos.snappedLat;
        originLon = userPos.snappedLon;
      }

      setIsCalculatingRoute(true);
      setRouteError(null);
      offRouteStrikeCountRef.current = 0;
      resetGpsKalmanFilter();

      try {
        const res = await api.calculateRoute({
          start_lat: originLat,
          start_lon: originLon,
          target_building_id: buildingId,
        });

        setTargetBuildingId(buildingId);
        setActiveRoute(res);
        setSimProgress(0);

        if (reasonBanner) {
          setRerouteNotice(reasonBanner);
          setTimeout(() => setRerouteNotice((prev) => (prev === reasonBanner ? null : prev)), 5000);
        }

        const firstPt = res.coordinates[0];
        setUserPos((prev) => ({
          ...prev,
          snappedLon: firstPt ? firstPt[0] : originLon,
          snappedLat: firstPt ? firstPt[1] : originLat,
          isSnapped: true,
          offRouteDistanceMeters: 0,
          remainingMeters: res.distance_m,
          remainingMinutes: res.duration_min,
        }));
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Rota hesaplanamadı';
        setRouteError(msg);
        return null;
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    [userPos.snappedLat, userPos.snappedLon]
  );

  // Recalculate route if an edge along the active route gets blocked by admin
  useEffect(() => {
    if (!activeRoute || !targetBuildingId) return;
    const hitBlockedEdge = activeRoute.used_edge_ids.some((eid) => blockedEdgeIds.includes(eid));
    if (hitBlockedEdge) {
      computeRouteToBuilding(
        targetBuildingId,
        userPos.snappedLat,
        userPos.snappedLon,
        '⚠️ Rotanız üzerindeki bir yürüyüş yolu kapatıldı. A* algoritması alternatif güvenli rotayı hesapladı.'
      );
    }
  }, [blockedEdgeIds, activeRoute, targetBuildingId, userPos.snappedLat, userPos.snappedLon, computeRouteToBuilding]);

  const applyRawCoordinates = useCallback(
    (
      rawLat: number,
      rawLon: number,
      source: 'default' | 'simulator' | 'gps',
      accuracyM: number = 4.5
    ) => {
      // Guard against invalid coordinates
      if (!isWithinCampusBounds(rawLat, rawLon)) {
        return;
      }

      if (activeRoute && activeRoute.coordinates.length >= 2) {
        const snap = snapLocationToRoute(
          rawLat,
          rawLon,
          activeRoute.coordinates,
          accuracyM
        );

        // Calculate remaining route distance from snapped point
        let remainingMeters = activeRoute.distance_m;
        if (snap.segmentIndex < activeRoute.coordinates.length - 1) {
          const nextPt = activeRoute.coordinates[snap.segmentIndex + 1];
          let dist = haversineDistanceM(snap.lat, snap.lon, nextPt[1], nextPt[0]);
          for (let i = snap.segmentIndex + 1; i < activeRoute.coordinates.length - 1; i++) {
            const a = activeRoute.coordinates[i];
            const b = activeRoute.coordinates[i + 1];
            dist += haversineDistanceM(a[1], a[0], b[1], b[0]);
          }
          remainingMeters = Math.round(dist * 10) / 10;
        }
        const remainingMinutes = Math.max(1, Math.ceil(remainingMeters / 80));

        setUserPos({
          rawLat,
          rawLon,
          snappedLat: snap.lat,
          snappedLon: snap.lon,
          isSnapped: snap.isSnapped,
          offRouteDistanceMeters: snap.distanceToRouteM,
          remainingMeters,
          remainingMinutes,
          source,
        });

        // If GPS was just activated while a route from another origin was active, reroute immediately on first fix
        const isFirstGpsLock = userPos.source !== 'gps' && source === 'gps' && snap.distanceToRouteM > 18;

        // 3 consecutive strikes off-route (or immediate first GPS lock) trigger A* recalculation from current position
        if (snap.isOffRoute) {
          offRouteStrikeCountRef.current += 1;
        } else {
          offRouteStrikeCountRef.current = 0;
        }

        const now = Date.now();
        if (
          (isFirstGpsLock || offRouteStrikeCountRef.current >= 3) &&
          targetBuildingId &&
          now - lastRerouteTimeRef.current > (isFirstGpsLock ? 1000 : 5000)
        ) {
          offRouteStrikeCountRef.current = 0;
          lastRerouteTimeRef.current = now;
          computeRouteToBuilding(
            targetBuildingId,
            rawLat,
            rawLon,
            isFirstGpsLock
              ? '📡 Canlı GPS konumunuza göre rota yeniden hesaplandı.'
              : '🔄 Rotadan sapma algılandı. Yeni konumunuza göre A* rotası güncellendi.'
          );
        }
      } else {
        setUserPos({
          rawLat,
          rawLon,
          snappedLat: rawLat,
          snappedLon: rawLon,
          isSnapped: false,
          offRouteDistanceMeters: 0,
          remainingMeters: 0,
          remainingMinutes: 0,
          source,
        });
      }
    },
    [activeRoute, targetBuildingId, userPos.source, computeRouteToBuilding]
  );

  // Desktop Walking Simulator loop (moves student along active route smoothly)
  useEffect(() => {
    if (!isSimulatingWalk || !activeRoute || activeRoute.coordinates.length < 2) {
      return;
    }
    const stepMs = 120;
    const totalDurationMs = Math.max(8000, Math.min(26000, activeRoute.distance_m * 32));
    const delta = stepMs / totalDurationMs;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        const next = prev + delta;
        if (next >= 1) {
          setIsSimulatingWalk(false);
          const [endLon, endLat] = activeRoute.coordinates[activeRoute.coordinates.length - 1];
          applyRawCoordinates(endLat, endLon, 'simulator');
          return 1;
        }
        const [lon, lat] = interpolateAlongPolyline(activeRoute.coordinates, next);
        const jitterLat = lat + Math.sin(next * 48) * 0.000018;
        const jitterLon = lon + Math.cos(next * 48) * 0.000018;
        applyRawCoordinates(jitterLat, jitterLon, 'simulator');
        return next;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [isSimulatingWalk, activeRoute, applyRawCoordinates]);

  const setUserStartCoords = useCallback(
    (lat: number, lon: number) => {
      if (!isWithinCampusBounds(lat, lon)) {
        setRerouteNotice('Seçtiğiniz başlangıç noktası kampüs sınırları dışındadır.');
        setTimeout(() => setRerouteNotice(null), 4000);
        return;
      }
      setUserPos({
        rawLat: lat,
        rawLon: lon,
        snappedLat: lat,
        snappedLon: lon,
        isSnapped: false,
        offRouteDistanceMeters: 0,
        remainingMeters: 0,
        remainingMinutes: 0,
        source: 'default',
      });
      if (targetBuildingId) {
        computeRouteToBuilding(targetBuildingId, lat, lon);
      }
    },
    [targetBuildingId, computeRouteToBuilding]
  );

  const clearNavigation = useCallback(() => {
    setIsSimulatingWalk(false);
    setActiveRoute(null);
    setTargetBuildingId(null);
    setSimProgress(0);
    setRouteError(null);
    setUserPos((prev) => ({
      ...prev,
      rawLat: prev.snappedLat,
      rawLon: prev.snappedLon,
      isSnapped: false,
      offRouteDistanceMeters: 0,
      remainingMeters: 0,
      remainingMinutes: 0,
    }));
  }, []);

  return {
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
  };
}
