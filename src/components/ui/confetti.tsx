'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];
const SHAPES = ['circle', 'square', 'triangle'];

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  shape: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  delay: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 45 + Math.random() * 10, // cluster near center
    y: 40 + Math.random() * 10,
    color: COLORS[i % COLORS.length],
    shape: SHAPES[i % SHAPES.length],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 80,
    velocityY: -30 - Math.random() * 50,
    delay: Math.random() * 0.3,
  }));
}

export function Confetti({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!show) return;
    setParticles(generateParticles(30));
    const timer = setTimeout(() => {
      setParticles([]);
      onDone?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [show, onDone]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'triangle' ? '0' : '2px',
            clipPath: p.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-burst 1.2s ease-out ${p.delay}s forwards`,
            '--vx': `${p.velocityX}px`,
            '--vy': `${p.velocityY}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-burst {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--vx), calc(var(--vy) + 200px)) rotate(720deg) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
