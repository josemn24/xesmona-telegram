// 7×6 board in SVG. Discs drop in with Motion; the winning line is ringed. Sized to fit the
// compact iOS sheet (~500 px tall) and the desktop window (ADR 0007).
import type { Outcome, Seat } from '@xesmona/games';
import { COLUMNS, ROWS, type State } from '@xesmona/games/four-in-a-row';
import { motion } from 'motion/react';

const CELL = 100;
const RADIUS = 40;

export const DISC_COLORS = { red: '#e5484d', yellow: '#f5c400' } as const;

interface BoardProps {
  state: State;
  /** The seat that starts the round plays red. */
  starting: Seat;
  outcome: Outcome;
  /** Columns can be tapped (it's the viewer's turn). */
  canPlay: boolean;
  onPlay: (column: number) => void;
  /** Changes on rematch, so discs of the new round drop in again. */
  round: number;
}

const centre = (index: number) => ({
  cx: (index % COLUMNS) * CELL + CELL / 2,
  cy: Math.floor(index / COLUMNS) * CELL + CELL / 2,
});

export function Board({ state, starting, outcome, canPlay, onPlay, round }: BoardProps) {
  const winning = new Set(outcome && outcome !== 'draw' ? outcome.line : []);
  const color = (seat: Seat) => (seat === starting ? DISC_COLORS.red : DISC_COLORS.yellow);

  return (
    <svg
      viewBox={`0 0 ${COLUMNS * CELL} ${ROWS * CELL}`}
      className="mx-auto block w-full touch-manipulation select-none"
      // Fits the width, or the height left for the board, whichever is smaller.
      style={{ maxWidth: `calc((100dvh - 13rem) * ${COLUMNS} / ${ROWS})` }}
      role="grid"
      aria-label="Four in a row board"
    >
      <rect width={COLUMNS * CELL} height={ROWS * CELL} rx={28} fill="var(--color-tg-button)" />
      {state.cells.map((_, index) => (
        <circle key={`hole-${index}`} {...centre(index)} r={RADIUS} fill="var(--color-tg-bg)" />
      ))}
      {state.cells.map((seat, index) => {
        if (seat === null) return null;
        const { cx, cy } = centre(index);
        return (
          <motion.circle
            key={`disc-${round}-${index}`}
            // The final position is a plain attribute; only a translate (in viewBox units)
            // is animated, so the disc stays in its hole whatever size the board renders at.
            cx={cx}
            cy={cy}
            r={RADIUS}
            fill={color(seat)}
            initial={{ y: -(cy + CELL / 2) }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            stroke={winning.has(index) ? 'var(--color-tg-text)' : 'none'}
            strokeWidth={winning.has(index) ? 8 : 0}
          />
        );
      })}
      {Array.from({ length: COLUMNS }, (_, column) => (
        <rect
          key={`column-${column}`}
          x={column * CELL}
          width={CELL}
          height={ROWS * CELL}
          fill="transparent"
          role="button"
          aria-label={`Column ${column + 1}`}
          aria-disabled={!canPlay}
          className={canPlay ? 'cursor-pointer' : undefined}
          onClick={() => canPlay && onPlay(column)}
        />
      ))}
    </svg>
  );
}
