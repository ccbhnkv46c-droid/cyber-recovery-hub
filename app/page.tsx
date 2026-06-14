'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, LayoutDashboard, List, UserCheck, AlertTriangle, BarChart3, Settings, ArrowRight, Activity, CheckCircle, Clock, Target, Timer } from 'lucide-react';
import { apiFetch } from '@/lib/store';

const NAV_CARDS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Executive overview and KPIs' },
  { href: '/register', label: 'Vulnerability Register', icon: List, desc: 'Search and manage all findings' },
  { href: '/my-actions', label: 'My Actions', icon: UserCheck, desc: 'Engineer remediation portal' },
  { href: '/completed-tasks', label: 'Completed Tasks', icon: CheckCircle, desc: 'Archived remediations and SME leaderboard' },
  { href: '/escalations', label: 'Escalations', icon: AlertTriangle, desc: 'Automated escalation tracking' },
  { href: '/analytics', label: 'Reports', icon: BarChart3, desc: 'Power BI style analytics' },
  { href: '/settings', label: 'Settings', icon: Settings, desc: 'Platform configuration' },
];

interface HomepageKpis {
  openVulnerabilities: number;
  closedVulnerabilities: number;
  criticalVulnerabilities: number;
  overdueVulnerabilities: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  slaCompliancePercent: number;
  mttrDays: number;
  updatedAt: string;
}

export default function HomePage() {
  const [kpis, setKpis] = useState<HomepageKpis | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadKpis = () => {
    apiFetch<HomepageKpis>('/dashboard/homepage')
      .then((data) => {
        setKpis(data);
        setLastUpdated(new Date(data.updatedAt).toLocaleTimeString());
      })
      .catch(() => setKpis(null));
  };

  useEffect(() => {
    loadKpis();
    const id = setInterval(loadKpis, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(51,161,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(51,161,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <header className="mb-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-glow">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <span className="font-display text-lg font-bold">Cyber Recovery Hub</span>
          </div>
          <Link href="/login" className="btn-primary">
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="mb-12 text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
            Cyber Recovery Hub
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-surface-400">
            Transforming vulnerability recovery through automation and accountability.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/login" className="btn-primary px-8 py-3 text-base">
              Access Platform
            </Link>
            <Link href="/dashboard" className="btn-secondary border-surface-700 bg-surface-900 px-8 py-3 text-base text-surface-200">
              View Dashboard
            </Link>
          </div>
        </section>

        {kpis && (
          <section className="mb-16">
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <p className="text-sm text-surface-400">Live platform metrics · Updated {lastUpdated}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Open Vulnerabilities', value: kpis.openVulnerabilities, icon: Activity, color: 'text-brand-400' },
                { title: 'Closed Vulnerabilities', value: kpis.closedVulnerabilities, icon: CheckCircle, color: 'text-green-400' },
                { title: 'Critical Vulnerabilities', value: kpis.criticalVulnerabilities, icon: AlertTriangle, color: 'text-red-400' },
                { title: 'Overdue Vulnerabilities', value: kpis.overdueVulnerabilities, icon: Clock, color: 'text-orange-400' },
                { title: 'Tasks Due Today', value: kpis.tasksDueToday, icon: Clock, color: 'text-yellow-400' },
                { title: 'Tasks Due This Week', value: kpis.tasksDueThisWeek, icon: Target, color: 'text-brand-400' },
                { title: 'SLA Compliance', value: `${kpis.slaCompliancePercent}%`, icon: Target, color: 'text-green-400' },
                { title: 'Mean Time to Remediate', value: `${kpis.mttrDays}d`, icon: Timer, color: 'text-brand-400' },
              ].map((kpi) => (
                <div
                  key={kpi.title}
                  className="rounded-xl border border-surface-800 bg-surface-900/60 p-5 backdrop-blur transition-all hover:border-brand-500/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{kpi.title}</p>
                      <p className="mt-2 font-display text-3xl font-bold">{kpi.value}</p>
                    </div>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-surface-800 bg-surface-900/50 p-6 backdrop-blur transition-all hover:border-brand-500/50 hover:bg-surface-900 hover:shadow-glow"
            >
              <card.icon className="mb-4 h-8 w-8 text-brand-400 transition-transform group-hover:scale-110" />
              <h3 className="font-display text-lg font-semibold">{card.label}</h3>
              <p className="mt-2 text-sm text-surface-400">{card.desc}</p>
            </Link>
          ))}
        </section>

        <footer className="mt-20 border-t border-surface-800 pt-8 text-center text-sm text-surface-500">
          <p>Enterprise Cyber Recovery Platform &mdash; Tier 1 Banking Grade</p>
          <p className="mt-1">Automated SLA Management &bull; Intelligent Escalation &bull; Executive Visibility</p>
        </footer>
      </div>
    </div>
  );
}
