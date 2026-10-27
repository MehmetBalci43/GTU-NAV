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
export function useNavigation(blockedEdgeIds: string[], isAdmin: boolean = false) {
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
  const routeRequestIdRef = useRef<number>(0);
  const userPosRef = useRef<UserPositionState>(userPos);
  userPosRef.current = userPos;

  const lastRealUserPosRef = useRef<{
    lat: number;
    lon: number;
    source: 'default' | 'gps';
  }>({
    lat: CAMPUS_CONFIG.defaultSimStartCoord.lat,
    lon: CAMPUS_CONFIG.defaultSimStartCoord.lon,
    source: 'default',
  });

  const routeOriginRef = useRef<{
    rawLat: number;
    rawLon: number;
    doorLat: number;
    doorLon: number;
  } | null>(null);

  const computeRouteToBuilding = useCallback(
    async (buildingId: string, startLat?: number, startLon?: number, reasonBanner?: string) => {
      // Defensive origin determination:
      // 1. Explicit start coords if within campus
      // 2. Last known real GPS/user origin or current snapped userPos if within campus
      // 3. Fallback to default campus entrance (Marmaray station exit)
      let originLat = CAMPUS_CONFIG.defaultSimStartCoord.lat;
      let originLon = CAMPUS_CONFIG.defaultSimStartCoord.lon;
      const curPos = userPosRef.current;

      if (
        typeof startLat === 'number' &&
        typeof startLon === 'number' &&
        isWithinCampusBounds(startLat, startLon)
      ) {
        originLat = startLat;
        originLon = startLon;
      } else if (
        curPos.source === 'simulator' &&
        isWithinCampusBounds(lastRealUserPosRef.current.lat, lastRealUserPosRef.current.lon)
      ) {
        originLat = lastRealUserPosRef.current.lat;
        originLon = lastRealUserPosRef.current.lon;
      } else if (isWithinCampusBounds(curPos.rawLat, curPos.rawLon)) {
        originLat = curPos.rawLat;
        originLon = curPos.rawLon;
      } else if (isWithinCampusBounds(curPos.snappedLat, curPos.snappedLon)) {
        originLat = curPos.snappedLat;
        originLon = curPos.snappedLon;
      }

      const reqId = ++routeRequestIdRef.current;
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

        // Ignore stale response if route was cancelled or superseded while in-flight
        if (reqId !== routeRequestIdRef.current) {
          return null;
        }

        setTargetBuildingId(buildingId);
        setActiveRoute(res);
        setSimProgress(0);

        if (reasonBanner) {
          setRerouteNotice(reasonBanner);
          setTimeout(() => setRerouteNotice((prev) => (prev === reasonBanner ? null : prev)), 5000);
        }

        const firstPt = res.coordinates[0];
        const secondPt = res.coordinates.length > 1 ? res.coordinates[1] : firstPt;
        const doorLon = secondPt ? secondPt[0] : originLon;
        const doorLat = secondPt ? secondPt[1] : originLat;
        routeOriginRef.current = {
          rawLat: originLat,
          rawLon: originLon,
          doorLat,
          doorLon,
        };

        // Keep character at their true origin (inside the building) instead of snapping outside
        setUserPos((prev) => ({
          ...prev,
          rawLat: originLat,
          rawLon: originLon,
          snappedLat: originLat,
          snappedLon: originLon,
          isSnapped: false,
          offRouteDistanceMeters: 0,
          remainingMeters: res.distance_m,
          remainingMinutes: res.duration_min,
        }));
        return res;
      } catch (err) {
        if (reqId !== routeRequestIdRef.current) {
          return null;
        }
        const msg = err instanceof Error ? err.message : 'Rota hesaplanamadı';
        setRouteError(msg);
        return null;
      } finally {
        if (reqId === routeRequestIdRef.current) {
          setIsCalculatingRoute(false);
        }
      }
    },
    []
  );

  // Recalculate route if an edge along the active route gets blocked by admin
  useEffect(() => {
    if (!activeRoute || !targetBuildingId) return;
    const hitBlockedEdge = activeRoute.used_edge_ids.some((eid) => blockedEdgeIds.includes(eid));
    if (hitBlockedEdge) {
      const curPos = userPosRef.current;
      computeRouteToBuilding(
        targetBuildingId,
        curPos.rawLat,
        curPos.rawLon,
        isAdmin
          ? '⚠️ Rotanız üzerindeki bir yürüyüş yolu kapatıldı. A* algoritması alternatif güvenli rotayı hesapladı.'
          : 'Rotanız üzerindeki bir yürüyüş yolu kapandığı için alternatif güzergâh oluşturuldu.'
      );
    }
  }, [blockedEdgeIds, activeRoute, targetBuildingId, computeRouteToBuilding, isAdmin]);

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

      if (source !== 'simulator') {
        lastRealUserPosRef.current = {
          lat: rawLat,
          lon: rawLon,
          source: source === 'gps' ? 'gps' : 'default',
        };
      }

      const prevSource = userPosRef.current.source;

      if (activeRoute && activeRoute.coordinates.length >= 2) {
        const snap = snapLocationToRoute(
          rawLat,
          rawLon,
          activeRoute.coordinates,
          accuracyM,
          source === 'simulator'
        );

        // If user started inside a building and hasn't walked away from their indoor origin yet,
        // keep them at their true indoor GPS coordinates and prevent false off-route recalculations
        const originInfo = routeOriginRef.current;
        const distFromRawOriginM = originInfo
          ? haversineDistanceM(rawLat, rawLon, originInfo.rawLat, originInfo.rawLon)
          : Infinity;
        const originToDoorM = originInfo
          ? haversineDistanceM(originInfo.rawLat, originInfo.rawLon, originInfo.doorLat, originInfo.doorLon)
          : 0;
        const isStillInsideStartBuilding =
          source !== 'simulator' &&
          originInfo !== null &&
          originToDoorM > 3.0 &&
          distFromRawOriginM <= 24.0 &&
          snap.distanceToRouteM > CAMPUS_CONFIG.snapThresholdMeters;

        const effectiveSnappedLat = isStillInsideStartBuilding ? rawLat : snap.lat;
        const effectiveSnappedLon = isStillInsideStartBuilding ? rawLon : snap.lon;
        const effectiveIsSnapped = isStillInsideStartBuilding ? false : snap.isSnapped;
        const effectiveIsOffRoute = isStillInsideStartBuilding ? false : snap.isOffRoute;

        // Calculate remaining route distance from snapped point
        let remainingMeters = activeRoute.distance_m;
        if (snap.segmentIndex < activeRoute.coordinates.length - 1) {
          const nextPt = activeRoute.coordinates[snap.segmentIndex + 1];
          let dist = haversineDistanceM(effectiveSnappedLat, effectiveSnappedLon, nextPt[1], nextPt[0]);
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
          snappedLat: effectiveSnappedLat,
          snappedLon: effectiveSnappedLon,
          isSnapped: effectiveIsSnapped,
          offRouteDistanceMeters: isStillInsideStartBuilding ? 0 : snap.distanceToRouteM,
          remainingMeters,
          remainingMinutes,
          source,
        });

        // Simulator follows activeRoute directly; never trigger off-route A* recalculation from simulator steps
        if (source === 'simulator') {
          return;
        }

        // If GPS was just activated while a route from another origin was active, reroute immediately on first fix
        const isFirstGpsLock = prevSource !== 'gps' && source === 'gps';

        // 3 consecutive strikes off-route (or immediate first GPS lock) trigger A* recalculation from current position
        if (effectiveIsOffRoute) {
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
              : isAdmin
                ? '🔄 Rotadan sapma algılandı. Yeni konumunuza göre A* rotası güncellendi.'
                : 'Yeni konumunuza göre yürüyüş rotası güncellendi.'
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
    [activeRoute, targetBuildingId, computeRouteToBuilding]
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

  const toggleSimulateWalk = useCallback(() => {
    setIsSimulatingWalk((prev) => {
      const next = !prev;
      if (!next) {
        // Pausing or stopping walking simulation: restore character directly to real indoor / GPS position!
        setSimProgress(0);
        const restored = lastRealUserPosRef.current;
        setUserPos((p) => ({
          ...p,
          rawLat: restored.lat,
          rawLon: restored.lon,
          snappedLat: restored.lat,
          snappedLon: restored.lon,
          isSnapped: false,
          offRouteDistanceMeters: 0,
          source: restored.source,
        }));
      } else {
        setSimProgress(0);
      }
      return next;
    });
  }, []);

  const setUserStartCoords = useCallback(
    (lat: number, lon: number) => {
      if (!isWithinCampusBounds(lat, lon)) {
        setRerouteNotice('Seçtiğiniz başlangıç noktası kampüs sınırları dışındadır.');
        setTimeout(() => setRerouteNotice(null), 4000);
        return;
      }
      lastRealUserPosRef.current = { lat, lon, source: 'default' };
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
    routeRequestIdRef.current += 1;
    offRouteStrikeCountRef.current = 0;
    routeOriginRef.current = null;
    setIsCalculatingRoute(false);
    setIsSimulatingWalk(false);
    setActiveRoute(null);
    setTargetBuildingId(null);
    setSimProgress(0);
    setRouteError(null);
    const restored = lastRealUserPosRef.current;
    setUserPos({
      rawLat: restored.lat,
      rawLon: restored.lon,
      snappedLat: restored.lat,
      snappedLon: restored.lon,
      isSnapped: false,
      offRouteDistanceMeters: 0,
      remainingMeters: 0,
      remainingMinutes: 0,
      source: restored.source,
    });
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
    toggleSimulateWalk,
    clearNavigation,
  };
}
