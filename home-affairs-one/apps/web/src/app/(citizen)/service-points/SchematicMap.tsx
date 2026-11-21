import type { ServicePoint } from '@hao/api-contracts';
import { cx } from '@hao/design-system';
import type { CSSProperties } from 'react';
import styles from './service-points.module.css';
import { KIND_LABEL } from './words';

export interface SchematicMapProps {
  points: ServicePoint[];
  selectedId?: string | null;
  /** Leave out for a static map (one point, nothing to choose). */
  onSelect?: (point: ServicePoint) => void;
  size?: 'full' | 'small';
}

function pinPosition(point: ServicePoint): CSSProperties {
  return { left: `${point.position.x}%`, top: `${point.position.y}%` };
}

/**
 * A schematic, not a geographic map: a soft grid with a numbered pin for each
 * sample service point. Pins are buttons in the same order as the numbered
 * list beside the map, so the keyboard order matches the numbers.
 */
export function SchematicMap({ points, selectedId = null, onSelect, size = 'full' }: SchematicMapProps) {
  const only = points.length === 1 ? points[0] : undefined;
  return (
    <figure className={styles.mapFigure}>
      {onSelect ? (
        <div
          className={cx(styles.map, size === 'small' && styles.mapSmall)}
          role="group"
          aria-label="Schematic map of sample service points"
        >
          <div className={styles.mapInner}>
            {points.map((point, index) => {
              const selected = point.id === selectedId;
              return (
                <button
                  key={point.id}
                  type="button"
                  className={cx(styles.pin, selected && styles.pinSelected)}
                  style={pinPosition(point)}
                  aria-pressed={selected}
                  aria-label={`${index + 1}: ${point.name}, ${KIND_LABEL[point.kind]}`}
                  onClick={() => onSelect(point)}
                >
                  <span className={styles.pinDot} aria-hidden="true">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className={cx(styles.map, size === 'small' && styles.mapSmall)}
          role="img"
          aria-label={
            only
              ? `Schematic position of ${only.name}`
              : 'Schematic positions of sample service points'
          }
        >
          <div className={styles.mapInner}>
            {points.map((point, index) => (
              <span
                key={point.id}
                className={cx(styles.pin, styles.pinStatic, styles.pinSelected)}
                style={pinPosition(point)}
              >
                <span className={styles.pinDot}>{index + 1}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <figcaption className={styles.mapCaption}>
        Schematic map. Locations are synthetic and not to scale.
      </figcaption>
    </figure>
  );
}
