'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DeepDiveCard as DeepDiveCardType } from '@/types/reports-hub';

interface DeepDiveCardProps {
  card: DeepDiveCardType;
}

export function DeepDiveCard({ card }: DeepDiveCardProps) {
  return (
    <Link
      href={card.href}
      className="group block rounded-xl border bg-card p-4 transition-all hover:shadow-sm hover:border-foreground/10"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0 leading-none mt-0.5">
          {card.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-foreground/90 transition-colors">
            {card.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {card.teaser}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>
    </Link>
  );
}
