'use client';

import Link from 'next/link';
import { Calendar, BarChart3, Star } from 'lucide-react';

interface YourReportsZoneProps {
  weeklyWorkoutCount: number;
  monthlyWorkoutCount: number;
  isCoach?: boolean;
}

const REPORT_LINKS = [
  {
    href: '/wrap',
    icon: Calendar,
    title: 'Weekly Wrap',
    getSubtitle: (weekly: number) =>
      weekly > 0 ? `${weekly} workout${weekly !== 1 ? 's' : ''} this week` : 'Your weekly capsule',
    gradient: 'from-blue-500/10 to-indigo-500/10',
    borderColor: 'border-blue-500/20 hover:border-blue-500/30',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/15',
  },
  {
    href: '/review',
    icon: BarChart3,
    title: 'Monthly Review',
    getSubtitle: (monthly: number) =>
      monthly > 0 ? `${monthly} workout${monthly !== 1 ? 's' : ''} this month` : 'Your month in review',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    borderColor: 'border-emerald-500/20 hover:border-emerald-500/30',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
  },
  {
    href: '/wrapped',
    icon: Star,
    title: 'Year in Review',
    getSubtitle: () => '2025 Wrapped',
    gradient: 'from-purple-500/10 to-pink-500/10',
    borderColor: 'border-purple-500/20 hover:border-purple-500/30',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-500/15',
  },
];

export function YourReportsZone({ weeklyWorkoutCount, monthlyWorkoutCount, isCoach }: YourReportsZoneProps) {
  if (isCoach) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {REPORT_LINKS.map((item) => {
        const Icon = item.icon;
        const subtitle = item.getSubtitle(
          item.href === '/wrap' ? weeklyWorkoutCount : monthlyWorkoutCount
        );

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-xl border bg-gradient-to-br ${item.gradient} ${item.borderColor} p-4 transition-all hover:shadow-sm`}
          >
            <div className="flex items-start gap-3">
              <div className={`h-9 w-9 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4.5 w-4.5 ${item.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-foreground/90 transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
