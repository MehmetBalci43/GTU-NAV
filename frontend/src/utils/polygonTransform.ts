/**
 * Geometry transformation utilities for 2D/3D Campus Building Polygons.
 * Supports both GeoJSON Polygon (number[][][]) and MultiPolygon (number[][][][]) coordinates,
 * with latitude-corrected aspect ratio so rotation never distorts building shapes.
 */

export function createDefaultBuildingRing(
  centerLon: number,
  centerLat: number,
  widthMeters: number = 36,
  lengthMeters: number = 24
): number[][] {
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const dLon = widthMeters / 2 / (111320 * cosLat);
  const dLat = lengthMeters / 2 / 110540;

  return [
    [Number((centerLon - dLon).toFixed(6)), Number((centerLat - dLat).toFixed(6))],
    [Number((centerLon + dLon).toFixed(6)), Number((centerLat - dLat).toFixed(6))],
    [Number((centerLon + dLon).toFixed(6)), Number((centerLat + dLat).toFixed(6))],
    [Number((centerLon - dLon).toFixed(6)), Number((centerLat + dLat).toFixed(6))],
    [Number((centerLon - dLon).toFixed(6)), Number((centerLat - dLat).toFixed(6))],
  ];
}

export function getPolygonCoordsCenter(polyCoords: any): [number, number] {
  if (!polyCoords || !Array.isArray(polyCoords) || polyCoords.length === 0) {
    return [29.3595, 40.8085];
  }

  const isMulti = Array.isArray(polyCoords[0]?.[0]?.[0]);
  const rings: number[][][] = isMulti
    ? polyCoords.map((p: any) => p?.[0]).filter((r: any) => Array.isArray(r) && r.length >= 3)
    : Array.isArray(polyCoords[0]) && polyCoords[0].length >= 3
    ? [polyCoords[0]]
    : [];

  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (const ring of rings) {
    const n =
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.length - 1
        : ring.length;
    for (let i = 0; i < n; i++) {
      if (typeof ring[i]?.[0] === 'number' && typeof ring[i]?.[1] === 'number') {
        sumLon += ring[i][0];
        sumLat += ring[i][1];
        count++;
      }
    }
  }

  if (count === 0) return [29.3595, 40.8085];
  return [Number((sumLon / count).toFixed(6)), Number((sumLat / count).toFixed(6))];
}

function transformRing(
  ring: number[][],
  centerLon: number,
  centerLat: number,
  options: {
    scaleX?: number;
    scaleY?: number;
    rotateDeg?: number;
    dLon?: number;
    dLat?: number;
  }
): number[][] {
  const { scaleX = 1, scaleY = 1, rotateDeg = 0, dLon = 0, dLat = 0 } = options;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const rad = (rotateDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const transformed = ring.map((pt) => {
    const lon = pt[0];
    const lat = pt[1];

    // Local metric-proportional offsets from center
    let dx = (lon - centerLon) * cosLat * scaleX;
    let dy = (lat - centerLat) * scaleY;

    if (rotateDeg !== 0) {
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      dx = rx;
      dy = ry;
    }

    const newLon = centerLon + dx / cosLat + dLon;
    const newLat = centerLat + dy + dLat;
    return [Number(newLon.toFixed(6)), Number(newLat.toFixed(6))];
  });

  if (transformed.length >= 3) {
    transformed[transformed.length - 1] = [...transformed[0]];
  }
  return transformed;
}

export function transformBuildingPolygon(
  polyCoords: any,
  options: {
    scaleX?: number;
    scaleY?: number;
    rotateDeg?: number;
    dLon?: number;
    dLat?: number;
  }
): { polygon_coords: any; lat: number; lon: number } {
  const [centerLon, centerLat] = getPolygonCoordsCenter(polyCoords);
  const isMulti = Array.isArray(polyCoords?.[0]?.[0]?.[0]);

  let nextPoly: any;
  if (isMulti) {
    nextPoly = polyCoords.map((poly: number[][][]) =>
      poly.map((ring: number[][]) => transformRing(ring, centerLon, centerLat, options))
    );
  } else if (Array.isArray(polyCoords?.[0])) {
    nextPoly = polyCoords.map((ring: number[][]) =>
      transformRing(ring, centerLon, centerLat, options)
    );
  } else {
    const defaultRing = createDefaultBuildingRing(centerLon, centerLat);
    nextPoly = [transformRing(defaultRing, centerLon, centerLat, options)];
  }

  const [newLon, newLat] = getPolygonCoordsCenter(nextPoly);
  return {
    polygon_coords: nextPoly,
    lat: newLat,
    lon: newLon,
  };
}
