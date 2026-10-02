import React from 'react';
import { AlertRule } from '@/types/alert';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface AlertRuleCardProps {
  rule: AlertRule;
}

export const AlertRuleCard = React.memo(function AlertRuleCard({ rule }: AlertRuleCardProps) {
  const isCritical = rule.severity === 'critical';

  return (
    <Card
      accent={isCritical ? 'red' : 'amber'}
      className="p-4 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${
              isCritical
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                : 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40'
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#000000] dark:text-white tracking-wide">
              {rule.name}
            </h4>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono capitalize">
              Target: {rule.sensorType} sensor
            </span>
          </div>
        </div>

        <Badge variant={isCritical ? 'danger' : 'warning'} className="text-[10px] uppercase font-mono font-bold">
          {rule.severity}
        </Badge>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between text-xs font-mono">
        <span className="text-[#5c677d] dark:text-[#94a3b8]">Trigger:</span>
        <span className="font-bold text-[#000000] dark:text-white bg-[#f4f5f7] dark:bg-[#000000] px-2 py-0.5 rounded-md border border-[#e5e5e5] dark:border-[#14213d]">
          Value {rule.operator} {rule.threshold} {rule.unit}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-[#5c677d] dark:text-[#94a3b8] leading-normal">
        {rule.description}
      </p>
    </Card>
  );
});

