import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Compass,
  Layers,
  Moon,
  Sun,
  Eye,
  EyeOff,
  LocateFixed,
  Box,
  Map as MapIcon,
  MapPin,
} from 'lucide-react';
import {
  Building,
  WalkGraph,
  MapAlert,
  RouteResponse,
} from '../../types/campus';
import { CAMPUS_CONFIG } from '../../config/campusConfig';
import { ALERT_TYPES } from '../../config/alertTypes';
import { isWithinCampusBounds } from '../../services/campusBounds';
import { UserPositionState } from '../../hooks/useNavigation';
import { TactileButton, TactileIconButton } from '../ui/Primitives';

export type AdminMapInteractionMode =
  | 'none'
  | 'toggle_edge'
  | 'move_entrance'
  | 'add_building'
  | 'pick_building_entrance'
  | 'draw_edge'
  | 'pick_alert_coords'
  | 'pick_user_start';

export type BasemapStyleMode = 'diorama' | 'satellite' | 'street';
export type ThemeMode = 'night' | 'day';

export interface MapControlActions {
  basemapMode: BasemapStyleMode;
  is3DPitch: boolean;
  toggleBasemap: (mode?: BasemapStyleMode) => void;
  togglePitch: () => void;
}

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
  bottomSheetHeight?: number;
  isPickingUserStart?: boolean;
  onTogglePickUserStart?: () => void;
  selectedFootprintIds?: number[];
  onAdminToggleFootprintSelection?: (osmWayId: number, name: string) => void;
  onAdminPickEntranceCoords?: (lat: number, lon: number) => void;
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
  onControlsReady?: (actions: MapControlActions) => void;
  isLiveGpsActive?: boolean;
  onToggleLiveGps?: () => void;
}

// Mini Motorways Palette
const PALETTES = {
  night: {
    canvas: '#1A1D27',
    roadCasing: '#12151E',
    roadFill: '#2E3547',
    buildingShadow: 'rgba(0, 0, 0, 0.45)',
    buildingRim: 'rgba(0, 0, 0, 0.25)',
    stroke: 'rgba(255, 255, 255, 0.10)',
    text: '#F8FAFC',
  },
  day: {
    canvas: '#F6F4EE',
    roadCasing: '#E0D9CB',
    roadFill: '#FFFFFF',
    buildingShadow: 'rgba(32, 24, 16, 0.15)',
    buildingRim: 'rgba(0, 0, 0, 0.08)',
    stroke: 'rgba(0, 0, 0, 0.07)',
    text: '#09090B',
  },
};

const CAT_COLORS: Record<string, string> = {
  academic: '#FB7185', // Rose
  library: '#818CF8',  // Indigo
  dining: '#FBBF24',   // Amber
  admin: '#38BDF8',    // Sky
  transit: '#34D399',  // Mint
};

// Mini Motorways Procedural Textures (Grid Mat & Boundary Diagonal Hatch)
function generateGridPattern(theme: ThemeMode): ImageData {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new ImageData(size, size);

  ctx.fillStyle = theme === 'night' ? '#1A1D27' : '#F6F4EE';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle =
    theme === 'night'
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(210, 203, 188, 0.45)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, size - 0.5);
  ctx.lineTo(size, size - 0.5);
  ctx.moveTo(size - 0.5, 0);
  ctx.lineTo(size - 0.5, size);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function generateDiagonalHatch(theme: ThemeMode): ImageData {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new ImageData(size, size);

  ctx.fillStyle = theme === 'night' ? '#141620' : '#EFECE3';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle =
    theme === 'night'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(195, 187, 170, 0.55)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);

  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);

  ctx.moveTo(size / 2, size * 1.5);
  ctx.lineTo(size * 1.5, size / 2);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function updatePatternImages(map: maplibregl.Map, theme: ThemeMode) {
  try {
    const gridData = generateGridPattern(theme);
    if (map.hasImage('grid-pattern')) {
      map.updateImage('grid-pattern', gridData);
    } else {
      map.addImage('grid-pattern', gridData);
    }

    const hatchData = generateDiagonalHatch(theme);
    if (map.hasImage('diagonal-hatch')) {
      map.updateImage('diagonal-hatch', hatchData);
    } else {
      map.addImage('diagonal-hatch', hatchData);
    }
  } catch (e) {
    console.warn('Could not register map pattern textures', e);
  }
}

// Campus diorama boundary mask (donut cutout around GTÜ)
const campusMaskGeoJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          // Outer boundary
          [
            [29.25, 40.7],
            [29.48, 40.7],
            [29.48, 40.92],
            [29.25, 40.92],
            [29.25, 40.7],
          ],
          // Inner diorama board cutout hole
          [
            [29.3525, 40.8035],
            [29.368, 40.8035],
            [29.368, 40.816],
            [29.3525, 40.816],
            [29.3525, 40.8035],
          ],
        ],
      },
    },
  ],
};

const campusBoundaryGeoJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [29.3525, 40.8035],
          [29.368, 40.8035],
          [29.368, 40.816],
          [29.3525, 40.816],
          [29.3525, 40.8035],
        ],
      },
    },
  ],
};

function createUnifiedMapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'basemap-satellite-src': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri World Imagery',
      },
      'basemap-street-src': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'canvas-background',
        type: 'background',
        paint: {
          'background-color': '#1A1D27',
        },
      },
      {
        id: 'basemap-satellite',
        type: 'raster',
        source: 'basemap-satellite-src',
        layout: { visibility: 'none' },
        paint: {
          'raster-saturation': -0.25,
          'raster-contrast': 0.15,
          'raster-brightness-max': 0.85,
        },
      },
      {
        id: 'basemap-street',
        type: 'raster',
        source: 'basemap-street-src',
        layout: { visibility: 'none' },
      },
    ],
  };
}

