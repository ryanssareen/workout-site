import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, subMonths } from 'date-fns';

vi.mock('@/lib/firebase/config', () => ({
  getAuthInstance: vi.fn(),
  getDbInstance: vi.fn(),
  getStorageInstance: vi.fn(),
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getUserWorkouts: vi.fn().mockResolvedValue([]),
  getPersonalRecords: vi.fn().mockResolvedValue([]),
  getMilestones: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: { username: 'testuser', displayName: 'Test User', uid: 'test-uid', role: 'athlete' },
      loading: false,
    };
    return selector(state);
  }),
}));

vi.mock('@/lib/stores/workoutStore', () => {
  const state = {
    fetchWorkouts: vi.fn().mockResolvedValue([]),
    getWorkouts: vi.fn().mockResolvedValue([]),
    workouts: [],
    loading: false,
  };
  const hook = Object.assign(
    vi.fn(() => state),
    { getState: vi.fn(() => state) },
  );
  return { useWorkoutStore: hook };
});

vi.mock('@/hooks/useSwipe', () => ({
  useSwipe: vi.fn(() => ({})),
}));

vi.mock('@/components/dashboard/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/workouts/ShareWorkoutCard', () => ({
  ShareButtons: () => <div data-testid="share-buttons" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import MonthlyReviewPage from '@/app/(dashboard)/review/page';

describe('MonthlyReviewPage default month', () => {
  const previousMonthLabel = format(subMonths(new Date(), 1), 'MMMM yyyy');
  const currentMonthName = format(new Date(), 'MMMM');

  it('defaults to previous month (not current month)', async () => {
    render(<MonthlyReviewPage />);
    await waitFor(() => {
      // Month label appears in the nav bar header
      const matches = screen.getAllByText(previousMonthLabel);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not show the "not over yet" gate by default', async () => {
    render(<MonthlyReviewPage />);
    await waitFor(() => {
      expect(screen.getAllByText(previousMonthLabel).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(`${currentMonthName} isn't over yet!`)).not.toBeInTheDocument();
  });

  it('shows the gate when navigating to current month', async () => {
    const user = userEvent.setup();
    render(<MonthlyReviewPage />);

    await waitFor(() => {
      expect(screen.getAllByText(previousMonthLabel).length).toBeGreaterThanOrEqual(1);
    });

    // The right chevron button navigates forward (decreases monthOffset)
    // It's the second button in the nav (first is the back/left chevron)
    const buttons = screen.getAllByRole('button');
    // Find the chevron-right button: it's not disabled when monthOffset > 0
    const forwardBtn = buttons.find(btn => {
      const svg = btn.querySelector('.lucide-chevron-right');
      return svg && !btn.hasAttribute('disabled');
    });

    expect(forwardBtn).toBeTruthy();
    await user.click(forwardBtn!);

    await waitFor(() => {
      expect(screen.getByText(`${currentMonthName} isn't over yet!`)).toBeInTheDocument();
    });
  });
});
