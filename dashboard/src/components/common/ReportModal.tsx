"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  Building2,
  Cpu,
  CheckCircle2,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { ExecutiveReportData, downloadReportHtml } from '@/lib/reportGenerator';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExecutiveReportData | null;
}

export function ReportModal({ isOpen, onClose, report }: ReportModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on ESC
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !report || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    downloadReportHtml(report);
  };

  const isCritical = report.complianceStatus === 'CRITICAL';
  const isAdvisory = report.complianceStatus === 'ADVISORY';

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-auto"
      aria-modal="true"
      role="dialog"
    >
      {/* Background backdrop click */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Main Modal Shell */}
      <div className="relative w-full max-w-5xl h-full max-h-[92vh] sm:max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Sticky Action Toolbar (Hidden during Print) */}
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950 border-b border-slate-800 text-slate-200 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Executive Dossier Preview
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {report.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                DGMS Circular No. 2 &amp; SIH-2026 Boardroom Print-Ready Format
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download HTML Button */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
              title="Download standalone HTML dossier for offline auditing"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>HTML Dossier</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-md active:scale-95"
              title="Open System Print Dialog to Save as crisp vector PDF or print"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Print / Save PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors ml-1"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-950/50">
          <div
            id="printable-report-sheet"
            className="w-full max-w-4xl mx-auto bg-white text-slate-900 border border-slate-300 rounded-lg shadow-xl p-6 sm:p-10 font-sans print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full"
          >
            {/* Official Crest Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-black text-xl tracking-tighter shrink-0">
                  M
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    Ministry of Mines &amp; Coal India Limited
                  </div>
                  <div className="text-sm font-black text-slate-950 tracking-tight">
                    DIRECTORATE GENERAL OF MINES SAFETY (DGMS)
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Statutory Geological Hazard Notification — Circular No. 2 of 2026
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Smart India Hackathon 2026
                </div>
                <div className="text-[10px] text-slate-600 font-mono">
                  Problem Statement 1642: Mine Subsidence
                </div>
                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                  Autonomous Edge-to-Cloud IoT &amp; AI Framework
                </div>
              </div>
            </div>

            {/* Document Title & Subtitle */}
            <div className="mb-4">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                {report.title}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {report.subtitle}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-100 border border-slate-300 rounded-md mb-6 font-mono text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                  Doc Tracking ID
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">{report.id}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                  Mine Sector / Pit
                </span>
                <span className="font-bold text-slate-900 block mt-0.5 truncate">
                  {report.mineSector}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                  Timestamp
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">{report.generatedAt}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                  DGMS Compliance
                </span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-black uppercase text-white ${
                    isCritical
                      ? 'bg-red-600'
                      : isAdvisory
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600'
                  }`}
                >
                  {report.complianceStatus}
                </span>
              </div>
            </div>

            {/* Executive Summary Callout */}
            <div className="border-l-4 border-slate-900 bg-slate-50 p-3.5 rounded-r-md mb-6 text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-950 uppercase font-black tracking-wider text-[11px] mr-1">
                Geotechnical Executive Briefing:
              </strong>
              {report.executiveSummary}
            </div>

            {/* Key Statutory KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {report.kpis.map((kpi, idx) => {
                const borderClass =
                  kpi.status === 'critical'
                    ? 'border-t-4 border-t-red-600 bg-red-50/50'
                    : kpi.status === 'warning'
                    ? 'border-t-4 border-t-amber-500 bg-amber-50/50'
                    : kpi.status === 'normal'
                    ? 'border-t-4 border-t-emerald-600 bg-emerald-50/50'
                    : 'border-t-4 border-t-slate-800 bg-slate-50';

                return (
                  <div
                    key={idx}
                    className={`border border-slate-200 rounded p-3 ${borderClass}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {kpi.label}
                    </div>
                    <div className="text-lg font-black font-mono text-slate-950 mt-1">
                      {kpi.value}
                    </div>
                    {kpi.subtext && (
                      <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                        {kpi.subtext}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Numbered Sections */}
            <div className="space-y-6">
              {report.sections.map((section, sIdx) => (
                <div key={sIdx} className="break-inside-avoid">
                  {/* Section Title */}
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5 mb-2.5">
                    <span className="bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                      0{sIdx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                        {section.title}
                      </h3>
                      {section.subtitle && (
                        <span className="text-[10px] text-slate-500 block">
                          {section.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section Content */}
                  {section.content && (
                    <p className="text-xs text-slate-700 leading-relaxed mb-3">
                      {section.content}
                    </p>
                  )}

                  {/* Section Table */}
                  {section.table && (
                    <div className="border border-slate-300 rounded overflow-hidden mb-3">
                      <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300">
                        {section.table.title}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-300">
                              {section.table.headers.map((h, hIdx) => (
                                <th
                                  key={hIdx}
                                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                            {section.table.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                              >
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3 py-1.5 text-slate-900">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section Notes / Regulatory Directives */}
                  {section.notes && section.notes.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1.5">
                        Statutory Mandates &amp; Operational Directives:
                      </div>
                      <ul className="space-y-1 list-disc pl-4 text-slate-600 text-[11px] leading-relaxed">
                        {section.notes.map((note, nIdx) => (
                          <li key={nIdx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 3-Party Sign-Off & Verification Block */}
            <div className="mt-8 pt-4 border-t-2 border-slate-900 break-inside-avoid">
              <div className="text-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Statutory Engineering Review &amp; Geotechnical Attestation
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Geotechnical Engineer */}
                <div className="border border-slate-300 rounded p-3 bg-white text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Geotechnical Specialist
                  </span>
                  <div className="h-9 border-b border-dashed border-slate-400 flex items-center justify-center font-serif italic text-blue-900 text-sm font-semibold">
                    K. Raman, Ph.D.
                  </div>
                  <div className="text-[10px] font-bold text-slate-900 mt-1">
                    {report.signOff.engineer}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Signed: {report.signOff.date}
                  </div>
                </div>

                {/* Safety Supervisor */}
                <div className="border border-slate-300 rounded p-3 bg-white text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Mine Safety Officer
                  </span>
                  <div className="h-9 border-b border-dashed border-slate-400 flex items-center justify-center font-serif italic text-blue-900 text-sm font-semibold">
                    M. Verma, M.Tech
                  </div>
                  <div className="text-[10px] font-bold text-slate-900 mt-1">
                    {report.signOff.supervisor}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Signed: {report.signOff.date}
                  </div>
                </div>

                {/* DGMS Authority */}
                <div className="border border-slate-300 rounded p-3 bg-white text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Inspecting Authority / DGMS
                  </span>
                  <div className="h-9 border-b border-dashed border-slate-400 flex items-center justify-center font-serif italic text-blue-900 text-sm font-semibold">
                    S. Sengupta, DGMS
                  </div>
                  <div className="text-[10px] font-bold text-slate-900 mt-1">
                    {report.signOff.manager}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Signed: {report.signOff.date}
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Footer */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[9px] font-mono text-slate-500 gap-1">
              <div>Security Classification: {report.securityClassification}</div>
              <div>Audit Verification Hash: 9F8A-7C14-E52B-DGMS-2026</div>
              <div>Autonomous Mine Subsidence AI Early Warning Network</div>
            </div>
          </div>
        </div>
      </div>

      {/* Global CSS for Print Mode to isolate and format the report cleanly */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          /* Hide all application elements */
          body * {
            visibility: hidden;
          }
          /* Show only the printable report sheet */
          #printable-report-sheet,
          #printable-report-sheet * {
            visibility: visible;
          }
          #printable-report-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
