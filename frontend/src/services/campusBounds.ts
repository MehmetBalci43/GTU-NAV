import { CAMPUS_CONFIG } from '../config/campusConfig';

/**
 * Checks whether a given (lat, lon) coordinate is strictly within the GTÜ Çayırova campus boundary box.
 * This prevents off-campus coordinates (e.g. from desktop ISP/Wi-Fi geolocation in Istanbul/Kocaeli)
 * from poisoning the campus A* navigation graph and causing routing failures.
 */
export function isWithinCampusBounds(lat: number, lon: number): boolean {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    isNaN(lat) ||
    isNaN(lon)
  ) {
    return false;
  }

  const minLon = CAMPUS_CONFIG.maxBounds[0][0];
  const minLat = CAMPUS_CONFIG.maxBounds[0][1];
  const maxLon = CAMPUS_CONFIG.maxBounds[1][0];
  const maxLat = CAMPUS_CONFIG.maxBounds[1][1];

  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}
