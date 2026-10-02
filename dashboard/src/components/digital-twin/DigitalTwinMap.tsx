"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MINE_CENTER_COORDS,
  MINE_DEFAULT_ZOOM,
  MINING_NODE_REGISTRY,
  GATEWAY_SPATIAL_INFO,
  MINE_LEASE_BOUNDARY,
  PIT_EXCAVATION_BENCHES,
  GEOLOGICAL_FAULT_LINES,
  SUBSIDENCE_HAZARD_ZONES,
  EVACUATION_ROUTES,
  resolveNodeCoordinates,
  MiningNodeSpatialInfo,
} from '@/lib/gis/miningGisData';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import { ShadowMlPrediction } from '@/types/ml';
import {
  Layers,
  Compass,
  Maximize2,
  Minimize2,
  Ruler,
  Shield,
  Radio,
  Eye,
  Activity,
  AlertTriangle,
  MoveDown,
  Navigation,
} from 'lucide-react';

export type BaseTileType = 'dark' | 'satellite' | 'osm' | 'topo';

interface DigitalTwinMapProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  mlPredictions?: Record<string, Record<string, ShadowMlPrediction>>;
  timeTravelOffsetHours?: number;
  focusedZoneId?: string | null;
}

const TILE_PROVIDERS: Record<BaseTileType, { url: string; attribution: string; name: string }> = {
  dark: {
    name: 'CartoDB Dark Matter (High-Tech NOC)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Esri World Imagery (Aerial Pit View)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  topo: {
    name: 'OpenTopoMap (Contour GIS)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
};

export function DigitalTwinMap({
  selectedNodeId,
  onSelectNode,
  readings,
  nodeStatuses,
  mlPredictions,
  timeTravelOffsetHours = 0,
  focusedZoneId,
}: DigitalTwinMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const boundaryLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const benchesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const faultsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardZonesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const meshLinksLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const evacuationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const toolsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // UI state
  const [activeBaseTile, setActiveBaseTile] = useState<BaseTileType>('dark');
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);
  const [measureModeActive, setMeasureModeActive] = useState(false);
  const [measureDistanceM, setMeasureDistanceM] = useState<number | null>(null);
  const [bufferRadiusActive, setBufferRadiusActive] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer toggles
  const [layerVisibility, setLayerVisibility] = useState({
    boundary: true,
    benches: true,
    faults: true,
    hazardZones: true,
    meshLinks: true,
    evacuation: true,
    nodes: true,
  });

  // Measure tool click points
  const measurePointsRef = useRef<L.LatLng[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MINE_CENTER_COORDS,
      zoom: MINE_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 19,
      minZoom: 13,
    });

    // Custom positioned zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: 'SIH-2026 Digital Twin GIS' }).addTo(map);

    // Add initial base tile layer
    const baseTile = TILE_PROVIDERS[activeBaseTile];
    const tileLayer = L.tileLayer(baseTile.url, {
      attribution: baseTile.attribution,
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Create persistent layer groups
    boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
    benchesLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardZonesLayerGroupRef.current = L.layerGroup().addTo(map);
    faultsLayerGroupRef.current = L.layerGroup().addTo(map);
    meshLinksLayerGroupRef.current = L.layerGroup().addTo(map);
    evacuationLayerGroupRef.current = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    toolsLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size after initial paint to prevent tile gaps
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer when changed
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newBase = TILE_PROVIDERS[activeBaseTile];
    const newTile = L.tileLayer(newBase.url, {
      attribution: newBase.attribution,
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [activeBaseTile]);

  // Render Static GIS Layers (Boundary, Benches, Faults, Hazard Zones, Evacuation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Mine Lease Boundary
    if (boundaryLayerGroupRef.current) {
      boundaryLayerGroupRef.current.clearLayers();
      if (layerVisibility.boundary) {
        L.polygon(MINE_LEASE_BOUNDARY, {
          color: '#fca311',
          weight: 2.5,
          dashArray: '8, 6',
          fillColor: '#fca311',
          fillOpacity: 0.04,
        })
          .bindTooltip('<b>Jharia Mine Concession Perimeter</b><br>Area: 2.14 km²', {
            sticky: true,
            className: 'gis-custom-tooltip',
          })
          .addTo(boundaryLayerGroupRef.current);
      }
    }

    // 2. Pit Excavation Benches
    if (benchesLayerGroupRef.current) {
      benchesLayerGroupRef.current.clearLayers();
      if (layerVisibility.benches) {
        PIT_EXCAVATION_BENCHES.forEach(bench => {
          L.polygon(bench.coordinates, {
            color: '#64748b',
            weight: 1.5,
            fillColor: '#334155',
            fillOpacity: 0.1,
          })
            .bindTooltip(`<b>${bench.level}</b><br>Excavation Depth: -${bench.depthM}m`, {
              sticky: true,
              className: 'gis-custom-tooltip',
            })
            .addTo(benchesLayerGroupRef.current!);
        });
      }
    }

    // 3. Geological Fault Lines
    if (faultsLayerGroupRef.current) {
      faultsLayerGroupRef.current.clearLayers();
      if (layerVisibility.faults) {
        GEOLOGICAL_FAULT_LINES.forEach(fault => {
          L.polyline(fault.coordinates, {
            color: fault.color,
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.9,
          })
            .bindTooltip(`<b>${fault.name}</b><br>Dip: ${fault.dipAngle} | Strike: ${fault.strikeDirection}<br>Type: ${fault.slipType}`, {
              sticky: true,
              className: 'gis-custom-tooltip',
            })
            .addTo(faultsLayerGroupRef.current!);
        });
      }
    }

    // 4. Hazard Zones with dynamic simulation expansion
    if (hazardZonesLayerGroupRef.current) {
      hazardZonesLayerGroupRef.current.clearLayers();
      if (layerVisibility.hazardZones) {
        SUBSIDENCE_HAZARD_ZONES.forEach(zone => {
          // In time travel projection, increase opacity & stroke width if looking ahead into critical subsidence
          const isCriticalProjected = timeTravelOffsetHours > 0 && zone.riskCategory === 'critical';
          const fillOpacity = isCriticalProjected ? Math.min(0.5, zone.fillOpacity + 0.15) : zone.fillOpacity;

          L.polygon(zone.coordinates, {
            color: isCriticalProjected ? '#dc2626' : zone.color,
            weight: isCriticalProjected ? 3.5 : 2,
            fillColor: zone.fillColor,
            fillOpacity,
          })
            .bindTooltip(`<b>${zone.name}</b><br>Category: ${zone.riskCategory.toUpperCase()}<br>Geology: ${zone.geologicalUnit}<br>${zone.description}`, {
              sticky: true,
              className: 'gis-custom-tooltip',
            })
            .addTo(hazardZonesLayerGroupRef.current!);
        });
      }
    }

    // 5. Evacuation Routes & Assembly Points
    if (evacuationLayerGroupRef.current) {
      evacuationLayerGroupRef.current.clearLayers();
      if (layerVisibility.evacuation) {
        EVACUATION_ROUTES.forEach(route => {
          // Route Polyline
          L.polyline(route.coordinates, {
            color: '#10b981',
            weight: 3,
            dashArray: '4, 6',
          })
            .bindTooltip(`<b>${route.name}</b><br>Destination: ${route.assemblyPointName}`, {
              sticky: true,
              className: 'gis-custom-tooltip',
            })
            .addTo(evacuationLayerGroupRef.current!);

          // Assembly Point Marker
          const assemblyIcon = L.divIcon({
            className: 'assembly-point-icon',
            html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs shadow-lg border-2 border-white animate-bounce">A</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          L.marker(route.assemblyPointCoord, { icon: assemblyIcon })
            .bindTooltip(`<b>${route.assemblyPointName}</b><br>Designated Safe Assembly Haven`, {
              sticky: true,
              className: 'gis-custom-tooltip',
            })
            .addTo(evacuationLayerGroupRef.current!);
        });
      }
    }
  }, [layerVisibility, timeTravelOffsetHours]);

  // Render Dynamic Nodes, LoRa Mesh Links, and Gateway Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerGroupRef.current || !meshLinksLayerGroupRef.current) return;

    markersLayerGroupRef.current.clearLayers();
    meshLinksLayerGroupRef.current.clearLayers();

    if (!layerVisibility.nodes) return;

    // 1. Gateway Marker
    const gwIcon = L.divIcon({
      className: 'gis-gateway-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full bg-[#fca311]/20 animate-ping"></div>
          <div class="relative w-8 h-8 rounded-xl bg-[#14213d] border-2 border-[#fca311] shadow-[0_0_15px_rgba(252,163,17,0.7)] flex items-center justify-center text-[#fca311]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(GATEWAY_SPATIAL_INFO.coordinates, { icon: gwIcon })
      .bindPopup(`
        <div class="p-3 font-sans text-xs space-y-2 bg-[#0a1120] text-white rounded-lg border border-[#fca311]/50">
          <div class="flex items-center gap-2 border-b border-[#14213d] pb-2 font-bold text-sm text-[#fca311]">
            <span>${GATEWAY_SPATIAL_INFO.name}</span>
          </div>
          <div class="space-y-1 font-mono text-[11px] text-slate-300">
            <div>Elevation: <b class="text-white">${GATEWAY_SPATIAL_INFO.elevationM}m MSL</b></div>
            <div>Mast Height: <b class="text-white">${GATEWAY_SPATIAL_INFO.antennaHeightM}m</b></div>
            <div>Frequency: <b class="text-[#fca311]">${GATEWAY_SPATIAL_INFO.frequencyMhz} MHz</b></div>
            <div>Protocol: <b class="text-emerald-400">${GATEWAY_SPATIAL_INFO.meshProtocol}</b></div>
          </div>
        </div>
      `, { className: 'gis-custom-popup' })
      .bindTooltip(`<b>${GATEWAY_SPATIAL_INFO.name}</b><br>LoRa Master Receiver`, {
        sticky: true,
        className: 'gis-custom-tooltip',
      })
      .addTo(markersLayerGroupRef.current);

    // 2. Telemetry Nodes
    const registeredNodes = Object.values(MINING_NODE_REGISTRY);

    registeredNodes.forEach(node => {
      // Lookup live readings
      const nodeReads = readings[node.zoneId]?.[node.nodeId] || {};
      const statusObj = nodeStatuses[node.zoneId]?.[node.nodeId];
      const isOnline = statusObj?.status === 'online';
      const gapCount = statusObj?.gapCount || 0;
      const lastSeq = statusObj?.lastSequenceNumber || 0;

      // Realtime sensor values
      const tiltVal = nodeReads.tilt?.value || 0;
      const dispVal = nodeReads.displacement?.value || 0;
      const vibeVal = nodeReads.vibration?.value || 0;
      const gasVal = nodeReads.gas?.value || 0;
      const waterVal = nodeReads.water?.value || 0;

      // Severity derivation
      let severity: 'normal' | 'warning' | 'critical' = 'normal';
      if (tiltVal >= node.criticalThresholdTilt || dispVal >= 25 || (nodeReads.crack?.value || 0) >= 1) {
        severity = 'critical';
      } else if (tiltVal >= 2.0 || dispVal >= 15 || vibeVal >= 8.0) {
        severity = 'warning';
      }

      // In time-travel forward mode (+2h / +6h), simulate projected elevation of severity for active longwall nodes
      if (timeTravelOffsetHours > 0 && node.nodeId === 'NODE_03') {
        severity = 'critical';
      }

      // Marker appearance styling
      let pulseRing = 'bg-emerald-500/30';
      let centerColor = 'bg-emerald-500';
      let borderGlow = 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]';

      if (!isOnline) {
        pulseRing = 'hidden';
        centerColor = 'bg-slate-500';
        borderGlow = 'border-slate-400';
      } else if (severity === 'critical') {
        pulseRing = 'bg-red-500/40 animate-ping';
        centerColor = 'bg-red-600 animate-pulse';
        borderGlow = 'border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.9)]';
      } else if (severity === 'warning') {
        pulseRing = 'bg-[#fca311]/40 animate-pulse';
        centerColor = 'bg-[#fca311]';
        borderGlow = 'border-[#fca311] shadow-[0_0_14px_rgba(252,163,17,0.8)]';
      }

      const isSelected = selectedNodeId === node.nodeId;

      const nodeIcon = L.divIcon({
        className: `gis-node-marker-wrap ${isSelected ? 'selected' : ''}`,
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="absolute w-8 h-8 rounded-full ${pulseRing}"></div>
            <div class="relative w-6 h-6 rounded-full ${centerColor} border-2 ${borderGlow} flex items-center justify-center text-[10px] font-black text-black font-mono transition-transform duration-200 group-hover:scale-125 ${isSelected ? 'ring-4 ring-white scale-125' : ''}">
              ${node.nodeId.replace('NODE_', '')}
            </div>
            ${
              severity === 'critical'
                ? `<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-white animate-ping"></div>`
                : ''
            }
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(node.coordinates, { icon: nodeIcon }).addTo(markersLayerGroupRef.current!);

      // Click listener: select node
      marker.on('click', () => {
        onSelectNode(node.nodeId);
      });

      // Rich Pop-up
      const popupContent = `
        <div class="p-3 font-sans text-xs space-y-2.5 bg-[#0a1120] text-white rounded-xl border ${
          severity === 'critical' ? 'border-red-500' : 'border-[#fca311]/50'
        } min-w-[240px]">
          <div class="flex items-center justify-between border-b border-[#14213d] pb-2">
            <div>
              <div class="font-extrabold text-sm text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}"></span>
                ${node.label}
              </div>
              <div class="text-[10px] text-[#fca311] font-mono">${node.zoneId}</div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              severity === 'critical'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : severity === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }">
              ${severity}
            </span>
          </div>

          <!-- Geotechnical Readings Grid -->
          <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div class="bg-[#14213d]/60 p-1.5 rounded border border-[#14213d]">
              <span class="text-slate-400">Tilt Angle:</span>
              <div class="text-sm font-bold ${tiltVal >= 2.0 ? 'text-red-400' : 'text-white'}">
                ${tiltVal.toFixed(2)}°
              </div>
            </div>
            <div class="bg-[#14213d]/60 p-1.5 rounded border border-[#14213d]">
              <span class="text-slate-400">Settlement:</span>
              <div class="text-sm font-bold ${dispVal >= 15 ? 'text-amber-400' : 'text-white'}">
                ${dispVal.toFixed(1)} mm
              </div>
            </div>
            <div class="bg-[#14213d]/60 p-1.5 rounded border border-[#14213d]">
              <span class="text-slate-400">Vibration PPV:</span>
              <div class="text-xs font-bold text-white">${vibeVal.toFixed(1)} mm/s</div>
            </div>
            <div class="bg-[#14213d]/60 p-1.5 rounded border border-[#14213d]">
              <span class="text-slate-400">Collar Elev:</span>
              <div class="text-xs font-bold text-white">${node.elevationM}m MSL</div>
            </div>
          </div>

          <!-- Geological Unit & Depth -->
          <div class="text-[10px] text-slate-300 bg-[#101a2e] p-1.5 rounded border border-slate-800">
            <span class="text-[#fca311]">Geology:</span> ${node.geologicalLayer}<br/>
            <span class="text-[#fca311]">Borehole Depth:</span> -${node.boreholeDepthM}m
          </div>

          <!-- Packet Sequence Info -->
          <div class="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
            <span>Seq: #${lastSeq}</span>
            <span class="${gapCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}">Gaps: ${gapCount}</span>
            <span>Status: ${statusObj?.status || 'Active'}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { className: 'gis-custom-popup' });
      marker.bindTooltip(`<b>${node.nodeId}</b>: ${node.label} (${tiltVal.toFixed(2)}°)`, {
        sticky: true,
        className: 'gis-custom-tooltip',
      });

      // 3. Draw Mesh Wireless Link to Gateway
      if (layerVisibility.meshLinks && isOnline) {
        L.polyline([node.coordinates, GATEWAY_SPATIAL_INFO.coordinates], {
          color: severity === 'critical' ? '#ef4444' : '#fca311',
          weight: severity === 'critical' ? 2 : 1.2,
          opacity: 0.6,
          dashArray: '3, 6',
        })
          .bindTooltip(`<b>LoRa Mesh Link</b>: ${node.nodeId} &harr; ${GATEWAY_SPATIAL_INFO.id}<br>RSSI: -76 dBm | SNR: +8.4 dB`, {
            sticky: true,
            className: 'gis-custom-tooltip',
          })
          .addTo(meshLinksLayerGroupRef.current!);
      }
    });
  }, [readings, nodeStatuses, selectedNodeId, layerVisibility, timeTravelOffsetHours]);

  // Fly-to focused node or zone
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedNodeId && MINING_NODE_REGISTRY[selectedNodeId]) {
      const coord = MINING_NODE_REGISTRY[selectedNodeId].coordinates;
      map.flyTo(coord, 17, { duration: 1.2 });
    }
  }, [selectedNodeId]);

  // Handle measurement clicks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !toolsLayerGroupRef.current) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!measureModeActive) return;

      const toolsGroup = toolsLayerGroupRef.current;
      if (!toolsGroup) return;

      if (measurePointsRef.current.length >= 2) {
        measurePointsRef.current = [];
        toolsGroup.clearLayers();
        setMeasureDistanceM(null);
      }

      measurePointsRef.current.push(e.latlng);

      // Marker on clicked point
      L.circleMarker(e.latlng, {
        radius: 5,
        color: '#fca311',
        fillColor: '#ffffff',
        fillOpacity: 1,
      }).addTo(toolsGroup);

      if (measurePointsRef.current.length === 2) {
        const p1 = measurePointsRef.current[0];
        const p2 = measurePointsRef.current[1];
        const dist = p1.distanceTo(p2);
        setMeasureDistanceM(Math.round(dist * 10) / 10);

        L.polyline([p1, p2], {
          color: '#fca311',
          weight: 3,
          dashArray: '5, 5',
        })
          .bindTooltip(`<b>Distance: ${Math.round(dist * 10) / 10} m</b>`, {
            permanent: true,
            direction: 'center',
            className: 'gis-measure-tooltip',
          })
          .addTo(toolsGroup);
      }
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [measureModeActive]);

  // Handle safety buffer radius drawing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !toolsLayerGroupRef.current) return;

    const toolsGroup = toolsLayerGroupRef.current;
    toolsGroup.clearLayers();

    if (bufferRadiusActive && selectedNodeId && MINING_NODE_REGISTRY[selectedNodeId]) {
      const center = MINING_NODE_REGISTRY[selectedNodeId].coordinates;
      L.circle(center, {
        radius: bufferRadiusActive,
        color: '#ef4444',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        dashArray: '4, 4',
      })
        .bindTooltip(`<b>Exclusion Safety Zone: ${bufferRadiusActive}m Radius</b><br>Around ${selectedNodeId}`, {
          permanent: true,
          direction: 'top',
          className: 'gis-measure-tooltip',
        })
        .addTo(toolsGroup);
    }
  }, [bufferRadiusActive, selectedNodeId]);

  // Quick camera fly-to presets
  const flyToPreset = (preset: 'all' | 'zone1' | 'zone2' | 'critical') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (preset === 'all') {
      map.flyTo(MINE_CENTER_COORDS, MINE_DEFAULT_ZOOM, { duration: 1 });
    } else if (preset === 'zone1') {
      map.flyTo([23.7515, 86.4170], 17, { duration: 1 });
    } else if (preset === 'zone2') {
      map.flyTo([23.7525, 86.4230], 17, { duration: 1 });
    } else if (preset === 'critical') {
      map.flyTo([23.7495, 86.4192], 18, { duration: 1.2 });
      onSelectNode('NODE_03');
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#e5e5e5] dark:border-[#14213d] shadow-xl bg-[#000000] transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'h-[620px]'
      }`}
    >
      {/* The Leaflet DOM container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Control Bar: Base Tile & View Presets */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        {/* Base Map Switcher Pill */}
        <div className="flex items-center p-1 rounded-xl bg-white/90 dark:bg-[#0a1120]/90 backdrop-blur-md border border-[#e5e5e5] dark:border-[#14213d] shadow-lg text-xs font-semibold">
          <button
            onClick={() => setActiveBaseTile('dark')}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              activeBaseTile === 'dark'
                ? 'bg-[#14213d] text-[#fca311] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Dark GIS
          </button>
          <button
            onClick={() => setActiveBaseTile('satellite')}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              activeBaseTile === 'satellite'
                ? 'bg-[#14213d] text-[#fca311] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setActiveBaseTile('osm')}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              activeBaseTile === 'osm'
                ? 'bg-[#14213d] text-[#fca311] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            OSM Streets
          </button>
          <button
            onClick={() => setActiveBaseTile('topo')}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              activeBaseTile === 'topo'
                ? 'bg-[#14213d] text-[#fca311] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Topographic
          </button>
        </div>

        {/* Quick Camera Presets */}
        <div className="hidden sm:flex items-center p-1 rounded-xl bg-white/90 dark:bg-[#0a1120]/90 backdrop-blur-md border border-[#e5e5e5] dark:border-[#14213d] shadow-lg text-xs font-semibold">
          <button
            onClick={() => flyToPreset('all')}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#14213d]/20 transition-all flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-[#fca311]" />
            Full Mine
          </button>
          <button
            onClick={() => flyToPreset('zone1')}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#14213d]/20 transition-all"
          >
            Pit Slope
          </button>
          <button
            onClick={() => flyToPreset('zone2')}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#14213d]/20 transition-all"
          >
            Return Airway
          </button>
          <button
            onClick={() => flyToPreset('critical')}
            className="px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1 font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Focus N3 Hazard
          </button>
        </div>
      </div>

      {/* Top Right Tool Bar: Layers Drawer, Measurement, Fullscreen */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* Layer Visibility Toggle Button */}
        <button
          onClick={() => setShowLayerDrawer(!showLayerDrawer)}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-lg transition-all ${
            showLayerDrawer
              ? 'bg-[#fca311] text-black border-[#fca311]'
              : 'bg-white/90 dark:bg-[#0a1120]/90 text-slate-700 dark:text-white border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]'
          }`}
          title="GIS Vector Layers"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Spatial Measurement Ruler */}
        <button
          onClick={() => {
            setMeasureModeActive(!measureModeActive);
            if (measureModeActive && toolsLayerGroupRef.current) {
              toolsLayerGroupRef.current.clearLayers();
              setMeasureDistanceM(null);
            }
          }}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
            measureModeActive
              ? 'bg-amber-500 text-black border-amber-500 shadow-amber-500/30'
              : 'bg-white/90 dark:bg-[#0a1120]/90 text-slate-700 dark:text-white border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]'
          }`}
          title="Click two points on the map to measure linear distance"
        >
          <Ruler className="w-4 h-4" />
          {measureDistanceM !== null && <span className="font-mono font-bold">{measureDistanceM}m</span>}
        </button>

        {/* Safety Radius Buffer Generator */}
        <button
          onClick={() => {
            if (!bufferRadiusActive) setBufferRadiusActive(50);
            else if (bufferRadiusActive === 50) setBufferRadiusActive(100);
            else if (bufferRadiusActive === 100) setBufferRadiusActive(200);
            else setBufferRadiusActive(null);
          }}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
            bufferRadiusActive
              ? 'bg-red-600 text-white border-red-500 shadow-red-500/30'
              : 'bg-white/90 dark:bg-[#0a1120]/90 text-slate-700 dark:text-white border-[#e5e5e5] dark:border-[#14213d] hover:border-red-500'
          }`}
          title="Cycle blast exclusion buffer radius (50m, 100m, 200m)"
        >
          <Shield className="w-4 h-4" />
          {bufferRadiusActive && <span className="font-mono font-bold">{bufferRadiusActive}m Buffer</span>}
        </button>

        {/* Fullscreen Expand Button */}
        <button
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize();
            }, 300);
          }}
          className="p-2.5 rounded-xl bg-white/90 dark:bg-[#0a1120]/90 backdrop-blur-md text-slate-700 dark:text-white border border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311] shadow-lg transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map View'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating GIS Vector Layers Drawer */}
      {showLayerDrawer && (
        <div className="absolute top-16 right-4 z-30 w-64 p-3.5 rounded-2xl bg-white/95 dark:bg-[#0a1120]/95 backdrop-blur-xl border border-[#e5e5e5] dark:border-[#14213d] shadow-2xl text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#e5e5e5] dark:border-[#14213d] font-bold text-[#14213d] dark:text-white">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#fca311]" />
              GIS Feature Overlays
            </span>
            <button
              onClick={() => setShowLayerDrawer(false)}
              className="text-slate-400 hover:text-black dark:hover:text-white text-xs font-mono"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 font-medium">
            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#fca311]" />
                Mine Lease Perimeter
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.boundary}
                onChange={e => setLayerVisibility({ ...layerVisibility, boundary: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                Pit Excavation Benches
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.benches}
                onChange={e => setLayerVisibility({ ...layerVisibility, benches: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                Geological Fault Lines
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.faults}
                onChange={e => setLayerVisibility({ ...layerVisibility, faults: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 border border-red-500" />
                Subsidence Hazard Iso-Zones
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.hazardZones}
                onChange={e => setLayerVisibility({ ...layerVisibility, hazardZones: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Evacuation Corridors
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.evacuation}
                onChange={e => setLayerVisibility({ ...layerVisibility, evacuation: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fca311] border border-black" />
                LoRa Wireless Mesh Links
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.meshLinks}
                onChange={e => setLayerVisibility({ ...layerVisibility, meshLinks: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#14213d]/40 cursor-pointer">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Radio className="w-3 h-3 text-[#fca311]" />
                Sensor Nodes (IoT Beacons)
              </span>
              <input
                type="checkbox"
                checked={layerVisibility.nodes}
                onChange={e => setLayerVisibility({ ...layerVisibility, nodes: e.target.checked })}
                className="accent-[#fca311] rounded cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* Bottom Floating Mine GIS Coordinates & Active Node Telemetry Banner */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#0a1120]/90 backdrop-blur-md border border-[#e5e5e5] dark:border-[#14213d] shadow-lg text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[#14213d] dark:text-[#fca311] font-bold">
          <Navigation className="w-3.5 h-3.5" />
          <span>Jharia Coalfield, India</span>
        </div>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600 dark:text-slate-300">Lat: 23.7505° N, Lon: 86.4172° E</span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600 dark:text-slate-300">Datum: WGS84 / EPSG:4326</span>
        {measureModeActive && (
          <>
            <span className="text-slate-400">|</span>
            <span className="text-amber-500 font-bold animate-pulse">
              Click 2 map points to measure distance
            </span>
          </>
        )}
      </div>

      {/* CSS Styles for Leaflet tooltips & Popups */}
      <style jsx global>{`
        .gis-custom-tooltip {
          background: rgba(10, 17, 32, 0.9) !important;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(252, 163, 17, 0.4) !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          font-family: inherit !important;
          font-size: 11px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5) !important;
        }
        .gis-custom-tooltip:before {
          border-top-color: rgba(10, 17, 32, 0.9) !important;
        }
        .gis-measure-tooltip {
          background: #fca311 !important;
          color: #000000 !important;
          font-weight: 800 !important;
          border-radius: 6px !important;
          border: 1px solid #000 !important;
          font-size: 10px !important;
          padding: 3px 6px !important;
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 14px !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          line-height: inherit !important;
        }
        .leaflet-popup-tip {
          background: #0a1120 !important;
        }
        .gis-node-marker-wrap.selected {
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  );
}
export default DigitalTwinMap;
