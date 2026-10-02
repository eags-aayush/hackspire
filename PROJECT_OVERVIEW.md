# System Overview & Architecture Hand-off: SIH-2026 Mine Subsidence Monitoring System

> **Purpose**: This document provides a complete, canonical overview of the project architecture, data pipeline, technology stack, directory structure, and design invariants. It is designed to serve as a comprehensive context primer for developers, researchers, and AI models.

---

## 1. Executive Summary & Problem Scope

- **Parent Project**: Smart India Hackathon (SIH 2026) — *AI-Enabled Low-Cost Real-Time Mine Subsidence Monitoring, Prediction & Early Warning System*.
- **Physical Domain**: Open-cast and underground coal/mineral mines where geological strata movement, rock mass shifts, fault slip, pore-water pressure, and seismic blasting vibrations cause sudden ground collapse (subsidence).
- **Core Engineering Challenge**: Ingest high-frequency, continuous telemetry from distributed mine mesh nodes via MQTT, validate and deduplicate packets without data loss, detect sequence gaps (safety-critical packet loss indicators), and broadcast real-time state to an operations dashboard with sub-500ms latency.
- **Current Repository Scope**:
  1. **MQTT Broker Layer**: EMQX Cloud (TLS, QoS 1, LWT support).
  2. **Backend Engine**: NestJS (TypeScript strict mode, RxJS, EventEmitter2 internal decoupling, Socket.IO gateway, Protobuf binary encoding).
  3. **Real-time Operations Dashboard**: Next.js 16 (React 19, Tailwind CSS v4, GSAP animations, Protobuf binary deserialization, sub-500ms latency audit).
  4. **Hardware & Simulator Bridge**: Dual support for simulated JSON nodes (`test_mqtt.js`) and physical ESP32 LoRa gateways transmitting packed 54-byte binary structs or JSON payloads.

---

## 2. High-Level Architecture & End-to-End Data Flow

```text
[Simulated Nodes / Hardware Gateway (ESP32 via LoRa)]
       │  QoS 1, Monotonic Sequence Numbers, MQTT Last Will & Testament (LWT)
       ▼
[Eclipse EMQX Broker] (Port 1883 / 1884)
       │  Wildcard subscriptions: mine/+/+/#  &  sensors/lora/#
       ▼
[NestJS IngestionModule] (Latency-Critical Path)
       │  1. Unpacks 54-byte LoRa binary struct OR parses JSON
       │  2. Calculates physical metrics (Biaxial tilt pitch/roll, PPV vibration)
       │  3. Strictly validates shape & stamps receivedAt timestamp
       │  4. Emits internal event (sensor.reading.received / node.status.received)
       ▼
[NestJS ProcessingModule] (Correctness & Deduplication Core)
       │  1. Sliding window deduplication by (nodeId, sequenceNumber)
       │  2. Sequence gap detection: updates canonical gapCount
       │  3. Sequence jump / reboot resilience (forward >10k or backward >100 handled as reset)
       │  4. Stale node watchdog timer (8s timeout marks node 'offline')
       │  5. Emits: sensor.reading.deduped & node.status.changed
       ▼
  ┌────┴───────────────────────────────┬─────────────────────────────────┐
  ▼                                    ▼                                 ▼
[StorageModule]               [RealtimeModule / Gateway]          [AlertsModule]
- Interface: StorageAdapter   - RxJS bufferTime(250ms)            - Stub for AI/ML
- Current: In-Memory          - Coalesces updates by zone         - Historical queries
- Target: TimescaleDB         - Primary: Protobuf binary frames   - Anomaly detection
                              - Fallback: Standard JSON frames
                                       │
                                       ▼ (WebSocket / Socket.IO)
                          [Next.js Operations Dashboard]
                          - Zone-scoped rooms (zone:{zoneId})
                          - Centralized RealtimeContext
                          - Protobuf decoder (sub-millisecond parsing)
                          - Live Latency Budget Audit (<500ms)
                          - Interactive simulator controls & onboarding wizard
```

