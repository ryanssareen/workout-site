'use client';

import { useEffect, useState } from 'react';
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

export function ChartSection({ section }: ChartSectionProps) {
  const { chartType, title, data, xKey, yKey, label } = section;
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial dark mode
    setIsDarkMode(document.documentElement.classList.contains('dark'));

    // Watch for changes
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

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <div className="w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={xKey}
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  color: isDarkMode ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name={label || yKey}
              />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'bar':
        return (
          <div className="w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={xKey}
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  color: isDarkMode ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Legend />
              <Bar
                dataKey={yKey}
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                name={label || yKey}
              />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'area':
        return (
          <div className="w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={xKey}
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke={axisColor}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  color: isDarkMode ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
                strokeWidth={2}
                name={label || yKey}
              />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        return (
          <div className="w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  color: isDarkMode ? '#f1f5f9' : '#0f172a',
                }}
              />
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
    <div className="space-y-3">
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
