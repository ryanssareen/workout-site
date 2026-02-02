'use client';

import { ReportSection, StatSection } from '@/types/reports';
import { StatCard } from './sections/StatCard';
import { DataTable } from './sections/DataTable';
import { ChartSection } from './sections/ChartSection';
import { TextBlock } from './sections/TextBlock';
import { HighlightCallout } from './sections/HighlightCallout';
import { PRBadge } from './sections/PRBadge';
import { Divider } from './sections/Divider';

interface ReportRendererProps {
  sections: ReportSection[];
}

export function ReportRenderer({ sections }: ReportRendererProps) {
  const renderSection = (section: ReportSection, index: number) => {
    const key = `section-${index}`;

    switch (section.type) {
      case 'stat':
        return <StatCard key={key} section={section} />;
      case 'table':
        return <DataTable key={key} section={section} />;
      case 'chart':
        return <ChartSection key={key} section={section} />;
      case 'text':
        return <TextBlock key={key} section={section} />;
      case 'highlight':
        return <HighlightCallout key={key} section={section} />;
      case 'pr':
        return <PRBadge key={key} section={section} />;
      case 'divider':
        return <Divider key={key} />;
      default:
        return null;
    }
  };

  // Group consecutive stat sections into a grid
  const groupedSections: (ReportSection | StatSection[])[] = [];
  let currentStatGroup: StatSection[] = [];

  sections.forEach((section) => {
    if (section.type === 'stat') {
      currentStatGroup.push(section);
    } else {
      if (currentStatGroup.length > 0) {
        groupedSections.push([...currentStatGroup]);
        currentStatGroup = [];
      }
      groupedSections.push(section);
    }
  });

  if (currentStatGroup.length > 0) {
    groupedSections.push(currentStatGroup);
  }

  return (
    <div className="space-y-6">
      {groupedSections.map((item, index) => {
        if (Array.isArray(item)) {
          // Render stat cards in a grid
          return (
            <div
              key={`stat-grid-${index}`}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {item.map((section, statIndex) => (
                <StatCard key={`stat-${index}-${statIndex}`} section={section} />
              ))}
            </div>
          );
        } else {
          return renderSection(item, index);
        }
      })}
    </div>
  );
}
