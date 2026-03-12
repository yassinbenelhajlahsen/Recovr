"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type LineConfig = {
  dataKey: string;
  color: string;
  label: string;
};

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  /** Single-line mode */
  dataKey?: string;
  label: string;
  color?: string;
  unit: string;
  emptyMessage?: string;
  chartKey?: string;
  /** Multi-line mode — overrides dataKey/color */
  lines?: LineConfig[];
  /** Stretch the card to fill its parent container height */
  grow?: boolean;
};

type TooltipProps = {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  unit: string;
};

function ChartTooltip({ active, payload, label, unit }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const isMulti = payload.length > 1;
  return (
    <div className="bg-elevated border border-border-subtle rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="text-xs text-muted mb-1">{label}</p>
      {isMulti ? (
        <div className="space-y-0.5">
          {payload.map((entry) => (
            <div key={entry.dataKey} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.stroke }}
              />
              <span className="text-secondary text-xs">{entry.name}:</span>
              <span className="font-medium text-primary">
                {(entry.value ?? 0).toLocaleString()} {unit}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-medium text-primary">
          {(payload[0]?.value ?? 0).toLocaleString()} {unit}
        </p>
      )}
    </div>
  );
}

// Muted tick color that works in both light and dark SVG context
const TICK_COLOR = "#9CA3AF";

export function ProgressChart({ data, dataKey, label, color, unit, emptyMessage, chartKey, lines, grow }: Props) {
  const isEmpty = data.length < 2;
  const resolvedLines: LineConfig[] = lines ?? (dataKey && color ? [{ dataKey, color, label }] : []);
  const showLegend = resolvedLines.length > 1;

  return (
    <div className={`bg-surface border border-border-subtle rounded-xl p-4 sm:p-6 ${grow ? "flex flex-col flex-1" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
        {showLegend && (
          <div className="flex items-center gap-3">
            {resolvedLines.map((line) => (
              <div key={line.dataKey} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                <span className="text-xs text-secondary">{line.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className={`flex items-center justify-center ${grow ? "flex-1 min-h-[220px]" : "h-[220px] sm:h-[280px]"}`}>
          <p className="text-sm text-muted text-center">
            {emptyMessage ?? "Log more sessions to see trends"}
          </p>
        </div>
      ) : (
        <div className={grow ? "flex-1 min-h-[220px]" : "h-[220px] sm:h-[280px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart key={chartKey} data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                stroke="var(--c-border-subtle)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: TICK_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: TICK_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    payload={props.payload as any}
                    label={props.label as string | undefined}
                    unit={unit}
                  />
                )}
                cursor={{ stroke: "var(--c-border)", strokeWidth: 1 }}
                wrapperStyle={{ zIndex: 10, outline: "none" }}
              />
              {resolvedLines.map((line) => (
                <Line
                  key={line.dataKey}
                  name={line.label}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ fill: line.color, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: line.color, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
