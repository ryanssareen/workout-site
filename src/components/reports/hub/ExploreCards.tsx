'use client';

import { useMemo } from 'react';
import { DeepDiveCard } from './DeepDiveCard';
import type { DeepDiveCard as DeepDiveCardType } from '@/types/reports-hub';
import { SPORT_EMOJI, SPORT_LABELS } from '@/types/reports-hub';
import type { Workout, User } from '@/types';

interface ExploreCardsProps {
  workouts: Workout[];
  user: User;
}

/** Get the date N days ago from now */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the first day of last month */
function firstOfLastMonth(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parse a workout date into a JS Date */
function toDate(d: Date | { seconds: number }): Date {
  if (d instanceof Date) return d;
  if (d && typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  return new Date(d);
}

/** Check if a workout has a PR */
function hasPrs(w: Workout): boolean {
  return Array.isArray(w.prs) && w.prs.length > 0;
}

export function ExploreCards({ workouts, user }: ExploreCardsProps) {
  const cards = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = daysAgo(30);
    const fourteenDaysAgo = daysAgo(14);
    const sevenDaysAgo = daysAgo(7);

    const completedWorkouts = workouts.filter((w) => w.completed);
    const recentWorkouts = completedWorkouts.filter(
      (w) => toDate(w.date) >= thirtyDaysAgo
    );

    const result: DeepDiveCardType[] = [];

    // --- 1: Sport Deep Dive ---
    const sportCounts: Record<string, number> = {};
    for (const w of recentWorkouts) {
      sportCounts[w.type] = (sportCounts[w.type] || 0) + 1;
    }
    const topSport = Object.entries(sportCounts)
      .sort(([, a], [, b]) => b - a)[0];

    const sportName = topSport ? (SPORT_LABELS[topSport[0]] || topSport[0]) : 'Running';
    const sportKey = topSport ? topSport[0] : 'run';
    const sportCount = topSport ? topSport[1] : 0;
    result.push({
      type: 'sport-deep-dive',
      title: `Your ${sportName} This Month`,
      teaser: sportCount > 0
        ? `${sportCount} session${sportCount !== 1 ? 's' : ''} in the last 30 days — see pace trends, highlights, and insights`
        : 'Dive deep into your most-trained sport with pace trends and highlights',
      icon: SPORT_EMOJI[sportKey] || '🏋️',
      color: sportKey,
      href: `/reports/sport-deep-dive?sport=${sportKey}`,
      minWorkouts: 0,
    });

    // --- 2: Trend Report ---
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long' });
    const thisMonth = now.toLocaleDateString('en-US', { month: 'long' });
    result.push({
      type: 'trend-report',
      title: `${thisMonth} vs ${monthName}`,
      teaser: 'Compare your training volume, consistency, and sport mix month over month',
      icon: '📈',
      color: 'orange',
      href: '/reports/trend-report',
      minWorkouts: 0,
    });

    // --- 3: Goal Tracker ---
    let goalTitle = 'Goal Tracker';
    let goalTeaser = 'Track your readiness and training volume buildup toward your next event';
    let goalHref = '/reports/goal-tracker';
    if (user.events && user.events.length > 0) {
      const eightWeeksFromNow = new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
      const upcomingEvent = user.events.find((e) => {
        if (!e.eventDate) return false;
        const eventDate = new Date(e.eventDate);
        return eventDate > now && eventDate <= eightWeeksFromNow;
      });
      if (upcomingEvent) {
        const eventDate = new Date(upcomingEvent.eventDate!);
        const weeksUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
        goalTitle = `${weeksUntil} Weeks to ${upcomingEvent.eventName || 'Your Event'}`;
        goalTeaser = 'Track your readiness and see what to focus on in the weeks ahead';
        goalHref = `/reports/goal-tracker?event=${encodeURIComponent(upcomingEvent.eventName || '')}`;
      }
    }
    result.push({
      type: 'goal-tracker',
      title: goalTitle,
      teaser: goalTeaser,
      icon: '🎯',
      color: 'orange',
      href: goalHref,
      minWorkouts: 0,
    });

    // --- 4: Recovery Report ---
    const lastTwoWeeksWorkouts = completedWorkouts.filter(
      (w) => toDate(w.date) >= fourteenDaysAgo
    );
    result.push({
      type: 'recovery-report',
      title: 'Recovery Check',
      teaser: lastTwoWeeksWorkouts.length >= 5
        ? `${lastTwoWeeksWorkouts.length} workouts in 14 days — let's check your training load balance`
        : 'Analyze your rest patterns, training load, and recovery balance',
      icon: '🔋',
      color: 'orange',
      href: '/reports/recovery-report',
      minWorkouts: 0,
    });

    // --- 5: PR Timeline ---
    const recentPrs = completedWorkouts.filter(
      (w) => toDate(w.date) >= sevenDaysAgo && hasPrs(w)
    );
    const totalPrs = completedWorkouts.filter(hasPrs).length;
    result.push({
      type: 'pr-timeline',
      title: recentPrs.length > 0
        ? `${recentPrs.length} New PR${recentPrs.length !== 1 ? 's' : ''} This Week`
        : 'Personal Records',
      teaser: recentPrs.length > 0
        ? 'You set new records recently — see your full PR timeline and progression'
        : totalPrs > 0
          ? `${totalPrs} personal record${totalPrs !== 1 ? 's' : ''} tracked — explore your progression`
          : 'Track and visualize your personal records over time',
      icon: '🏆',
      color: 'amber',
      href: '/reports/pr-timeline',
      minWorkouts: 0,
    });

    // --- 6: Training Analysis ---
    result.push({
      type: 'training-analysis',
      title: 'Training Analysis',
      teaser: completedWorkouts.length > 0
        ? `${completedWorkouts.length} workout${completedWorkouts.length !== 1 ? 's' : ''} tracked — charts, breakdowns, and detailed analytics`
        : 'Detailed charts, breakdowns, and analytics for your training',
      icon: '📊',
      color: 'gray',
      href: '/reports/training-analysis',
      minWorkouts: 0,
    });

    return result;
  }, [workouts, user]);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {cards.map((card) => (
        <DeepDiveCard key={card.type + card.href} card={card} />
      ))}
    </div>
  );
}
