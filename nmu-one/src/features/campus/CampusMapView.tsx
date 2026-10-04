import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { Building, CampusMap, Route } from '@/core/domain/models';
import { colors, nunito } from '@/design';

const VIEW_W = 1000;
const VIEW_H = 1300;

/**
 * The schematic campus map (brief §9). Drawn from the building register, so
 * the live CampusProvider can supply NMU's real layout without changing this
 * component. It is a picture for sighted users; the screen around it always
 * gives the same information as text (route steps, building list).
 */
export function CampusMapView({
  map,
  route,
  highlight,
  origin,
  onSelectBuilding,
  height = 420,
  label,
}: {
  map: CampusMap;
  route?: Route | null;
  highlight?: string | null;
  origin?: string | null;
  onSelectBuilding?: (b: Building) => void;
  height?: number;
  label: string;
}) {
  const waypoints = useMemo(() => new Map(map.waypoints.map((w) => [w.id, w.point])), [map]);
  const here = origin ? waypoints.get(origin) : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ height, width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#E6E5DC' }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grounds */}
        <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#E6E5DC" />
        <Rect x={300} y={930} width={400} height={170} rx={40} fill="#D5DEC9" />
        <SvgText x={500} y={1022} fontSize={30} fontFamily={nunito.bold} fill="#7C8A6E" textAnchor="middle">
          Main Lawn
        </SvgText>

        {/* Walkways */}
        {map.paths.map(([a, b]) => {
          const p = waypoints.get(a);
          const q = waypoints.get(b);
          if (!p || !q) return null;
          return <Line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={colors.white} strokeWidth={34} strokeLinecap="round" />;
        })}

        {/* Route */}
        {route ? (
          <>
            <Polyline points={route.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.navy} strokeWidth={26} strokeLinejoin="round" strokeLinecap="round" />
            <Polyline points={route.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.yellow} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}

        {/* Buildings */}
        {map.buildings.map((b) => {
          const on = b.id === highlight;
          return (
            <G key={b.id} onPress={onSelectBuilding ? () => onSelectBuilding(b) : undefined}>
              <Rect
                x={b.position.x - b.size.w / 2}
                y={b.position.y - b.size.h / 2}
                width={b.size.w}
                height={b.size.h}
                rx={22}
                fill={on ? colors.yellow : colors.navy2}
                stroke={on ? colors.navy : 'none'}
                strokeWidth={on ? 8 : 0}
              />
              <SvgText x={b.position.x} y={b.position.y + 14} fontSize={44} fontFamily={nunito.extrabold} fill={on ? colors.navy : colors.white} textAnchor="middle">
                {b.code}
              </SvgText>
            </G>
          );
        })}

        {/* You are here */}
        {here ? (
          <G>
            <Circle cx={here.x} cy={here.y} r={40} fill={colors.navy} opacity={0.18} />
            <Circle cx={here.x} cy={here.y} r={22} fill={colors.white} />
            <Circle cx={here.x} cy={here.y} r={15} fill={colors.navy} />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