---

## 3. Strict Architectural Rules & Constraints (`docs/Rules.md`)

1. **Module Boundary Decoupling**:
   - `IngestionModule` may **only** validate payload shapes, stamp `receivedAt`, and emit internal events. It must **never** call `StorageModule` or `RealtimeModule` directly, and must **never** contain business logic (deduplication, gap detection, threshold checking).
   - `ProcessingModule` is the **only** place deduplication, gap detection, and node status derivation live.
   - Modules communicate solely over the NestJS `EventEmitter2` event bus, not through direct cross-module method injection.
2. **Latency-Critical Path Discipline**:
   - Nothing synchronous, blocking, or CPU-heavy is permitted inside the MQTT message callback. Heavy analytics or ML inference must run asynchronously via event listeners.
3. **Correctness & Reliability Invariants**:
   - **QoS 1 (At-Least-Once)** is mandatory for all sensor and status MQTT topics. QoS 0 is strictly forbidden.
   - **Deduplication** by `(nodeId, sequenceNumber)` must happen before any reading is stored or broadcast.
   - **Sequence gaps are safety-critical signals**: missing packets increment `NodeStatus.gapCount` (a physical indicator of packet loss or radio blockage).
   - **Hardware Reset Resilience**: Nodes using uptime-based sequence numbers (e.g., `millis()`) or rebooting must not cause artificial million-packet gap spikes. Forward jumps `> 10,000` or backward drops `> 100` are flagged as resets.
   - **Offline Derivation**: Derived from MQTT Last Will and Testament (LWT) or the 8-second watchdog timer, never from client polling.
4. **Wire Format & Latency Budget**:
   - Sensor-to-screen target latency is **< 500ms**.
   - Rapid updates are coalesced over a 250ms window (`bufferTime(250)`) before WebSocket emission.
   - Binary Protocol Buffers (`telemetry.proto`) reduce network payload by 50–85% compared to JSON.

---

## 4. Data Contracts & Wire Formats

### A. MQTT Topics
- `mine/{zoneId}/{nodeId}/{sensorType}` — Telemetry readings.
- `mine/{zoneId}/{nodeId}/status` — Node connection lifecycle (`online` / `offline`).
- `sensors/lora/#` — Physical ESP32 LoRa Gateway transmissions.

### B. Standard Sensor Telemetry Payload (JSON)
```json
{
  "nodeId": "NODE_01",
  "zoneId": "ZONE_1",
  "sensorType": "tilt",       // Valid: tilt | vibration | displacement | crack | gas | water | temperature | humidity
  "value": 1.45,
  "unit": "degrees",
  "timestamp": "2026-09-10T14:30:00.000Z", // Sensor origin timestamp
  "sequenceNumber": 42
}
```

### C. ESP32 LoRa 54-Byte Packed Binary Struct
The physical gateway sends a 54-byte packed C-struct containing:
- `nodeId` (bytes 0–7, `char[8]`)
- `packetSeq` (bytes 8–11, `uint32` LE)
- `temp`, `hum`, `ax`, `ay`, `az`, `gx`, `gy`, `gz`, `dist_cm` (bytes 12–47, 9 x `float` LE)
- `mq6_raw`, `water_raw`, `pot_raw` (bytes 48–53, 3 x `int16` LE)
- **Derived Physical Metrics**:
  - $\text{pitch} = \operatorname{atan2}(ax, \sqrt{ay^2 + az^2}) \times \frac{180}{\pi}$
  - $\text{roll} = \operatorname{atan2}(ay, \sqrt{ax^2 + az^2}) \times \frac{180}{\pi}$
  - $\text{tilt} = \sqrt{\text{pitch}^2 + \text{roll}^2}$ (in degrees)
  - $\text{vibration} = \sqrt{ax^2 + ay^2 + az^2}$ (in g / PPV)

