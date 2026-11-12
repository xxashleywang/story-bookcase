import type { CSSProperties } from 'react';

const CANNON_COUNT = 48;
const RAIN_COUNT = 16;
const SHAPES = ['strip', 'dot', 'tri', 'ribbon', 'star', 'plank'] as const;
const COLORS = ['var(--coral)', 'var(--butter)', 'var(--ink)', '#FF9A80', '#7E8A6A', '#5C7A99'];

type Piece = CSSProperties & Record<`--${string}`, string>;

function noise(index: number, salt: number) {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function between(index: number, salt: number, min: number, max: number) {
  return min + noise(index, salt) * (max - min);
}

function cannonPiece(index: number, seed: number): Piece {
  const fromLeft = index % 2 === 0;
  const dir = fromLeft ? 1 : -1;
  const reach = between(index, seed + 1, 14, 72);
  return {
    '--ox': `${fromLeft ? 3 : 97}cqw`,
    '--oy': '102cqh',
    '--mx': `${dir * reach * 0.62}cqw`,
    '--my': `${-between(index, seed + 2, 58, 98)}cqh`,
    '--ex': `${dir * reach}cqw`,
    '--ey': '12cqh',
    '--delay': `${Math.round(between(index, seed + 3, 0, 260))}ms`,
    '--dur': `${Math.round(between(index, seed + 4, 2300, 3100))}ms`,
    '--spin': `${Math.round(between(index, seed + 5, -900, 900))}deg`,
    '--flip': `${Math.round(between(index, seed + 6, 360, 1260))}deg`,
    '--color': COLORS[index % COLORS.length],
  };
}

function rainPiece(index: number, seed: number): Piece {
  const sway = between(index, seed + 7, -12, 12);
  return {
    '--ox': `${between(index, seed + 8, 4, 96)}cqw`,
    '--oy': '-6cqh',
    '--mx': `${sway}cqw`,
    '--my': '55cqh',
    '--ex': `${-sway * 0.6}cqw`,
    '--ey': '116cqh',
    '--delay': `${Math.round(between(index, seed + 9, 350, 1000))}ms`,
    '--dur': `${Math.round(between(index, seed + 10, 2600, 3300))}ms`,
    '--spin': `${Math.round(between(index, seed + 11, -540, 540))}deg`,
    '--flip': `${Math.round(between(index, seed + 12, 540, 1080))}deg`,
    '--color': COLORS[(index + 3) % COLORS.length],
  };
}

/**
 * Decorative full-stage celebration for build completion.
 * This layer is visual-only and intentionally removed from accessibility APIs.
 */
export function BuildCelebration({ burstId }: { burstId: number }) {
  const seed = burstId * 17;
  return <div className="build-celebration" aria-hidden="true">
    <i className="build-celebration-wave" />
    <i className="build-celebration-wave is-late" />
    <div className="build-celebration-badge">
      <svg viewBox="0 0 110 110"><defs><path id="celebrateRing" d="M55,55 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs><text fontSize="9.5" fontWeight="700" letterSpacing="2.4" fill="currentColor"><textPath href="#celebrateRing">BUILT IT · NAILED IT · STACKED IT · </textPath></text></svg>
      <b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 12.5l4.2 4.1L19 7.8" /></svg></b>
    </div>
    {Array.from({ length: CANNON_COUNT + RAIN_COUNT }, (_, index) => {
      const isRain = index >= CANNON_COUNT;
      return <span key={`${burstId}-${index}`} className={`confetti${isRain ? ' is-rain' : ''}`} style={isRain ? rainPiece(index, seed) : cannonPiece(index, seed)}>
        <i className={`confetti-${SHAPES[index % SHAPES.length]}`} />
      </span>;
    })}
  </div>;
}
