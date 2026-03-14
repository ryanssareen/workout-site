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

const MAX_CARDS = 3;

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

    // --- Rule 1: Sport Deep Dive (most-trained sport with 3+ in last 30 days) ---
    const sportCounts: Record<string, number> = {};
    for (const w of recentWorkouts) {
      sportCounts[w.type] = (sportCounts[w.type] || 0) + 1;
    }
    const topSport = Object.entries(sportCounts)
      .sort(([, a], [, b]) => b - a)
      .find(([, count]) => count >= 3);

    if (topSport) {
      const [sport, count] = topSport;
      result.push({
        type: 'sport-deep-dive',
        title: `Your ${SPORT_LABELS[sport] || sport} This Month`,
        teaser: `${count} session${count !== 1 ? 's' : ''} in the last 30 days — see pace trends, highlights, and insights`,
        icon: SPORT_EMOJI[sport] || '🏋️',
        color: sport,
        href: `/reports/sport-deep-dive?sport=${sport}`,
        minWorkouts: 3,
      });
    }

    // --- Rule 2: Trend Report (2+ months of data) ---
    const lastMonthStart = firstOfLastMonth();
    const hasLastMonthData = completedWorkouts.some(
      (w) => toDate(w.date) >= lastMonthStart && toDate(w.date) < new Date(now.getFullYear(), now.getMonth(), 1)
    );
    if (hasLastMonthData && completedWorkouts.length >= 10) {
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
        minWorkouts: 10,
      });
    }

    // --- Rule 3: Goal Tracker (event within 8 weeks) ---
    if (user.events && user.events.length > 0) {
      const eightWeeksFromNow = new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
      const upcomingEvent = user.events.find((e) => {
        if (!e.eventDate) return false;
        const eventDate = new Date(e.eventDate);
        return eventDate > now && eventDate <= eightWeeksFromNow;
      });

      if (upcomingEvent && completedWorkouts.length >= 5) {
        const eventDate = new Date(upcomingEvent.eventDate!);
        const weeksUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
        result.push({
          type: 'goal-tracker',
          title: `${weeksUntil} Weeks to ${upcomingEvent.eventName || 'Your Event'}`,
          teaser: 'Track your readiness and see what to focus on in the weeks ahead',
          icon: '🎯',
          color: 'orange',
          href: `/reports/goal-tracker?event=${encodeURIComponent(upcomingEvent.eventName || '')}`,
          minWorkouts: 5,
        });
      }
    }

    // --- Rule 4: Recovery Report (busy athlete) ---
    const lastTwoWeeksWorkouts = completedWorkouts.filter(
      (w) => toDate(w.date) >= fourteenDaysAgo
    );
    if (lastTwoWeeksWorkouts.length >= 10) {
      result.push({
        type: 'recovery-report',
        title: 'Recovery Check',
        teaser: `${lastTwoWeeksWorkouts.length} workouts in 14 days — let's check your training load balance`,
        icon: '🔋',
        color: 'orange',
        href: '/reports/recovery-report',
        minWorkouts: 10,
      });
    }

    // --- Rule 5: PR Timeline (any PRs in last 7 days) ---
    const recentPrs = completedWorkouts.filter(
      (w) => toDate(w.date) >= sevenDaysAgo && hasPrs(w)
    );
    const totalPrs = completedWorkouts.filter(hasPrs).length;
    if (totalPrs > 0) {
      result.push({
        type: 'pr-timeline',
        title: recentPrs.length > 0
          ? `${recentPrs.length} New PR${recentPrs.length !== 1 ? 's' : ''} This Week`
          : 'Personal Records',
        teaser: recentPrs.length > 0
          ? 'You set new records recently — see your full PR timeline and progression'
          : `${totalPrs} personal record${totalPrs !== 1 ? 's' : ''} tracked — explore your progression`,
        icon: '🏆',
        color: 'amber',
        href: '/reports/pr-timeline',
        minWorkouts: 0,
      });
    }

    // --- Rule 6: Training Analysis (always available as fallback) ---
    result.push({
      type: 'training-analysis',
      title: 'Training Analysis',
      teaser: `${completedWorkouts.length} workout${completedWorkouts.length !== 1 ? 's' : ''} tracked — charts, breakdowns, and detailed analytics`,
      icon: '📊',
      color: 'gray',
      href: '/reports/training-analysis',
      minWorkouts: 0,
    });

    return result.slice(0, MAX_CARDS);
  }, [workouts, user]);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <DeepDiveCard key={card.type + card.href} card={card} />
      ))}
    </div>
  );
}
