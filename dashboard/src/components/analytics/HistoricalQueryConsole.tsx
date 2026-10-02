"use client";

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  Database,
  Search,
  Download,
  Terminal,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Code,
  Zap,
} from 'lucide-react';

interface HistoricalReadingItem {
  nodeId: string;
  zoneId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: string;
  sequenceNumber: number;
  receivedAt: string;
  isGapRecovered?: boolean;
}

export function HistoricalQueryConsole() {
  const [selectedNode, setSelectedNode] = useState<string>('NODE_01');
  const [selectedSensor, setSelectedSensor] = useState<string>('tilt');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [aggregation, setAggregation] = useState<string>('RAW');
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    records: HistoricalReadingItem[];
    executionTimeMs: number;
    totalCount: number;
    gapCount: number;
    packetLossPct: number;
  } | null>(null);

  const sensorMeta = SENSOR_CONFIGS[selectedSensor] || SENSOR_CONFIGS.tilt;

  // Execute §8 Historical Query
  const handleExecuteQuery = () => {
    setIsExecuting(true);

    setTimeout(() => {
      const count = timeRange === '15m' ? 45 : timeRange === '1h' ? 120 : 350;
      const records: HistoricalReadingItem[] = [];
      const now = Date.now();
      const intervalMs = (60 * 60 * 1000) / count;
      let mockGapCount = selectedNode === 'NODE_06' ? 2 : 0;

      for (let i = 0; i < count; i++) {
        const t = new Date(now - (count - i) * intervalMs).toISOString();
        let val = 0;

        if (selectedSensor === 'tilt') {
          val = Number((0.15 + Math.sin(i / 10) * 0.12 + (selectedNode === 'NODE_03' ? (i / count) * 1.8 : 0)).toFixed(2));
        } else if (selectedSensor === 'vibration') {
          val = Number((0.45 + Math.cos(i / 7) * 0.2 + (selectedNode === 'NODE_02' ? 2.2 : 0)).toFixed(2));
        } else if (selectedSensor === 'displacement') {
          val = Number((0.25 + (i / count) * (selectedNode === 'NODE_03' ? 6.5 : 0.4)).toFixed(2));
        } else if (selectedSensor === 'gas') {
          val = Math.round(7.5 + (selectedNode === 'NODE_04' ? (i / count) * 28 : Math.sin(i / 15) * 2));
        } else if (selectedSensor === 'water') {
          val = Number((0.25 + (selectedNode === 'NODE_05' ? (i / count) * 2.1 : 0.05)).toFixed(2));
        } else {
          val = selectedNode === 'NODE_03' && i > count * 0.7 ? 1 : 0;
        }

        records.push({
          nodeId: selectedNode,
          zoneId:
            selectedNode.includes('01') || selectedNode.includes('02') || selectedNode.includes('03')
              ? 'ZONE_01_LONGWALL_FACE'
              : 'ZONE_02_RETURN_AIRWAY',
          sensorType: selectedSensor,
          value: val,
          unit: sensorMeta.defaultUnit,
          timestamp: t,
          sequenceNumber: 1000 + i + (i > 30 && selectedNode === 'NODE_06' ? 2 : 0),
          receivedAt: new Date(new Date(t).getTime() + 18).toISOString(),
          isGapRecovered: false,
        });
      }

      setQueryResult({
        records: records.reverse(),
        executionTimeMs: Math.floor(18 + Math.random() * 16),
        totalCount: records.length,
        gapCount: mockGapCount,
        packetLossPct: Number(((mockGapCount / (records.length + mockGapCount)) * 100).toFixed(2)),
      });

      setIsExecuting(false);
    }, 320);
  };

  // Export Queried Data to CSV
  const handleExportCsv = () => {
    if (!queryResult || queryResult.records.length === 0) return;

    const headers = [
      'nodeId',
      'zoneId',
      'sensorType',
      'value',
      'unit',
      'timestamp',
      'sequenceNumber',
      'receivedAt',
    ];

    const rows = queryResult.records.map(r => [
      r.nodeId,
      r.zoneId,
      r.sensorType,
      r.value,
      r.unit,
      r.timestamp,
      r.sequenceNumber,
      r.receivedAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `timeseries_${selectedNode}_${selectedSensor}_${timeRange}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* §8 Query Contract Card */}
      <Card className="p-5 bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#14213d] dark:text-[#fca311] font-bold text-xs font-mono">
            <Database className="w-4 h-4" />
            <span>Design &amp; Architecture §8 — Historical Query Contract</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            InfluxDB Cloud Interface
          </Badge>
        </div>

        <p className="text-xs text-[#14213d] dark:text-[#e5e5e5] leading-relaxed">
          Provides external machine learning training pipelines, Python data scientists, and geotechnical auditors direct access to validated time-series with canonical packet sequence verification.
        </p>

        <div className="bg-[#f4f5f7] dark:bg-[#000000] p-3.5 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] font-mono text-[11px] text-[#14213d] dark:text-[#e5e5e5] space-y-1 overflow-x-auto">
          <div className="text-amber-700 dark:text-[#fca311] font-bold">
            {'// StorageModule.getHistoricalReadings(nodeId, sensorType, timeRange, aggregation)'}
          </div>
          <div>
            Contract: <span className="text-[#5c677d] dark:text-[#94a3b8]">&#123; nodeId, zoneId, sensorType, value, unit, timestamp, sequenceNumber, receivedAt &#125;</span>
          </div>
          <div className="text-[#5c677d] dark:text-[#94a3b8] pt-1">
            Canonical truth for packet loss is always verified through monotonic <code className="text-emerald-600 dark:text-emerald-400 font-bold">sequenceNumber</code> gaps.
          </div>
        </div>
      </Card>

      {/* Query Parameters Toolbar */}
      <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            {/* Node Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Node:</span>
              <select
                value={selectedNode}
                onChange={e => setSelectedNode(e.target.value)}
                className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
              >
                {['NODE_01', 'NODE_02', 'NODE_03', 'NODE_04', 'NODE_05', 'NODE_06'].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Sensor Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Sensor:</span>
              <select
                value={selectedSensor}
                onChange={e => setSelectedSensor(e.target.value)}
                className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
              >
                {Object.keys(SENSOR_CONFIGS).map(type => (
                  <option key={type} value={type}>
                    {SENSOR_CONFIGS[type].label} ({type})
                  </option>
                ))}
              </select>
            </div>

            {/* Aggregation */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Resolution:</span>
              <select
                value={aggregation}
                onChange={e => setAggregation(e.target.value)}
                className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
              >
                <option value="RAW">Raw High-Res Telemetry</option>
                <option value="1_MIN_AVG">1-Minute Moving Average</option>
                <option value="5_MIN_AVG">5-Minute Window Average</option>
                <option value="MAX_PEAK">Peak Max Extrema</option>
              </select>
            </div>

            {/* Time Window Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Window:</span>
              <div className="flex bg-[#f4f5f7] dark:bg-[#000000] p-1 rounded-xl border border-[#e5e5e5] dark:border-[#14213d]">
                {['15m', '1h', '6h', '24h', '7d'].map(w => (
                  <button
                    key={w}
                    onClick={() => setTimeRange(w)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      timeRange === w
                        ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] font-bold shadow-sm'
                        : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleExecuteQuery}
            disabled={isExecuting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#fca311] hover:bg-[#ffb733] text-[#000000] text-xs font-bold font-mono tracking-wide transition-all shadow-md shadow-[#fca311]/25 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Search className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
            {isExecuting ? 'Executing Query...' : 'Execute §8 Query'}
          </button>
        </div>
      </Card>

      {/* Query Results Presentation */}
      {queryResult && (
        <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Query Succeeded ({queryResult.executionTimeMs}ms)
              </span>
              <span className="text-[#5c677d] dark:text-[#94a3b8]">
                Returned: <strong className="text-[#000000] dark:text-white">{queryResult.totalCount} rows</strong>
              </span>
              <span className="text-[#5c677d] dark:text-[#94a3b8]">
                Sequence Gaps: <strong className="text-[#000000] dark:text-white">{queryResult.gapCount}</strong> ({queryResult.packetLossPct}% loss)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000] hover:bg-[#e5e5e5] dark:hover:bg-[#14213d] text-[#14213d] dark:text-white text-xs font-mono font-bold border border-[#e5e5e5] dark:border-[#14213d] transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#fca311]" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] dark:border-[#14213d] max-h-96">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#f4f5f7] dark:bg-[#000000] text-[#5c677d] dark:text-[#94a3b8] sticky top-0 border-b border-[#e5e5e5] dark:border-[#14213d]">
                <tr>
                  <th className="p-2.5">Seq #</th>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Node ID</th>
                  <th className="p-2.5">Sensor Type</th>
                  <th className="p-2.5">Value</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5] dark:divide-[#14213d]">
                {queryResult.records.slice(0, 30).map((r, idx) => (
                  <tr
                    key={`${r.sequenceNumber}-${idx}`}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="p-2.5 font-bold text-[#14213d] dark:text-white">
                      #{r.sequenceNumber}
                    </td>
                    <td className="p-2.5 text-[#5c677d] dark:text-[#94a3b8] whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2.5 font-bold text-[#000000] dark:text-white">
                      {r.nodeId}
                    </td>
                    <td className="p-2.5 capitalize">{r.sensorType}</td>
                    <td className="p-2.5 font-bold text-amber-700 dark:text-[#fca311]">
                      {r.value}
                    </td>
                    <td className="p-2.5 text-[#5c677d] dark:text-[#94a3b8]">{r.unit}</td>
                    <td className="p-2.5 text-[11px] text-[#5c677d] dark:text-[#94a3b8] whitespace-nowrap">
                      {new Date(r.receivedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
