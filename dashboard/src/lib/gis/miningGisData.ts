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

export interface NationalCoalMineSite {
  id: string;
  name: string;
  coalfield: string;
  state: string;
  geology: string;
  prominence: string;
  type: 'underground' | 'opencast' | 'breach';
  status: 'active' | 'abandoned';
  risk: number;
  workers: number;
  vehicles: number;
  ch4: number;
  co2: number;
  temp: number;
  lat: number;
  lng: number;
  dangerLevel: 'critical' | 'high' | 'medium' | 'low' | 'abandoned';
}

export const COALFIELD_REGISTRY: Record<string, { lat: number; lng: number; state: string; coalfield: string; geology: string; prominence: string }> = {
  jharia: { lat: 23.7488, lng: 86.4205, state: 'Jharkhand', coalfield: 'Jharia Coalfield', geology: 'Gondwana (Barakar & Raniganj Measures)', prominence: "India's premier source of prime coking coal; lifeline for the domestic steel industry." },
  bokaro: { lat: 23.78, lng: 86.15, state: 'Jharkhand', coalfield: 'East & West Bokaro', geology: 'Gondwana', prominence: 'Rich deposits of metallurgical and heavy thermal grade coal.' },
  karanpura: { lat: 23.72, lng: 85.45, state: 'Jharkhand', coalfield: 'North & South Karanpura', geology: 'Gondwana', prominence: 'Massive mechanized open-cast projects supplying central power grids.' },
  jharkhandOther: { lat: 24.05, lng: 86.2, state: 'Jharkhand', coalfield: 'Rajmahal & Giridih', geology: 'Gondwana', prominence: 'Giridih supplies prime metallurgical coking coal and Rajmahal powers NTPC Farakka/Kahalgaon.' },
  korba: { lat: 22.3527, lng: 82.6969, state: 'Chhattisgarh', coalfield: 'Korba Coalfield', geology: 'Gondwana', prominence: 'High-output open-cast mega-mines; primary fuel supplier for NTPC thermal power hubs.' },
  mandraigarh: { lat: 22.18, lng: 83.58, state: 'Chhattisgarh', coalfield: 'Mand Raigarh / Bisrampur', geology: 'Gondwana', prominence: 'Large-scale power-grade non-coking coal generation in eastern basins.' },
  talcher: { lat: 20.9515, lng: 85.2336, state: 'Odisha', coalfield: 'Talcher Coalfield', geology: 'Gondwana', prominence: 'Second highest nationwide geological reserves; major hub for power generation and coal gasification.' },
  ibvalley: { lat: 21.909, lng: 83.864, state: 'Odisha', coalfield: 'Ib Valley Coalfield', geology: 'Gondwana', prominence: 'Expansive open-cast grid feeding regional heavy industries and power plants.' },
  singrauli: { lat: 24.1997, lng: 82.6725, state: 'Madhya Pradesh', coalfield: 'Singrauli Basin', geology: 'Gondwana', prominence: 'Massive open-cast basin supplying sub-bituminous coal to Central India energy super-corridors.' },
  sohagpur: { lat: 23.45, lng: 81.35, state: 'Madhya Pradesh', coalfield: 'Sohagpur / Pench', geology: 'Gondwana', prominence: 'Operational blocks managed by SECL providing mixed-grade industrial fuel.' },
  raniganj: { lat: 23.608, lng: 87.096, state: 'West Bengal', coalfield: 'Raniganj Coalfield', geology: 'Gondwana', prominence: "Historic birthplace of Indian coal mining (1774); Chinakuri is among India's deepest underground mines." },
  wbother: { lat: 23.9, lng: 87.55, state: 'West Bengal', coalfield: 'Birbhum / Darjeeling', geology: 'Gondwana', prominence: 'Serves regional thermal networks and eastern industrial clusters.' },
  godavari: { lat: 18.72, lng: 79.95, state: 'Telangana', coalfield: 'Godavari Valley', geology: 'Gondwana', prominence: 'Operated by SCCL; advanced underground systems alongside major open-cast cuts.' },
  kamptee: { lat: 21.17, lng: 79.12, state: 'Maharashtra', coalfield: 'Kamptee & Nagpur', geology: 'Gondwana', prominence: 'Managed by WCL; localized power production and cement kilns.' },
  wardha: { lat: 20.45, lng: 79.3, state: 'Maharashtra', coalfield: 'Wardha Valley', geology: 'Gondwana', prominence: 'Cluster of medium-sized open-cast projects supplying western manufacturing corridors.' },
  neyveli: { lat: 11.62, lng: 79.49, state: 'Tamil Nadu', coalfield: 'Neyveli Complex', geology: 'Tertiary (Lignite)', prominence: 'Major lignite complex operated by NLC India Limited powering southern grid.' },
};

