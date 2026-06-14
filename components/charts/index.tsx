'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, ComposedChart,
} from 'recharts';

const SEVERITY_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'];
const CHART_COLORS = ['#1a82f5', '#33a1ff', '#59c0ff', '#8ed8ff', '#136be1', '#1656b6'];

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(51, 65, 85, 0.5)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
};

export function SeverityChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
          {data.map((_, i) => (
            <Cell key={i} fill={SEVERITY_COLORS[i] || CHART_COLORS[i]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarChartWidget({ data, dataKey = 'value', color = '#1a82f5' }: {
  data: { name: string; value: number }[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { month: string; opened: number; closed: number; net?: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Area type="monotone" dataKey="opened" stackId="1" stroke="#ea580c" fill="#ea580c" fillOpacity={0.3} />
        <Area type="monotone" dataKey="closed" stackId="2" stroke="#16a34a" fill="#16a34a" fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrendChart({ data }: { data: { month: string; risk?: number; value?: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="risk" stroke="#1a82f5" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HeatmapGrid({ data }: { data: { businessArea: string; severity: string; count: number }[] }) {
  const areas = [...new Set(data.map((d) => d.businessArea))].slice(0, 8);
  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  const getCount = (area: string, sev: string) =>
    data.find((d) => d.businessArea === area && d.severity === sev)?.count || 0;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-surface-500">Business Area</th>
            {severities.map((s) => (
              <th key={s} className="p-2 text-center text-surface-500">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area}>
              <td className="p-2 font-medium text-surface-700 dark:text-surface-300">{area}</td>
              {severities.map((sev) => {
                const count = getCount(area, sev);
                const intensity = count / maxCount;
                return (
                  <td key={sev} className="p-1">
                    <div
                      className="flex h-10 items-center justify-center rounded-md font-medium text-white"
                      style={{
                        backgroundColor: count === 0
                          ? 'rgba(100,116,139,0.1)'
                          : `rgba(220, 38, 38, ${0.15 + intensity * 0.85})`,
                        color: count === 0 ? '#94a3b8' : intensity > 0.5 ? '#fff' : '#fca5a5',
                      }}
                    >
                      {count}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamPerformanceChart({ data }: { data: { name: string; overdue: number; performance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={75} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="overdue" fill="#dc2626" radius={[0, 4, 4, 0]} name="Overdue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OpenClosedChart({ data }: { data: { month: string; open: number; closed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="open" fill="#1a82f5" radius={[4, 4, 0, 0]} name="Open" />
        <Bar dataKey="closed" fill="#16a34a" radius={[4, 4, 0, 0]} name="Closed" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SlaPerformanceChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SlaTrendChart({ data }: { data: { month: string; compliance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="compliance" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="SLA %" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SmeWorkloadChart({ data }: { data: { name: string; open: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="open" fill="#1a82f5" radius={[4, 4, 0, 0]} name="Open Tasks" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LeaderboardChart({ data }: { data: { name: string; totalCompleted: number; completedThisMonth: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={95} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="totalCompleted" fill="#16a34a" radius={[0, 4, 4, 0]} name="Total Completed" />
        <Bar dataKey="completedThisMonth" fill="#1a82f5" radius={[0, 4, 4, 0]} name="This Month" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RecoveryTrendChart({ data }: { data: { month: string; opened: number; closed: number; netReduction: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Area type="monotone" dataKey="opened" stroke="#ea580c" fill="#ea580c" fillOpacity={0.2} name="Opened" />
        <Area type="monotone" dataKey="closed" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} name="Closed" />
        <Line type="monotone" dataKey="netReduction" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Net Reduction" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ServiceRiskTable({ data }: {
  data: { name: string; total: number; critical: number; overdue: number; completionPercent: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 dark:border-surface-800">
            {['Service', 'Total', 'Critical', 'Overdue', 'Completion %'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
          {data.map((svc) => (
            <tr key={svc.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
              <td className="px-3 py-2 font-medium">{svc.name}</td>
              <td className="px-3 py-2">{svc.total}</td>
              <td className="px-3 py-2">
                <span className={svc.critical > 0 ? 'font-medium text-red-500' : 'text-surface-500'}>{svc.critical}</span>
              </td>
              <td className="px-3 py-2">
                <span className={svc.overdue > 0 ? 'font-medium text-orange-500' : 'text-surface-500'}>{svc.overdue}</span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 max-w-[80px] rounded-full bg-surface-200 dark:bg-surface-700">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${svc.completionPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500">{svc.completionPercent}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
