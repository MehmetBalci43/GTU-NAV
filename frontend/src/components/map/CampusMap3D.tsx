import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Building,
  WalkGraph,
  MapAlert,
  RouteResponse,
} from '../../types/campus';
import { CAMPUS_CONFIG } from '../../config/campusConfig';
import { ALERT_TYPES } from '../../config/alertTypes';
import { UserPositionState } from '../../hooks/useNavigation';

export type AdminMapInteractionMode =
  | 'none'
  | 'toggle_edge'
  | 'move_entrance'
  | 'add_building'
  | 'draw_edge'
  | 'pick_alert_coords'
  | 'pick_user_start';

export type BasemapStyleMode = 'street' | 'dark' | 'satellite';

interface CampusMap3DProps {
  buildings: Building[];
  walkGraph: WalkGraph | null;
  activeAlerts: MapAlert[];
  blockedEdgeIds: string[];
  selectedBuildingId: string | null;
  activeRoute: RouteResponse | null;
  userPos: UserPositionState;
  adminMapMode: AdminMapInteractionMode;
  isLeftDrawerOpen?: boolean;
  isRightDrawerOpen?: boolean;
  onSelectBuilding: (buildingId: string) => void;
  onQuickRouteToBuilding: (buildingId: string) => void;
  onVoteAlert: (alertId: number, vote: 'up' | 'down') => void;
  onAdminToggleEdge: (edgeId: string, currentlyBlocked: boolean) => void;
  onAdminMoveEntrance: (lat: number, lon: number) => void;
  onAdminPickBuildingCoords: (lat: number, lon: number) => void;
  onAdminDrawWalkwayPoint: (lat: number, lon: number) => void;
  onPickAlertCoords: (lat: number, lon: number, nearestEdgeId?: string | null) => void;
  onPickUserStartCoords?: (lat: number, lon: number) => void;
  onCancelMapMode?: () => void;
}

/**
 * Builds a single unified MapLibre StyleSpecification using ONLY 100% API-key-free sources
 * (OpenStreetMap Standard for Street + GPU Dark Shader for Dark Mode, and Esri World Imagery for Satellite).
 * Switching basemaps simply toggles layer visibility in 0ms without destroying 3D layers or requiring API keys.
 */
function createUnifiedMapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'basemap-street-src': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      'basemap-satellite-src': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri World Imagery',
      },
    },
    layers: [
      {
        id: 'basemap-street',
        type: 'raster',
        source: 'basemap-street-src',
        layout: { visibility: 'visible' },
      },
      {
        id: 'basemap-dark',
        type: 'raster',
        source: 'basemap-street-src',
        layout: { visibility: 'none' },
        paint: {
          'raster-brightness-max': 0.36,
          'raster-brightness-min': 0.02,
          'raster-saturation': -0.75,
          'raster-contrast': 0.28,
        },
      },
      {
        id: 'basemap-satellite',
        type: 'raster',
        source: 'basemap-satellite-src',
        layout: { visibility: 'none' },
      },
    ],
  };
}

/**
 * Computes the exact geometric center [lon, lat] of a building's footprint polygon
 * so the badge sits cleanly on the building roof instead of drifting off to the side.
 */
function getBuildingCentroid(b: Building): [number, number] {
  const ring = b.polygon_coords?.[0];
  if (!ring || ring.length < 3) {
    return [b.lon, b.lat];
  }
  // Exclude duplicate closing vertex if present
  const count =
    ring.length > 3 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.length - 1
      : ring.length;

  let sumLon = 0;
  let sumLat = 0;
  for (let i = 0; i < count; i++) {
    sumLon += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLon / count, sumLat / count];
}

/**
 * IMPORTANT: Never apply `transition-transform` or `scale-*` to the root MapLibre Marker element,
 * because MapLibre positions markers using inline `style.transform = translate(...)` on every frame.
 * We style ONLY the inner `<button>` element with `transition-colors`!
 */
