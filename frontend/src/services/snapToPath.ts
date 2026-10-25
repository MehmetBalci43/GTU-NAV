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
 * Aşama 1: 1.8m Jitter Kalkanı ve Hafif 2B Kalman Filtresi
 * Bina aralarında Multipath Error nedeniyle zıplayan ham GPS sinyalini yumuşatır.
 */
class LightweightKalman2D {
  private lat: number | null = null;
  private lon: number | null = null;
  private variance = 9.0; // m^2

  reset(): void {
    this.lat = null;
    this.lon = null;
    this.variance = 9.0;
  }

  filter(rawLat: number, rawLon: number, accuracyM: number = 6.0): { lat: number; lon: number } {
    const clampedAcc = Math.max(2.0, Math.min(35.0, accuracyM));
    if (this.lat === null || this.lon === null) {
      this.lat = rawLat;
      this.lon = rawLon;
      this.variance = clampedAcc * clampedAcc;
      return { lat: rawLat, lon: rawLon };
    }

    const deltaM = haversineDistanceM(this.lat, this.lon, rawLat, rawLon);
    // 1.8m Jitter Kalkanı: Dururken GPS hata yarıçapı içindeki küçük titremeleri yok say
    if (deltaM < 1.8 && clampedAcc >= deltaM) {
      return { lat: this.lat, lon: this.lon };
    }

    // Süreç gürültüsü Q (yaya yürüyüş ivmesi)
    const processNoiseQ = 3.2;
    this.variance += processNoiseQ;

    const measurementNoiseR = clampedAcc * clampedAcc;
    const kalmanGain = this.variance / (this.variance + measurementNoiseR);

    this.lat = this.lat + kalmanGain * (rawLat - this.lat);
    this.lon = this.lon + kalmanGain * (rawLon - this.lon);
    this.variance = (1.0 - kalmanGain) * this.variance;

    return {
      lat: Number(this.lat.toFixed(6)),
      lon: Number(this.lon.toFixed(6)),
    };
  }
}

const sharedKalman = new LightweightKalman2D();

export function resetGpsKalmanFilter(): void {
  sharedKalman.reset();
}

export function smoothGpsCoordinate(
  rawLat: number,
  rawLon: number,
  accuracyM: number = 5.0
): { lat: number; lon: number } {
  return sharedKalman.filter(rawLat, rawLon, accuracyM);
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
 * Kullanıcının Kalman ile filtrelenmiş GPS konumunu aktif yürüyüş rotası çizgisine dik izdüşümle mıknatıslar.
 * Eğer mesafe <= 15m ise nokta tam yürüyüş çizgisinin üzerinde ilerler (bina içine girmez).
 * Eğer mesafe > 18m ise kullanıcının rotadan saptığını (isOffRoute = true) bildirir.
 */
export function snapLocationToRoute(
  rawLat: number,
  rawLon: number,
  routeCoords: [number, number][],
  accuracyM: number = 5.0
): SnappedLocationResult {
  const smoothed = smoothGpsCoordinate(rawLat, rawLon, accuracyM);
  const sLat = smoothed.lat;
  const sLon = smoothed.lon;

  if (!routeCoords || routeCoords.length < 2) {
    return {
      lat: sLat,
      lon: sLon,
      distanceToRouteM: 0,
      isSnapped: false,
      isOffRoute: false,
      segmentIndex: 0,
    };
  }

  let bestLon = sLon;
  let bestLat = sLat;
  let bestDist = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLon, aLat] = routeCoords[i];
    const [bLon, bLat] = routeCoords[i + 1];
    const proj = projectPointOnSegment(sLon, sLat, aLon, aLat, bLon, bLat);
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
    lat: isSnapped ? Number(bestLat.toFixed(6)) : sLat,
    lon: isSnapped ? Number(bestLon.toFixed(6)) : sLon,
    distanceToRouteM: Math.round(bestDist * 10) / 10,
    isSnapped,
    isOffRoute,
    segmentIndex: bestIndex,
  };
}
