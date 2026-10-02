# Design & Architecture — Backend + Dashboard

## 1. High-level flow
```
Dummy Sensor Simulator (N independent MQTT clients)
        │  publish, QoS 1, per-node sequence numbers, LWT for offline detection
        ▼
   MQTT Broker (EMQX)
        │  backend subscribes as a client, never talks to simulator directly
        ▼
NestJS Backend
   Ingestion  →  Processing/Validation  →  ┬─→ Storage (time-series)
  (thin, fast)   (dedupe, gap detect,      │
                  node status update)      └─→ Realtime Broadcast (WebSocket)
                                                        │
                                                        ▼
                                          Next.js Dashboard (per-zone/node rooms)
```
The simulator today plays the role the real **gateway ESP32** plays later. The MQTT contract (topics + payload shape) is the interface that must not change when hardware replaces the simulator — everything else can.

## 2. Components

### 2.1 Dummy Sensor Simulator
- One independent MQTT client per simulated node (not one shared connection looping over nodes) — this is what actually exercises the backend's per-connection handling.
- Each node: connects → sets LWT (`status=offline`) → publishes `status=online` → loops publishing readings on its own jittered interval with an incrementing per-node sequence number.
- Must be able to simulate: normal operation, dropped connections (packet loss / offline), and burst load (many nodes publishing simultaneously) — these are test scenarios, not just a happy-path script.

### 2.2 MQTT Broker
- EMQX Cloud for development and production. Backend and simulator are both just clients of the broker — no direct coupling between them.

### 2.3 NestJS Backend — internal modules
- **IngestionModule**: subscribes to MQTT topics. Only job: validate payload shape, stamp `receivedAt`, emit an internal event. Must never do heavy/blocking work here — this is the latency-critical path.
- **ProcessingModule**: reacts to ingestion events. Dedupes by (`nodeId`, `sequenceNumber`), detects sequence gaps, updates node status (online/offline/stale), applies any validation/normalization rules.
- **StorageModule**: persists valid, deduped readings as time-series data. This is also the future data source for the AI/ML module.
- **RealtimeModule** (WebSocket gateway): maintains dashboard client connections, organized into rooms per zone (and optionally per node). Sends a full snapshot on connect, then incremental updates after.
- **AlertsModule** (stub for this phase): subscribes to the same processing events; will later decide when to fire an alert. Exists as a module boundary now so AI/ML and alerting can be added without restructuring.
- Internal decoupling: modules communicate via an internal event bus (e.g., NestJS `EventEmitter2`), not direct method calls across modules — this keeps ingestion thin and lets processing/storage/broadcast evolve independently.

### 2.4 Next.js Dashboard
- Connects over WebSocket, joins rooms for the zones/nodes currently being viewed.
- On connect: receives a full snapshot, then applies incremental updates (never re-requests full state on every update).
- Displays: live per-sensor values, node online/offline/stale status, and a placeholder region for future alerts/anomaly flags.

## 3. Data model (conceptual)

**SensorReading**
- `nodeId`, `zoneId`, `sensorType` (tilt | vibration | displacement | crack | gas | water)
- `value`, `unit`
- `timestamp` (originated at sensor/simulator — not receivedAt)
- `sequenceNumber` (per-node, monotonically increasing)
  - *Note on hardware vs. simulator*: The simulator starts at 0/1 and increments. Real hardware nodes often derive this from uptime (e.g., `millis()`), meaning the first message may have an arbitrarily high sequence number (e.g., `3707764729`), and may reset to a low value across reboots. The backend must handle massive forward or backward sequence jumps as "resets" rather than sequence "gaps".

**NodeStatus**
- `nodeId`, `zoneId`, `status` (online | offline | stale)
- `lastSeenAt`, `lastSequenceNumber`
- `gapCount` (readings known to be missing, inferred from sequence jumps)

## 4. MQTT topic design
Pattern: `mine/{zoneId}/{nodeId}/{sensorType}` and `mine/{zoneId}/{nodeId}/status`

- Backend subscribes broadly (`mine/+/+/#`) and routes internally based on the parsed topic, rather than hardcoding one subscription per sensor type.
- `status` topic carries `online`/`offline` — `offline` may arrive either explicitly (graceful disconnect) or via the broker-triggered LWT (ungraceful disconnect). Both must be handled identically downstream.
- This structure maps directly onto the dashboard's zone-based grouping and onto future GIS zone overlays.