### D. Canonical Protocol Buffers (`proto/telemetry.proto`)
```protobuf
syntax = "proto3";
package telemetry;

message SensorReading {
  string nodeId = 1;
  string zoneId = 2;
  string sensorType = 3;
  double value = 4;
  string unit = 5;
  string timestamp = 6;
  uint32 sequenceNumber = 7;
  string receivedAt = 8;
}

message SensorReadingBatch {
  string zoneId = 1;
  repeated SensorReading readings = 2;
}

message NodeStatusRecord {
  string nodeId = 1;
  string zoneId = 2;
  string status = 3; // 'online' | 'offline' | 'stale'
  string lastSeenAt = 4;
  uint32 lastSequenceNumber = 5;
  uint32 gapCount = 6;
}

message NodeStatusBatch {
  string zoneId = 1;
  repeated NodeStatusRecord statuses = 2;
}

message ZoneSnapshot {
  string zoneId = 1;
  repeated SensorReading readings = 2;
  repeated NodeStatusRecord statuses = 3;
}
```

### E. WebSocket (Socket.IO) Contract
- **Client Emits**:
  - `join_zone`: `{ "zoneId": "ZONE_1" }`
  - `get_zones`: request array of active zone IDs.
- **Server Broadcasts (Dual-Channel)**:
  - **Protobuf Binary (Primary)**: `snapshot:proto`, `readings:proto`, `nodeStatuses:proto`
  - **JSON (Fallback)**: `snapshot`, `readings`, `nodeStatuses`, `active_zones`

---

## 5. Directory Structure & Key File Map

```text
SIH-2026/
├── PROJECT_OVERVIEW.md             # This comprehensive architecture handoff document
├── docker-compose.yml              # Multi-container orchestration (EMQX, InfluxDB Cloud, Backend, Dashboard)
├── proto/
│   └── telemetry.proto             # Canonical Protobuf schema definition
├── emqx/
│   └── config/emqx.conf       # EMQX broker configuration (ports, queue sizes, persistence)
├── backend/                        # NestJS Application
│   ├── src/
│   │   ├── main.ts                 # NestJS bootstrap (CORS, port 3000)
│   │   ├── app.module.ts           # Root module registering Ingestion, Processing, Storage, Realtime, Alerts
│   │   ├── ingestion/
│   │   │   ├── ingestion.service.ts # MQTT subscriber, LoRa binary unpacker, validator
│   │   │   ├── sensor-reading.interface.ts # TypeScript definitions for raw & validated readings
│   │   │   └── node-status.interface.ts    # NodeStatus types
│   │   ├── processing/
│   │   │   └── processing.service.ts # Deduplication, sequence gap detection, stale watchdog
│   │   ├── storage/
│   │   │   ├── storage.interface.ts  # StorageAdapter contract (getHistoricalReadings, etc.)
│   │   │   └── memory-storage.service.ts # In-memory storage implementation
│   │   ├── realtime/
│   │   │   ├── realtime.gateway.ts   # WebSocket gateway, RxJS bufferTime(250ms) batching
│   │   │   ├── realtime.service.ts   # Zone snapshot & active zone caching
│   │   │   └── telemetry.proto.ts    # Protobuf encoder / serializer for backend
│   │   └── alerts/
│   │       └── alerts.service.ts     # Future AI/ML anomaly detection hook
│   └── test_mqtt.js                # Interactive simulator script with fault-injection scenarios
├── dashboard/                      # Next.js 16 App Router (React 19)
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Executive Landing & Live Overview
│       │   ├── monitoring/page.tsx # Live Operations Room with zone grouping & sensor cards
│       │   ├── nodes/page.tsx      # Comprehensive Node health & gap audit table
│       │   ├── alerts/page.tsx     # Threshold alert center & DGMS compliance rules
│       │   ├── analytics/page.tsx  # Historical trends & statistical aggregation
│       │   └── architecture/page.tsx # Interactive system diagram and telemetry specifications
│       ├── context/
│       │   └── RealtimeContext.tsx # Centralized Socket.IO client, Protobuf decoder, latency metric calculator
│       ├── lib/
│       │   ├── proto/telemetry.ts  # Browser-safe Protobuf deserializer
│       │   ├── socket.ts           # Socket.IO singleton factory
│       │   └── constants.ts        # DGMS safety thresholds, default units, sensor configs
│       └── components/             # Reusable UI components (HeroSection, LatencyTracker, ZoneContainer, etc.)
└── docs/
    ├── PRD.md                      # Product Requirements Document
    ├── Design&Architecture.md       # Architectural blueprints, contracts, and AI/ML seams
    ├── Phases.md                   # Step-by-step verification milestones (Phases 0 through 5)
    └── Rules.md                    # Mandatory system rules and design invariants
```

