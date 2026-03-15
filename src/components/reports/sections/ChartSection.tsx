'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChartSection as ChartSectionType } from '@/types/reports';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartSectionProps {
  section: ChartSectionType;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

/**
 * Resolve the actual y-keys to render. Handles:
 * 1. Explicit yKeys array (multi-series)
 * 2. Single yKey that exists in data
 * 3. Auto-detection: if yKey doesn't exist in data, find all numeric keys except xKey
 */
function resolveYKeys(
  data: Record<string, string | number>[],
  xKey: string,
  yKey: string,
  yKeys?: string[],
): string[] {
  // If explicit yKeys provided, use them
  if (yKeys && yKeys.length > 0) {
    return yKeys;
  }

  // Check if the single yKey exists in the first data point
  if (data.length > 0 && yKey in data[0]) {
    return [yKey];
  }

  // Auto-detect: find all numeric keys that aren't the xKey
  if (data.length > 0) {
    const numericKeys = Object.keys(data[0]).filter((key) => {
      if (key === xKey) return false;
      return typeof data[0][key] === 'number';
    });
    if (numericKeys.length > 0) {
      return numericKeys;
    }
  }

  // Fallback to single yKey even if it doesn't exist
  return [yKey];
}

export function ChartSection({ section }: ChartSectionProps) {
  const { chartType, title, data, xKey, yKey, yKeys, label, labels } = section;
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const axisColor = isDarkMode ? '#94a3b8' : '#64748b';
  const tooltipBg = isDarkMode ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#475569' : '#e2e8f0';

  // Resolve which keys to plot
  const resolvedKeys = useMemo(
    () => resolveYKeys(data || [], xKey, yKey, yKeys),
    [data, xKey, yKey, yKeys],
  );

  if (!data || data.length === 0) {
    return (
      <div className="space-y-3 min-w-[320px]">
        {title && (
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
        )}
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm min-h-[200px] flex items-center justify-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">No data available for this chart</p>
        </div>
      </div>
    );
  }

  const getLabel = (key: string, index: number): string => {
    if (labels && labels[index]) return labels[index];
    if (resolvedKeys.length === 1 && label) return label;
    // Capitalize the key name as fallback label
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey={xKey} stroke={axisColor} style={{ fontSize: '12px' }} />
                <YAxis stroke={axisColor} style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {resolvedKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={3}
                    dot={{ fill: COLORS[i % COLORS.length], r: 4 }}
                    activeDot={{ r: 6 }}
                    name={getLabel(key, i)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'bar':
        return (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey={xKey} stroke={axisColor} style={{ fontSize: '12px' }} />
                <YAxis stroke={axisColor} style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {resolvedKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={COLORS[i % COLORS.length]}
                    radius={[8, 8, 0, 0]}
                    name={getLabel(key, i)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'area':
        return (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey={xKey} stroke={axisColor} style={{ fontSize: '12px' }} />
                <YAxis stroke={axisColor} style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {resolvedKeys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.3}
                    strokeWidth={2}
                    name={getLabel(key, i)}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        return (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey={resolvedKeys[0]}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 min-w-[320px]">
      {title && (
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      )}
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        {renderChart()}
      </div>
    </div>
  );
}
