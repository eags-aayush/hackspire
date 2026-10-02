# PRD — Mine Subsidence Monitoring: Data Pipeline, Backend & Dashboard

## 1. Context
Parent project: AI-Enabled Low-Cost Real-Time Mine Subsidence Monitoring, Prediction & Early Warning System (Hackspire-2026). Full system = surface mesh sensor nodes → gateway ESP32 → server → dashboard/digital twin → alerts, plus a separate miner safety-band network.

This PRD covers **only the software owner's scope**: Data Transport Pipeline, Backend, and the real-time Dashboard. Hardware is not yet available, so this phase is built and validated entirely against a **dummy sensor data simulator** that stands in for the real gateway ESP32.

## 2. Problem this phase solves
Before real hardware exists, we need a backend that can:
- Ingest concurrent, continuous sensor data reliably (no silent packet loss)
- Process it fast enough to feel real-time on a dashboard
- Detect when a node goes silent (safety-relevant, not just a bug)
- Push live updates to a dashboard with low latency

If this foundation isn't solid, everything built on top later (AI/ML anomaly detection, alerts, GIS) inherits the weaknesses.

## 3. Goals / success criteria
- [ ] N concurrent simulated sensor nodes can publish continuously without the backend dropping or silently losing readings
- [ ] Dashboard reflects a new reading within a defined latency budget (target: **< 500ms** sensor-publish to dashboard-render)
- [ ] A node going offline is detected and shown on the dashboard within a few seconds, without polling
- [ ] Duplicate messages (from at-least-once delivery) never appear twice in stored data or on the dashboard
- [ ] System survives a simulated burst (many nodes publishing at once) without crashing or falling silently behind
- [ ] Architecture requires no rework of the ingestion contract when real ESP32 hardware replaces the simulator

## 4. Users
- **Mine operator / dashboard viewer** — needs live per-zone, per-node sensor state and node health at a glance
- **Hackspire judges (demo audience)** — need to see the system visibly reacting in real time to simulated events (including simulated node failure / packet loss)
- **Future self / teammates** — need a backend that's honest about what's implemented vs. stubbed for later (AI/ML, alerts, GIS)

## 5. Functional requirements
1. Dummy sensor simulator publishes readings for tilt, vibration, displacement, crack (binary), gas, water — one or more per simulated node — over MQTT.
2. Each simulated node runs as an independent client with its own identity, connection, and publish interval (with jitter), not a shared loop.
3. Backend subscribes to sensor topics, validates payload shape, deduplicates by sequence number, and detects gaps in sequence per node.
4. Backend tracks node online/offline status via MQTT Last Will and Testament (LWT), not polling.
5. Backend persists every valid reading (time-series) — this is also the future training data source for AI/ML.
6. Backend broadcasts live state to connected dashboard clients over WebSocket, scoped by zone/node (not a single global broadcast to everyone).
7. Dashboard renders live values per node/zone, per-sensor-type, and node health status (online / offline / stale).
8. System exposes hooks (not full implementations yet) where AI/ML anomaly detection and alerting will plug in later.

## 6. Non-functional requirements
- **Latency**: sub-500ms sensor-to-dashboard under normal load (defined, measurable, testable — not just "fast")
- **Packet loss handling**: MQTT QoS 1 minimum; sequence numbers to catch what QoS can't
- **Concurrency**: ingestion path must not block on slow downstream work (storage, broadcast prep run async of receipt)
- **Resilience**: reconnect logic on both simulator and dashboard WebSocket clients; backend restart doesn't require simulator restart
- **Observability**: basic metrics — messages/sec ingested, dropped/duplicate count, current online node count, per-node last-seen timestamp
- **Scalability path**: design should tolerate going from ~10 dummy nodes to hundreds without a rewrite (even if not literally load-tested at hundreds yet)

## 7. Out of scope (this phase)
- Real ESP32/LoRa hardware integration
- AI/ML subsidence prediction models (hooks only)
- GIS map visualization
- SMS/email alert delivery
- Miner safety band / ESP-NOW zone handoff logic
- DGMS/IS regulatory compliance work

## 8. Assumptions & constraints
- MQTT broker (EMQX) runs in the cloud
- Backend: NestJS. Dashboard: Next.js. Realtime transport to dashboard: WebSocket.
- Team size and hackathon timeline mean simplicity and demonstrability beat premature scale — but the architecture must not paint us into a corner (see Design&Architecture.md).