---

## 6. Sensor Types & Threshold Reference (DGMS Criteria)

| Sensor Type | Physical Metric | Normal Range | Warning Threshold | Critical Alert | Notes |
|---|---|---|---|---|---|
| **tilt** | Ground Slope Angle | 0.0 – 1.5° | > 2.0° | > 3.5° | Biaxial inclinometer measurement |
| **vibration** | Peak Particle Velocity (PPV) | 0.0 – 5.0 mm/s | > 8.0 mm/s | > 15.0 mm/s | Seismic / blasting micro-tremors |
| **displacement**| Extensometer Surface Shift | 0.0 – 10.0 mm | > 15.0 mm | > 25.0 mm | Strata differential settlement |
| **crack** | Structural Fissure Gauge | 0 (Intact) | 0.5 (Tension) | 1.0 (Rupture) | Tripwire / binary rupture detector |
| **gas** | CH4 / CO Concentration | 0 – 50 ppm | > 100 ppm | > 250 ppm | Sub-surface toxic/explosive gas |
| **water** | Piezometer Water Level | 100 – 300 cm | > 350 cm | > 450 cm | Pore-water pressure build-up |

---

## 7. Current Implementation Status vs. Future Roadmap

### Complete & Validated (Phases 0–4)
- [x] EMQX Cloud broker setup with QoS 1.
- [x] Decoupled NestJS pipeline: Ingestion → EventBus → Processing → Realtime Broadcast.
- [x] In-memory sliding-window deduplication by `(nodeId, sequenceNumber)`.
- [x] Sequence gap counter recording packet loss as a primary safety signal.
- [x] Hardware reboot / counter-reset handling (prevents false multi-million gap counts).
- [x] Stale node watchdog (8s silent timeout triggers offline status).
- [x] Binary Protocol Buffers encoding/decoding over WebSockets with JSON fallback.
- [x] RxJS 250ms coalescing batch buffer to prevent client DOM thrashing.
- [x] Full Next.js 16 Operations Room with sub-500ms sensor-publish-to-render latency auditor.
- [x] Physical ESP32 LoRa 54-byte binary telemetry decoder.
- [x] Simulator script (`test_mqtt.js`) with fault-injection triggers (duplicates, gaps, jumps).

### Next Phase / Future Integration Seams (Phase 5+)
- [ ] **InfluxDB Cloud**: Swap `MemoryStorageService` with a persistent database adhering to the `StorageAdapter` interface.
- [ ] **AI/ML Subsidence Model**: Consume historical data via `StorageAdapter.getHistoricalReadings()` and evaluate predictions in `AlertsService`.
- [ ] **GIS / Map Visualizer**: 3D geological digital twin using spatial coordinates.
- [ ] **Miner Safety Band Integration**: LoRa/ESP-NOW emergency broadcast to worker wearable bands.

---

## 8. Common Developer Commands & Operations

```bash
# 1. Start all infrastructure
npm run start

# 2. Run NestJS Backend locally
cd backend
pnpm install
pnpm run start:dev

# 3. Run Next.js Dashboard locally
cd dashboard
pnpm install
pnpm dev

# 4. Run Test Simulator with fault-injection sequence
cd backend
node test_mqtt.js

# 5. Run automated test suites
cd backend
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # End-to-end Protobuf WebSocket tests
```