## 5. QoS & reliability
- QoS 1 (at-least-once) on all sensor and status topics — never QoS 0, since silent loss defeats the "low packet loss" requirement.
- QoS 1 can duplicate — deduplication by (`nodeId`, `sequenceNumber`) in ProcessingModule is mandatory, not optional.
- Sequence gaps are a first-class signal, not just a debugging aid — they represent real packet loss and should update `NodeStatus.gapCount`.

## 6. WebSocket contract (dashboard-facing)
- Namespaced/room-based: dashboard joins `zone:{zoneId}` (and optionally `node:{nodeId}`) rooms — never a single global broadcast channel.
- **Transport Protocols (Protobuf Binary Primary + JSON Fallback)**:
  - **High-Performance Binary Channels (Protocol Buffers)**:
    - `readings:proto` (emits binary `Uint8Array` buffer of `SensorReadingBatch`)
    - `nodeStatuses:proto` (emits binary `Uint8Array` buffer of `NodeStatusBatch`)
    - `snapshot:proto` (emits binary `Uint8Array` buffer of `ZoneSnapshot`)
  - **Legacy JSON Channels**: `snapshot`, `readings`, `nodeStatuses` (maintained for backward compatibility).
- **Protobuf Schema Definition**: `proto/telemetry.proto` defines the canonical wire format (`SensorReading`, `SensorReadingBatch`, `NodeStatusRecord`, `NodeStatusBatch`, `ZoneSnapshot`).
- **Compression & Latency**: Protobuf binary frames reduce payload size by 50% to 85% compared to JSON text, eliminating repeated key strings, reducing GC pressure, and enabling sub-millisecond parsing on both server and client.
- Backend coalesces rapid-fire updates into a short window (250ms bufferTime) before broadcasting, rather than pushing every raw reading as it's deduped — this prevents flooding the browser under high node counts. Raw readings are still stored at full resolution regardless of broadcast coalescing.

## 7. Storage choice
- Start simple and correct over premature optimization: an in-memory store or a plain InfluxDB Cloud table is acceptable for the hackathon demo scale.
- Design the storage interface so it can be swapped for a time-series-optimized store (e.g., TimescaleDB) later without touching ProcessingModule or RealtimeModule — storage is an implementation detail behind a clear interface, not something other modules query directly by SQL.

## 8. AI/ML Storage Query Interface (Future implementation)
The AI/ML module will need to query historical data. The `StorageModule` will expose the following interfaces (to be implemented):

**Querying Historical Sensor Readings**
- **Method**: `getHistoricalReadings(nodeId: string, sensorType: string, timeRange: { start: string, end: string })`
- **Field Names Returned**:
  - `nodeId` (string)
  - `zoneId` (string)
  - `sensorType` (string)
  - `value` (number)
  - `unit` (string)
  - `timestamp` (ISO 8601 string, originating at sensor)
  - `sequenceNumber` (number)
  - `receivedAt` (ISO 8601 string, ingestion time)

**Querying Node Status History / Health**
- **Method**: `getNodeStatusHistory(nodeId: string)`
- **Field Names Returned**:
  - `nodeId` (string)
  - `zoneId` (string)
  - `status` ('online' | 'offline' | 'stale')
  - `lastSeenAt` (ISO 8601 string)
  - `lastSequenceNumber` (number)
  - `gapCount` (number, representing total missed packets)

**Critical Note on Sequence Numbers and `gapCount` (Real vs. Simulated)**
- The AI/ML system cannot assume `sequenceNumber` strictly increments from 1. 
- While the simulator starts at 0/1 and increments steadily, **real hardware nodes** often derive this from uptime (e.g., `millis()`), meaning the first message may have an arbitrarily high sequence number (e.g., `3707764729`), and may reset to a low value across reboots. 
- **Gap detection fix**: The `ProcessingModule` already handles this. Massive forward jumps (> 10000) or backward jumps (> 100) are treated as node resets, *not* as packet loss. 
- Therefore, the `gapCount` field is the canonical source of truth for packet loss. AI/ML should not attempt to independently subtract sequence numbers to find missing packets, as it will misinterpret hardware resets as massive data loss.

## 9. Tech stack summary
| Layer | Choice |
|---|---|
| Sensor transport | MQTT (EMQX broker) |
| Backend framework | NestJS (TypeScript) |
| Internal decoupling | EventEmitter2 (or equivalent internal event bus) |
| Dashboard transport | WebSocket (Socket.IO with Protocol Buffers binary encoding + JSON fallback) |
| Dashboard framework | Next.js |
| Storage (this phase) | In-memory or InfluxDB Cloud — behind an interface |
