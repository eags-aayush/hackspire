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
  AlertTriangle,
  Compass,
  MoveDown,
  Info,
  ChevronRight,
  TrendingDown,
  Droplets,
  Zap,
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
  const nodeInfo = MINING_NODE_REGISTRY[activeNodeId] || MINING_NODE_REGISTRY.NODE_03;

  // Live telemetry for active node
  const nodeReads = readings[nodeInfo.zoneId]?.[activeNodeId] || {};
  const statusObj = nodeStatuses[nodeInfo.zoneId]?.[activeNodeId];
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
  const inflectionPointM = 42; // Distance to inflection point based on barakar sandstone depth
  const profilePoints = useMemo(() => {
    return calculatePecksSubsidenceProfile(sMaxMm, inflectionPointM, 240, 48);
  }, [sMaxMm, inflectionPointM]);

  // SVG dimensions
  const svgWidth = 720;
  const svgHeight = 340;
  const groundBaseY = 70; // Elevation zero line in SVG coords
  const maxDepthY = 300;

  // Convert subsidence profile into SVG path coordinates
  // X: -120m to +120m maps to 40px .. 680px
  const scaleX = (xM: number) => {
    return 40 + ((xM + 120) / 240) * (svgWidth - 80);
  };

  // Convert settlement (mm) into visual dip on the surface
  // 100mm = 35px visual depression
  const scaleYSurface = (settlementMm: number) => {
    return groundBaseY + (settlementMm / 100) * 45;
  };

  // Build the dynamic surface curve path (Peck's Trough)
  const surfacePathD = useMemo(() => {
    if (!profilePoints.length) return '';
    let d = `M ${scaleX(profilePoints[0].distM)} ${scaleYSurface(profilePoints[0].settlementMm)}`;
    for (let i = 1; i < profilePoints.length; i++) {
      const pt = profilePoints[i];
      d += ` L ${scaleX(pt.distM)} ${scaleYSurface(pt.settlementMm)}`;
    }
    return d;
  }, [profilePoints]);

  // Fill path underneath the surface to represent the overburden
  const overburdenFillPathD = useMemo(() => {
    if (!profilePoints.length) return '';
    let d = surfacePathD;
    d += ` L ${scaleX(120)} 150 L ${scaleX(-120)} 150 Z`;
    return d;
  }, [surfacePathD]);

  // Biaxial Inclinometer deflection calculation
  // Tilt in degrees bends the borehole probe visually
  const boreholeX = scaleX(0); // Located over center
  const probeTopY = scaleYSurface(sMaxMm);
  const probeBottomY = 240;
  const deflectionDx = Math.sin((rawTilt * Math.PI) / 180) * 35; // Visual exaggerated bend

  // Current hovered or center point data
  const activeProfilePoint =
    hoveredPointIndex !== null && profilePoints[hoveredPointIndex]
      ? profilePoints[hoveredPointIndex]
      : profilePoints[Math.floor(profilePoints.length / 2)];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0a1120] border border-[#e5e5e5] dark:border-[#14213d] shadow-xl p-4 lg:p-6 space-y-4">
      {/* Header & Subsurface Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
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

        {/* Selected Probe Chip & Synchronizer */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono">
            <span className="text-slate-400">Target Probe:</span>
            <span className="font-extrabold text-[#fca311]">{activeNodeId}</span>
            <span className="text-slate-400">({nodeInfo.label})</span>
          </div>

          <button
            onClick={() => setShowGeotechDetails(!showGeotechDetails)}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#14213d]/60 hover:bg-[#fca311]/20 text-slate-600 dark:text-slate-300 transition-colors"
            title="Toggle Rock Mass & Strata Telemetry Panel"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Geotechnical Strata SVG */}
      <div className="relative w-full overflow-x-auto rounded-xl bg-[#000000] border border-slate-800 p-2 select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[640px]"
          onMouseLeave={() => setHoveredPointIndex(null)}
        >
          <defs>
            {/* Strata Textures & Gradients */}
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#040814" />
              <stop offset="100%" stopColor="#0a1329" />
            </linearGradient>

            <linearGradient id="overburdenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78350f" stopOpacity="0.85" />
              <stop offset="30%" stopColor="#334155" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="coalSeamGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#020617" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="voidGoafGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
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

          {/* 1. Geological Strata Layers (Bottom to Top) */}

          {/* Layer 5: Deep Metamorphic Bedrock (Depth: -120m to -150m) */}
          <rect x="40" y="270" width={svgWidth - 80} height="55" fill="#0f172a" />
          <rect x="40" y="270" width={svgWidth - 80} height="55" fill="url(#geologicalHatch)" opacity="0.3" />
          <text x="50" y="300" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">
            ARCHEAN BASEMENT BEDROCK (-120m MSL)
          </text>

          {/* Layer 4: Lower Coal Seam II (Virgin Seam, Depth: -90m to -115m) */}
          <rect x="40" y="225" width={svgWidth - 80} height="40" fill="url(#coalSeamGrad)" stroke="#334155" strokeWidth="1" />
          <text x="50" y="248" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            LOWER COAL SEAM II (UNMINED VIRGIN SEAM - 4.5m THICK)
          </text>

          {/* Layer 3: Interburden Sandstone & Siltstone (Depth: -60m to -90m) */}
          <rect x="40" y="175" width={svgWidth - 80} height="50" fill="#1e293b" opacity="0.9" />
          <text x="50" y="195" fill="#64748b" fontSize="9" fontFamily="monospace">
            INTERBURDEN MASSIVE SANDSTONE WITH SHALE LAMINAE
          </text>

          {/* Layer 2: Main Coal Seam I & Active Longwall Extraction Void (Goaf) */}
          <rect x="40" y="145" width={svgWidth - 80} height="30" fill="url(#coalSeamGrad)" />
          {/* Extraction Void / Goaf Caved Zone in the Center */}
          <rect
            x={scaleX(-45)}
            y="145"
            width={scaleX(45) - scaleX(-45)}
            height="30"
            fill="url(#voidGoafGrad)"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
          <text
            x={svgWidth / 2}
            y="163"
            fill="#fca311"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            [ ACTIVE LONGWALL EXTRACTION VOID / CAVED GOAF ]
          </text>

          {/* Layer 1: Sandstone & Alluvium Overburden bounded by the dynamic surface curve */}
          <path d={overburdenFillPathD} fill="url(#overburdenGrad)" />
          <path d={overburdenFillPathD} fill="url(#geologicalHatch)" opacity="0.15" />

          {/* 2. Dynamic Subsidence Trough Surface Curve (Peck's Curve) */}
          <path
            d={surfacePathD}
            fill="none"
            stroke="#fca311"
            strokeWidth="3.5"
            filter="url(#glowGold)"
          />

          {/* Unsubsided Ground Baseline Reference (Dashed Grey Line) */}
          <line
            x1="40"
            y1={groundBaseY}
            x2={svgWidth - 40}
            y2={groundBaseY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="6,6"
          />
          <text x="45" y={groundBaseY - 6} fill="#64748b" fontSize="9" fontFamily="monospace">
            ORIGINAL GROUND DATUM (EL +220m)
          </text>

          {/* 3. Geological Fault Slip Plane (Diagonal Shear Fracture F-1) */}
          <line
            x1={scaleX(50)}
            y1="50"
            x2={scaleX(-20)}
            y2="310"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="6,4"
          />
          {/* Fault Shear Direction Arrows */}
          <text x={scaleX(35)} y="95" fill="#ef4444" fontSize="10" fontWeight="bold">
            &darr; FAULT F-1 (DIP 68°)
          </text>
          <text x={scaleX(-15)} y="260" fill="#ef4444" fontSize="10" fontWeight="bold">
            &uarr; FOOTWALL
          </text>

          {/* 4. Groundwater Phreatic Water Table Line */}
          <path
            d={`M 40 120 Q ${svgWidth / 2} ${120 + rawWater / 25} ${svgWidth - 40} 120`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.8"
          />
          <text x={svgWidth - 170} y="115" fill="#38bdf8" fontSize="9" fontFamily="monospace">
            PHREATIC WATER TABLE (-{Math.round(rawWater / 10)}m)
          </text>

          {/* 5. Active Inclinometer Borehole Probe (Synchronized with activeNodeId) */}
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
          {/* Depth Anchors along the Borehole */}
          <circle cx={boreholeX + deflectionDx * 0.3} cy="140" r="3.5" fill="#ffffff" />
          <circle cx={boreholeX + deflectionDx * 0.6} cy="190" r="3.5" fill="#ffffff" />
          <circle cx={boreholeX + deflectionDx} cy={probeBottomY} r="4" fill="#38bdf8" />

          {/* Inclinometer Tilt Badge */}
          <g transform={`translate(${boreholeX + 12}, ${probeTopY - 14})`}>
            <rect x="0" y="0" width="110" height="24" rx="6" fill="#0a1120" stroke="#fca311" strokeWidth="1" />
            <text x="6" y="16" fill="#fca311" fontSize="10" fontFamily="monospace" fontWeight="bold">
              {activeNodeId}: {rawTilt.toFixed(2)}° TILT
            </text>
          </g>

          {/* 6. Subsidence Depression Depth Callout */}
          <line
            x1={scaleX(0)}
            y1={groundBaseY}
            x2={scaleX(0)}
            y2={probeTopY}
            stroke="#ef4444"
            strokeWidth="1.5"
          />
          <text
            x={scaleX(0) - 8}
            y={(groundBaseY + probeTopY) / 2 + 3}
            fill="#ef4444"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="end"
          >
            S_max: -{sMaxMm.toFixed(1)}mm
          </text>

          {/* 7. Interactive Hover Cursor & Sampling Points */}
          {profilePoints.map((pt, idx) => {
            const cx = scaleX(pt.distM);
            const cy = scaleYSurface(pt.settlementMm);
            const isHovered = hoveredPointIndex === idx;

            return (
              <g key={idx}>
                {/* Transparent hover hit target */}
                <rect
                  x={cx - 6}
                  y="30"
                  width="12"
                  height={svgHeight - 40}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                />
                {isHovered && (
                  <>
                    <line
                      x1={cx}
                      y1="30"
                      x2={cx}
                      y2={svgHeight - 20}
                      stroke="#fca311"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <circle cx={cx} cy={cy} r="6" fill="#fca311" stroke="#ffffff" strokeWidth="2" />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Readout Tooltip Overlay */}
        {hoveredPointIndex !== null && activeProfilePoint && (
          <div className="absolute top-4 right-4 z-10 p-3 rounded-xl bg-[#0a1120]/95 backdrop-blur-md border border-[#fca311]/50 shadow-2xl text-xs font-mono space-y-1">
            <div className="text-[#fca311] font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
              <span>Strata Station X: {activeProfilePoint.distM}m</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${
                  activeProfilePoint.riskClass === 'critical'
                    ? 'bg-red-500/20 text-red-400'
                    : activeProfilePoint.riskClass === 'warning'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {activeProfilePoint.riskClass}
              </span>
            </div>
            <div className="text-slate-300 flex justify-between gap-3">
              <span>Settlement S(x):</span>
              <b className="text-white">-{activeProfilePoint.settlementMm} mm</b>
            </div>
            <div className="text-slate-300 flex justify-between gap-3">
              <span>Slope Gradient T(x):</span>
              <b className="text-white">{activeProfilePoint.slopeMmPerM} mm/m</b>
            </div>
            <div className="text-slate-300 flex justify-between gap-3">
              <span>Horizontal Strain:</span>
              <b className="text-white">{activeProfilePoint.strainMicro} &mu;&epsilon;</b>
            </div>
          </div>
        )}
      </div>

      {/* Geotechnical Parameters & Peck's Model KPIs */}
      {showGeotechDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              <span>Max Settlement (Smax)</span>
            </div>
            <div className="text-lg font-black text-[#14213d] dark:text-white font-mono mt-1">
              -{sMaxMm.toFixed(1)} <span className="text-xs text-slate-500">mm</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Trough Centerline (x = 0m)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Compass className="w-3.5 h-3.5 text-[#fca311]" />
              <span>Biaxial Probe Tilt</span>
            </div>
            <div className="text-lg font-black text-[#14213d] dark:text-white font-mono mt-1">
              {rawTilt.toFixed(2)}° <span className="text-xs text-slate-500">dip</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Threshold: {nodeInfo.criticalThresholdTilt}° Limit
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>Inflection Radius (i)</span>
            </div>
            <div className="text-lg font-black text-[#14213d] dark:text-white font-mono mt-1">
              {inflectionPointM} <span className="text-xs text-slate-500">meters</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Angle of Draw: 35° (Barakar)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              <span>Pore Water Table</span>
            </div>
            <div className="text-lg font-black text-[#14213d] dark:text-white font-mono mt-1">
              -{Math.round(rawWater / 10)} <span className="text-xs text-slate-500">m depth</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Hydrostatic Head: {(rawWater * 0.098).toFixed(1)} kPa
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default StrataCrossSection;
