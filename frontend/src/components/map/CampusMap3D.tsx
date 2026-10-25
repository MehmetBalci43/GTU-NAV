import React, { useEffect, useRef, useState } from 'react';
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
  | 'pick_alert_coords';

interface CampusMap3DProps {
  buildings: Building[];
  walkGraph: WalkGraph | null;
  activeAlerts: MapAlert[];
  blockedEdgeIds: string[];
  selectedBuildingId: string | null;
  activeRoute: RouteResponse | null;
  userPos: UserPositionState;
  adminMapMode: AdminMapInteractionMode;
  onSelectBuilding: (buildingId: string) => void;
  onQuickRouteToBuilding: (buildingId: string) => void;
  onVoteAlert: (alertId: number, vote: 'up' | 'down') => void;
  onAdminToggleEdge: (edgeId: string, currentlyBlocked: boolean) => void;
  onAdminMoveEntrance: (lat: number, lon: number) => void;
  onAdminPickBuildingCoords: (lat: number, lon: number) => void;
  onAdminDrawWalkwayPoint: (lat: number, lon: number) => void;
  onPickAlertCoords: (lat: number, lon: number, nearestEdgeId?: string | null) => void;
}

function buildRasterStyle(mode: 'voyager' | 'satellite'): maplibregl.StyleSpecification {
  const tiles =
    mode === 'satellite'
      ? ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']
      : [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        ];

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution:
          mode === 'satellite'
            ? '© Esri World Imagery & OpenStreetMap'
            : '© OpenStreetMap contributors & CARTO',
      },
    },
    layers: [
      {
        id: 'basemap-layer',
        type: 'raster',
        source: 'basemap',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
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
  onSelectBuilding,
  onVoteAlert,
  onAdminToggleEdge,
  onAdminMoveEntrance,
  onAdminPickBuildingCoords,
  onAdminDrawWalkwayPoint,
  onPickAlertCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const rawGpsMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [basemapMode, setBasemapMode] = useState<'voyager' | 'satellite'>('voyager');
  const [is3DPitch, setIs3DPitch] = useState<boolean>(true);
  const [styleVersion, setStyleVersion] = useState<number>(0);

  // Keep latest callbacks in refs so MapLibre event listeners always invoke fresh handlers
  const callbacksRef = useRef({
    adminMapMode,
    blockedEdgeIds,
    onSelectBuilding,
    onAdminToggleEdge,
    onAdminMoveEntrance,
    onAdminPickBuildingCoords,
    onAdminDrawWalkwayPoint,
    onPickAlertCoords,
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
  ]);

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildRasterStyle('voyager'),
      center: CAMPUS_CONFIG.defaultCenter,
      zoom: CAMPUS_CONFIG.defaultZoom,
      pitch: CAMPUS_CONFIG.defaultPitch,
      bearing: CAMPUS_CONFIG.defaultBearing,
      maxBounds: CAMPUS_CONFIG.maxBounds,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      setStyleVersion((v) => v + 1);
    });

    map.on('click', (e) => {
      const cb = callbacksRef.current;
      const clickLat = Number(e.lngLat.lat.toFixed(6));
      const clickLon = Number(e.lngLat.lng.toFixed(6));

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

      // Check if an edge was clicked when in toggle_edge or pick_alert_coords mode
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

  // Switch between Street (CartoDB Voyager) and Satellite (Esri World Imagery)
  const handleToggleBasemap = (nextMode: 'voyager' | 'satellite') => {
    if (nextMode === basemapMode || !mapRef.current) return;
    setBasemapMode(nextMode);
    const map = mapRef.current;
    map.setStyle(buildRasterStyle(nextMode));
    map.once('styledata', () => {
      setStyleVersion((v) => v + 1);
    });
  };

  const handleTogglePitch = () => {
    if (!mapRef.current) return;
    const next3D = !is3DPitch;
    setIs3DPitch(next3D);
    mapRef.current.easeTo({
      pitch: next3D ? CAMPUS_CONFIG.defaultPitch : 0,
      bearing: next3D ? CAMPUS_CONFIG.defaultBearing : 0,
      duration: 600,
    });
  };

  // Render GeoJSON Layers (Buildings 3D, Extra Campus Footprints, Walkways, Blocked Edges, Active Route, Entrances)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || styleVersion === 0) return;

    // 1. Extra OSM Campus Footprints (85 auxiliary campus buildings)
    const extraFootprintsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: (walkGraph?.extra_building_footprints || []).map((fp) => ({
        type: 'Feature',
        properties: {
          name: fp.name,
        },
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
          'fill-extrusion-height': 9,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.55,
        },
      });
    }

    // 2. Primary Interactive GTÜ Buildings (24 major buildings with Empty Amphitheater counts)
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
            height: Math.max(10, (b.floors_count || 3) * 4.5),
            color: isSelected ? '#22d3ee' : baseColor,
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
          'fill-extrusion-opacity': 0.86,
        },
      });
    }

    // 3. Pedestrian Walkway Graph (1,512 real OSM walkway edges)
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
          'line-width': 2.5,
          'line-opacity': 0.65,
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
      // Wide invisible hit layer for easy clicking in Admin edge toggle mode
      map.addLayer({
        id: 'walkway-edges-hit',
        type: 'line',
        source: 'walkway-edges',
        paint: {
          'line-color': '#000000',
          'line-width': 14,
          'line-opacity': 0.01,
        },
      });
    }

    // 4. Building Entrance Pins (Green points showing exact entrance doors)
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
          'circle-radius': 5,
          'circle-color': '#10b981',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
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
          'line-width': 11,
          'line-opacity': 0.35,
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
  }, [buildings, walkGraph, blockedEdgeIds, selectedBuildingId, activeRoute, styleVersion]);

  // Render HTML Badges for Buildings (Code + Free Rooms Radar Badge) and Active Map Alerts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Building Badges
    buildings.forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      const isSelected = b.id === selectedBuildingId;
      const hasRooms = b.total_rooms_count > 0;
      const badgeColor =
        b.free_rooms_count > 0
          ? 'bg-emerald-500 text-slate-950'
          : 'bg-rose-500 text-white';

      el.className = `group flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold shadow-lg border transition-transform ${
        isSelected
          ? 'bg-cyan-950 text-cyan-200 border-cyan-400 scale-110 z-30'
          : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:scale-105'
      }`;
      el.innerHTML = `
        <span>${b.code}</span>
        ${
          hasRooms
            ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${badgeColor}" title="Boş Derslik / Amfi Sayısı">${b.free_rooms_count}/${b.total_rooms_count}</span>`
            : ''
        }
      `;
      el.onclick = (ev) => {
        ev.stopPropagation();
        onSelectBuilding(b.id);
      };

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([b.lon, b.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Map Alert Markers (Layer 1)
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
      wrapper.className = 'relative group';

      const pill = document.createElement('div');
      pill.className =
        'flex items-center gap-1 px-2 py-1 rounded-full bg-slate-950/95 text-white border border-amber-400/60 shadow-lg text-xs cursor-pointer';
      pill.style.borderColor = cfg?.hexColor || '#f59e0b';
      pill.innerHTML = `<span>${emoji}</span><span class="font-semibold max-w-[130px] truncate">${alert.title}</span><span class="text-[10px] text-emerald-300 font-bold">+${alert.upvotes}</span>`;

      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(`
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
        if (upBtn) {
          upBtn.addEventListener('click', () => onVoteAlert(alert.id, 'up'));
        }
        if (downBtn) {
          downBtn.addEventListener('click', () => onVoteAlert(alert.id, 'down'));
        }
      });

      wrapper.appendChild(pill);
      const alertMarker = new maplibregl.Marker({ element: wrapper })
        .setLngLat([alert.lon, alert.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(alertMarker);
    });
  }, [buildings, activeAlerts, selectedBuildingId, onSelectBuilding, onVoteAlert]);

  // Update User Snapped Location Dot & Raw GPS Ghost Dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className =
        'w-5 h-5 rounded-full bg-sky-500 border-[3px] border-white shadow-[0_0_14px_rgba(14,165,233,0.95)] transition-all duration-100';
      el.title = 'Yola Mıknatıslanmış (Snap-to-Path) Konumunuz';
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userPos.snappedLon, userPos.snappedLat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userPos.snappedLon, userPos.snappedLat]);
    }

    if (!rawGpsMarkerRef.current) {
      const rawEl = document.createElement('div');
      rawEl.className =
        'w-3 h-3 rounded-full bg-amber-400/50 border border-amber-300 pointer-events-none';
      rawEl.title = 'Ham GPS Konumu (Snap-to-Path Öncesi)';
      rawGpsMarkerRef.current = new maplibregl.Marker({ element: rawEl })
        .setLngLat([userPos.rawLon, userPos.rawLat])
        .addTo(map);
    } else {
      rawGpsMarkerRef.current.setLngLat([userPos.rawLon, userPos.rawLat]);
    }
  }, [userPos]);

  // Fly to selected building when changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBuildingId) return;
    const target = buildings.find((b) => b.id === selectedBuildingId);
    if (target) {
      map.flyTo({
        center: [target.lon, target.lat],
        zoom: Math.max(map.getZoom(), 16.4),
        duration: 850,
      });
    }
  }, [selectedBuildingId, buildings]);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Admin Active Map Mode Banner */}
      {adminMapMode !== 'none' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-xl border border-amber-200 flex items-center gap-2">
          <span>🛠️ Canlı Harita Müdahale Modu:</span>
          <span>
            {adminMapMode === 'toggle_edge' && 'Kapatmak veya açmak istediğiniz yürüyüş yoluna tıklayın'}
            {adminMapMode === 'move_entrance' && 'Seçili binanın yeni giriş kapısı noktasına haritada tıklayın'}
            {adminMapMode === 'add_building' && 'Yeni eklenecek binanın harita/uydu üzerindeki konumuna tıklayın'}
            {adminMapMode === 'draw_edge' && 'Yeni yürüyüş patikası çizmek için haritada başlangıç ve bitiş noktalarına tıklayın'}
            {adminMapMode === 'pick_alert_coords' && 'Uyarı bırakmak istediğiniz yürüyüş yoluna veya noktaya tıklayın'}
          </span>
        </div>
      )}

      {/* Map Control Floating Pill (Street / Satellite / 3D Tilt / Reset Campus Center) */}
      <div className="absolute bottom-5 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-xl text-xs">
        <button
          type="button"
          onClick={() => handleToggleBasemap('voyager')}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
            basemapMode === 'voyager'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          🗺️ Sokak Haritası
        </button>
        <button
          type="button"
          onClick={() => handleToggleBasemap('satellite')}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
            basemapMode === 'satellite'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          🛰️ Uydu (Esri)
        </button>
        <button
          type="button"
          onClick={handleTogglePitch}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
            is3DPitch ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          {is3DPitch ? '🧊 3B Görünüm' : '📐 2B Görünüm'}
        </button>
        <button
          type="button"
          onClick={() =>
            mapRef.current?.flyTo({
              center: CAMPUS_CONFIG.defaultCenter,
              zoom: CAMPUS_CONFIG.defaultZoom,
              pitch: is3DPitch ? CAMPUS_CONFIG.defaultPitch : 0,
              bearing: is3DPitch ? CAMPUS_CONFIG.defaultBearing : 0,
              duration: 800,
            })
          }
          className="px-2.5 py-1.5 rounded-lg font-semibold text-slate-300 hover:bg-slate-800 transition"
        >
          🎯 Kampüsü Ortala
        </button>
      </div>
    </div>
  );
};
