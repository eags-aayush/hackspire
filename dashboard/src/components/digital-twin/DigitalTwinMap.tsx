"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  NATIONAL_COAL_MINES,
  NationalCoalMineSite,
  MiningNodeSpatialInfo,
} from '@/lib/gis/miningGisData';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import { ShadowMlPrediction } from '@/types/ml';
import { useRealtime } from '@/hooks/useRealtime';
import {
  Layers,
  Compass,
  Maximize2,
  Minimize2,
  Ruler,
  Shield,
  Radio,
  Search,
  ExternalLink,
  FileText,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Flame,
  Thermometer,
  Wind,
  Users,
  Truck,
  Download,
  Info,
} from 'lucide-react';

export type BaseTileType = 'satellite' | 'hybrid' | 'dark' | 'osm' | 'topo';

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
  satellite: {
    name: 'Esri World Imagery (Satellite Pit View)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
  },
  hybrid: {
    name: 'Satellite + Boundary Labels (Hybrid)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
  dark: {
    name: 'CartoDB Dark Matter (NOC Radar)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  osm: {
    name: 'OpenStreetMap Standard (Roads & Cities)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  topo: {
    name: 'OpenTopoMap (Topographic Contours)',
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
  const mapRootRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hybridOverlayLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const boundaryLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const benchesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const faultsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardZonesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const meshLinksLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const evacuationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const nationalMinesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const toolsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // UI state
  const [activeBaseTile, setActiveBaseTile] = useState<BaseTileType>('satellite');
  const [showLegend, setShowLegend] = useState(true);
  const [measureModeActive, setMeasureModeActive] = useState(false);
  const [measureDistanceM, setMeasureDistanceM] = useState<number | null>(null);
  const [bufferRadiusActive, setBufferRadiusActive] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Realtime Web Serial Telemetry Link
  const { isSerialConnected, livePortData, connectSerialPort } = useRealtime();

  // National Coal Mining GPS Atlas states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMine, setSelectedMine] = useState<NationalCoalMineSite | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [dangerFilter, setDangerFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low' | 'abandoned'>('all');

  // Filtered national mines
  const filteredNationalMines = useMemo(() => {
    return NATIONAL_COAL_MINES.filter(mine => {
      const matchesSearch =
        searchQuery === '' ||
        mine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mine.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mine.coalfield.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDanger = dangerFilter === 'all' || mine.dangerLevel === dangerFilter;
      return matchesSearch && matchesDanger;
    });
  }, [searchQuery, dangerFilter]);

  // Sync fullscreen state with browser Fullscreen API
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 350);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      isFullscreen
    );

    if (!isCurrentlyFullscreen) {
      const el = mapRootRef.current;
      if (el) {
        if (el.requestFullscreen) {
          try {
            await el.requestFullscreen();
            return;
          } catch {}
        } else if ((el as any).webkitRequestFullscreen) {
          try {
            await (el as any).webkitRequestFullscreen();
            return;
          } catch {}
        }
      }
      setIsFullscreen(true);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    } else {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
            return;
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
            return;
          }
        } catch {}
      }
      setIsFullscreen(false);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isFullscreen]);

  // Layer toggles
  const [layerVisibility, setLayerVisibility] = useState({
    boundary: true,
    benches: true,
    faults: true,
    hazardZones: true,
    meshLinks: true,
    evacuation: true,
    nodes: true,
    nationalMines: true,
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
      minZoom: 4,
    });

    // Custom positioned zoom control at topright below the toolbar
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: 'National Mine Safety GIS Portal' }).addTo(map);

    // Add initial base tile layer (Satellite by default!)
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
    nationalMinesLayerGroupRef.current = L.layerGroup().addTo(map);
    toolsLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

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
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (hybridOverlayLayerRef.current) {
      map.removeLayer(hybridOverlayLayerRef.current);
      hybridOverlayLayerRef.current = null;
    }

    const newBase = TILE_PROVIDERS[activeBaseTile];
    const newTile = L.tileLayer(newBase.url, {
      attribution: newBase.attribution,
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = newTile;

    if (activeBaseTile === 'hybrid') {
      const labelsOverlay = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.95 }
      ).addTo(map);
      hybridOverlayLayerRef.current = labelsOverlay;
    }
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
          color: '#c9a227',
          weight: 2.5,
          dashArray: '8, 6',
          fillColor: '#c9a227',
          fillOpacity: 0.05,
        })
          .bindTooltip('<b>Jharia Seam XI/XII Concession Perimeter</b><br>Area: 2.14 km²', {
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

          const assemblyIcon = L.divIcon({
            className: 'assembly-point-icon',
            html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-lg border-2 border-white animate-bounce">A</div>`,
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
          <div class="absolute w-10 h-10 rounded-full bg-[#003366]/20 animate-ping"></div>
          <div class="relative w-8 h-8 rounded-xl bg-[#003366] border-2 border-[#c9a227] shadow-[0_0_15px_rgba(201,162,39,0.7)] flex items-center justify-center text-white font-bold">
            ★
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(GATEWAY_SPATIAL_INFO.coordinates, { icon: gwIcon })
      .bindPopup(`
        <div class="p-3 font-serif text-xs space-y-2 bg-[#003366] text-white rounded-lg border border-[#c9a227]">
          <div class="flex items-center gap-2 border-b border-white/20 pb-2 font-bold text-sm text-[#c9a227]">
            <span>${GATEWAY_SPATIAL_INFO.name}</span>
          </div>
          <div class="space-y-1 text-[11px] text-slate-100">
            <div>Elevation: <b class="text-white">${GATEWAY_SPATIAL_INFO.elevationM}m MSL</b></div>
            <div>Mast Height: <b class="text-white">${GATEWAY_SPATIAL_INFO.antennaHeightM}m</b></div>
            <div>Frequency: <b class="text-[#c9a227]">${GATEWAY_SPATIAL_INFO.frequencyMhz} MHz</b></div>
            <div>Protocol: <b class="text-emerald-300">${GATEWAY_SPATIAL_INFO.meshProtocol}</b></div>
          </div>
        </div>
      `, { className: 'gis-custom-popup' })
      .bindTooltip(`<b>${GATEWAY_SPATIAL_INFO.name}</b><br>LoRa Master Receiver Mast`, {
        sticky: true,
        className: 'gis-custom-tooltip',
      })
      .addTo(markersLayerGroupRef.current);

    // 2. Telemetry Nodes
    const registeredNodes = Object.values(MINING_NODE_REGISTRY);

    registeredNodes.forEach(node => {
      const nodeReads = readings[node.zoneId]?.[node.nodeId] || {};
      const statusObj = nodeStatuses[node.zoneId]?.[node.nodeId];
      const isOnline = statusObj?.status === 'online';
      const gapCount = statusObj?.gapCount || 0;

      const tiltVal = nodeReads.tilt?.value || 0;
      const dispVal = nodeReads.displacement?.value || 0;
      const vibeVal = nodeReads.vibration?.value || 0;
      const gasVal = nodeReads.gas?.value || 0;
      const waterVal = nodeReads.water?.value || 0;

      const isCritical =
        tiltVal >= node.criticalThresholdTilt ||
        dispVal >= node.criticalThresholdDisp ||
        gasVal > 2500 ||
        waterVal < 25;

      const isCaution =
        tiltVal >= node.criticalThresholdTilt * 0.7 ||
        dispVal >= node.criticalThresholdDisp * 0.7 ||
        gasVal > 1500;

      const color = !isOnline ? '#64748b' : isCritical ? '#dc2626' : isCaution ? '#f59e0b' : '#22c55e';
      const isSelected = selectedNodeId === node.nodeId;

      const nodeIcon = L.divIcon({
        className: `gis-node-marker-wrap ${isSelected ? 'selected' : ''}`,
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            ${isCritical ? `<div class="absolute w-8 h-8 rounded-full bg-red-600/40 animate-ping"></div>` : ''}
            <div class="relative flex items-center justify-center w-7 h-7 rounded-full shadow-md border-2 ${
              isSelected ? 'border-[#c9a227] scale-125 z-50 ring-4 ring-[#c9a227]/40' : 'border-white dark:border-[#0a1120]'
            }" style="background-color: ${color}">
              <span class="text-[10px] font-bold text-white font-mono">${node.nodeId.replace('NODE_0', 'N')}</span>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(node.coordinates, { icon: nodeIcon });

      marker.on('click', () => {
        onSelectNode(node.nodeId);
      });

      marker
        .bindTooltip(`
          <div class="font-serif">
            <div class="font-bold text-xs text-[#003366] dark:text-[#c9a227]">${node.label} (${node.nodeId})</div>
            <div class="text-[10px] text-slate-600 dark:text-slate-300">Depth: -${node.depthM}m | Strata: ${node.strataLayer}</div>
            <div class="text-[10px] text-slate-500">Status: <span style="color:${color};font-weight:bold">${!isOnline ? 'OFFLINE' : isCritical ? 'CRITICAL HAZARD' : isCaution ? 'CAUTION' : 'NOMINAL'}</span></div>
          </div>
        `, {
          sticky: true,
          className: 'gis-custom-tooltip',
        })
        .addTo(markersLayerGroupRef.current!);

      // LoRa wireless mesh link to gateway
      if (layerVisibility.meshLinks && isOnline) {
        L.polyline([node.coordinates, GATEWAY_SPATIAL_INFO.coordinates], {
          color: color,
          weight: isSelected ? 2.5 : 1.2,
          dashArray: '3, 6',
          opacity: isSelected ? 0.9 : 0.45,
        }).addTo(meshLinksLayerGroupRef.current!);
      }
    });
  }, [layerVisibility, readings, nodeStatuses, selectedNodeId, onSelectNode]);

  // Render National Coal Mines GPS Atlas Markers
  useEffect(() => {
    const group = nationalMinesLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();
    if (!layerVisibility.nationalMines) return;

    filteredNationalMines.forEach(mine => {
      const isSelected = selectedMine?.id === mine.id;
      const size = isSelected ? 38 : 28;

      let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-600';
      let iconSvg = `<circle cx="12" cy="12" r="8" fill="currentColor"/>`;

      if (mine.dangerLevel === 'critical') {
        colorClass = 'text-red-700 bg-red-50 border-red-600 animate-pulse';
        iconSvg = `<polygon points="12,2 22,20 2,20" fill="currentColor"/><text x="12" y="18" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">!</text>`;
      } else if (mine.dangerLevel === 'high') {
        colorClass = 'text-amber-700 bg-amber-50 border-amber-600';
        iconSvg = `<polygon points="12,3 21,19 3,19" fill="currentColor"/><text x="12" y="17" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">!</text>`;
      } else if (mine.dangerLevel === 'medium') {
        colorClass = 'text-yellow-700 bg-yellow-50 border-yellow-600';
        iconSvg = `<circle cx="12" cy="12" r="7" fill="currentColor"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">!</text>`;
      } else if (mine.dangerLevel === 'abandoned') {
        colorClass = 'text-slate-600 bg-slate-100 border-slate-500 opacity-75';
        iconSvg = `<circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.4"/><line x1="7" y1="7" x2="17" y2="17" stroke="currentColor" stroke-width="2.5"/><line x1="17" y1="7" x2="7" y2="17" stroke="currentColor" stroke-width="2.5"/>`;
      }

      const nationalIcon = L.divIcon({
        className: `national-mine-marker-icon ${isSelected ? 'national-mine-selected' : ''}`,
        html: `
          <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-125" style="width:${size}px; height:${size}px;">
            <div class="w-full h-full rounded-full border-2 shadow-md flex items-center justify-center ${colorClass}">
              <svg viewBox="0 0 24 24" class="w-4 h-4">${iconSvg}</svg>
            </div>
            ${isSelected ? `<div class="absolute -bottom-1 w-2 h-2 rounded-full bg-[#c9a227]"></div>` : ''}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([mine.lat, mine.lng], { icon: nationalIcon });

      marker.on('click', () => {
        setSelectedMine(mine);
        setInspectorOpen(true);
        mapInstanceRef.current?.flyTo([mine.lat, mine.lng], 12, { duration: 1 });
      });

      marker.bindTooltip(`
        <div class="font-serif">
          <div class="font-bold text-xs text-[#003366] dark:text-[#c9a227]">${mine.name}</div>
          <div class="text-[10px] text-slate-600 dark:text-slate-300">${mine.coalfield} • ${mine.state}</div>
          <div class="text-[10px] mt-0.5">Danger: <b class="uppercase">${mine.dangerLevel}</b> (${mine.risk}% Risk)</div>
          <div class="text-[9px] text-slate-400">Click to inspect geological safety profile</div>
        </div>
      `, {
        sticky: true,
        className: 'gis-custom-tooltip',
      }).addTo(group);
    });
  }, [filteredNationalMines, layerVisibility.nationalMines, selectedMine]);

  // Fly to selected node
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

      L.circleMarker(e.latlng, {
        radius: 5,
        color: '#c9a227',
        fillColor: '#ffffff',
        fillOpacity: 1,
      }).addTo(toolsGroup);

      if (measurePointsRef.current.length === 2) {
        const p1 = measurePointsRef.current[0];
        const p2 = measurePointsRef.current[1];
        const dist = p1.distanceTo(p2);
        setMeasureDistanceM(Math.round(dist * 10) / 10);

        L.polyline([p1, p2], {
          color: '#c9a227',
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
        color: '#dc2626',
        weight: 2,
        fillColor: '#dc2626',
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
  const flyToPreset = (preset: 'national' | 'jharia' | 'zone1' | 'critical') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (preset === 'national') {
      map.flyTo([22.5937, 82.9629], 5, { duration: 1.2 });
    } else if (preset === 'jharia') {
      map.flyTo(MINE_CENTER_COORDS, MINE_DEFAULT_ZOOM, { duration: 1.2 });
    } else if (preset === 'zone1') {
      map.flyTo([23.7515, 86.4170], 17, { duration: 1 });
    } else if (preset === 'critical') {
      map.flyTo([23.7495, 86.4192], 18, { duration: 1.2 });
      onSelectNode('NODE_03');
    }
  };

  // Download Statutory Safety Audit PDF using window.jspdf
  const downloadMineAuditPdf = (mine: NationalCoalMineSite) => {
    const jspdfModule = (window as any).jspdf;
    if (!jspdfModule || !jspdfModule.jsPDF) {
      window.print();
      return;
    }

    try {
      const doc = new jspdfModule.jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 18;
      const pageW = doc.internal.pageSize.getWidth();
      const navy = [0, 51, 102];
      const gold = [201, 162, 39];

      // Top Header Bands
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 26, 'F');
      doc.setFillColor(...gold);
      doc.rect(0, 26, pageW, 2.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('DGMS STATUTORY SAFETY AUDIT REPORT', margin, 11);
      doc.setFontSize(8.5);
      doc.setFont('times', 'normal');
      doc.text('DIRECTORATE GENERAL OF MINES SAFETY | MINISTRY OF COAL, GOVT OF INDIA', margin, 17);
      doc.text('NATIONAL MINEGUARD IOT MONITORING PROGRAMME • DGMS RULES 1955', margin, 22);

      let y = 36;
      doc.setTextColor(0, 0, 0);

      const sectionTitle = (title: string) => {
        if (y > 250) { doc.addPage(); y = margin; }
        doc.setFillColor(...navy);
        doc.rect(margin, y, pageW - margin * 2, 6.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('times', 'bold');
        doc.setFontSize(9.5);
        doc.text(title, margin + 3, y + 4.8);
        y += 11;
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
      };

      const bodyLine = (label: string, value: string) => {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.setFont('times', 'bold');
        doc.text(label, margin, y);
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(String(value), pageW - margin * 2 - 45);
        doc.text(lines, margin + 45, y);
        y += Math.max(5.5, lines.length * 4.2);
      };

      sectionTitle('1. Mine Profiling & Spatial Identification');
      bodyLine('Colliery Name:', mine.name);
      bodyLine('State / Territory:', mine.state);
      bodyLine('Coalfield Basin:', mine.coalfield);
      bodyLine('Geological Formation:', mine.geology);
      bodyLine('Extraction Method:', mine.type.toUpperCase());
      bodyLine('Geographical Coordinates:', `${mine.lat.toFixed(5)}° N, ${mine.lng.toFixed(5)}° E`);
      bodyLine('Operational Status:', mine.status.toUpperCase());
      bodyLine('Geological Prominence:', mine.prominence);
      y += 2;

      sectionTitle('2. Environmental & Gas Telemetry (DGMS Limits)');
      const ch4Vol = livePortData?.mq4 != null
        ? (livePortData.mq4 / 10000).toFixed(3)
        : (isSerialConnected ? '0.000' : (mine.ch4 / 10000).toFixed(3));
      const observedCh4 = livePortData?.mq4 != null ? `${livePortData.mq4} ppm` : `${mine.ch4} ppm`;
      const observedCo = livePortData?.mq135 != null ? `${Math.round(livePortData.mq135)} ppm` : `${mine.co2} ppm`;
      const observedTemp = livePortData?.temp != null ? `${livePortData.temp.toFixed(1)}°C` : `${mine.temp.toFixed(1)}°C`;
      const telSource = livePortData ? 'LIVE SERIAL PORT' : 'REGIONAL BASELINE';

      if (doc.autoTable) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Parameter', 'Observed Reading', 'Statutory Limit', 'Compliance / Source']],
          body: [
            ['Methane (CH₄)', `${ch4Vol}% vol (${observedCh4})`, '1.25% vol max (Reg 122)', `${telSource} COMPLIANT`],
            ['Carbon Monoxide / CO₂', observedCo, '500 ppm threshold', `${telSource} COMPLIANT`],
            ['Ambient Temperature', observedTemp, '48.0°C max limit', `${telSource} NOMINAL`],
            ['Water Elevation / Depth', livePortData?.water != null ? `${Math.round(livePortData.water)} cm` : 'Normal', 'Subsurface Drainage', `${telSource} ACTIVE`],
          ],
          styles: { font: 'times', fontSize: 8.5 },
          headStyles: { fillColor: navy, textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      sectionTitle('3. Personnel & Heavy Machinery Deployment');
      bodyLine('Underground / Pit Workforce:', `${mine.workers} Certified Personnel`);
      bodyLine('Active Haulage Vehicles:', `${mine.vehicles} Heavy Mining Machinery Units`);
      bodyLine('Evacuation Readiness:', mine.risk >= 70 ? 'EMERGENCY PROTOCOL ALPHA' : 'STANDARD DRILL COMPLIANT');
      y += 2;

      sectionTitle('4. Statutory Directives & Safety Verdict');
      const directive = mine.risk >= 70
        ? 'CRITICAL ALERT: Environmental gas levels or geotechnical instability indices indicate high-stress strata. Auxiliary exhaust fans must be driven at maximum frequency under Coal Mines Regulations Rule 123. Review pit slope drainage immediately.'
        : mine.risk >= 40
        ? 'CAUTION ADVISORY: Methane gas accumulation and temperature are elevated. Intensify stone dusting at face sections. Monitor haulage roads for structural cracking.'
        : 'NOMINAL STATUS: Parameters are fully compliant with statutory limits. Maintain continuous gas monitoring and standard ventilation cycles.';
      bodyLine('DGMS Safety Advisory:', directive);

      y += 12;
      if (y > 250) { doc.addPage(); y = margin; }
      doc.line(margin, y, margin + 50, y);
      doc.setFont('times', 'bold');
      doc.text('DGMS Regional Inspector', margin, y + 5);
      doc.setFont('times', 'normal');
      doc.text('Government of India', margin, y + 9);

      doc.line(pageW - margin - 50, y, pageW - margin, y);
      doc.setFont('times', 'bold');
      doc.text('Mine Safety Officer', pageW - margin - 50, y + 5);
      doc.setFont('times', 'normal');
      doc.text('MineGuard IoT Certified', pageW - margin - 50, y + 9);

      doc.save(`DGMS_Safety_Audit_${mine.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      window.print();
    }
  };

  return (
    <div
      ref={mapRootRef}
      className={`relative w-full rounded-2xl overflow-hidden border border-[#c9c9c9] dark:border-[#334155] shadow-2xl bg-[#000000] transition-all duration-300 ${
        isFullscreen ? '!fixed !inset-0 !z-[9999] !w-screen !h-screen !rounded-none !m-0 !p-0' : 'h-[680px]'
      }`}
    >
      {/* Leaflet DOM container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating GIS Toolbar: Search, Colliery Selector, Map Style */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
        {/* Search input for 60+ national mines */}
        <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-[#003366]/95 backdrop-blur-md rounded-lg border border-[#003366]/20 dark:border-[#c9a227]/40 shadow-md px-3 py-1.5 w-60 sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#003366] dark:text-[#c9a227] mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search 60+ mines, states, basins…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none font-serif"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-black dark:hover:text-white text-xs px-1">
              ✕
            </button>
          )}
        </div>

        {/* Master Colliery Quick Selector Dropdown */}
        <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-[#003366]/95 backdrop-blur-md rounded-lg border border-[#003366]/20 dark:border-[#c9a227]/40 shadow-md px-2.5 py-1.5">
          <select
            value={selectedMine?.id || 'jharia-local'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'jharia-local') {
                setSelectedMine(null);
                setInspectorOpen(false);
                flyToPreset('jharia');
              } else {
                const found = NATIONAL_COAL_MINES.find(m => m.id === val);
                if (found) {
                  setSelectedMine(found);
                  setInspectorOpen(true);
                  mapInstanceRef.current?.flyTo([found.lat, found.lng], 12, { duration: 1 });
                }
              }
            }}
            className="bg-transparent text-xs font-serif font-bold text-[#003366] dark:text-white focus:outline-none cursor-pointer pr-1"
          >
            <option value="jharia-local">★ Central Digital Twin — Jharia Seam XI/XII</option>
            <optgroup label="Chhattisgarh (SECL)">
              <option value="korba-gevra">Gevra Mega Open-Cast (Asia's Largest)</option>
              <option value="korba-dipka">Dipka Open-Cast Colliery</option>
              <option value="korba-kusmunda">Kusmunda Deep Extraction Cut</option>
            </optgroup>
            <optgroup label="Jharkhand (BCCL / CCL)">
              <option value="jharia-dhanbad">Jharia Coalfield - Dhanbad Pit</option>
              <option value="jharia-sudamdih">Sudamdih-Patherdih Shaft Colliery</option>
              <option value="bokaro-west">West Bokaro Metallurgical Pit</option>
              <option value="karanpura-amrapali">Amrapali Mechanized OCP</option>
            </optgroup>
            <optgroup label="Odisha (MCL)">
              <option value="talcher-bhubaneswari">Bhubaneswari Mega Pit (Talcher)</option>
              <option value="ibvalley-lakhanpur">Lakhanpur Deep Pit (Ib Valley)</option>
            </optgroup>
            <optgroup label="Madhya Pradesh (NCL / SECL)">
              <option value="singrauli-jayant">Jayant Open-Cast (Singrauli Basin)</option>
              <option value="singrauli-dudhichua">Dudhichua Heavy Stripping Pit</option>
            </optgroup>
            <optgroup label="West Bengal (ECL)">
              <option value="raniganj-chinakuri">Chinakuri Deep Underground Colliery</option>
              <option value="raniganj-jhanjra">Jhanjra Continuous Miner Colliery</option>
            </optgroup>
            <optgroup label="Telangana (SCCL)">
              <option value="godavari-adriyala">Adriyala Longwall Shaft Project</option>
            </optgroup>
            <optgroup label="Maharashtra (WCL)">
              <option value="wardha-sasti">Sasti Open-Cast Colliery (Wardha)</option>
              <option value="kamptee-adasa">Adasa UG-to-OC Transition Mine</option>
            </optgroup>
            <optgroup label="Tamil Nadu (NLC)">
              <option value="neyveli-mine-1">Neyveli Lignite Mine I</option>
            </optgroup>
          </select>
        </div>

        {/* Clean Map Style Dropdown */}
        <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-[#003366]/95 backdrop-blur-md rounded-lg border border-[#003366]/20 dark:border-[#c9a227]/40 shadow-md px-2.5 py-1.5">
          <select
            value={activeBaseTile}
            onChange={e => setActiveBaseTile(e.target.value as BaseTileType)}
            className="bg-transparent text-xs font-serif font-bold text-[#003366] dark:text-white focus:outline-none cursor-pointer"
            title="Select Base Map Appearance"
          >
            <option value="satellite">Satellite Imagery (Aerial Pit View)</option>
            <option value="hybrid">Satellite + Roads & Labels (Hybrid)</option>
            <option value="dark">Dark Matter (NOC Radar)</option>
            <option value="osm">Standard Map (Roads & Cities)</option>
            <option value="topo">Topographic Contours (Terrain)</option>
          </select>
        </div>
      </div>

      {/* Top Right Tool Bar: Measurement Ruler, Fullscreen */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => {
            setMeasureModeActive(!measureModeActive);
            if (measureModeActive && toolsLayerGroupRef.current) {
              toolsLayerGroupRef.current.clearLayers();
              setMeasureDistanceM(null);
            }
          }}
          className={`p-2 rounded-lg backdrop-blur-md border shadow-md transition-all flex items-center gap-1.5 text-xs font-bold font-serif ${
            measureModeActive
              ? 'bg-[#c9a227] text-black border-[#c9a227]'
              : 'bg-white/95 dark:bg-[#003366]/95 text-slate-800 dark:text-white border-[#c9c9c9] dark:border-[#334155] hover:border-[#c9a227]'
          }`}
          title="Click 2 points on map to measure linear distance"
        >
          <Ruler className="w-4 h-4" />
          {measureDistanceM !== null && <span className="font-mono">{measureDistanceM}m</span>}
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-white/95 dark:bg-[#003366]/95 backdrop-blur-md text-slate-800 dark:text-white border border-[#c9c9c9] dark:border-[#334155] hover:border-[#c9a227] shadow-md transition-all"
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Map View'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-[#c9a227]" />}
        </button>
      </div>

      {/* Slide-Out Mine Profile Inspector Drawer (`gps-inspector`) */}
      <aside
        className={`absolute top-20 right-4 bottom-4 w-96 max-w-[calc(100%-32px)] z-30 flex flex-col rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-[#003366]/20 dark:border-[#c9a227]/40 shadow-2xl transition-transform duration-300 overflow-hidden font-serif ${
          inspectorOpen && selectedMine ? 'translate-x-0' : 'translate-x-[450px] pointer-events-none'
        }`}
      >
        {selectedMine && (
          <>
            {/* Inspector Head */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#003366] to-[#1a4480] text-white flex items-center justify-between border-b-2 border-[#c9a227]">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-ping" />
                  <h3 className="font-bold text-sm leading-snug">{selectedMine.name}</h3>
                </div>
                <div className="text-[11px] text-slate-200 mt-0.5">
                  {selectedMine.coalfield} • {selectedMine.state} • {selectedMine.geology.split(' ')[0]} Basin
                </div>
              </div>
              <button
                onClick={() => setInspectorOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors"
                title="Close Profile Inspector"
              >
                ✕
              </button>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
              {/* Live Serial Port Banner or Waiting Notice */}
              {isSerialConnected && livePortData ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold text-[11px]">Hardware Port Active ({livePortData.nodeId})</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    {livePortData.lastPacketTime ? new Date(livePortData.lastPacketTime).toLocaleTimeString() : 'Streaming'}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">⚠</span>
                    <span className="text-[11px] font-semibold">Waiting for live serial port telemetry</span>
                  </div>
                  <button
                    onClick={() => connectSerialPort(115200)}
                    className="px-2 py-1 rounded bg-[#003366] hover:bg-[#1a4480] text-white text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                  >
                    ⚡ Connect Port
                  </button>
                </div>
              )}

              {/* Telemetry Row - Live Port Detected vs Disconnected */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                  <span>Safety Telemetry Gauges</span>
                  <span className="font-mono text-[9px] text-[#003366] dark:text-[#c9a227]">
                    {isSerialConnected && livePortData ? '● REAL-TIME SERIAL STREAM' : 'OFFLINE / WAITING'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-inner">
                    <div className="text-xs font-mono font-extrabold text-[#003366] dark:text-[#c9a227]">
                      {livePortData?.mq4 != null ? `${(livePortData.mq4 / 10000).toFixed(3)}%` : '--'}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                      CH₄ Level {livePortData?.mq4 != null && <span className="font-mono text-[8px]">({Math.round(livePortData.mq4)} ppm)</span>}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-inner">
                    <div className="text-xs font-mono font-extrabold text-[#003366] dark:text-[#c9a227]">
                      {livePortData?.mq135 != null ? `${Math.round(livePortData.mq135)} ppm` : '--'}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">CO₂ / CO</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-inner">
                    <div className="text-xs font-mono font-extrabold text-[#003366] dark:text-[#c9a227]">
                      {livePortData?.temp != null ? `${livePortData.temp.toFixed(1)}°C` : '--'}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Temp</div>
                  </div>
                </div>

                {/* Additional Live Telemetry Row: Water & Seismic/Humidity */}
                {livePortData && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      <div className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400">
                        {livePortData.water != null ? `${Math.round(livePortData.water)} cm` : '--'}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Water Drainage</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      <div className="text-xs font-mono font-extrabold text-amber-600 dark:text-amber-400">
                        {livePortData.hum != null ? `${livePortData.hum.toFixed(1)}%` : livePortData.ml != null ? `ML ${livePortData.ml.toFixed(2)}` : '--'}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                        {livePortData.hum != null ? 'Relative Humidity' : 'Richter ML'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Circular Risk Progress Ring */}
              {(() => {
                const dynamicRisk = livePortData
                  ? Math.min(100, Math.max(5, Math.round(
                      ((livePortData.mq4 || 0) / 3000) * 40 +
                      ((livePortData.mq135 || 0) / 2000) * 30 +
                      ((livePortData.temp || 25) > 40 ? 20 : 5) +
                      ((livePortData.ml || 0) >= 1 ? 25 : 0)
                    )))
                  : null;

                const isDanger = dynamicRisk !== null && dynamicRisk >= 70;
                const isCaution = dynamicRisk !== null && dynamicRisk >= 40;

                return (
                  <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="32" cy="32" r="26" stroke="#cbd5e1" strokeWidth="5" fill="none" />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke={
                            dynamicRisk === null
                              ? '#94a3b8'
                              : isDanger
                              ? '#dc2626'
                              : isCaution
                              ? '#f59e0b'
                              : '#16a34a'
                          }
                          strokeWidth="5"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray="163"
                          strokeDashoffset={dynamicRisk !== null ? 163 - (dynamicRisk / 100) * 163 : 163}
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs">
                        {dynamicRisk !== null ? `${dynamicRisk}%` : '--'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-xs text-[#003366] dark:text-white">Strata & Gas Risk Factor</div>
                      <div
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                          dynamicRisk === null
                            ? 'bg-slate-100 text-slate-600 border border-slate-300'
                            : isDanger
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : isCaution
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {dynamicRisk === null
                          ? 'AWAITING PORT'
                          : isDanger
                          ? 'HIGH RISK ZONE'
                          : isCaution
                          ? 'CAUTION OUTLOOK'
                          : 'NOMINAL STATE'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Geological Profile Narrative */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                  Geological Formation & Stratigraphy
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  {selectedMine.prominence}
                </p>
                <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
                  <div>• Basin Formation: <b>{selectedMine.geology}</b></div>
                  <div>• Mining Category: <b className="uppercase">{selectedMine.type}</b></div>
                  <div>• Coordinates: <b>{selectedMine.lat.toFixed(5)}°N, {selectedMine.lng.toFixed(5)}°E</b></div>
                </div>
              </div>

              {/* Live Personnel & HEMM Equipment Roster */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
                  Active Asset Roster ({selectedMine.workers + selectedMine.vehicles} Units)
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-[#003366] dark:text-[#c9a227]" />
                      <div>
                        <div className="font-bold text-[11px]">Underground Personnel</div>
                        <div className="text-[9px] text-slate-400">{selectedMine.workers} Certified Miners Logged</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMine.risk >= 70 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {selectedMine.risk >= 70 ? 'ALERT' : 'SAFE'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-[#003366] dark:text-[#c9a227]" />
                      <div>
                        <div className="font-bold text-[11px]">HEMM Haulage Equipment</div>
                        <div className="text-[9px] text-slate-400">{selectedMine.vehicles} Shovels & Dumpers Tracked</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      DEPLOYED
                    </span>
                  </div>
                </div>
              </div>

              {/* GIS Command Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedMine.lat},${selectedMine.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#003366] hover:text-white dark:hover:bg-[#c9a227] dark:hover:text-[#003366] border border-slate-200 dark:border-slate-700 text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Street View
                  </a>
                  <a
                    href={`https://earth.google.com/web/@${selectedMine.lat},${selectedMine.lng},300a,30d,35y,0h,0t,0r`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#003366] hover:text-white dark:hover:bg-[#c9a227] dark:hover:text-[#003366] border border-slate-200 dark:border-slate-700 text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Google Earth 3D
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => downloadMineAuditPdf(selectedMine)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#003366] hover:bg-[#1a4480] text-white font-bold text-xs border border-[#c9a227] shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#c9a227]" />
                  <span>Download DGMS Safety Audit PDF</span>
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Bottom Right GIS Vector Layers & Status Legend Checklist */}
      <div className="absolute bottom-4 right-4 z-20 max-w-[270px] w-auto">
        {showLegend ? (
          <div className="p-3 rounded-xl bg-white/95 dark:bg-[#003366]/95 backdrop-blur-xl border border-[#003366]/20 dark:border-[#c9a227]/40 shadow-2xl text-xs space-y-2 animate-in fade-in slide-in-from-bottom-2 select-none font-serif">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#003366]/20 dark:border-white/10 font-bold text-[#003366] dark:text-white">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
                GIS Vector Layers & Danger
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-xs"
                title="Collapse Legend"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 font-medium max-h-[220px] overflow-y-auto pr-0.5 text-[11px]">
              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  National Coal Mines (Atlas)
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.nationalMines}
                  onChange={e => setLayerVisibility({ ...layerVisibility, nationalMines: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#c9a227]" />
                  Mine Lease Perimeter
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.boundary}
                  onChange={e => setLayerVisibility({ ...layerVisibility, boundary: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                  Pit Excavation Benches
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.benches}
                  onChange={e => setLayerVisibility({ ...layerVisibility, benches: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Geological Fault Lines
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.faults}
                  onChange={e => setLayerVisibility({ ...layerVisibility, faults: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 border border-red-500" />
                  Subsidence Hazard Zones
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.hazardZones}
                  onChange={e => setLayerVisibility({ ...layerVisibility, hazardZones: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Evacuation Corridors
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.evacuation}
                  onChange={e => setLayerVisibility({ ...layerVisibility, evacuation: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227] border border-black" />
                  LoRa Wireless Mesh Links
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.meshLinks}
                  onChange={e => setLayerVisibility({ ...layerVisibility, meshLinks: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Radio className="w-3 h-3 text-[#c9a227]" />
                  Sensor Nodes (IoT Beacons)
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.nodes}
                  onChange={e => setLayerVisibility({ ...layerVisibility, nodes: e.target.checked })}
                  className="accent-[#003366] dark:accent-[#c9a227] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLegend(true)}
            className="p-2.5 rounded-xl bg-white/95 dark:bg-[#003366]/95 backdrop-blur-md text-slate-800 dark:text-white border border-[#c9c9c9] dark:border-[#334155] hover:border-[#c9a227] shadow-xl flex items-center gap-2 text-xs font-serif font-bold transition-all hover:scale-105"
            title="Expand GIS Layers Legend"
          >
            <Layers className="w-4 h-4 text-[#c9a227]" />
            <span>GIS Layers</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Global CSS Styles for Leaflet tooltips & custom popups */}
      <style jsx global>{`
        :fullscreen, :-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #000000 !important;
        }
        :fullscreen .leaflet-container, :-webkit-full-screen .leaflet-container {
          width: 100vw !important;
          height: 100vh !important;
        }
        .leaflet-top.leaflet-right {
          margin-top: 60px !important;
          margin-right: 16px !important;
        }
        .leaflet-touch .leaflet-bar {
          border: 1px solid rgba(0, 51, 102, 0.2) !important;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25) !important;
          border-radius: 10px !important;
          overflow: hidden;
        }
        .leaflet-touch .leaflet-bar a {
          background-color: #ffffff !important;
          color: #003366 !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .dark .leaflet-touch .leaflet-bar a {
          background-color: #003366 !important;
          color: #c9a227 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-touch .leaflet-bar a:hover {
          background-color: #f1f5f9 !important;
          color: #003366 !important;
        }
        .dark .leaflet-touch .leaflet-bar a:hover {
          background-color: #1a4480 !important;
          color: #ffffff !important;
        }
        .gis-custom-tooltip {
          background: #003366 !important;
          border: 1px solid #c9a227 !important;
          color: #ffffff !important;
          border-radius: 6px !important;
          font-family: inherit !important;
          font-size: 11px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
        }
        .gis-custom-tooltip:before {
          border-top-color: #003366 !important;
        }
        .gis-measure-tooltip {
          background: #c9a227 !important;
          color: #000000 !important;
          font-weight: 800 !important;
          border-radius: 4px !important;
          border: 1px solid #000 !important;
          font-size: 10px !important;
          padding: 3px 6px !important;
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 12px !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          line-height: inherit !important;
        }
        .leaflet-popup-tip {
          background: #003366 !important;
        }
      `}</style>
    </div>
  );
}

export default DigitalTwinMap;
