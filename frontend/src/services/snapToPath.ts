import { CAMPUS_CONFIG } from '../config/campusConfig';

export interface SnappedLocationResult {
  lat: number;
  lon: number;
  distanceToRouteM: number;
  isSnapped: boolean;
  isOffRoute: boolean;
  segmentIndex: number;
}

/**
 * İki WGS84 koordinatı arasındaki mesafeyi metre cinsinden hesaplar (Haversine).
 */
export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bir P(lon, lat) noktasının A(lon1, lat1) -> B(lon2, lat2) doğru parçası üzerindeki
 * dik izdüşümünü (orthogonal projection) hesaplar.
 */
function projectPointOnSegment(
  pLon: number,
  pLat: number,
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number
): { lon: number; lat: number; distM: number } {
  const cosLat = Math.cos((pLat * Math.PI) / 180);
  const dx = (bLon - aLon) * cosLat;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq <= 1e-12) {
    return {
      lon: aLon,
      lat: aLat,
      distM: haversineDistanceM(pLat, pLon, aLat, aLon),
    };
  }

  const px = (pLon - aLon) * cosLat;
  const py = pLat - aLat;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));

  const projLon = aLon + t * (bLon - aLon);
  const projLat = aLat + t * (bLat - aLat);
  return {
    lon: projLon,
    lat: projLat,
    distM: haversineDistanceM(pLat, pLon, projLat, projLon),
  };
}

/**
 * Yoldan Sapmayan Navigasyon (Snap-to-Path):
 * Kullanıcının ham GPS konumunu aktif yürüyüş rotası çizgisine dik izdüşümle mıknatıslar.
 * Eğer mesafe <= 15m ise nokta tam yürüyüş çizgisinin üzerinde ilerler (bina içine girmez).
 * Eğer mesafe > 18m ise kullanıcının rotadan saptığını (isOffRoute = true) bildirir.
 */
export function snapLocationToRoute(
  rawLat: number,
  rawLon: number,
  routeCoords: [number, number][]
): SnappedLocationResult {
  if (!routeCoords || routeCoords.length < 2) {
    return {
      lat: rawLat,
      lon: rawLon,
      distanceToRouteM: 0,
      isSnapped: false,
      isOffRoute: false,
      segmentIndex: 0,
    };
  }

  let bestLon = rawLon;
  let bestLat = rawLat;
  let bestDist = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLon, aLat] = routeCoords[i];
    const [bLon, bLat] = routeCoords[i + 1];
    const proj = projectPointOnSegment(rawLon, rawLat, aLon, aLat, bLon, bLat);
    if (proj.distM < bestDist) {
      bestDist = proj.distM;
      bestLon = proj.lon;
      bestLat = proj.lat;
      bestIndex = i;
    }
  }

  const isSnapped = bestDist <= CAMPUS_CONFIG.snapThresholdMeters;
  const isOffRoute = bestDist > CAMPUS_CONFIG.offRouteThresholdMeters;

  return {
    lat: isSnapped ? Number(bestLat.toFixed(6)) : rawLat,
    lon: isSnapped ? Number(bestLon.toFixed(6)) : rawLon,
    distanceToRouteM: Math.round(bestDist * 10) / 10,
    isSnapped,
    isOffRoute,
    segmentIndex: bestIndex,
  };
}