function getBuildingCentroid(b: Building): [number, number] {
  const ring = b.polygon_coords?.[0];
  if (!ring || ring.length < 3) {
    return [b.lon, b.lat];
  }
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

function getInnerBadgeClassName(isSelected: boolean): string {
  return `apple-poi-badge${isSelected ? ' selected' : ''}`;
}

const ALERT_ICONS: Record<string, string> = {
  road_work: '🚧',
  puddle_ice: '🌊',
  lighting_fault: '💡',
  event_stand: '🎪',
};

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
  bottomSheetHeight = 92,
  isPickingUserStart = false,
  onTogglePickUserStart,
  selectedFootprintIds = [],
  onAdminToggleFootprintSelection,
  onAdminPickEntranceCoords,
  onSelectBuilding,
  onVoteAlert,
  onAdminToggleEdge,
  onAdminMoveEntrance,
  onAdminPickBuildingCoords,
  onAdminDrawWalkwayPoint,
  onPickAlertCoords,
  onPickUserStartCoords,
  onCancelMapMode,
  onControlsReady,
  isLiveGpsActive = false,
  onToggleLiveGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

  const [basemapMode, setBasemapMode] = useState<BasemapStyleMode>('diorama');
  const [themeMode, setThemeMode] = useState<ThemeMode>('night');
  const [is3DPitch, setIs3DPitch] = useState<boolean>(false); // 2D diorama by default per Decision K-04
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [showBuildingLabels, setShowBuildingLabels] = useState<boolean>(true);
  const [currentBearing, setCurrentBearing] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(15.6);

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
    onAdminToggleFootprintSelection,
    onAdminPickEntranceCoords,
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
      onAdminToggleFootprintSelection,
      onAdminPickEntranceCoords,
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
    onAdminToggleFootprintSelection,
    onAdminPickEntranceCoords,
  ]);

  const fitCampusBounds = useCallback(
    (durationMs: number = 750) => {
      const map = mapRef.current;
      if (!map) return;
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      const dynamicBottomPadding = isDesktop
        ? (isRightDrawerOpen ? 60 : 70)
        : Math.max(90, (bottomSheetHeight || 90) + 20);
      map.fitBounds(CAMPUS_CONFIG.campusBounds, {
        padding: {
          top: isDesktop ? 60 : 60,
          bottom: dynamicBottomPadding,
          left: isDesktop ? (isLeftDrawerOpen ? 460 : 400) : 20,
          right: isDesktop ? (isRightDrawerOpen ? 450 : 80) : 20,
        },
        pitch: is3DPitch ? CAMPUS_CONFIG.defaultPitch : 0,
        bearing: is3DPitch ? CAMPUS_CONFIG.defaultBearing : 0,
        maxZoom: 16.0,
        duration: durationMs,
      });
    },
    [is3DPitch, isLeftDrawerOpen, isRightDrawerOpen, bottomSheetHeight]
  );

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createUnifiedMapStyle(),
      center: CAMPUS_CONFIG.defaultCenter,
      zoom: 15.6,
      pitch: 0,
      bearing: 0,
      maxBounds: CAMPUS_CONFIG.maxBounds,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      pitchWithRotate: true,
    });

    // Explicitly enable two-finger and touch gesture handlers
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.dragRotate.enable();

    // Track dynamic zoom and bearing state
    map.on('rotate', () => {
      setCurrentBearing(Math.round(map.getBearing()));
    });
    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    // 1. WebKit / Safari trackpad 2-finger gesture (Simultaneous Zoom & Rotate)
    const canvas = map.getCanvas();
    let gestureStartBearing = 0;
    let gestureStartZoom = 0;

    const onGestureStart = (e: any) => {
      // Do not intercept multi-touch on real touchscreens (let MapLibre touchZoomRotate handle it natively!)
      if ('ontouchstart' in window && navigator.maxTouchPoints > 1) {
        return;
      }
      e.preventDefault();
      gestureStartBearing = map.getBearing();
      gestureStartZoom = map.getZoom();
    };

    const onGestureChange = (e: any) => {
      // Do not intercept touches on touchscreens so mobile pinch zoom & rotate works 100% naturally
      if ('ontouchstart' in window && navigator.maxTouchPoints > 1) {
        return;
      }
      e.preventDefault();

      // Simultaneous Trackpad Zoom & Rotate
      if (typeof e.scale === 'number' && e.scale > 0) {
        const targetZoom = gestureStartZoom + Math.log2(e.scale);
        map.setZoom(Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom)));
      }
      if (typeof e.rotation === 'number') {
        map.setBearing(gestureStartBearing - e.rotation);
      }
    };
    canvas.addEventListener('gesturestart', onGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', onGestureChange, { passive: false });

    // 2. Windows / Precision Touchpad & Wheel
    // (ctrlKey is touchpad pinch-zoom handled natively by MapLibre scrollZoom; Shift or Alt rotates)
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // Leave pinch-to-zoom to MapLibre's scrollZoom

      if (e.shiftKey || e.altKey) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        map.setBearing(map.getBearing() + delta * 0.25);
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    map.on('load', () => {
      setIsMapLoaded(true);

      // Register Mini Motorways procedural textures
      updatePatternImages(map, 'night');
      if (map.getLayer('canvas-background')) {
        map.setPaintProperty('canvas-background', 'background-pattern', 'grid-pattern');
      }

      // Add campus diorama boundary mask & line (Playfield cutout)
      if (!map.getSource('campus-mask')) {
        map.addSource('campus-mask', { type: 'geojson', data: campusMaskGeoJSON });
        map.addLayer({
          id: 'campus-mask-fill',
          type: 'fill',
          source: 'campus-mask',
          paint: {
            'fill-pattern': 'diagonal-hatch',
            'fill-opacity': 0.85,
          },
        });
      }

      if (!map.getSource('campus-boundary')) {
        map.addSource('campus-boundary', { type: 'geojson', data: campusBoundaryGeoJSON });
        map.addLayer({
          id: 'campus-boundary-line',
          type: 'line',
          source: 'campus-boundary',
          paint: {
            'line-color': 'rgba(255, 255, 255, 0.12)',
            'line-width': 1.5,
            'line-dasharray': [3, 2],
          },
        });
      }

      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      map.fitBounds(CAMPUS_CONFIG.campusBounds, {
        padding: {
          top: isDesktop ? 60 : 60,
          bottom: isDesktop ? 70 : 100,
          left: isDesktop ? 400 : 20,
          right: isDesktop ? 80 : 20,
        },
        pitch: 0,
        bearing: 0,
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
      if (cb.adminMapMode === 'pick_building_entrance') {
        cb.onAdminPickEntranceCoords?.(clickLat, clickLon);
        return;
      }
      if (cb.adminMapMode === 'add_building') {
        // First check if an OSM footprint was clicked
        if (map.getLayer('extra-footprints-fill')) {
          const fpFeatures = map.queryRenderedFeatures(e.point, {
            layers: ['extra-footprints-fill'],
          });
          if (fpFeatures.length > 0) {
            const wayId = Number(fpFeatures[0].properties?.osm_way_id);
            const fpName = String(fpFeatures[0].properties?.name || '');
            if (wayId) {
              cb.onAdminToggleFootprintSelection?.(wayId, fpName);
              return;
            }
          }
        }
        // Fallback: clicked open ground
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

      // Normal mode: check if building was clicked (supports both 2D top layer and 3D extrusion)
      const layersToCheck = ['campus-buildings-3d', 'buildings-top'].filter((id) =>
        Boolean(map.getLayer(id))
      );
      if (layersToCheck.length > 0) {
        const bFeatures = map.queryRenderedFeatures(e.point, {
          layers: layersToCheck,
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
      canvas.removeEventListener('gesturestart', onGestureStart);
      canvas.removeEventListener('gesturechange', onGestureChange);
      canvas.removeEventListener('wheel', onWheel);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update theme & basemap paint properties
  const handleToggleBasemap = (targetMode?: BasemapStyleMode) => {
    const nextMode = targetMode || (basemapMode === 'diorama' ? 'satellite' : 'diorama');
    setBasemapMode(nextMode);
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (map.getLayer('basemap-satellite')) {
      map.setLayoutProperty(
        'basemap-satellite',
        'visibility',
        nextMode === 'satellite' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('basemap-street')) {
      map.setLayoutProperty(
        'basemap-street',
        'visibility',
        nextMode === 'street' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('canvas-background')) {
      map.setLayoutProperty(
        'canvas-background',
        'visibility',
        nextMode === 'diorama' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('campus-mask-fill')) {
      map.setLayoutProperty(
        'campus-mask-fill',
        'visibility',
        nextMode === 'diorama' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('campus-boundary-line')) {
      map.setLayoutProperty(
        'campus-boundary-line',
        'visibility',
        nextMode === 'diorama' ? 'visible' : 'none'
      );
    }
  };

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = themeMode === 'night' ? 'day' : 'night';
    setThemeMode(nextTheme);

    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Update procedural textures
    updatePatternImages(map, nextTheme);

    const p = PALETTES[nextTheme];
    if (map.getLayer('canvas-background')) {
      map.setPaintProperty('canvas-background', 'background-color', p.canvas);
      map.setPaintProperty('canvas-background', 'background-pattern', 'grid-pattern');
    }
    if (map.getLayer('campus-mask-fill')) {
      map.setPaintProperty('campus-mask-fill', 'fill-pattern', 'diagonal-hatch');
    }
    if (map.getLayer('campus-boundary-line')) {
      map.setPaintProperty(
        'campus-boundary-line',
        'line-color',
        nextTheme === 'night' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'
      );
    }
    if (map.getLayer('walkways-casing')) {
      map.setPaintProperty('walkways-casing', 'line-color', p.roadCasing);
    }
    if (map.getLayer('walkways-fill')) {
      map.setPaintProperty('walkways-fill', 'line-color', p.roadFill);
    }
    if (map.getLayer('buildings-shadow')) {
      map.setPaintProperty('buildings-shadow', 'fill-color', p.buildingShadow);
    }
    if (map.getLayer('buildings-rim')) {
      map.setPaintProperty('buildings-rim', 'fill-color', p.buildingRim);
    }
    if (map.getLayer('buildings-stroke')) {
      map.setPaintProperty('buildings-stroke', 'line-color', [
        'case',
        ['==', ['get', 'id'], selectedBuildingId || ''],
        '#0284C7',
        p.stroke,
      ]);
    }
    if (map.getLayer('building-entrances-circle')) {
      map.setPaintProperty(
        'building-entrances-circle',
        'circle-stroke-color',
        nextTheme === 'night' ? '#0F172A' : '#FFFFFF'
      );
    }
    if (map.getLayer('extra-footprints-fill')) {
      map.setPaintProperty('extra-footprints-fill', 'fill-color', [
        'case',
        ['boolean', ['get', 'is_selected'], false],
        '#10B981',
        ['boolean', ['get', 'is_interactive'], false],
        nextTheme === 'night' ? '#F59E0B' : '#FBBF24',
        nextTheme === 'night' ? '#272E3E' : '#E8E4D9',
      ]);
    }
    if (map.getLayer('extra-footprints-stroke')) {
      map.setPaintProperty('extra-footprints-stroke', 'line-color', [
        'case',
        ['boolean', ['get', 'is_selected'], false],
        '#065F46',
        ['boolean', ['get', 'is_interactive'], false],
        '#D97706',
        nextTheme === 'night' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      ]);
    }
  };

  const handleTogglePitch = () => {
    if (!mapRef.current) return;
    const next3D = !is3DPitch;
    setIs3DPitch(next3D);

    const map = mapRef.current;
    map.easeTo({
      pitch: next3D ? CAMPUS_CONFIG.defaultPitch : 0,
      bearing: next3D ? CAMPUS_CONFIG.defaultBearing : 0,
      duration: 500,
    });

    // Toggle 2D diorama layers vs 3D fill extrusion
    const dioramaLayers = [
      'buildings-shadow',
      'buildings-rim',
      'buildings-top',
      'buildings-stroke',
    ];
    dioramaLayers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', next3D ? 'none' : 'visible');
      }
    });

    if (map.getLayer('campus-buildings-3d')) {
      map.setLayoutProperty('campus-buildings-3d', 'visibility', next3D ? 'visible' : 'none');
    }
  };

  const onControlsReadyRef = useRef(onControlsReady);
  useEffect(() => {
    onControlsReadyRef.current = onControlsReady;
  }, [onControlsReady]);

  useEffect(() => {
    onControlsReadyRef.current?.({
      basemapMode,
      is3DPitch,
      toggleBasemap: (m) => handleToggleBasemap(m),
      togglePitch: () => handleTogglePitch(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemapMode, is3DPitch, isMapLoaded]);

  // Render GeoJSON Layers (Mini Motorways Walkways, Diorama Buildings, Entrances, Active Route)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const p = PALETTES[themeMode];

    // 1. Walkways Data & Layers
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
      if (map.getLayer('walkways-casing')) {
        map.setPaintProperty('walkways-casing', 'line-color', p.roadCasing);
      }
      if (map.getLayer('walkways-fill')) {
        map.setPaintProperty('walkways-fill', 'line-color', p.roadFill);
      }
    } else {
      map.addSource('walkway-edges', { type: 'geojson', data: walkwaysGeoJSON });

      // Layer 1: Road Casing (Bottom tube border & soft cushion)
      map.addLayer({
        id: 'walkways-casing',
        type: 'line',
        source: 'walkway-edges',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.roadCasing,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            13, 5,
            15, 8.5,
            17, 13.5,
            19, 20,
          ],
          'line-opacity': themeMode === 'night' ? 0.95 : 0.85,
        },
      });

      // Layer 2: Road Fill (Top tube surface / tactile road ribbon)
      map.addLayer({
        id: 'walkways-fill',
        type: 'line',
        source: 'walkway-edges',
        filter: ['==', ['get', 'blocked'], false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.roadFill,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            13, 3,
            15, 5.5,
            17, 9.5,
            19, 15,
          ],
        },
      });

      // Layer 3: Blocked Edges Warning (Red dashed line)
      map.addLayer({
        id: 'walkways-blocked',
        type: 'line',
        source: 'walkway-edges',
        filter: ['==', ['get', 'blocked'], true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#EF4444',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 17, 7],
          'line-dasharray': [2, 1.5],
        },
      });

      // Layer 4: Invisible Thick Hit Area for easy edge clicking
      map.addLayer({
        id: 'walkway-edges-hit',
        type: 'line',
        source: 'walkway-edges',
        paint: {
          'line-color': '#000000',
          'line-width': 18,
          'line-opacity': 0.01,
        },
      });
    }

    // 2. Extra OSM Footprints (Subtle background parcels)
    const extraFootprintsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: (walkGraph?.extra_building_footprints || []).map((fp) => {
        const isSel = selectedFootprintIds.includes(fp.osm_way_id);
        return {
          type: 'Feature',
          properties: {
            osm_way_id: fp.osm_way_id,
            name: fp.name,
            is_selected: isSel,
            is_interactive: adminMapMode === 'add_building',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [fp.coords],
          },
        };
      }),
    };

    if (map.getSource('extra-footprints')) {
      (map.getSource('extra-footprints') as maplibregl.GeoJSONSource).setData(extraFootprintsGeoJSON);
      if (map.getLayer('extra-footprints-fill')) {
        map.setPaintProperty('extra-footprints-fill', 'fill-color', [
          'case',
          ['boolean', ['get', 'is_selected'], false],
          '#10B981',
          ['boolean', ['get', 'is_interactive'], false],
          themeMode === 'night' ? '#F59E0B' : '#FBBF24',
          themeMode === 'night' ? '#272E3E' : '#E8E4D9',
        ]);
        map.setPaintProperty('extra-footprints-fill', 'fill-opacity', [
          'case',
          ['boolean', ['get', 'is_selected'], false],
          0.88,
          ['boolean', ['get', 'is_interactive'], false],
          0.65,
          0.14,
        ]);
      }
      if (map.getLayer('extra-footprints-stroke')) {
        map.setPaintProperty('extra-footprints-stroke', 'line-color', [
          'case',
          ['boolean', ['get', 'is_selected'], false],
          '#065F46',
          ['boolean', ['get', 'is_interactive'], false],
          '#D97706',
          themeMode === 'night' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        ]);
        map.setPaintProperty('extra-footprints-stroke', 'line-width', [
          'case',
          ['boolean', ['get', 'is_selected'], false],
          2.5,
          ['boolean', ['get', 'is_interactive'], false],
          1.8,
          0.5,
        ]);
      }
    } else {
      map.addSource('extra-footprints', { type: 'geojson', data: extraFootprintsGeoJSON });
      map.addLayer({
        id: 'extra-footprints-fill',
        type: 'fill',
        source: 'extra-footprints',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            '#10B981',
            ['boolean', ['get', 'is_interactive'], false],
            themeMode === 'night' ? '#F59E0B' : '#FBBF24',
            themeMode === 'night' ? '#272E3E' : '#E8E4D9',
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            0.88,
            ['boolean', ['get', 'is_interactive'], false],
            0.65,
            0.14,
          ],
        },
      });
      map.addLayer({
        id: 'extra-footprints-stroke',
        type: 'line',
        source: 'extra-footprints',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            '#065F46',
            ['boolean', ['get', 'is_interactive'], false],
            '#D97706',
            themeMode === 'night' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            2.5,
            ['boolean', ['get', 'is_interactive'], false],
            1.8,
            0.5,
          ],
        },
      });
    }

    // 3. Primary GTÜ Buildings (Mini Motorways 135° Single Sun Diorama Stack)
    const buildingsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: buildings.map((b) => {
        const isSelected = b.id === selectedBuildingId;
        const baseColor =
          CAT_COLORS[b.category] ||
          CAMPUS_CONFIG.buildingCategoryColors[b.category] ||
          '#38BDF8';

        return {
          type: 'Feature',
          properties: {
            id: b.id,
            code: b.code,
            name: b.name,
            height: Math.max(10, (b.floors_count || 3) * 4.2),
            color: isSelected ? '#38BDF8' : baseColor,
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
      if (map.getLayer('buildings-shadow')) {
        map.setPaintProperty('buildings-shadow', 'fill-color', p.buildingShadow);
      }
      if (map.getLayer('buildings-rim')) {
        map.setPaintProperty('buildings-rim', 'fill-color', p.buildingRim);
      }
      if (map.getLayer('buildings-stroke')) {
        map.setPaintProperty('buildings-stroke', 'line-color', [
          'case',
          ['==', ['get', 'id'], selectedBuildingId || ''],
          '#0284C7',
          p.stroke,
        ]);
        map.setPaintProperty('buildings-stroke', 'line-width', [
          'case',
          ['==', ['get', 'id'], selectedBuildingId || ''],
          2.5,
          1,
        ]);
      }
    } else {
      map.addSource('campus-buildings', { type: 'geojson', data: buildingsGeoJSON });

      // Layer 5: Hard Cast Shadow (135° angle, zoom interpolated)
      map.addLayer({
        id: 'buildings-shadow',
        type: 'fill',
        source: 'campus-buildings',
        layout: { visibility: is3DPitch ? 'none' : 'visible' },
        paint: {
          'fill-color': p.buildingShadow,
          'fill-translate': [
            'interpolate', ['linear'], ['zoom'],
            13, ['literal', [2, 2]],
            15, ['literal', [4.5, 4.5]],
            17, ['literal', [8, 8]],
          ],
          'fill-translate-anchor': 'viewport',
        },
      });

      // Layer 6: Building Base Rim (Darker bottom edge for token depth)
      map.addLayer({
        id: 'buildings-rim',
        type: 'fill',
        source: 'campus-buildings',
        layout: { visibility: is3DPitch ? 'none' : 'visible' },
        paint: {
          'fill-color': p.buildingRim,
          'fill-translate': [
            'interpolate', ['linear'], ['zoom'],
            13, ['literal', [0.6, 0.6]],
            15, ['literal', [1.4, 1.4]],
            17, ['literal', [2.2, 2.2]],
          ],
          'fill-translate-anchor': 'viewport',
        },
      });

      // Layer 7: Building Top Face (Clean pastel color)
      map.addLayer({
        id: 'buildings-top',
        type: 'fill',
        source: 'campus-buildings',
        layout: { visibility: is3DPitch ? 'none' : 'visible' },
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.98,
        },
      });

      // Layer 8: Building Tactile Bevel Rim (No more harsh black marker outline!)
      map.addLayer({
        id: 'buildings-stroke',
        type: 'line',
        source: 'campus-buildings',
        layout: { visibility: is3DPitch ? 'none' : 'visible' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'id'], selectedBuildingId || ''],
            '#0284C7',
            p.stroke,
          ],
          'line-width': [
            'case',
            ['==', ['get', 'id'], selectedBuildingId || ''],
            2.5,
            1,
          ],
        },
      });

      // Layer 9: Genuine 3D Fill-Extrusion (Active in 3D pitch mode)
      map.addLayer({
        id: 'campus-buildings-3d',
        type: 'fill-extrusion',
        source: 'campus-buildings',
        layout: { visibility: is3DPitch ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.92,
        },
      });
    }

    // 4. Building Entrances (Supports both 1st Primary & 2nd Secondary Entrance Doors)
    const entrancesGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: buildings.flatMap((b) => {
        const list: GeoJSON.Feature[] = [
          {
            type: 'Feature',
            properties: {
              id: b.id,
              entrance_name: b.entrance_name,
              slot: 1,
            },
            geometry: {
              type: 'Point',
              coordinates: [b.entrance_lon, b.entrance_lat],
            },
          },
        ];
        if (b.secondary_entrance_lat != null && b.secondary_entrance_lon != null) {
          list.push({
            type: 'Feature',
            properties: {
              id: b.id,
              entrance_name: b.secondary_entrance_name || `${b.code} 2. Giriş Kapısı`,
              slot: 2,
            },
            geometry: {
              type: 'Point',
              coordinates: [b.secondary_entrance_lon, b.secondary_entrance_lat],
            },
          });
        }
        return list;
      }),
    };

    if (map.getSource('building-entrances')) {
      (map.getSource('building-entrances') as maplibregl.GeoJSONSource).setData(entrancesGeoJSON);
      if (map.getLayer('building-entrances-circle')) {
        map.setFilter('building-entrances-circle', [
          'any',
          ['==', ['get', 'id'], selectedBuildingId || ''],
          ['>=', ['zoom'], 16.5],
        ]);
        map.setPaintProperty('building-entrances-circle', 'circle-stroke-color', themeMode === 'night' ? '#0F172A' : '#FFFFFF');
      }
    } else {
      map.addSource('building-entrances', { type: 'geojson', data: entrancesGeoJSON });
      map.addLayer({
        id: 'building-entrances-circle',
        type: 'circle',
        source: 'building-entrances',
        filter: [
          'any',
          ['==', ['get', 'id'], selectedBuildingId || ''],
          ['>=', ['zoom'], 16.5],
        ],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedBuildingId || ''],
            6.5,
            4,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'id'], selectedBuildingId || ''],
            '#10B981',
            '#34D399',
          ],
          'circle-stroke-color': themeMode === 'night' ? '#0F172A' : '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // 5. Active Pedestrian Route (Tactile Highway Ribbon)
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
      if (map.getLayer('active-route-line')) {
        map.setPaintProperty('active-route-line', 'line-color', '#38BDF8');
      }
      if (map.getLayer('active-route-casing')) {
        map.setPaintProperty('active-route-casing', 'line-color', '#0369A1');
      }
    } else {
      map.addSource('active-route', { type: 'geojson', data: routeGeoJSON });

      // Route Shadow (Tactile 135° drop shadow)
      map.addLayer({
        id: 'active-route-shadow',
        type: 'line',
        source: 'active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':
            themeMode === 'night'
              ? 'rgba(0, 0, 0, 0.40)'
              : 'rgba(15, 23, 42, 0.16)',
          'line-width': 13,
          'line-translate': [2, 2],
          'line-translate-anchor': 'viewport',
        },
      });

      // Route Casing
      map.addLayer({
        id: 'active-route-casing',
        type: 'line',
        source: 'active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0369A1',
          'line-width': 9.5,
          'line-opacity': 0.9,
        },
      });

      // Route Core Line
      map.addLayer({
        id: 'active-route-line',
        type: 'line',
        source: 'active-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#38BDF8',
          'line-width': 5.5,
          'line-opacity': 1,
        },
      });
    }
  }, [
    buildings,
    walkGraph,
    blockedEdgeIds,
    selectedBuildingId,
    activeRoute,
    isMapLoaded,
    themeMode,
    is3DPitch,
    selectedFootprintIds,
    adminMapMode,
  ]);

  // Synchronize Building Badges & Zoom-Based LOD Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    const isZoomedInEnough = zoom >= 15.95;

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
      const hasFree = b.free_rooms_count > 0;
      const isSel = b.id === selectedBuildingId;
      const isVisible = isSel || isZoomedInEnough;

      const innerMarkup = `
        ${hasFree ? '<span class="live-dot"></span>' : ''}
        <span>${b.code}</span>
        ${hasFree ? `<span class="room-count">${b.free_rooms_count}</span>` : ''}
        <div class="poi-tooltip">${b.name}</div>
      `;

      const existing = buildingMarkersMapRef.current.get(b.id);
      if (existing) {
        existing.wrapper.style.display = isVisible ? 'block' : 'none';
        existing.btn.className = getInnerBadgeClassName(isSel);
        existing.btn.innerHTML = innerMarkup;
        existing.marker.setLngLat([centroidLon, centroidLat]);
      } else {
        const wrapper = document.createElement('div');
        wrapper.style.zIndex = isSel ? '30' : '10';
        wrapper.style.display = isVisible ? 'block' : 'none';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = getInnerBadgeClassName(isSel);
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
  }, [buildings, showBuildingLabels, selectedBuildingId, currentZoom]);

  // Update selection highlight & ensure selected building is visible even when zoomed out
  useEffect(() => {
    const map = mapRef.current;
    const isZoomedInEnough = map ? map.getZoom() >= 15.95 : false;

    buildingMarkersMapRef.current.forEach((entry, bId) => {
      const isSel = bId === selectedBuildingId;
      entry.wrapper.style.zIndex = isSel ? '30' : '10';
      entry.btn.className = getInnerBadgeClassName(isSel);
      if (showBuildingLabels) {
        entry.wrapper.style.display = (isSel || isZoomedInEnough) ? 'block' : 'none';
      }
    });
  }, [selectedBuildingId, showBuildingLabels]);

  // Synchronize Map Alert Markers (Apple Maps Compact Hazard Beacons)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    alertMarkersRef.current.forEach((m) => m.remove());
    alertMarkersRef.current = [];

    activeAlerts.forEach((alert) => {
      const cfg = ALERT_TYPES.find((t) => t.id === alert.alert_type);
      const beaconColor = cfg?.hexColor || '#F59E0B';
      const icon = ALERT_ICONS[alert.alert_type] || '⚠️';

      const wrapper = document.createElement('div');
      wrapper.style.zIndex = '25';

      const beacon = document.createElement('button');
      beacon.type = 'button';
      beacon.className = 'hazard-beacon';
      beacon.style.borderColor = beaconColor;
      beacon.title = `${alert.title} (${alert.upvotes} onay)`;
      beacon.innerHTML = `
        <span class="beacon-pulse" style="border-color: ${beaconColor}"></span>
        <span class="text-[12px] leading-none select-none">${icon}</span>
      `;

      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(`
        <div class="p-2 space-y-1.5 min-w-[200px]">
          <div class="font-black text-sm text-zinc-950">${alert.title}</div>
          <div class="text-[11px] text-zinc-600 font-semibold">${
            alert.blocks_route ? '⛔ Bu yol yaya rotasında kapalıdır' : '⚠️ Saha uyarısı'
          }</div>
          <div class="flex items-center justify-between pt-2 border-t-2 border-zinc-950/20">
            <span class="text-[11px] font-black text-zinc-800">Doğruluk Oyu:</span>
            <div class="flex gap-1.5">
              <button data-vote="up" data-id="${alert.id}" class="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-zinc-950 rounded-md font-black text-xs">👍 ${alert.upvotes}</button>
              <button data-vote="down" data-id="${alert.id}" class="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-zinc-950 rounded-md font-black text-xs">👎 ${alert.downvotes}</button>
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

      wrapper.appendChild(beacon);
      const alertMarker = new maplibregl.Marker({ element: wrapper, anchor: 'center' })
        .setLngLat([alert.lon, alert.lat])
        .setPopup(popup)
        .addTo(map);
      alertMarkersRef.current.push(alertMarker);
    });
  }, [activeAlerts, onVoteAlert]);

  // Snapped Location Dot & Raw GPS Ghost Dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const validSnapped = isWithinCampusBounds(userPos.snappedLat, userPos.snappedLon);
    const validRaw = isWithinCampusBounds(userPos.rawLat, userPos.rawLon);

    if (validSnapped) {
      if (!userMarkerRef.current) {
        const root = document.createElement('div');
        root.style.zIndex = '15';
        const dot = document.createElement('div');
        dot.className =
          'w-6 h-6 rounded-full bg-sky-500 border-[3px] border-zinc-950 shadow-[0_0_12px_rgba(14,165,233,0.9)] flex items-center justify-center';
        const innerDot = document.createElement('div');
        innerDot.className = 'w-2 h-2 rounded-full bg-white';
        dot.appendChild(innerDot);
        root.appendChild(dot);
        userMarkerRef.current = new maplibregl.Marker({ element: root, anchor: 'center' })
          .setLngLat([userPos.snappedLon, userPos.snappedLat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([userPos.snappedLon, userPos.snappedLat]);
      }
    }

    if (validRaw && userPos.source === 'gps') {
      if (!rawGpsMarkerRef.current) {
        const rawRoot = document.createElement('div');
        rawRoot.style.zIndex = '14';
        const rawDot = document.createElement('div');
        rawDot.className =
          'w-3.5 h-3.5 rounded-full bg-amber-400/70 border border-zinc-950 pointer-events-none';
        rawRoot.appendChild(rawDot);
        rawGpsMarkerRef.current = new maplibregl.Marker({ element: rawRoot, anchor: 'center' })
          .setLngLat([userPos.rawLon, userPos.rawLat])
          .addTo(map);
      } else {
        rawGpsMarkerRef.current.setLngLat([userPos.rawLon, userPos.rawLat]);
      }
    } else if (rawGpsMarkerRef.current && userPos.source !== 'gps') {
      rawGpsMarkerRef.current.remove();
      rawGpsMarkerRef.current = null;
    }
  }, [userPos]);

  // Fly to selected building
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedBuildingId === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = selectedBuildingId;

    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const target = buildings.find((b) => b.id === selectedBuildingId);
    if (target) {
      const [cLon, cLat] = getBuildingCentroid(target);
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      const dynamicBottomPadding = isDesktop
        ? 60
        : Math.max(120, (bottomSheetHeight || 120) + 24);
      map.flyTo({
        center: [cLon, cLat],
        zoom: Math.max(map.getZoom(), 16.5),
        padding: {
          top: isDesktop ? 60 : 70,
          bottom: dynamicBottomPadding,
          left: isDesktop ? (isLeftDrawerOpen ? 460 : 400) : 20,
          right: isDesktop ? (isRightDrawerOpen ? 450 : 80) : 20,
        },
        duration: 750,
      });
    }
  }, [selectedBuildingId, buildings, isLeftDrawerOpen, isRightDrawerOpen, bottomSheetHeight]);

  return (
    <div
      className={`relative w-full h-full select-none ${
        themeMode === 'night'
          ? 'dark-theme mini-motorways-canvas-night'
          : 'mini-motorways-canvas-day'
      } ${
        adminMapMode !== 'none' ? 'cursor-crosshair' : ''
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full isolate" />

      {/* Interactive Map Picking Banner (Strictly centered, no bounce transform collision) */}
      {adminMapMode !== 'none' && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto px-4 py-2 rounded-2xl bg-amber-400 text-zinc-950 font-black text-xs shadow-hard-md border-2 border-zinc-950 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-150">
            <span>
              {adminMapMode === 'pick_user_start' &&
                '📍 Haritada yürüyüşe başlamak istediğiniz noktaya tıklayın'}
              {adminMapMode === 'toggle_edge' &&
                '🚧 Kapatmak veya açmak istediğiniz yürüyüş yoluna tıklayın'}
              {adminMapMode === 'move_entrance' &&
                '🚪 Seçili binanın giriş kapısı noktasına haritada tıklayın'}
              {adminMapMode === 'add_building' &&
                (selectedFootprintIds.length > 0
                  ? `🏛️ ${selectedFootprintIds.length} blok ayak izi seçildi. Yeni blok ekleyebilir veya giriş kapısına geçebilirsiniz.`
                  : '🏛️ Haritada altın parlayan bina kutucuğuna tıklayın (Birden fazla blok seçebilirsiniz)')}
              {adminMapMode === 'pick_building_entrance' &&
                '🚪 Binanın ana giriş kapısının olduğu noktaya haritada tıklayın (Snap-to-Node)'}
              {adminMapMode === 'draw_edge' &&
                '📏 Yeni yürüyüş patikası için başlangıç ve bitiş noktalarına tıklayın'}
              {adminMapMode === 'pick_alert_coords' &&
                '⚠️ Uyarı bırakmak istediğiniz noktaya tıklayın'}
            </span>
            {onCancelMapMode && (
              <TactileButton
                size="sm"
                variant="neutral"
                onClick={onCancelMapMode}
                className="py-0.5 px-2 text-[10px] min-h-0"
              >
                İptal ✕
              </TactileButton>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/*              DESKTOP BOTTOM-RIGHT MAP COMMAND DOCK                   */}
      {/* ==================================================================== */}
      <div
        className={`hidden md:flex fixed bottom-6 z-20 items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-[#1E222D]/95 border border-zinc-300 dark:border-white/10 shadow-hard-md dark:shadow-hard-night-md backdrop-blur-md transition-all duration-300 ease-out ${
          isRightDrawerOpen ? 'right-[436px]' : 'right-6'
        }`}
      >
        {onTogglePickUserStart && (
          <TactileButton
            size="sm"
            variant={isPickingUserStart ? 'accent' : 'secondary'}
            icon={<MapPin className="w-3.5 h-3.5 text-sky-500" />}
            onClick={onTogglePickUserStart}
            title="Haritada yürüyüşe başlayacağınız noktayı seçin"
          >
            {isPickingUserStart ? 'Noktaya Tıklayın...' : 'Konum Belirle'}
          </TactileButton>
        )}

        <TactileIconButton
          size="sm"
          variant="secondary"
          label="Tüm Kampüsü Ekrana Sığdır ve Ortala"
          onClick={() => fitCampusBounds(750)}
        >
          <LocateFixed className="w-4 h-4 text-sky-500" />
        </TactileIconButton>

        {currentBearing !== 0 && (
          <TactileIconButton
            size="sm"
            variant="accent"
            label={`Kuzeye Çevir (${currentBearing}°)`}
            onClick={() => {
              mapRef.current?.easeTo({
                bearing: 0,
                duration: 400,
              });
            }}
          >
            <Compass
              className="w-4 h-4 transition-transform duration-200 text-zinc-950"
              style={{ transform: `rotate(${-currentBearing}deg)` }}
            />
          </TactileIconButton>
        )}

        <div className="w-px h-5 bg-zinc-300 dark:bg-white/10 mx-0.5" />

        <TactileButton
          size="sm"
          variant={basemapMode === 'diorama' ? 'primary' : 'ghost'}
          icon={<Compass className="w-3.5 h-3.5" />}
          onClick={() => handleToggleBasemap('diorama')}
          title="Mini Motorways Kampüs Maketi Görünümü"
        >
          Maket
        </TactileButton>

        <TactileButton
          size="sm"
          variant={basemapMode === 'satellite' ? 'primary' : 'ghost'}
          icon={<Layers className="w-3.5 h-3.5" />}
          onClick={() => handleToggleBasemap('satellite')}
          title="Esri Yüksek Çözünürlüklü Uydu Altlığı"
        >
          Uydu
        </TactileButton>

        <TactileIconButton
          size="sm"
          variant={is3DPitch ? 'accent' : 'secondary'}
          label={is3DPitch ? '2B Makete Dön' : '3B Bloğa Geç'}
          onClick={handleTogglePitch}
        >
          <Box className="w-3.5 h-3.5" />
        </TactileIconButton>

        <TactileIconButton
          size="sm"
          variant="secondary"
          label={themeMode === 'night' ? 'Gündüz Modu' : 'Gece Modu'}
          onClick={handleToggleTheme}
        >
          {themeMode === 'night' ? (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          )}
        </TactileIconButton>

        <TactileIconButton
          size="sm"
          variant={showBuildingLabels ? 'primary' : 'secondary'}
          label={showBuildingLabels ? 'Etiketleri Gizle' : 'Etiketleri Göster'}
          onClick={() => setShowBuildingLabels((prev) => !prev)}
        >
          {showBuildingLabels ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </TactileIconButton>
      </div>



      {/* ==================================================================== */}
      {/*       MOBILE BOTTOM-RIGHT THUMB ZONE (ABOVE BOTTOM SHEET)            */}
      {/* ==================================================================== */}
      <div
        className="md:hidden fixed right-3.5 z-20 flex flex-col items-center gap-2.5 transition-all duration-300 pointer-events-auto"
        style={{ bottom: `${Math.max(104, (bottomSheetHeight || 92) + 16)}px` }}
      >
        {onTogglePickUserStart && (
          <button
            type="button"
            onClick={onTogglePickUserStart}
            aria-label="Konum Belirle"
            title="Haritada başlangıç noktası seçin"
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-hard-md active:scale-95 transition ${
              isPickingUserStart
                ? 'bg-sky-400 text-zinc-950 border-zinc-950 ring-2 ring-sky-300'
                : 'bg-white/95 dark:bg-[#1E222D]/95 text-sky-600 dark:text-sky-400 border-zinc-300 dark:border-white/10'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => fitCampusBounds(600)}
          aria-label="Tüm Kampüsü Ortala"
          title="Tüm Kampüsü Ortala"
          className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-[#1E222D]/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-white/10 shadow-hard-md flex items-center justify-center active:scale-95 transition"
        >
          <LocateFixed className="w-5 h-5 text-sky-500" />
        </button>

        {currentBearing !== 0 && (
          <button
            type="button"
            onClick={() => {
              mapRef.current?.easeTo({
                bearing: 0,
                duration: 400,
              });
            }}
            aria-label={`Kuzeye Çevir (${currentBearing}°)`}
            className="w-11 h-11 rounded-2xl bg-amber-400 text-zinc-950 border border-zinc-950 shadow-hard-md flex items-center justify-center active:scale-95 transition"
          >
            <Compass
              className="w-5 h-5 transition-transform duration-200"
              style={{ transform: `rotate(${-currentBearing}deg)` }}
            />
          </button>
        )}
      </div>
    </div>
  );
};
