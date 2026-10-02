/**
 * MINE MESH™ - Autonomous Mine Subsidence Digital Twin GIS Data Registry
 * Spatial Coordinates: Jharia Coalfield Seam XI / XII Strata, Jharkhand, India (EPSG:4326)
 */

export interface MiningNodeSpatialInfo {
  nodeId: string;
  zoneId: string;
  label: string;
  criticalThresholdTilt: number;
  criticalThresholdDisp: number;
  coordinates: [number, number];
  depthM: number;
  boreholeDepthM: number;
  elevationM: number;
  strataLayer: string;
  geologicalLayer: string;
  installationDate: string;
}

export interface PeckProfilePoint {
  distM: number;
  settlementMm: number;
  slopeMmPerM: number;
  strainMicro: number;
  riskClass: 'normal' | 'warning' | 'critical';
}

export const MINE_CENTER_COORDS: [number, number] = [23.7488, 86.4205];
export const MINE_DEFAULT_ZOOM = 16;

export const GATEWAY_SPATIAL_INFO = {
  id: 'GW-ALPHA-01',
  name: 'Central Surface LoRa Gateway Mast (Pit-Head)',
  coordinates: [23.7508, 86.4222] as [number, number],
  elevationM: 226,
  antennaHeightM: 24,
  frequencyMhz: 868.1,
  meshProtocol: 'Protobuf v3 / LoRaWAN QoS 1',
  connectedNodesCount: 6,
  status: 'online',
};

export const MINING_NODE_REGISTRY: Record<string, MiningNodeSpatialInfo> = {
  NODE_01: {
    nodeId: 'NODE_01',
    zoneId: 'ZONE_01_LONGWALL_FACE',
    label: 'Longwall Face Gate Tail Extensometer',
    criticalThresholdTilt: 3.5,
    criticalThresholdDisp: 25.0,
    coordinates: [23.7482, 86.4185],
    depthM: 142,
    boreholeDepthM: 142,
    elevationM: 218,
    strataLayer: 'Upper Barakar Sandstone',
    geologicalLayer: 'Upper Barakar Sandstone (Tier 2)',
    installationDate: '2025-11-10',
  },
  NODE_02: {
    nodeId: 'NODE_02',
    zoneId: 'ZONE_01_LONGWALL_FACE',
    label: 'Longwall Center Shield Roof Tiltmeter',
    criticalThresholdTilt: 3.2,
    criticalThresholdDisp: 22.0,
    coordinates: [23.7487, 86.4198],
    depthM: 156,
    boreholeDepthM: 156,
    elevationM: 212,
    strataLayer: 'Barakar Sandstone / Shale Intercalation',
    geologicalLayer: 'Barakar Sandstone / Shale Intercalation',
    installationDate: '2025-11-12',
  },
  NODE_03: {
    nodeId: 'NODE_03',
    zoneId: 'ZONE_01_LONGWALL_FACE',
    label: 'Goaf Edge Multi-Point Borehole Extensometer',
    criticalThresholdTilt: 3.0,
    criticalThresholdDisp: 20.0,
    coordinates: [23.7494, 86.4212],
    depthM: 168,
    boreholeDepthM: 168,
    elevationM: 206,
    strataLayer: 'Immediate Roof / Main Seam XI',
    geologicalLayer: 'Immediate Roof / Main Seam XI',
    installationDate: '2025-11-15',
  },
  NODE_04: {
    nodeId: 'NODE_04',
    zoneId: 'ZONE_02_RETURN_AIRWAY',
    label: 'Return Airway Pillar Rib Inclinometer',
    criticalThresholdTilt: 3.8,
    criticalThresholdDisp: 28.0,
    coordinates: [23.7471, 86.4225],
    depthM: 180,
    boreholeDepthM: 180,
    elevationM: 200,
    strataLayer: 'Carbonaceous Shale Floor Member',
    geologicalLayer: 'Carbonaceous Shale Floor Member',
    installationDate: '2025-11-18',
  },
  NODE_05: {
    nodeId: 'NODE_05',
    zoneId: 'ZONE_02_RETURN_AIRWAY',
    label: 'Airway Overcast Intersection Displacement Probe',
    criticalThresholdTilt: 3.5,
    criticalThresholdDisp: 25.0,
    coordinates: [23.7465, 86.4210],
    depthM: 185,
    boreholeDepthM: 185,
    elevationM: 196,
    strataLayer: 'Lower Sandstone Aquifer Roof',
    geologicalLayer: 'Lower Sandstone Aquifer Roof',
    installationDate: '2025-11-20',
  },
  NODE_06: {
    nodeId: 'NODE_06',
    zoneId: 'ZONE_02_RETURN_AIRWAY',
    label: 'Shaft Pillar Protection Boundary Telemetry',
    criticalThresholdTilt: 3.2,
    criticalThresholdDisp: 22.0,
    coordinates: [23.7460, 86.4192],
    depthM: 195,
    boreholeDepthM: 195,
    elevationM: 190,
    strataLayer: 'Deep Granite Basement Transition',
    geologicalLayer: 'Deep Granite Basement Transition',
    installationDate: '2025-11-22',
  },
};