export const NATIONAL_COAL_MINES: NationalCoalMineSite[] = [
  // Jharia Coalfield (Jharkhand)
  {
    id: 'jharia-central-longwall',
    name: 'Jharia Seam XI/XII Digital Twin (Active Face)',
    coalfield: 'Jharia Coalfield',
    state: 'Jharkhand',
    geology: 'Gondwana (Barakar Formations)',
    prominence: 'Central Digital Twin testbed with 6 active IoT borehole extensometers & subsidence sensors.',
    type: 'underground',
    status: 'active',
    risk: 86,
    workers: 184,
    vehicles: 16,
    ch4: 1820,
    co2: 520,
    temp: 34.2,
    lat: 23.7488,
    lng: 86.4205,
    dangerLevel: 'critical',
  },
  {
    id: 'jharia-dhanbad',
    name: 'Dhanbad Colliery Cluster',
    coalfield: 'Jharia Coalfield',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: "Heart of Bharat Coking Coal Limited (BCCL); ancient coking seams under heavy urban monitoring.",
    type: 'underground',
    status: 'active',
    risk: 78,
    workers: 210,
    vehicles: 14,
    ch4: 1640,
    co2: 480,
    temp: 33.5,
    lat: 23.7650,
    lng: 86.4350,
    dangerLevel: 'high',
  },
  {
    id: 'jharia-sudamdih',
    name: 'Sudamdih-Patherdih Incline',
    coalfield: 'Jharia Coalfield',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'Deep shaft mining operations with historical water inundation hazards.',
    type: 'underground',
    status: 'active',
    risk: 68,
    workers: 140,
    vehicles: 9,
    ch4: 920,
    co2: 410,
    temp: 32.8,
    lat: 23.6520,
    lng: 86.4380,
    dangerLevel: 'medium',
  },
  {
    id: 'jharia-dhansar',
    name: 'Amalgamated Dhansar Colliery',
    coalfield: 'Jharia Coalfield',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'Open-cast surface benching with adjacent spontaneous combustion fire zones.',
    type: 'opencast',
    status: 'active',
    risk: 88,
    workers: 195,
    vehicles: 22,
    ch4: 2100,
    co2: 650,
    temp: 37.1,
    lat: 23.7740,
    lng: 86.4210,
    dangerLevel: 'critical',
  },

  // Korba Coalfield (Chhattisgarh)
  {
    id: 'korba-gevra-oc',
    name: 'Gevra Open-Cast Mega Mine',
    coalfield: 'Korba Coalfield',
    state: 'Chhattisgarh',
    geology: 'Gondwana',
    prominence: 'One of the largest open-cast coal mines in Asia; massive draglines & 240T dumpers.',
    type: 'opencast',
    status: 'active',
    risk: 45,
    workers: 420,
    vehicles: 88,
    ch4: 380,
    co2: 410,
    temp: 36.4,
    lat: 22.3610,
    lng: 82.6840,
    dangerLevel: 'low',
  },
  {
    id: 'korba-dipka-oc',
    name: 'Dipka Open-Cast Mine',
    coalfield: 'Korba Coalfield',
    state: 'Chhattisgarh',
    geology: 'Gondwana',
    prominence: 'High-capacity mechanized pit situated in proximity to Lilagar river corridor.',
    type: 'opencast',
    status: 'active',
    risk: 74,
    workers: 310,
    vehicles: 54,
    ch4: 760,
    co2: 430,
    temp: 35.8,
    lat: 22.3180,
    lng: 82.5620,
    dangerLevel: 'high',
  },
  {
    id: 'korba-kusmunda',
    name: 'Kusmunda OCP',
    coalfield: 'Korba Coalfield',
    state: 'Chhattisgarh',
    geology: 'Gondwana',
    prominence: 'SECL high-speed surface miner project with automated conveyor trunking.',
    type: 'opencast',
    status: 'active',
    risk: 52,
    workers: 280,
    vehicles: 42,
    ch4: 420,
    co2: 390,
    temp: 34.0,
    lat: 22.3380,
    lng: 82.6710,
    dangerLevel: 'medium',
  },

  // Talcher & Ib Valley (Odisha)
  {
    id: 'talcher-bhubaneswari',
    name: 'Bhubaneswari Open-Cast Project',
    coalfield: 'Talcher Coalfield',
    state: 'Odisha',
    geology: 'Gondwana',
    prominence: 'MCL flagship pit with continuous surface miners feeding NTPC Kaniha Super Thermal.',
    type: 'opencast',
    status: 'active',
    risk: 58,
    workers: 260,
    vehicles: 38,
    ch4: 490,
    co2: 420,
    temp: 35.1,
    lat: 20.9540,
    lng: 85.1950,
    dangerLevel: 'medium',
  },
  {
    id: 'talcher-ananta',
    name: 'Ananta OCP Tier II',
    coalfield: 'Talcher Coalfield',
    state: 'Odisha',
    geology: 'Gondwana',
    prominence: 'Steep overburden dump slope with monsoon pore-pressure monitoring sensors.',
    type: 'opencast',
    status: 'active',
    risk: 76,
    workers: 190,
    vehicles: 29,
    ch4: 640,
    co2: 460,
    temp: 34.5,
    lat: 20.9420,
    lng: 85.2150,
    dangerLevel: 'high',
  },
  {
    id: 'ibvalley-lakhanpur',
    name: 'Lakhanpur Open-Cast Colliery',
    coalfield: 'Ib Valley Coalfield',
    state: 'Odisha',
    geology: 'Gondwana',
    prominence: 'Expansive open pit along western Odisha coal corridor.',
    type: 'opencast',
    status: 'active',
    risk: 42,
    workers: 180,
    vehicles: 26,
    ch4: 310,
    co2: 380,
    temp: 33.8,
    lat: 21.8200,
    lng: 83.8200,
    dangerLevel: 'low',
  },

  // Singrauli (Madhya Pradesh & UP border)
  {
    id: 'singrauli-jayant',
    name: 'Jayant Open-Cast Project',
    coalfield: 'Singrauli Basin',
    state: 'Madhya Pradesh',
    geology: 'Gondwana',
    prominence: 'Northern Coalfields Limited (NCL) showpiece mine supplying Singrauli Super Thermal.',
    type: 'opencast',
    status: 'active',
    risk: 48,
    workers: 340,
    vehicles: 62,
    ch4: 420,
    co2: 400,
    temp: 34.9,
    lat: 24.1350,
    lng: 82.6580,
    dangerLevel: 'low',
  },
  {
    id: 'singrauli-nigahi',
    name: 'Nigahi Open-Cast Mine',
    coalfield: 'Singrauli Basin',
    state: 'Madhya Pradesh',
    geology: 'Gondwana',
    prominence: 'High-wall excavation with deep haul road stability telemetry.',
    type: 'opencast',
    status: 'active',
    risk: 65,
    workers: 240,
    vehicles: 46,
    ch4: 580,
    co2: 440,
    temp: 35.2,
    lat: 24.1150,
    lng: 82.6820,
    dangerLevel: 'medium',
  },
  {
    id: 'singrauli-dudhichua',
    name: 'Dudhichua Interstate Colliery',
    coalfield: 'Singrauli Basin',
    state: 'Madhya Pradesh',
    geology: 'Gondwana',
    prominence: 'Interstate open pit straddling MP-UP boundary; large dragline operations.',
    type: 'opencast',
    status: 'active',
    risk: 54,
    workers: 290,
    vehicles: 50,
    ch4: 510,
    co2: 410,
    temp: 34.6,
    lat: 24.1480,
    lng: 82.7210,
    dangerLevel: 'medium',
  },

  // Raniganj (West Bengal)
  {
    id: 'raniganj-chinakuri',
    name: 'Chinakuri Deep Underground Mine (No. 1 & 2)',
    coalfield: 'Raniganj Coalfield',
    state: 'West Bengal',
    geology: 'Gondwana (Dishergarh Seam)',
    prominence: "One of India's deepest coal mines (~700m depth); high methane release rate & geological gas bursts.",
    type: 'underground',
    status: 'active',
    risk: 92,
    workers: 175,
    vehicles: 8,
    ch4: 3100,
    co2: 780,
    temp: 39.4,
    lat: 23.6820,
    lng: 86.8480,
    dangerLevel: 'critical',
  },
  {
    id: 'raniganj-jhanjra',
    name: 'Jhanjra Continuous Miner Project',
    coalfield: 'Raniganj Coalfield',
    state: 'West Bengal',
    geology: 'Gondwana',
    prominence: 'ECL mechanized underground mine with powered roof supports & real-time gas alarms.',
    type: 'underground',
    status: 'active',
    risk: 62,
    workers: 230,
    vehicles: 11,
    ch4: 840,
    co2: 440,
    temp: 33.0,
    lat: 23.6520,
    lng: 87.2910,
    dangerLevel: 'medium',
  },
  {
    id: 'raniganj-sonepur-bazari',
    name: 'Sonepur Bazari OCP',
    coalfield: 'Raniganj Coalfield',
    state: 'West Bengal',
    geology: 'Gondwana',
    prominence: 'Major open-cast pit in eastern Raniganj; heavy earth moving machinery.',
    type: 'opencast',
    status: 'active',
    risk: 44,
    workers: 210,
    vehicles: 34,
    ch4: 390,
    co2: 395,
    temp: 33.6,
    lat: 23.6890,
    lng: 87.2180,
    dangerLevel: 'low',
  },

  // Bokaro & North Karanpura (Jharkhand)
  {
    id: 'bokaro-west',
    name: 'West Bokaro Colliery Complex',
    coalfield: 'East & West Bokaro',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'Prime metallurgical washery feed pit; steep geological syncline.',
    type: 'opencast',
    status: 'active',
    risk: 59,
    workers: 195,
    vehicles: 32,
    ch4: 510,
    co2: 430,
    temp: 33.2,
    lat: 23.7780,
    lng: 85.5450,
    dangerLevel: 'medium',
  },
  {
    id: 'karanpura-amrapali',
    name: 'Amrapali Mega OCP',
    coalfield: 'North & South Karanpura',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'CCL high-capacity pit with dedicated coal evacuation rail siding.',
    type: 'opencast',
    status: 'active',
    risk: 46,
    workers: 290,
    vehicles: 48,
    ch4: 410,
    co2: 410,
    temp: 34.0,
    lat: 23.8200,
    lng: 85.0800,
    dangerLevel: 'low',
  },
  {
    id: 'karanpura-magadh',
    name: 'Magadh Open-Cast Project',
    coalfield: 'North & South Karanpura',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'One of the largest planned coal mining blocks in Jharkhand.',
    type: 'opencast',
    status: 'active',
    risk: 51,
    workers: 260,
    vehicles: 44,
    ch4: 450,
    co2: 405,
    temp: 33.9,
    lat: 23.8500,
    lng: 84.9800,
    dangerLevel: 'medium',
  },

  // Godavari Valley (Telangana)
  {
    id: 'godavari-adriyala',
    name: 'Adriyala Longwall Shaft Project',
    coalfield: 'Godavari Valley',
    state: 'Telangana',
    geology: 'Gondwana',
    prominence: 'SCCL ultra-mechanized deep underground longwall face; automated shearer & high-voltage monitoring.',
    type: 'underground',
    status: 'active',
    risk: 72,
    workers: 220,
    vehicles: 12,
    ch4: 1250,
    co2: 490,
    temp: 35.8,
    lat: 18.7840,
    lng: 79.5210,
    dangerLevel: 'high',
  },
  {
    id: 'godavari-kothagudem',
    name: 'Kothagudem Deep Mining Sector',
    coalfield: 'Godavari Valley',
    state: 'Telangana',
    geology: 'Gondwana',
    prominence: 'Dense cluster of incline shafts with heavy methane degasification systems.',
    type: 'underground',
    status: 'active',
    risk: 66,
    workers: 180,
    vehicles: 9,
    ch4: 980,
    co2: 460,
    temp: 34.7,
    lat: 17.5510,
    lng: 80.6120,
    dangerLevel: 'medium',
  },

  // Wardha & Kamptee (Maharashtra)
  {
    id: 'wardha-sasti',
    name: 'Sasti Open-Cast Colliery',
    coalfield: 'Wardha Valley',
    state: 'Maharashtra',
    geology: 'Gondwana',
    prominence: 'WCL pit in Chandrapur district; high summer ambient temperatures & spontaneous combustion risk.',
    type: 'opencast',
    status: 'active',
    risk: 81,
    workers: 165,
    vehicles: 28,
    ch4: 1420,
    co2: 560,
    temp: 41.2,
    lat: 19.8250,
    lng: 79.3180,
    dangerLevel: 'high',
  },
  {
    id: 'kamptee-adasa',
    name: 'Adasa UG-to-OC Transition Mine',
    coalfield: 'Kamptee & Nagpur',
    state: 'Maharashtra',
    geology: 'Gondwana',
    prominence: 'Former underground workings being converted to open-cast pit; void breakthrough danger.',
    type: 'breach',
    status: 'active',
    risk: 87,
    workers: 140,
    vehicles: 22,
    ch4: 1950,
    co2: 610,
    temp: 38.0,
    lat: 21.3200,
    lng: 78.9600,
    dangerLevel: 'critical',
  },

  // Neyveli (Tamil Nadu - Lignite)
  {
    id: 'neyveli-mine-1',
    name: 'Neyveli Lignite Mine I',
    coalfield: 'Neyveli Complex',
    state: 'Tamil Nadu',
    geology: 'Tertiary (Lignite / Cuddalore Formations)',
    prominence: 'Bucket wheel excavators & specialized deep aquifer artesian pressure depressurization.',
    type: 'opencast',
    status: 'active',
    risk: 49,
    workers: 380,
    vehicles: 72,
    ch4: 210,
    co2: 420,
    temp: 33.4,
    lat: 11.5950,
    lng: 79.4880,
    dangerLevel: 'low',
  },
  {
    id: 'neyveli-mine-2',
    name: 'Neyveli Lignite Mine II',
    coalfield: 'Neyveli Complex',
    state: 'Tamil Nadu',
    geology: 'Tertiary (Lignite)',
    prominence: 'Powers 1470 MW TPS-II thermal station with continuous belt conveyor trunking.',
    type: 'opencast',
    status: 'active',
    risk: 45,
    workers: 340,
    vehicles: 66,
    ch4: 240,
    co2: 395,
    temp: 33.1,
    lat: 11.5380,
    lng: 79.4620,
    dangerLevel: 'low',
  },
  {
    id: 'jharkhand-abandoned-kaplaspur',
    name: 'Kaplaspur Unmined Old Seam Block',
    coalfield: 'Rajmahal & Giridih',
    state: 'Jharkhand',
    geology: 'Gondwana',
    prominence: 'Abandoned colonial-era workings with unsealed subsidence craters and water accumulation.',
    type: 'underground',
    status: 'abandoned',
    risk: 35,
    workers: 0,
    vehicles: 0,
    ch4: 850,
    co2: 600,
    temp: 29.8,
    lat: 24.2800,
    lng: 86.8200,
    dangerLevel: 'abandoned',
  },
];

