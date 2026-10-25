import { useState, useEffect, useCallback, useRef } from 'react';
import { RouteResponse } from '../types/campus';
import { api } from '../services/apiClient';
import {
  snapLocationToRoute,
  haversineDistanceM,
  resetGpsKalmanFilter,
} from '../services/snapToPath';
import { CAMPUS_CONFIG } from '../config/campusConfig';

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
  const [isLiveGpsActive, setIsLiveGpsActive] = useState<boolean>(false);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);

  const gpsWatchIdRef = useRef<number | null>(null);
  const lastRerouteTimeRef = useRef<number>(0);
  const offRouteStrikeCountRef = useRef<number>(0);

  const computeRouteToBuilding = useCallback(
    async (buildingId: string, startLat?: number, startLon?: number, reasonBanner?: string) => {
      const originLat = startLat ?? userPos.snappedLat;
      const originLon = startLon ?? userPos.snappedLon;

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
          setTimeout(() => setRerouteNotice(null), 5500);
        }
        setUserPos((prev) => ({
          ...prev,
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

  // Automatically recalculate route if any edge along the active route gets closed
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
      if (activeRoute && activeRoute.coordinates.length >= 2) {
        const snap = snapLocationToRoute(rawLat, rawLon, activeRoute.coordinates, accuracyM);
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

        // Spec 02_harita_gps_ve_navigasyon_rehberi.md Bölüm 3:
        // Yalnızca ardışık 3 ölçüm boyunca (>18m) rotadan uzaklaşılırsa yeniden rota hesapla!
        if (snap.isOffRoute) {
          offRouteStrikeCountRef.current += 1;
        } else {
          offRouteStrikeCountRef.current = 0;
        }

        const now = Date.now();
        if (
          offRouteStrikeCountRef.current >= 3 &&
          targetBuildingId &&
          now - lastRerouteTimeRef.current > 4000
        ) {
          offRouteStrikeCountRef.current = 0;
          lastRerouteTimeRef.current = now;
          computeRouteToBuilding(
            targetBuildingId,
            rawLat,
            rawLon,
            '🔄 Rotadan sapma (3 ardışık ölçüm >18m) algılandı. Yeni konumunuza göre A* rotası güncellendi.'
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

  // Desktop Walking Simulator loop (moves student along active route with realistic 2m GPS jitter)
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

  const toggleLiveGps = useCallback(() => {
    if (isLiveGpsActive) {
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      gpsWatchIdRef.current = null;
      setIsLiveGpsActive(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setRouteError('Tarayıcınız canlı GPS konum servisini desteklemiyor.');
      return;
    }

    setIsSimulatingWalk(false);
    setIsLiveGpsActive(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        applyRawCoordinates(
          pos.coords.latitude,
          pos.coords.longitude,
          'gps',
          pos.coords.accuracy || 6.0
        );
      },
      () => {
        setRouteError('Canlı GPS izni alınamadı. Masaüstü Yürüyüş Simülatörünü kullanabilirsiniz.');
        setIsLiveGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
    );
    gpsWatchIdRef.current = id;
  }, [isLiveGpsActive, applyRawCoordinates]);

  const clearNavigation = useCallback(() => {
    setIsSimulatingWalk(false);
    setActiveRoute(null);
    setTargetBuildingId(null);
    setSimProgress(0);
    setRouteError(null);
  }, []);

  return {
    userPos,
    targetBuildingId,
    activeRoute,
    isCalculatingRoute,
    routeError,
    rerouteNotice,
    isSimulatingWalk,
    setIsSimulatingWalk,
    simProgress,
    isLiveGpsActive,
    toggleLiveGps,
    computeRouteToBuilding,
    applyRawCoordinates,
    clearNavigation,
  };
}