export const MINE_LEASE_BOUNDARY: [number, number][] = [
  [23.7535, 86.4150],
  [23.7540, 86.4255],
  [23.7510, 86.4275],
  [23.7450, 86.4265],
  [23.7435, 86.4180],
  [23.7455, 86.4140],
  [23.7535, 86.4150],
];

export const PIT_EXCAVATION_BENCHES = [
  {
    level: 'Bench Tier 1 - Surface Alluvium & Topsoil',
    depthM: 25,
    coordinates: [
      [23.7518, 86.4168],
      [23.7522, 86.4242],
      [23.7495, 86.4252],
      [23.7458, 86.4240],
      [23.7450, 86.4180],
      [23.7518, 86.4168],
    ] as [number, number][],
  },
  {
    level: 'Bench Tier 2 - Barakar Sandstone Intermediate',
    depthM: 75,
    coordinates: [
      [23.7508, 86.4178],
      [23.7512, 86.4230],
      [23.7490, 86.4238],
      [23.7468, 86.4228],
      [23.7462, 86.4188],
      [23.7508, 86.4178],
    ] as [number, number][],
  },
  {
    level: 'Bench Tier 3 - Seam X/XI Active Excavation Level',
    depthM: 140,
    coordinates: [
      [23.7498, 86.4188],
      [23.7502, 86.4218],
      [23.7482, 86.4224],
      [23.7475, 86.4198],
      [23.7498, 86.4188],
    ] as [number, number][],
  },
];

export const GEOLOGICAL_FAULT_LINES = [
  {
    name: 'Barakar Regional Fault F-1',
    color: '#ef4444',
    dipAngle: '68° SE',
    strikeDirection: 'N42°E',
    slipType: 'Normal Fault (Active Hazard)',
    coordinates: [
      [23.7542, 86.4162],
      [23.7515, 86.4192],
      [23.7482, 86.4222],
      [23.7445, 86.4250],
    ] as [number, number][],
  },
  {
    name: 'Damodar Valley Secondary Shear Zone S-2',
    color: '#f97316',
    dipAngle: '55° NW',
    strikeDirection: 'N78°W',
    slipType: 'Strike-Slip Conjugate',
    coordinates: [
      [23.7470, 86.4145],
      [23.7478, 86.4190],
      [23.7492, 86.4248],
      [23.7505, 86.4270],
    ] as [number, number][],
  },
];

export const SUBSIDENCE_HAZARD_ZONES = [
  {
    name: 'Zone Alpha - Active Longwall Goaf Collapse Hazard',
    riskCategory: 'critical' as const,
    geologicalUnit: 'Barakar Formation Caving Overburden',
    description: 'Tensile stress concentrations and high surface subsidence slope > 5mm/m detected.',
    color: '#ef4444',
    fillColor: '#dc2626',
    fillOpacity: 0.25,
    coordinates: [
      [23.7505, 86.4180],
      [23.7510, 86.4225],
      [23.7485, 86.4230],
      [23.7475, 86.4185],
    ] as [number, number][],
  },
  {
    name: 'Zone Beta - Return Airway Pillar Spalling Buffer',
    riskCategory: 'warning' as const,
    geologicalUnit: 'Shale Floor Heave Boundary',
    description: 'Elevated pore pressure with potential roof spalling along ventilation drift.',
    color: '#fca311',
    fillColor: '#fca311',
    fillOpacity: 0.18,
    coordinates: [
      [23.7475, 86.4195],
      [23.7480, 86.4240],
      [23.7455, 86.4245],
      [23.7450, 86.4200],
    ] as [number, number][],
  },
  {
    name: 'Zone Gamma - West Barrier Protective Pillar',
    riskCategory: 'low' as const,
    geologicalUnit: 'Intact Competent Sandstone Pillar',
    description: 'Low strain baseline corridor supporting main haulage drifts.',
    color: '#10b981',
    fillColor: '#10b981',
    fillOpacity: 0.12,
    coordinates: [
      [23.7525, 86.4155],
      [23.7530, 86.4185],
      [23.7495, 86.4180],
      [23.7490, 86.4150],
    ] as [number, number][],
  },
];

export const EVACUATION_ROUTES = [
  {
    name: 'Primary Incline Drift Evacuation Route',
    coordinates: [
      [23.7485, 86.4195],
      [23.7492, 86.4215],
      [23.7505, 86.4230],
      [23.7518, 86.4245],
    ] as [number, number][],
    assemblyPointName: 'Surface Assembly Point Alpha (North Gate)',
    assemblyPointCoord: [23.7518, 86.4245] as [number, number],
  },
  {
    name: 'South Ventilation Shaft Emergency Escape Corridor',
    coordinates: [
      [23.7465, 86.4210],
      [23.7458, 86.4225],
      [23.7450, 86.4250],
    ] as [number, number][],
    assemblyPointName: 'Emergency Bunker Beta (South Haulage)',
    assemblyPointCoord: [23.7450, 86.4250] as [number, number],
  },
];

/**
 * Resolves spatial coordinates for any given nodeId
 */
