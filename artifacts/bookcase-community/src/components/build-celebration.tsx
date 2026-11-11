import type { CSSProperties } from 'react';

const BURST_COUNT = 18;
const BURST_STEP_MS = 42;
const BURST_COLORS = ['var(--coral)', 'var(--butter)', 'var(--ink)', '#FF9A80'];

type BurstParticle = CSSProperties & {
  '--burst-delay': string;
  '--burst-x': string;
  '--burst-y': string;
  '--burst-rotate': string;
  '--burst-color': string;
};

function burstParticle(index: number): BurstParticle {
  const angle = -104 + index * (208 / (BURST_COUNT - 1));
  const distance = 54 + (index % 4) * 12;
  const radians = (angle * Math.PI) / 180;
  return {
    '--burst-delay': `${index * BURST_STEP_MS}ms`,
    '--burst-x': `${Math.cos(radians) * distance}px`,
    '--burst-y': `${Math.sin(radians) * distance}px`,
    '--burst-rotate': `${-120 + (index % 6) * 48}deg`,
    '--burst-color': BURST_COLORS[index % BURST_COLORS.length],
  };
}

/**
 * Decorative celebration burst for build completion.
 * This layer is visual-only and intentionally removed from accessibility APIs.
 */
export function BuildCelebration({ burstId }: { burstId: number }) {
  return <div className="build-celebration" aria-hidden="true">
    {Array.from({ length: BURST_COUNT }, (_, index) => (
      <i key={`${burstId}-${index}`} className="build-celebration-particle" style={burstParticle(index)} />
    ))}
  </div>;
}