function getInnerButtonClassName(isSelected: boolean): string {
  return `group relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold shadow-md border transition-colors cursor-pointer select-none whitespace-nowrap ${
    isSelected
      ? 'bg-sky-400 text-slate-950 border-white ring-2 ring-sky-300 shadow-sky-500/40'
      : 'bg-slate-900/95 text-slate-100 border-slate-600/90 hover:bg-slate-800 hover:border-sky-400'
  }`;
}

export const CampusMap3D: React.FC<CampusMap3DProps> = ({
  buildings,
  walkGraph,
  activeAlerts,
  blockedEdgeIds,
  selectedBuildingId,
  activeRoute,
  userPos,
  adminMapMode,
  isLeftDrawerOpen = false,
  isRightDrawerOpen = false,
  onSelectBuilding,
  onVoteAlert,
  onAdminToggleEdge,
  onAdminMoveEntrance,
  onAdminPickBuildingCoords,
  onAdminDrawWalkwayPoint,
  onPickAlertCoords,
  onPickUserStartCoords,
  onCancelMapMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Building markers cached in a Map: wrapper is owned by MapLibre, btn is styled by us
  const buildingMarkersMapRef = useRef<
    Map<
      string,
      {
        marker: maplibregl.Marker;
        wrapper: HTMLDivElement;
        btn: HTMLButtonElement;
      }
    >
  >(new Map());
  const alertMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const rawGpsMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [basemapMode, setBasemapMode] = useState<BasemapStyleMode>('street');
  const [is3DPitch, setIs3DPitch] = useState<boolean>(true);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [showBuildingLabels, setShowBuildingLabels] = useState<boolean>(true);

  const callbacksRef = useRef({
    adminMapMode,
    blockedEdgeIds,
    onSelectBuilding,
    onAdminToggleEdge,
    onAdminMoveEntrance,
    onAdminPickBuildingCoords,
    onAdminDrawWalkwayPoint,
    onPickAlertCoords,
    onPickUserStartCoords,
  });

  useEffect(() => {
    callbacksRef.current = {
      adminMapMode,
      blockedEdgeIds,
      onSelectBuilding,
      onAdminToggleEdge,
      onAdminMoveEntrance,
      onAdminPickBuildingCoords,
      onAdminDrawWalkwayPoint,
      onPickAlertCoords,
      onPickUserStartCoords,
    };
  }, [
    adminMapMode,
    blockedEdgeIds,
    onSelectBuilding,
    onAdminToggleEdge,
    onAdminMoveEntrance,
    onAdminPickBuildingCoords,
    onAdminDrawWalkwayPoint,
    onPickAlertCoords,
    onPickUserStartCoords,
  ]);

  const fitCampusBounds = useCallback(
    (durationMs: number = 750) => {
      const map = mapRef.current;
      if (!map) return;
      map.fitBounds(CAMPUS_CONFIG.campusBounds, {
        padding: {
          top: 105,
          bottom: 75,
          left: isLeftDrawerOpen ? 410 : 50,
          right: isRightDrawerOpen ? 410 : 50,
        },
        pitch: is3DPitch ? CAMPUS_CONFIG.defaultPitch : 0,
        bearing: is3DPitch ? CAMPUS_CONFIG.defaultBearing : 0,
        maxZoom: 16.0,
        duration: durationMs,
      });
    },
    [is3DPitch, isLeftDrawerOpen, isRightDrawerOpen]
  );

  // Initialize MapLibre GL instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createUnifiedMapStyle(),
      center: CAMPUS_CONFIG.defaultCenter,
      zoom: CAMPUS_CONFIG.defaultZoom,
      pitch: CAMPUS_CONFIG.defaultPitch,
      bearing: CAMPUS_CONFIG.defaultBearing,
      maxBounds: CAMPUS_CONFIG.maxBounds,
    });

    map.on('load', () => {
      setIsMapLoaded(true);
      map.fitBounds(CAMPUS_CONFIG.campusBounds, {
        padding: { top: 105, bottom: 75, left: 50, right: 50 },
        pitch: CAMPUS_CONFIG.defaultPitch,
        bearing: CAMPUS_CONFIG.defaultBearing,
        maxZoom: 15.9,
        duration: 0,
      });
    });

    map.on('click', (e) => {
      const cb = callbacksRef.current;
      const clickLat = Number(e.lngLat.lat.toFixed(6));
      const clickLon = Number(e.lngLat.lng.toFixed(6));

      if (cb.adminMapMode === 'pick_user_start') {
        cb.onPickUserStartCoords?.(clickLat, clickLon);
        return;
      }
      if (cb.adminMapMode === 'move_entrance') {
        cb.onAdminMoveEntrance(clickLat, clickLon);
        return;
      }
      if (cb.adminMapMode === 'add_building') {
        cb.onAdminPickBuildingCoords(clickLat, clickLon);
        return;
      }
      if (cb.adminMapMode === 'draw_edge') {
        cb.onAdminDrawWalkwayPoint(clickLat, clickLon);
        return;
      }

      if (
        (cb.adminMapMode === 'toggle_edge' || cb.adminMapMode === 'pick_alert_coords') &&
        map.getLayer('walkway-edges-hit')
      ) {
        const edgeFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['walkway-edges-hit'],
        });
        if (edgeFeatures.length > 0) {
          const edgeId = String(edgeFeatures[0].properties?.id || '');
          if (cb.adminMapMode === 'toggle_edge' && edgeId) {
            const isBlocked = cb.blockedEdgeIds.includes(edgeId);
            cb.onAdminToggleEdge(edgeId, isBlocked);
            return;
          }
          if (cb.adminMapMode === 'pick_alert_coords') {
            cb.onPickAlertCoords(clickLat, clickLon, edgeId || null);
            return;
          }
        }
      }

      if (cb.adminMapMode === 'pick_alert_coords') {
        cb.onPickAlertCoords(clickLat, clickLon, null);
        return;
      }

      // Normal mode: check if a primary 3D building polygon was clicked
      if (map.getLayer('campus-buildings-3d')) {
        const bFeatures = map.queryRenderedFeatures(e.point, {
          layers: ['campus-buildings-3d'],
        });
        if (bFeatures.length > 0) {
          const bId = String(bFeatures[0].properties?.id || '');
          if (bId) {
            cb.onSelectBuilding(bId);
          }
        }
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Instant 0ms Basemap Switch (Never destroys GeoJSON layers or triggers API key errors)
  const handleToggleBasemap = (nextMode: BasemapStyleMode) => {
    setBasemapMode(nextMode);
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const modes: BasemapStyleMode[] = ['street', 'dark', 'satellite'];
    modes.forEach((m) => {
      const layerId = `basemap-${m}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', m === nextMode ? 'visible' : 'none');
      }
    });
  };

  const handleTogglePitch = () => {
    if (!mapRef.current) return;
    const next3D = !is3DPitch;
    setIs3DPitch(next3D);
    mapRef.current.easeTo({
      pitch: next3D ? CAMPUS_CONFIG.defaultPitch : 0,
      bearing: next3D ? CAMPUS_CONFIG.defaultBearing : 0,
      duration: 500,
    });
  };

  // Render GeoJSON Layers (Buildings 3D, Extra Campus Footprints, Walkways, Blocked Edges, Active Route, Entrances)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // 1. Extra OSM Campus Footprints (auxiliary campus buildings)
    const extraFootprintsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: (walkGraph?.extra_building_footprints || []).map((fp) => ({
        type: 'Feature',
        properties: { name: fp.name },
        geometry: {
          type: 'Polygon',
          coordinates: [fp.coords],
        },
      })),
    };

    if (map.getSource('extra-footprints')) {
      (map.getSource('extra-footprints') as maplibregl.GeoJSONSource).setData(extraFootprintsGeoJSON);
    } else {
      map.addSource('extra-footprints', { type: 'geojson', data: extraFootprintsGeoJSON });
      map.addLayer({
        id: 'extra-footprints-3d',
        type: 'fill-extrusion',
        source: 'extra-footprints',
        paint: {
          'fill-extrusion-color': '#64748b',
          'fill-extrusion-height': 8,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.5,
        },
      });
    }

    // 2. Primary Interactive GTÜ Buildings
    const buildingsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: buildings.map((b) => {
        const isSelected = b.id === selectedBuildingId;
        const baseColor =
          CAMPUS_CONFIG.buildingCategoryColors[b.category] || '#3b82f6';
        return {
          type: 'Feature',
          properties: {
            id: b.id,
            code: b.code,
            name: b.name,
            height: Math.max(10, (b.floors_count || 3) * 4.2),
            color: isSelected ? '#38bdf8' : baseColor,
          },
          geometry: {
            type: 'Polygon',
            coordinates: b.polygon_coords,
          },
        };
      }),
    };

    if (map.getSource('campus-buildings')) {
      (map.getSource('campus-buildings') as maplibregl.GeoJSONSource).setData(buildingsGeoJSON);
    } else {
      map.addSource('campus-buildings', { type: 'geojson', data: buildingsGeoJSON });
      map.addLayer({
        id: 'campus-buildings-3d',
        type: 'fill-extrusion',
        source: 'campus-buildings',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88,
        },
      });
    }

    // 3. Pedestrian Walkway Graph
    const nodeMap = new Map<string, [number, number]>();
    (walkGraph?.nodes || []).forEach((n) => {
      nodeMap.set(n.id, [n.lon, n.lat]);
    });

    const walkwayFeatures: GeoJSON.Feature[] = [];
    (walkGraph?.edges || []).forEach((edge) => {
      const u = nodeMap.get(edge.from_node);
      const v = nodeMap.get(edge.to_node);
      if (!u || !v) return;
      const isBlocked = blockedEdgeIds.includes(edge.id);
      walkwayFeatures.push({
        type: 'Feature',
        properties: {
          id: edge.id,
          name: edge.name,
          blocked: isBlocked,
        },
        geometry: {
          type: 'LineString',
          coordinates: [u, v],
        },
      });
    });

    const walkwaysGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: walkwayFeatures,
    };

    if (map.getSource('walkway-edges')) {
      (map.getSource('walkway-edges') as maplibregl.GeoJSONSource).setData(walkwaysGeoJSON);
    } else {
      map.addSource('walkway-edges', { type: 'geojson', data: walkwaysGeoJSON });
      map.addLayer({
        id: 'walkway-edges-open',
        type: 'line',
        source: 'walkway-edges',
        filter: ['==', ['get', 'blocked'], false],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2.2,
          'line-opacity': 0.7,
        },
      });
      map.addLayer({
        id: 'walkway-edges-blocked',
        type: 'line',
        source: 'walkway-edges',
        filter: ['==', ['get', 'blocked'], true],
        paint: {
          'line-color': '#ef4444',
          'line-width': 5,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'walkway-edges-hit',
        type: 'line',
        source: 'walkway-edges',
        paint: {
          'line-color': '#000000',
          'line-width': 16,
          'line-opacity': 0.01,
        },
      });
    }

    // 4. Building Entrance Pins
    const entrancesGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: buildings.map((b) => ({
        type: 'Feature',
        properties: {
          id: b.id,
          entrance_name: b.entrance_name,
        },
        geometry: {
          type: 'Point',
          coordinates: [b.entrance_lon, b.entrance_lat],
        },
      })),
    };

    if (map.getSource('building-entrances')) {
      (map.getSource('building-entrances') as maplibregl.GeoJSONSource).setData(entrancesGeoJSON);
    } else {
      map.addSource('building-entrances', { type: 'geojson', data: entrancesGeoJSON });
      map.addLayer({
        id: 'building-entrances-circle',
        type: 'circle',
        source: 'building-entrances',
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#10b981',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
    }

    // 5. Active Pedestrian A* Route Polyline
    const routeGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        activeRoute && activeRoute.coordinates.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: activeRoute.coordinates,
                },
              },
            ]
          : [],
    };

    if (map.getSource('active-route')) {
      (map.getSource('active-route') as maplibregl.GeoJSONSource).setData(routeGeoJSON);
    } else {
      map.addSource('active-route', { type: 'geojson', data: routeGeoJSON });
      map.addLayer({
        id: 'active-route-glow',
        type: 'line',
        source: 'active-route',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 12,
          'line-opacity': 0.4,
        },
      });
      map.addLayer({
        id: 'active-route-line',
        type: 'line',
        source: 'active-route',
        paint: {
          'line-color': '#0284c7',
          'line-width': 5.5,
          'line-opacity': 0.98,
        },
      });
    }
  }, [buildings, walkGraph, blockedEdgeIds, selectedBuildingId, activeRoute, isMapLoaded]);

  // Synchronize Building Badges anchored to exact polygon centroids with ZERO CSS transform interference
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!showBuildingLabels) {
      buildingMarkersMapRef.current.forEach((entry) => {
        entry.wrapper.style.display = 'none';
      });
      return;
    }

    const currentIds = new Set(buildings.map((b) => b.id));
    buildingMarkersMapRef.current.forEach((entry, bId) => {
      if (!currentIds.has(bId)) {
        entry.marker.remove();
        buildingMarkersMapRef.current.delete(bId);
      }
    });

    buildings.forEach((b) => {
      const [centroidLon, centroidLat] = getBuildingCentroid(b);
      const hasRooms = b.total_rooms_count > 0;
      const dotColor =
        b.free_rooms_count > 0 ? 'bg-emerald-400 text-slate-950' : 'bg-rose-500 text-white';

      const innerMarkup = `
        <span>${b.code}</span>
        ${
          hasRooms
            ? `<span class="px-1 rounded text-[9px] font-black ${dotColor}">${b.free_rooms_count}/${b.total_rooms_count}</span>`
            : ''
        }
        <span class="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-slate-950/95 text-white text-[10px] font-bold border border-slate-700 shadow-xl whitespace-nowrap z-50">
          ${b.name}
        </span>
      `;

      const existing = buildingMarkersMapRef.current.get(b.id);
      if (existing) {
        existing.wrapper.style.display = 'block';
        existing.btn.innerHTML = innerMarkup;
        existing.marker.setLngLat([centroidLon, centroidLat]);
      } else {
        // Root wrapper has ZERO CSS transform/transition classes so MapLibre's translate3d never lags or bounces!
        const wrapper = document.createElement('div');
        wrapper.style.zIndex = b.id === selectedBuildingId ? '30' : '10';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = getInnerButtonClassName(b.id === selectedBuildingId);
        btn.innerHTML = innerMarkup;
        btn.onclick = (ev) => {
          ev.stopPropagation();
          callbacksRef.current.onSelectBuilding(b.id);
        };

        wrapper.appendChild(btn);
        const marker = new maplibregl.Marker({
          element: wrapper,
          anchor: 'center',
        })
          .setLngLat([centroidLon, centroidLat])
          .addTo(map);

        buildingMarkersMapRef.current.set(b.id, { marker, wrapper, btn });
      }
    });
  }, [buildings, showBuildingLabels, selectedBuildingId]);

  // Update selection highlight without touching DOM structure or MapLibre transform
  useEffect(() => {
    buildingMarkersMapRef.current.forEach((entry, bId) => {
      const isSel = bId === selectedBuildingId;
      entry.wrapper.style.zIndex = isSel ? '30' : '10';
      entry.btn.className = getInnerButtonClassName(isSel);
    });
  }, [selectedBuildingId]);

  // Synchronize Map Alert Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    alertMarkersRef.current.forEach((m) => m.remove());
    alertMarkersRef.current = [];

    activeAlerts.forEach((alert) => {
      const cfg = ALERT_TYPES.find((t) => t.id === alert.alert_type);
      const emoji =
        alert.alert_type === 'road_work'
          ? '🚧'
          : alert.alert_type === 'puddle_ice'
          ? '💧'
          : alert.alert_type === 'lighting_fault'
          ? '💡'
          : '🎉';

      const wrapper = document.createElement('div');
      wrapper.style.zIndex = '25';

      const pill = document.createElement('div');
      pill.className =
        'flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/95 text-white border shadow-lg text-[11px] cursor-pointer';
      pill.style.borderColor = cfg?.hexColor || '#f59e0b';
      pill.innerHTML = `<span>${emoji}</span><span class="font-semibold max-w-[110px] truncate">${alert.title}</span><span class="text-[10px] text-emerald-300 font-bold">+${alert.upvotes}</span>`;

      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(`
        <div class="p-2 text-slate-900 text-xs space-y-1.5 min-w-[190px]">
          <div class="font-bold text-slate-950">${emoji} ${alert.title}</div>
          <div class="text-[11px] text-slate-600">${
            alert.blocks_route ? '⛔ Bu yol yaya rotasında kapalıdır' : '⚠️ Kampüs saha uyarısı'
          }</div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-200">
            <span class="text-[11px] font-semibold text-slate-700">Doğruluk Oyu:</span>
            <div class="flex gap-1.5">
              <button data-vote="up" data-id="${alert.id}" class="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold">👍 ${alert.upvotes}</button>
              <button data-vote="down" data-id="${alert.id}" class="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-bold">👎 ${alert.downvotes}</button>
            </div>
          </div>
        </div>
      `);

      popup.on('open', () => {
        const container = popup.getElement();
        if (!container) return;
        const upBtn = container.querySelector('button[data-vote="up"]');
        const downBtn = container.querySelector('button[data-vote="down"]');
        if (upBtn) upBtn.addEventListener('click', () => onVoteAlert(alert.id, 'up'));
        if (downBtn) downBtn.addEventListener('click', () => onVoteAlert(alert.id, 'down'));
      });

      wrapper.appendChild(pill);
      const alertMarker = new maplibregl.Marker({ element: wrapper, anchor: 'center' })
        .setLngLat([alert.lon, alert.lat])
        .setPopup(popup)
        .addTo(map);
      alertMarkersRef.current.push(alertMarker);
    });
  }, [activeAlerts, onVoteAlert]);

  // Update User Snapped Location Dot & Raw GPS Ghost Dot (NO transition-transform on root element!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userMarkerRef.current) {
      const root = document.createElement('div');
      root.style.zIndex = '40';
      const dot = document.createElement('div');
      dot.className =
        'w-5 h-5 rounded-full bg-sky-500 border-[3px] border-white shadow-[0_0_14px_rgba(14,165,233,0.95)]';
      dot.title = 'Yola Mıknatıslanmış (Snap-to-Path) Konumunuz';
      root.appendChild(dot);
      userMarkerRef.current = new maplibregl.Marker({ element: root, anchor: 'center' })
        .setLngLat([userPos.snappedLon, userPos.snappedLat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userPos.snappedLon, userPos.snappedLat]);
    }

    if (!rawGpsMarkerRef.current) {
      const rawRoot = document.createElement('div');
      rawRoot.style.zIndex = '35';
      const rawDot = document.createElement('div');
      rawDot.className =
        'w-3 h-3 rounded-full bg-amber-400/60 border border-amber-200 pointer-events-none';
      rawDot.title = 'Ham GPS Konumu (Snap-to-Path Öncesi)';
      rawRoot.appendChild(rawDot);
      rawGpsMarkerRef.current = new maplibregl.Marker({ element: rawRoot, anchor: 'center' })
        .setLngLat([userPos.rawLon, userPos.rawLat])
        .addTo(map);
    } else {
      rawGpsMarkerRef.current.setLngLat([userPos.rawLon, userPos.rawLat]);
    }
  }, [userPos]);

  // Fly to selected building ONLY when `selectedBuildingId` changes, accounting for right drawer width
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedBuildingId === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = selectedBuildingId;

    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const target = buildings.find((b) => b.id === selectedBuildingId);
    if (target) {
      const [cLon, cLat] = getBuildingCentroid(target);
      map.flyTo({
        center: [cLon, cLat],
        zoom: Math.max(map.getZoom(), 16.5),
        padding: {
          top: 90,
          bottom: 70,
          left: isLeftDrawerOpen ? 390 : 40,
          right: 390,
        },
        duration: 750,
      });
    }
  }, [selectedBuildingId, buildings, isLeftDrawerOpen]);

  return (
    <div
      className={`relative w-full h-full select-none ${
        adminMapMode !== 'none' ? 'cursor-crosshair' : ''
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Interactive Map Picking Banner (Auto-centered, clear Cancel action) */}
      {adminMapMode !== 'none' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-400 text-slate-950 font-extrabold text-xs shadow-2xl border-2 border-white flex items-center gap-3 animate-pulse">
          <span>
            {adminMapMode === 'pick_user_start' &&
              '📍 Haritada yürüyüşe başlamak istediğiniz noktaya tıklayın (Snap-to-Path otomatik yola kilitleyecek)'}
            {adminMapMode === 'toggle_edge' &&
              '🚧 Kapatmak veya açmak istediğiniz turuncu yürüyüş yoluna tıklayın'}
            {adminMapMode === 'move_entrance' &&
              '🚪 Seçili binanın yeni giriş kapısı noktasına haritada tıklayın'}
            {adminMapMode === 'add_building' &&
              '🏛️ Yeni eklenecek binanın harita üzerindeki konumuna tıklayın'}
            {adminMapMode === 'draw_edge' &&
              '📏 Yeni yürüyüş patikası için haritada başlangıç ve bitiş noktalarına tıklayın'}
            {adminMapMode === 'pick_alert_coords' &&
              '⚠️ Uyarı bırakmak istediğiniz yürüyüş yoluna veya noktaya tıklayın'}
          </span>
          {onCancelMapMode && (
            <button
              type="button"
              onClick={onCancelMapMode}
              className="px-2.5 py-0.5 rounded-full bg-slate-950 text-white hover:bg-slate-800 font-bold text-[11px] shrink-0"
            >
              İptal ✕
            </button>
          )}
        </div>
      )}

      {/* Compact Bottom-Left Map Toolbar (Zero overlap with drawers or right controls) */}
      <div className="fixed bottom-4 left-4 z-20 flex flex-wrap items-center gap-1 bg-slate-900/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs">
        <button
          type="button"
          onClick={() => handleToggleBasemap('street')}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
            basemapMode === 'street'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="OpenStreetMap Standart Kampüs Sokak Haritası (API Anahtarsız)"
        >
          🗺️ Sokak
        </button>
        <button
          type="button"
          onClick={() => handleToggleBasemap('dark')}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
            basemapMode === 'dark'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="Gece / Koyu Kampüs Görünümü"
        >
          🌙 Koyu
        </button>
        <button
          type="button"
          onClick={() => handleToggleBasemap('satellite')}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
            basemapMode === 'satellite'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="Esri Yüksek Çözünürlüklü Uydu Görüntüsü"
        >
          🛰️ Uydu
        </button>

        <div className="w-px h-4 bg-slate-700 mx-0.5" />

        <button
          type="button"
          onClick={handleTogglePitch}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
            is3DPitch
              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          {is3DPitch ? '🧊 3B' : '📐 2B'}
        </button>

        <button
          type="button"
          onClick={() => setShowBuildingLabels((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
            showBuildingLabels
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Bina Etiketlerini Göster / Gizle"
        >
          🏷️ Etiketler
        </button>

        <button
          type="button"
          onClick={() => fitCampusBounds(750)}
          className="px-2.5 py-1.5 rounded-lg font-bold bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border border-slate-700 transition-colors"
          title="Tüm GTÜ Kampüs Binalarını Ekrana Sığdır ve Ortala"
        >
          🎯 Kampüsü Ortala
        </button>
      </div>
    </div>
  );
};
