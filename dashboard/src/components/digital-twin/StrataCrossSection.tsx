"use client";

import React, { useState, useMemo } from 'react';
import {
  calculatePecksSubsidenceProfile,
  MINING_NODE_REGISTRY,
} from '@/lib/gis/miningGisData';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import {
  Layers,
  Activity,
  Compass,
  Info,
  TrendingDown,
  Droplets,
  ChevronDown,
  Crosshair,
  Gauge,
} from 'lucide-react';

interface StrataCrossSectionProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  timeTravelOffsetHours?: number;
}

export function StrataCrossSection({
  selectedNodeId,
  onSelectNode,
  readings,
  nodeStatuses,
  timeTravelOffsetHours = 0,
}: StrataCrossSectionProps) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [showGeotechDetails, setShowGeotechDetails] = useState(true);

  // Active or fallback node
  const activeNodeId = selectedNodeId || 'NODE_03';
  const nodeInfo = MINING_NODE_REGISTRY[activeNodeId] || MINING_NODE_REGISTRY.NODE_03 || {
    nodeId: activeNodeId,
    zoneId: 'ZONE_01_LONGWALL_FACE',
    label: `Sensor ${activeNodeId}`,
    criticalThresholdTilt: 3.5,
    criticalThresholdDisp: 25.0,
    coordinates: [23.7494, 86.4212],
    depthM: 168,
    strataLayer: 'Immediate Roof / Main Seam XI',
    installationDate: '2025-11-15',
  };

  const zoneId = nodeInfo?.zoneId || 'ZONE_01_LONGWALL_FACE';

  // Live telemetry for active node
  const nodeReads = readings[zoneId]?.[activeNodeId] || {};
  const statusObj = nodeStatuses[zoneId]?.[activeNodeId];
  const isOnline = statusObj?.status === 'online';

  // Base live metrics
  let rawTilt = nodeReads.tilt?.value || 1.2;
  let rawDisp = nodeReads.displacement?.value || 12.5;
  const rawVibe = nodeReads.vibration?.value || 3.2;
  const rawWater = nodeReads.water?.value || 210;

  // In predictive time-travel simulation (+2h or +6h), apply subsidence growth factor
  if (timeTravelOffsetHours === 2) {
    rawDisp = rawDisp * 1.6 + 8;
    rawTilt = Math.min(4.8, rawTilt * 1.5 + 0.5);
  } else if (timeTravelOffsetHours === 6) {
    rawDisp = rawDisp * 2.8 + 22;
    rawTilt = Math.min(6.5, rawTilt * 2.2 + 1.2);
  }

  // Calculate dynamic Peck's subsidence settlement curve
  // Smax is proportional to surface displacement telemetry
  const sMaxMm = Math.max(15, rawDisp * 1.8);
  const inflectionPointM = 42; // Distance to inflection point based on Barakar sandstone depth
  const profilePoints = useMemo(() => {
    return calculatePecksSubsidenceProfile(sMaxMm, inflectionPointM, 240, 60);
  }, [sMaxMm, inflectionPointM]);

  // Full-bleed Widescreen Landscape SVG Coordinate System (1200 x 320)
  const svgWidth = 1200;
  const svgHeight = 320;
  const groundBaseY = 65; // Surface elevation datum (+220m)
  const profileStartX = 80;
  const profileEndX = 1120;
  const profileSpanX = profileEndX - profileStartX;

  // Convert cross-section distance (-120m to +120m) into SVG X coordinates
  const scaleX = (xM: number) => {
    return profileStartX + ((xM + 120) / 240) * profileSpanX;
  };

  // Convert settlement (mm) into visual dip on the surface
  const scaleYSurface = (settlementMm: number) => {
    return groundBaseY + (settlementMm / 100) * 45;
  };

  // Dynamic surface curve path (Peck's Trough) connecting smoothly edge-to-edge
  const surfacePathD = useMemo(() => {
    if (!profilePoints.length) return '';
    // Start at x = 0 (left edge) at datum level
    let d = `M 0 ${groundBaseY} L ${scaleX(profilePoints[0].distM)} ${scaleYSurface(profilePoints[0].settlementMm)}`;
    for (let i = 1; i < profilePoints.length; i++) {
      const pt = profilePoints[i];
      d += ` L ${scaleX(pt.distM)} ${scaleYSurface(pt.settlementMm)}`;
    }
    // Continue to x = svgWidth (right edge)
    d += ` L ${svgWidth} ${groundBaseY}`;
    return d;
  }, [profilePoints, groundBaseY, svgWidth]);

  // Fill path underneath the surface to represent the overburden
  const overburdenFillPathD = useMemo(() => {
    if (!profilePoints.length) return '';
    let d = surfacePathD;
    d += ` L ${svgWidth} 140 L 0 140 Z`;
    return d;
  }, [surfacePathD, svgWidth]);

  // Borehole probe coordinates
  const boreholeX = scaleX(0); // Centerline at x = 600px
  const probeTopY = scaleYSurface(sMaxMm);
  const probeBottomY = 245;
  const deflectionDx = Math.sin((rawTilt * Math.PI) / 180) * 35; // Visual tilt curve

  // Current hovered or center point data
  const activeProfilePoint =
    hoveredPointIndex !== null && profilePoints[hoveredPointIndex]
      ? profilePoints[hoveredPointIndex]
      : profilePoints[Math.floor(profilePoints.length / 2)];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0a1120] border border-[#e5e5e5] dark:border-[#14213d] shadow-xl p-4 lg:p-6 space-y-4">
      {/* Header & Subsurface Metadata */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#fca311]" />
            <h2 className="text-base lg:text-lg font-black text-[#14213d] dark:text-white tracking-wide">
              Subsurface Geotechnical Strata & Subsidence Trough Model
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            2.5D Digital Twin cross-section calculating Peck’s Gaussian subsidence curve & strata shear
          </p>
        </div>

        {/* Selected Probe Selector & Details Toggle */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          {/* Target Probe Dropdown Selector */}
          <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono">
            <span className="text-slate-400">Target Probe:</span>
            <select
              value={activeNodeId}
              onChange={e => onSelectNode(e.target.value)}
              className="bg-transparent font-extrabold text-[#fca311] outline-none cursor-pointer pr-4 appearance-none"
            >
              {Object.keys(MINING_NODE_REGISTRY).map(nodeId => (
                <option key={nodeId} value={nodeId} className="bg-[#0a1120] text-white font-mono">
                  {nodeId} ({MINING_NODE_REGISTRY[nodeId].label})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#fca311] pointer-events-none absolute right-2.5" />
          </div>

          <button
            onClick={() => setShowGeotechDetails(!showGeotechDetails)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              showGeotechDetails
                ? 'bg-[#14213d] text-[#fca311] border-[#14213d] dark:bg-[#fca311] dark:text-[#000000] dark:border-[#fca311]'
                : 'bg-slate-100 dark:bg-[#14213d]/60 text-slate-600 dark:text-slate-300 border-[#e5e5e5] dark:border-[#14213d]'
            }`}
            title="Toggle Rock Mass & Strata Telemetry Panel"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="font-sans text-xs">KPI Details</span>
          </button>
        </div>
      </div>

      {/* Live Geotechnical Station Inspector Bar (Responsive across landscape viewports) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#070d18] border border-slate-800 text-xs font-mono select-none shadow-md">
        <div className="flex items-center gap-2.5">
          <Crosshair className="w-4 h-4 text-[#fca311] animate-spin-slow" />
          <span className="text-slate-400 font-sans">Station Inspector:</span>
          <span className="font-extrabold text-[#fca311] bg-[#14213d] px-2 py-0.5 rounded border border-[#fca311]/40">
            X = {activeProfilePoint ? (activeProfilePoint.distM > 0 ? `+${activeProfilePoint.distM}` : `${activeProfilePoint.distM}`) : '0'}m
          </span>
          {hoveredPointIndex === null ? (
            <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">&bull; Hover cross-section curve to probe</span>
          ) : (
            <span className="text-[11px] text-amber-400 font-sans hidden sm:inline">&bull; Live Crosshair Active</span>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-sans">Risk:</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1.5 ${
                activeProfilePoint?.riskClass === 'critical'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : activeProfilePoint?.riskClass === 'warning'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              {activeProfilePoint?.riskClass || 'Normal'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-sans">Settlement S(x):</span>
            <span className="text-white font-bold">-{activeProfilePoint?.settlementMm ?? sMaxMm.toFixed(1)} mm</span>
          </div>

          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span className="text-slate-400 font-sans">Slope Gradient T(x):</span>
            <span className="text-white font-bold">{activeProfilePoint?.slopeMmPerM ?? '0.00'} mm/m</span>
          </div>

          <div className="flex items-center gap-1.5 hidden md:flex">
            <span className="text-slate-400 font-sans">Strain &epsilon;:</span>
            <span className="text-white font-bold">{activeProfilePoint?.strainMicro ?? 0} &mu;&epsilon;</span>
          </div>
        </div>
      </div>

      {/* Main Full-Bleed Interactive Geotechnical Strata SVG (Panoramic Landscape Edge-to-Edge) */}
      <div className="relative w-full overflow-hidden rounded-xl bg-[#000000] border border-slate-800 select-none shadow-2xl">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPointIndex(null)}
        >
          <defs>
            {/* Strata Textures & Gradients */}
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#030712" />
              <stop offset="100%" stopColor="#091124" />
            </linearGradient>

            <linearGradient id="overburdenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78350f" stopOpacity="0.88" />
              <stop offset="30%" stopColor="#334155" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.96" />
            </linearGradient>

            <linearGradient id="coalSeamGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#020617" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="voidGoafGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
            </linearGradient>

            <pattern id="geologicalHatch" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#475569" strokeWidth="0.75" />
            </pattern>

            <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 0. Sky / Atmosphere Background */}
          <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="url(#skyGrad)" />

          {/* Distance Ticks along the top */}
          <g opacity="0.35">
            <line x1={scaleX(-100)} y1="10" x2={scaleX(-100)} y2="20" stroke="#64748b" strokeWidth="1" />
            <text x={scaleX(-100)} y="28" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">-100m</text>
            <line x1={scaleX(-50)} y1="10" x2={scaleX(-50)} y2="20" stroke="#64748b" strokeWidth="1" />
            <text x={scaleX(-50)} y="28" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">-50m</text>
            <line x1={scaleX(50)} y1="10" x2={scaleX(50)} y2="20" stroke="#64748b" strokeWidth="1" />
            <text x={scaleX(50)} y="28" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">+50m</text>
            <line x1={scaleX(100)} y1="10" x2={scaleX(100)} y2="20" stroke="#64748b" strokeWidth="1" />
            <text x={scaleX(100)} y="28" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">+100m</text>
          </g>

          {/* Elevation Scale Guide on Left Margin */}
          <line x1="58" y1="45" x2="58" y2="300" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
          <text x="52" y="68" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">+220m</text>
          <text x="52" y="145" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">+140m</text>
          <text x="52" y="215" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">+60m</text>
          <text x="52" y="260" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">0m MSL</text>

          {/* 1. Geological Strata Layers (Edge-to-Edge across entire width) */}

          {/* Layer 5: Deep Metamorphic Bedrock (Depth: -120m to -150m) */}
          <rect x="0" y="255" width={svgWidth} height="65" fill="#0f172a" />
          <rect x="0" y="255" width={svgWidth} height="65" fill="url(#geologicalHatch)" opacity="0.3" />
          <text x="70" y="285" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">
            ARCHEAN BASEMENT BEDROCK (-120m MSL)
          </text>

          {/* Layer 4: Lower Coal Seam II (Virgin Seam, Depth: -90m to -115m) */}
          <rect x="0" y="215" width={svgWidth} height="40" fill="url(#coalSeamGrad)" stroke="#334155" strokeWidth="1" />
          <text x="70" y="239" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            LOWER COAL SEAM II (UNMINED VIRGIN SEAM - 4.5m THICK)
          </text>

          {/* Layer 3: Interburden Sandstone & Siltstone (Depth: -60m to -90m) */}
          <rect x="0" y="165" width={svgWidth} height="50" fill="#1e293b" opacity="0.92" />
          <text x="70" y="188" fill="#64748b" fontSize="9.5" fontFamily="monospace">
            INTERBURDEN MASSIVE SANDSTONE WITH SHALE LAMINAE
          </text>

          {/* Layer 2: Main Coal Seam I (Active Extraction Horizon) */}
          <rect x="0" y="135" width={svgWidth} height="30" fill="url(#coalSeamGrad)" />

          {/* Extraction Void / Goaf Caved Zone in the West/Center (-55m to +5m) */}
          <rect
            x={scaleX(-55)}
            y="135"
            width={scaleX(5) - scaleX(-55)}
            height="30"
            fill="url(#voidGoafGrad)"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
          {/* Goaf Label Pill shifted left into the void so the borehole never cuts through it */}
          <g transform={`translate(${scaleX(-55) + 12}, 140)`}>
            <rect x="0" y="0" width="235" height="20" rx="4" fill="#0a1120" stroke="#ef4444" strokeWidth="1" opacity="0.9" />
            <text x="117" y="14" fill="#fca311" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              CAVED GOAF / EXTRACTION VOID
            </text>
          </g>

          {/* Layer 1: Sandstone & Alluvium Overburden bounded by dynamic surface curve */}
          <path d={overburdenFillPathD} fill="url(#overburdenGrad)" />
          <path d={overburdenFillPathD} fill="url(#geologicalHatch)" opacity="0.15" />

          {/* 2. Dynamic Subsidence Trough Surface Curve (Peck's Gaussian Curve) */}
          <path
            d={surfacePathD}
            fill="none"
            stroke="#fca311"
            strokeWidth="3.5"
            filter="url(#glowGold)"
          />

          {/* Unsubsided Ground Baseline Reference (Dashed Grey Line) */}
          <line
            x1="0"
            y1={groundBaseY}
            x2={svgWidth}
            y2={groundBaseY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="6,6"
          />
          <text x="70" y={groundBaseY - 8} fill="#64748b" fontSize="9" fontFamily="monospace">
            ORIGINAL GROUND DATUM (EL +220m)
          </text>

          {/* 3. Geological Fault Slip Plane (Diagonal Shear Fracture F-1, Offset for zero collision) */}
          <line
            x1="870"
            y1="40"
            x2="720"
            y2="305"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="6,4"
          />
          {/* Fault Shear Direction Arrows */}
          <text x="875" y="58" fill="#ef4444" fontSize="10" fontWeight="bold">
            &darr; FAULT F-1 (DIP 68°)
          </text>
          <text x="726" y="295" fill="#ef4444" fontSize="9.5" fontWeight="bold">
            &uarr; FOOTWALL
          </text>

          {/* 4. Groundwater Phreatic Water Table Line */}
          <path
            d={`M 0 115 Q ${svgWidth / 2} ${115 + rawWater / 30} ${svgWidth} 115`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.8"
          />
          <text x={svgWidth - 210} y="110" fill="#38bdf8" fontSize="9" fontFamily="monospace">
            PHREATIC WATER TABLE (-{Math.round(rawWater / 10)}m)
          </text>

          {/* 5. Centerline Trough Axis Reference */}
          <line
            x1={boreholeX}
            y1="38"
            x2={boreholeX}
            y2="135"
            stroke="#fca311"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.5"
          />

          {/* S_max Depth Callout Dimension Pill (Positioned in clear sky area above curve) */}
          <g transform={`translate(${boreholeX - 75}, 16)`}>
            <rect x="0" y="0" width="150" height="22" rx="6" fill="#0a1120" stroke="#ef4444" strokeWidth="1" />
            <text x="75" y="15" fill="#fca311" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              S_max: -{sMaxMm.toFixed(1)}mm
            </text>
            {/* Leader line pointing down to trough bottom */}
            <line x1="75" y1="22" x2="75" y2={probeTopY - 2} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2" />
          </g>

          {/* 6. Active Inclinometer Borehole Probe (Synchronized with activeNodeId) */}
          {/* Borehole Casing & Deflection Vector */}
          <path
            d={`M ${boreholeX} ${probeTopY} Q ${boreholeX + deflectionDx * 0.4} ${(probeTopY + probeBottomY) / 2} ${boreholeX + deflectionDx} ${probeBottomY}`}
            fill="none"
            stroke={rawTilt >= 2.0 ? '#ef4444' : '#10b981'}
            strokeWidth="3.5"
          />
          {/* Probe Collar Head on Surface */}
          <circle
            cx={boreholeX}
            cy={probeTopY}
            r="6"
            fill={rawTilt >= 2.0 ? '#ef4444' : '#fca311'}
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Depth Anchors along Borehole */}
          <circle cx={boreholeX + deflectionDx * 0.3} cy="135" r="3.5" fill="#ffffff" />
          <circle cx={boreholeX + deflectionDx * 0.6} cy="185" r="3.5" fill="#ffffff" />
          <circle cx={boreholeX + deflectionDx} cy={probeBottomY} r="4.5" fill="#38bdf8" />

          {/* Inclinometer Tilt Badge (Clean separation from fault line) */}
          <g transform={`translate(${boreholeX + 14}, ${probeTopY - 14})`}>
            <rect x="0" y="0" width="130" height="24" rx="6" fill="#0a1120" stroke="#fca311" strokeWidth="1" />
            <text x="8" y="16" fill="#fca311" fontSize="10" fontFamily="monospace" fontWeight="bold">
              {activeNodeId}: {rawTilt.toFixed(2)}° TILT
            </text>
          </g>

          {/* 7. Interactive Hover Cursor & Sampling Crosshair Points */}
          {profilePoints.map((pt, idx) => {
            const cx = scaleX(pt.distM);
            const cy = scaleYSurface(pt.settlementMm);
            const isHovered = hoveredPointIndex === idx;

            return (
              <g key={idx}>
                {/* Transparent hover hit target column */}
                <rect
                  x={cx - 10}
                  y="20"
                  width="20"
                  height={svgHeight - 40}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                />
                {isHovered && (
                  <g pointerEvents="none">
                    <line
                      x1={cx}
                      y1="25"
                      x2={cx}
                      y2={svgHeight - 20}
                      stroke="#fca311"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                    <circle cx={cx} cy={cy} r="6" fill="#fca311" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Geotechnical Parameters & Peck's Model KPIs (Responsive Grid on Landscape) */}
      {showGeotechDetails && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#14213d]/30 border border-[#e5e5e5] dark:border-[#14213d] hover:border-red-500/40 transition-all shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="font-semibold">Max Settlement (Smax)</span>
            </div>
            <div className="text-xl font-black text-[#14213d] dark:text-white font-mono mt-1.5">
              -{sMaxMm.toFixed(1)} <span className="text-xs text-slate-500 font-sans font-normal">mm</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Trough Axis (x = 0m)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#14213d]/30 border border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]/40 transition-all shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Compass className="w-4 h-4 text-[#fca311]" />
              <span className="font-semibold">Biaxial Probe Tilt</span>
            </div>
            <div className="text-xl font-black text-[#14213d] dark:text-white font-mono mt-1.5">
              {rawTilt.toFixed(2)}° <span className="text-xs text-slate-500 font-sans font-normal">dip</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Threshold: {nodeInfo?.criticalThresholdTilt || 3.5}° max
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#14213d]/30 border border-[#e5e5e5] dark:border-[#14213d] hover:border-emerald-500/40 transition-all shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold">Inflection Radius (i)</span>
            </div>
            <div className="text-xl font-black text-[#14213d] dark:text-white font-mono mt-1.5">
              {inflectionPointM} <span className="text-xs text-slate-500 font-sans font-normal">meters</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Angle of Draw: 35° (Barakar)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#14213d]/30 border border-[#e5e5e5] dark:border-[#14213d] hover:border-blue-500/40 transition-all shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="font-semibold">Pore Water Table</span>
            </div>
            <div className="text-xl font-black text-[#14213d] dark:text-white font-mono mt-1.5">
              -{Math.round(rawWater / 10)} <span className="text-xs text-slate-500 font-sans font-normal">m depth</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Hydrostatic: {(rawWater * 0.098).toFixed(1)} kPa
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StrataCrossSection;