export function resolveNodeCoordinates(nodeId: string): { lat: number; lng: number; depth: number } {
  const node = MINING_NODE_REGISTRY[nodeId] || MINING_NODE_REGISTRY.NODE_03;
  return {
    lat: node.coordinates[0],
    lng: node.coordinates[1],
    depth: node.depthM,
  };
}

/**
 * Calculates Peck's Empirical Gaussian Subsidence Settlement Trough Profile:
 * S(x) = S_max * exp(-x^2 / (2 * i^2))
 *
 * @param sMaxMm Maximum settlement at trough centerline (mm)
 * @param inflectionPointM Distance from centerline to inflection point i (meters)
 * @param profileWidthM Total cross-section width to evaluate (default: 240m)
 * @param samplePoints Number of discrete measurement samples along cross-section
 */
export function calculatePecksSubsidenceProfile(
  sMaxMm: number,
  inflectionPointM: number,
  profileWidthM: number = 240,
  samplePoints: number = 48
): PeckProfilePoint[] {
  const points: PeckProfilePoint[] = [];
  const halfWidth = profileWidthM / 2;
  const step = profileWidthM / (samplePoints - 1);
  const iSafe = Math.max(10, inflectionPointM);

  for (let idx = 0; idx < samplePoints; idx++) {
    const x = -halfWidth + idx * step;
    // Peck's Gaussian equation
    const exponent = -(x * x) / (2 * iSafe * iSafe);
    const settlement = sMaxMm * Math.exp(exponent);

    // First derivative: Slope Gradient T(x) in mm/m
    const slope = Math.abs(x / (iSafe * iSafe)) * settlement;

    // Horizontal Strain estimate: proportional to curvature (microstrain)
    const curvature = Math.abs((1 - (x * x) / (iSafe * iSafe)) * (settlement / (iSafe * iSafe)));
    const strainMicro = Math.round(curvature * 1000);

    let riskClass: 'normal' | 'warning' | 'critical' = 'normal';
    if (settlement >= 25 || slope >= 4.5 || strainMicro >= 120) {
      riskClass = 'critical';
    } else if (settlement >= 12 || slope >= 2.0 || strainMicro >= 60) {
      riskClass = 'warning';
    }

    points.push({
      distM: Math.round(x),
      settlementMm: Number(settlement.toFixed(2)),
      slopeMmPerM: Number(slope.toFixed(2)),
      strainMicro,
      riskClass,
    });
  }

  return points;
}

/**
 * Exports current digital twin GIS layers and live telemetry as a GeoJSON FeatureCollection
 */
export function exportMiningGeoJson(
  readings: Record<string, Record<string, Record<string, any>>>,
  nodeStatuses: Record<string, Record<string, any>>
) {
  const features: any[] = [];

  // 1. Gateway Feature
  features.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [GATEWAY_SPATIAL_INFO.coordinates[1], GATEWAY_SPATIAL_INFO.coordinates[0]],
    },
    properties: {
      category: 'gateway',
      id: GATEWAY_SPATIAL_INFO.id,
      name: GATEWAY_SPATIAL_INFO.name,
      elevationM: GATEWAY_SPATIAL_INFO.elevationM,
      frequencyMhz: GATEWAY_SPATIAL_INFO.frequencyMhz,
      protocol: GATEWAY_SPATIAL_INFO.meshProtocol,
    },
  });

  // 2. Sensor Node Features
  Object.values(MINING_NODE_REGISTRY).forEach(node => {
    const nodeReads = readings[node.zoneId]?.[node.nodeId] || {};
    const statusObj = nodeStatuses[node.zoneId]?.[node.nodeId];

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [node.coordinates[1], node.coordinates[0]],
      },
      properties: {
        category: 'sensor_node',
        nodeId: node.nodeId,
        zoneId: node.zoneId,
        label: node.label,
        depthM: node.depthM,
        strataLayer: node.strataLayer,
        status: statusObj?.status || 'offline',
        tiltDeg: nodeReads.tilt?.value || 0,
        displacementMm: nodeReads.displacement?.value || 0,
        vibrationMmS: nodeReads.vibration?.value || 0,
        criticalThresholdTilt: node.criticalThresholdTilt,
      },
    });
  });

  // 3. Hazard Zones
  SUBSIDENCE_HAZARD_ZONES.forEach(zone => {
    const coords = zone.coordinates.map(pt => [pt[1], pt[0]]);
    // Close polygon if needed
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
      properties: {
        category: 'hazard_zone',
        name: zone.name,
        riskCategory: zone.riskCategory,
        geologicalUnit: zone.geologicalUnit,
        description: zone.description,
      },
    });
  });

  // 4. Mine Concession Perimeter
  const leaseCoords = MINE_LEASE_BOUNDARY.map(pt => [pt[1], pt[0]]);
  features.push({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [leaseCoords],
    },
    properties: {
      category: 'mine_boundary',
      name: 'Jharia Coalfield Mine Concession Lease',
      areaSqKm: 2.14,
    },
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      system: 'MINE MESH™ Autonomous Telemetry Digital Twin',
      generatedAt: new Date().toISOString(),
      coordinateSystem: 'WGS84 / EPSG:4326',
    },
    features,
  };
}
