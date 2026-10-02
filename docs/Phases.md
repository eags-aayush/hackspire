# Build Phases — Backend + Dashboard

Rule for every phase: do not start the next phase until the current one's exit criteria are actually verified, not assumed. Each phase should be independently demoable.

## Phase 0 — Environment setup
**Goal**: everyone/every tool can run the stack locally.
- [ ] EMQX broker running in the cloud
- [ ] NestJS project scaffolded with the module boundaries from Design&Architecture.md created as empty modules (Ingestion, Processing, Storage, Realtime, Alerts)
- [ ] Next.js project scaffolded
- [ ] Confirm a basic MQTT publish/subscribe works end-to-end with a throwaway script (prove the broker works before building on it)
**Exit criteria**: a manual `emqx_pub`/`emqx_sub` test round-trips a message.

## Phase 1 — Single node, straight-line pipe
**Goal**: prove the basic path works before adding concurrency or realism.
- [ ] One dummy sensor node (single MQTT client) publishes a fake tilt reading every few seconds
- [ ] Backend IngestionModule subscribes and logs the received, parsed reading to console
- [ ] No dedup, no gap detection, no storage, no dashboard yet — deliberately minimal
**Exit criteria**: readings visibly and correctly appear in backend logs with correct field parsing.

## Phase 2 — Concurrency and correctness
**Goal**: the pipeline survives multiple independent nodes and doesn't silently lose or duplicate data.
- [ ] Simulator spawns N independent MQTT clients (own connection, own jittered interval, own sequence counter) — not a shared loop
- [ ] ProcessingModule dedupes by (nodeId, sequenceNumber)
- [ ] ProcessingModule detects and logs sequence gaps per node
- [ ] StorageModule persists every valid, deduped reading
- [ ] Manually verify: temporarily force a duplicate publish and confirm it's dropped; temporarily force a gap and confirm it's detected
**Exit criteria**: with N≥10 concurrent nodes running, storage contains exactly the expected reading count (no dupes, gaps correctly logged, not silently eaten).

## Phase 3 — Realtime dashboard
**Goal**: live data is visible, not just stored.
- [ ] RealtimeModule (WebSocket gateway) broadcasts to zone-scoped rooms
- [ ] Dashboard connects, joins relevant room(s), receives a snapshot on connect, then incremental updates
- [ ] Basic UI: live values per node/sensor type, grouped by zone
- [ ] Measure actual sensor-publish-to-dashboard-render latency and confirm it meets the PRD's <500ms target
**Exit criteria**: a change published by the simulator is visibly reflected on the dashboard within the latency budget, for multiple concurrent nodes at once.

## Phase 4 — Failure scenarios (this is where "robust" is actually proven)
**Goal**: demonstrate the system handles the failure modes it was designed for, not just the happy path.
- [ ] Simulate a node disconnecting ungracefully (kill its connection) and confirm LWT-triggered offline status appears on the dashboard within a few seconds
- [ ] Simulate a burst (many nodes publishing simultaneously) and confirm no crash, no unbounded latency growth
- [ ] Simulate packet loss (force a sequence gap) and confirm it's visible in node health / gap count, not silently absorbed
- [ ] Confirm backend restart doesn't require the simulator to restart, and dashboard reconnect doesn't require a page reload
**Exit criteria**: all four scenarios above can be demoed live and behave as designed — this is the "robust backend" proof for judges.

## Phase 5 — Hooks for what comes next
**Goal**: leave clean seams for AI/ML and alerting without building them yet.
- [ ] AlertsModule receives processing events but only stubs a decision (e.g., logs "would alert here")
- [ ] Storage interface documented clearly enough that the AI/ML owner can query historical data without needing to understand ProcessingModule internals
- [ ] Update Design&Architecture.md with anything that changed from the original plan during the build (see Rules.md)
**Exit criteria**: a teammate working on AI/ML could plug into AlertsModule/Storage without reading backend internals beyond this document.
