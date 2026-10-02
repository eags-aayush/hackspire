# Rules — for the AI Agent Building This Backend

These are binding constraints, not suggestions. If a request conflicts with these rules, flag the conflict instead of silently picking one side.

## 1. Module boundaries (do not violate)
- IngestionModule may only: validate payload shape, stamp `receivedAt`, emit an internal event. It must never call StorageModule or RealtimeModule directly, and must never contain business logic (dedup, gap detection, anomaly checks).
- ProcessingModule is the only place dedup/gap-detection/status logic lives. Do not duplicate this logic in IngestionModule or RealtimeModule "for convenience."
- RealtimeModule only broadcasts what ProcessingModule/StorageModule hand it. It does not re-derive validation or dedup logic.
- Modules talk to each other through the internal event bus (EventEmitter2 or equivalent), not direct cross-module method calls, unless there's a specific documented reason (record it in Design&Architecture.md if so).

## 2. Latency-critical path discipline
- Nothing synchronous/blocking/CPU-heavy runs inside the MQTT message handler in IngestionModule. If a future feature (e.g., ML inference) needs to react to a reading, it subscribes to the internal event asynchronously — it does not get inserted into the ingestion handler itself.
- Any new feature must be able to answer: "does this add latency to the ingest path?" If yes, it needs to be moved off that path before merging.

## 3. Correctness requirements (non-negotiable)
- Every sensor/status MQTT subscription uses QoS 1. QoS 0 is not acceptable anywhere in this system.
- Deduplication by (`nodeId`, `sequenceNumber`) must happen before a reading reaches storage or broadcast — never store or broadcast a duplicate.
- Sequence gaps must be recorded (not silently dropped) — they are a safety-relevant signal, not noise.
- Node status changes (online/offline/stale) must be derived from LWT/status topics, never from dashboard polling or guesswork.

## 4. Code style & structure
- TypeScript strict mode on. No `any` used to bypass a type problem — if the shape is genuinely unknown, model it explicitly (e.g., a validated-vs-raw payload distinction).
- Naming: `nodeId`, `zoneId`, `sensorType`, `sequenceNumber`, `receivedAt`, `timestamp` are the canonical field names used everywhere (MQTT payload, internal events, storage, WebSocket messages) — no silent renaming between layers.
- One module = one responsibility, matching Design&Architecture.md's module list exactly. If a new responsibility doesn't fit an existing module, propose a new module rather than bolting it onto an existing one.
- Config (broker URL, ports, thresholds) comes from environment variables, never hardcoded.

## 5. Testing expectations
- Every phase in Phases.md has explicit exit criteria — treat those as required checks before considering a phase complete, not optional nice-to-haves.
- Dedup and gap-detection logic must have tests that explicitly simulate: a duplicate message, a missing sequence number, and out-of-order arrival.
- Any "robustness" claim (low latency, low packet loss, no crash under burst) must be backed by a way to actually demonstrate it — a script or test that produces the failure condition, not just a design intention.

## 6. Documentation discipline
- If the actual implementation diverges from Design&Architecture.md (e.g., a different topic structure, a different storage choice), update that document in the same change — it must stay a true reflection of the system, not the original plan.
- New modules, new topics, or new WebSocket message types get added to Design&Architecture.md before being considered "done."

## 7. Honesty in scope
- Do not silently implement something listed as "out of scope" in PRD.md (e.g., real anomaly detection, GIS, alert delivery) without flagging that scope is expanding.
- Do not claim a non-functional requirement (latency, packet loss handling) is met without the corresponding test/measurement from Phase 4 passing.

## 8. When in doubt
- Prefer the simpler correct implementation over a more "impressive" one that hasn't been proven under Phase 4's failure scenarios.
- If a design decision here turns out to be wrong once building starts, change the design doc and explain why — don't quietly work around it in code while the docs still describe the old plan.
