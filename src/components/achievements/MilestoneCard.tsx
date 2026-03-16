'use client';

import { forwardRef } from 'react';
import {
  Star, Medal, Award, Trophy, Crown, Flame, Zap, MapPin, Compass, Globe, Earth,
  Footprints, Bike, Waves, Dumbbell,
} from 'lucide-react';
import { format } from 'date-fns';
import type { DetectedMilestone } from '@/types/achievements';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star, medal: Medal, award: Award, trophy: Trophy, crown: Crown,
  flame: Flame, zap: Zap, 'map-pin': MapPin, compass: Compass, globe: Globe,
  earth: Earth, footprints: Footprints, bike: Bike, waves: Waves, dumbbell: Dumbbell,
};

const CATEGORY_COLORS: Record<string, { from: string; to: string; glow: string }> = {
  workout_count: { from: 'from-amber-400', to: 'to-orange-500', glow: 'bg-amber-500/10' },
  distance: { from: 'from-green-400', to: 'to-emerald-500', glow: 'bg-green-500/10' },
  streak: { from: 'from-orange-400', to: 'to-red-500', glow: 'bg-orange-500/10' },
  first_ever: { from: 'from-blue-400', to: 'to-cyan-500', glow: 'bg-blue-500/10' },
};

interface MilestoneCardProps {
  milestone: DetectedMilestone;
  date?: Date;
  userName?: string;
}

export const MilestoneCard = forwardRef<HTMLDivElement, MilestoneCardProps>(
  function MilestoneCard({ milestone, date, userName }, ref) {
    const IconComponent = ICON_MAP[milestone.icon] || Trophy;
    const colors = CATEGORY_COLORS[milestone.category] || CATEGORY_COLORS.workout_count;

    return (
      <div
        ref={ref}
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f1a0f 100%)' }}
      >
        {/* Decorative glow */}
        <div className={`absolute top-0 right-0 w-40 h-40 rounded-full ${colors.glow} blur-3xl`} />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="text-xs font-medium text-gray-400">The Daily Athlete</span>
          </div>
          {date && (
            <span className="text-xs text-gray-500">{format(date, 'MMM d, yyyy')}</span>
          )}
        </div>

        {/* Icon + Badge */}
        <div className="relative flex flex-col items-center text-center mb-4">
          <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center shadow-lg mb-4`}>
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-1">
            Milestone Unlocked
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {milestone.name}
          </p>
          <p className="text-sm text-gray-400 mt-1">{milestone.description}</p>
        </div>

        {/* Footer */}
        {userName && (
          <div className="relative mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-gray-500">{userName}</p>
          </div>
        )}
      </div>
    );
  }
);
