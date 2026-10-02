import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { ValidatedNodeStatus, NodeStatusState } from '../ingestion/node-status.interface.js';
import { MlInferenceService } from '../ml/ml-inference.service.js';
import { MovingAverageFilterService } from './moving-average-filter.service.js';

@Injectable()
export class ProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessingService.name);

  // nodeId -> set of recently seen sequence numbers (keyed by sensorType:sequenceNumber)
  private seenSequences = new Map<string, Set<string>>();

  // nodeId -> highest sequence number seen so far (for gap detection)
  private lastSequenceNumber = new Map<string, number>();

  // nodeId -> NodeStatusState
  private nodeStatuses = new Map<string, NodeStatusState>();

  private watchdogInterval: NodeJS.Timeout | null = null;
  private readonly STALE_TIMEOUT_MS = 30_000; // 30 seconds without data = offline (supports alternating multi-node LoRa meshes)

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly mlInference: MlInferenceService,
    private readonly movingAverageFilter: MovingAverageFilterService,
  ) { }

  onModuleInit(): void {
    // Check every 2 seconds for nodes that have stopped transmitting
    this.watchdogInterval = setInterval(() => {
      this.checkStaleNodes();
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private checkStaleNodes(): void {
    const now = Date.now();
    for (const [nodeId, nodeStatus] of this.nodeStatuses.entries()) {
      if (nodeStatus.status === 'online') {
        const lastSeen = new Date(nodeStatus.lastSeenAt).getTime();
        if (now - lastSeen > this.STALE_TIMEOUT_MS) {
          nodeStatus.status = 'offline';
          this.logger.warn(
            `[processing] Node ${nodeId} timed out (no data for ${Math.round((now - lastSeen) / 1000)}s) -> marked offline`,
          );
          this.movingAverageFilter.resetNode(nodeId);
          this.mlInference.onNodeOffline(nodeId);
          this.eventEmitter.emit('node.status.changed', nodeStatus);
        }
      }
    }
  }

  @OnEvent('sensor.reading.received')
  handleSensorReading(reading: ValidatedSensorReading) {
    const { nodeId, sequenceNumber, sensorType } = reading;

    if (!this.seenSequences.has(nodeId)) {
      this.seenSequences.set(nodeId, new Set());
    }

    const nodeSeen = this.seenSequences.get(nodeId)!;
    const dedupKey = `${sensorType}:${sequenceNumber}`;

    // Deduplication check
    if (nodeSeen.has(dedupKey)) {
      this.logger.warn(`[processing] Dropped duplicate reading: node=${nodeId} type=${sensorType} seq=${sequenceNumber}`);
      return;
    }

    // Record as seen
    nodeSeen.add(dedupKey);

    // Prevent memory leak — keep only last 200 elements
    if (nodeSeen.size > 200) {
      const firstItem = nodeSeen.values().next().value;
      if (firstItem !== undefined) {
        nodeSeen.delete(firstItem);
      }
    }

    // Gap detection
    const lastSeq = this.lastSequenceNumber.get(nodeId);
    let gapDetected = false;
    let missingCount = 0;
    let isReset = false;

    if (lastSeq !== undefined) {
      if (sequenceNumber > lastSeq + 1) {
        const jump = sequenceNumber - lastSeq - 1;
        // If the jump is massive, treat it as a reset (e.g., switching from simulator to hardware)
        if (jump > 10000) {
          this.logger.warn(`[processing] SEQUENCE RESET (FORWARD): node=${nodeId} jumped from ${lastSeq} to ${sequenceNumber}`);
          isReset = true;
        } else {
          missingCount = jump;
          this.logger.warn(`[processing] GAP DETECTED: node=${nodeId} missing ${missingCount} readings (last seen ${lastSeq}, now ${sequenceNumber})`);
          gapDetected = true;
        }
      } else if (sequenceNumber < lastSeq) {
        // If the sequence number drops significantly, it's a reset (e.g., node reboot)
        if (lastSeq - sequenceNumber > 100) {
          this.logger.warn(`[processing] SEQUENCE RESET (BACKWARD): node=${nodeId} jumped from ${lastSeq} to ${sequenceNumber}`);
          isReset = true;
        } else {
          this.logger.debug(`[processing] Out of order reading: node=${nodeId} seq=${sequenceNumber} (last seen ${lastSeq})`);
        }
      }
    }

    // Node Status update
    let nodeStatus = this.nodeStatuses.get(nodeId);
    if (!nodeStatus) {
      nodeStatus = {
        nodeId,
        zoneId: reading.zoneId,
        status: 'online',
        lastSeenAt: reading.receivedAt,
        gapCount: 0
      };
      this.nodeStatuses.set(nodeId, nodeStatus);
    }
    const oldStatus = nodeStatus.status;
    nodeStatus.lastSeenAt = reading.receivedAt;
    nodeStatus.lastSequenceNumber = sequenceNumber;
    nodeStatus.status = 'online';

    if (gapDetected) {
      nodeStatus.gapCount += missingCount;
    }

    if (oldStatus !== 'online' || gapDetected) {
      this.eventEmitter.emit('node.status.changed', nodeStatus);
    }

    // Update highest seen sequence
    // We update it if it's a new node (lastSeq === undefined), a normal increment, or a detected reset
    if (lastSeq === undefined || sequenceNumber > lastSeq || isReset) {
      this.lastSequenceNumber.set(nodeId, sequenceNumber);
    }

    if (isReset) {
      this.movingAverageFilter.resetNode(nodeId);
    }

    // Apply Moving Average filter to eliminate sensor jitter and round cleanly
    const smoothedReading = this.movingAverageFilter.smooth(reading);

    this.logger.log(
      `[processing] Processed reading: node=${nodeId} seq=${sequenceNumber} type=${sensorType} val=${smoothedReading.value}${smoothedReading.unit} (raw=${smoothedReading.rawValue})`,
    );

    // Pass to ML window buffer for shadow inference
    this.mlInference.handleSensorReading(smoothedReading);

    // Pass further downstream (to storage, realtime, alerts, etc.)
    this.eventEmitter.emit('sensor.reading.deduped', smoothedReading);
  }

  @OnEvent('node.status.received')
  handleNodeStatus(statusUpdate: ValidatedNodeStatus) {
    const { nodeId, zoneId, status, receivedAt } = statusUpdate;
    let nodeStatus = this.nodeStatuses.get(nodeId);
    if (!nodeStatus) {
      nodeStatus = {
        nodeId,
        zoneId,
        status,
        lastSeenAt: receivedAt,
        gapCount: 0
      };
      this.nodeStatuses.set(nodeId, nodeStatus);
    } else {
      nodeStatus.status = status;
      nodeStatus.lastSeenAt = receivedAt;
      nodeStatus.zoneId = zoneId;
    }

    if (status === 'offline') {
      this.movingAverageFilter.resetNode(nodeId);
    }

    this.logger.log(`[processing] Node status changed: node=${nodeId} status=${status}`);
    this.eventEmitter.emit('node.status.changed', nodeStatus);
  }
}
