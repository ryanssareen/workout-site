import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SportBreakdownCard, getTimeRangeCutoff } from '@/components/dashboard/SportBreakdownCard';
import { Workout } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { subDays, subMonths, subYears } from 'date-fns';

function makeWorkout(overrides: Partial<Workout> & { type: Workout['type']; date: Date }): Workout {
  const { date, ...rest } = overrides;
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Test Workout',
    description: '',
    ownerUsername: 'testuser',
    createdBy: 'testuser',
    assignedTo: 'testuser',
    completed: true,
    createdAt: Timestamp.fromDate(date),
    updatedAt: Timestamp.fromDate(date),
    date: Timestamp.fromDate(date),
    ...rest,
  } as Workout;
}

describe('SportBreakdownCard', () => {
  const now = new Date();

  const workouts: Workout[] = [
    // Recent workouts (within last week)
    makeWorkout({ type: 'run', date: subDays(now, 1) }),
    makeWorkout({ type: 'run', date: subDays(now, 2) }),
    makeWorkout({ type: 'swim', date: subDays(now, 3) }),
    // Within last month but not last week
    makeWorkout({ type: 'bike', date: subDays(now, 14) }),
    makeWorkout({ type: 'bike', date: subDays(now, 20) }),
    makeWorkout({ type: 'strength', date: subDays(now, 25) }),
    // Old workouts (2+ months ago)
    makeWorkout({ type: 'run', date: subMonths(now, 3) }),
    makeWorkout({ type: 'walk', date: subMonths(now, 6) }),
    // Very old (2 years ago)
    makeWorkout({ type: 'swim', date: subYears(now, 2) }),
    // Incomplete workout — should always be excluded
    makeWorkout({ type: 'run', date: subDays(now, 1), completed: false }),
  ];

  it('renders with "Last Month" selected by default', () => {
    render(<SportBreakdownCard workouts={workouts} />);
    expect(screen.getByText('Sport Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Last Month')).toBeInTheDocument();
  });

  it('shows only workouts from the last month by default', () => {
    render(<SportBreakdownCard workouts={workouts} />);
    // Last month: 2 run, 1 swim, 2 bike, 1 strength = 6 workouts
    // run: 2/6 = 33%, swim: 1/6 = 17%, bike: 2/6 = 33%, strength: 1/6 = 17%
    expect(screen.getByText('run')).toBeInTheDocument();
    expect(screen.getByText('swim')).toBeInTheDocument();
    expect(screen.getByText('bike')).toBeInTheDocument();
    expect(screen.getByText('strength')).toBeInTheDocument();
    // walk is 6 months ago — should not appear in last month
    expect(screen.queryByText('walk')).not.toBeInTheDocument();
  });

  it('excludes incomplete workouts', () => {
    // The incomplete run workout (subDays 1) should not increase run count
    // With 6 completed workouts in last month, run is 2 of 6 = 33%
    // Bike is also 2 of 6 = 33%, swim 1 = 17%, strength 1 = 17%
    render(<SportBreakdownCard workouts={workouts} />);
    // Find the run row and check its count — text is split across spans
    const runLabels = screen.getAllByText('run');
    expect(runLabels.length).toBe(1);
    // Verify the run row's parent contains the expected count
    const runRow = runLabels[0].closest('.space-y-1');
    expect(runRow?.textContent).toContain('2');
    expect(runRow?.textContent).toContain('33%');
  });

  it('opens dropdown and shows all time range options', async () => {
    const user = userEvent.setup();
    render(<SportBreakdownCard workouts={workouts} />);

    await user.click(screen.getByText('Last Month'));

    expect(screen.getByText('Last Week')).toBeInTheDocument();
    expect(screen.getByText('Last 3 Months')).toBeInTheDocument();
    expect(screen.getByText('Last Year')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('filters to last week when selected', async () => {
    const user = userEvent.setup();
    render(<SportBreakdownCard workouts={workouts} />);

    await user.click(screen.getByText('Last Month'));
    await user.click(screen.getByText('Last Week'));

    // Last week: 2 run + 1 swim = 3 workouts
    expect(screen.getByText('run')).toBeInTheDocument();
    expect(screen.getByText('swim')).toBeInTheDocument();
    expect(screen.queryByText('bike')).not.toBeInTheDocument();
    expect(screen.queryByText('strength')).not.toBeInTheDocument();
  });

  it('shows all workouts when "All Time" selected', async () => {
    const user = userEvent.setup();
    render(<SportBreakdownCard workouts={workouts} />);

    await user.click(screen.getByText('Last Month'));
    await user.click(screen.getByText('All Time'));

    // All completed: 3 run, 2 swim, 2 bike, 1 strength, 1 walk = 9
    expect(screen.getByText('run')).toBeInTheDocument();
    expect(screen.getByText('swim')).toBeInTheDocument();
    expect(screen.getByText('bike')).toBeInTheDocument();
    expect(screen.getByText('strength')).toBeInTheDocument();
    expect(screen.getByText('walk')).toBeInTheDocument();
  });

  it('shows empty state when no workouts match the range', async () => {
    const oldWorkouts = [
      makeWorkout({ type: 'run', date: subYears(now, 3) }),
    ];
    render(<SportBreakdownCard workouts={oldWorkouts} />);
    expect(screen.getByText('No completed workouts in this period')).toBeInTheDocument();
  });

  it('shows empty state for empty workout list', () => {
    render(<SportBreakdownCard workouts={[]} />);
    expect(screen.getByText('No completed workouts in this period')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(<SportBreakdownCard workouts={workouts} />);

    // Open dropdown
    await user.click(screen.getByText('Last Month'));
    expect(screen.getByText('Last Week')).toBeInTheDocument();

    // Click the overlay backdrop
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    await user.click(overlay!);

    // Dropdown should close — "Last Week" as a dropdown option should be gone
    // (the button still shows the current label "Last Month")
    const dropdownItems = document.querySelectorAll('.absolute.right-0 button');
    expect(dropdownItems.length).toBe(0);
  });
});

describe('getTimeRangeCutoff', () => {
  it('returns null for "all" range', () => {
    expect(getTimeRangeCutoff('all')).toBeNull();
  });

  it('returns a date in the past for all other ranges', () => {
    const now = new Date();
    for (const range of ['week', 'month', '3months', 'year'] as const) {
      const cutoff = getTimeRangeCutoff(range);
      expect(cutoff).not.toBeNull();
      expect(cutoff!.getTime()).toBeLessThan(now.getTime());
    }
  });

  it('returns progressively older dates for wider ranges', () => {
    const week = getTimeRangeCutoff('week')!;
    const month = getTimeRangeCutoff('month')!;
    const threeMonths = getTimeRangeCutoff('3months')!;
    const year = getTimeRangeCutoff('year')!;

    expect(week.getTime()).toBeGreaterThan(month.getTime());
    expect(month.getTime()).toBeGreaterThan(threeMonths.getTime());
    expect(threeMonths.getTime()).toBeGreaterThan(year.getTime());
  });
});
