import type { Building, CampusMap, MapPoint, Route } from '../domain/models';

/** Schematic units to metres, and an unhurried walking pace. */
export const METRES_PER_UNIT = 0.6;
export const WALKING_METRES_PER_MINUTE = 75;

/**
 * "EB212" → building code "EB", floor 2. Room codes are building letters then
 * a number whose first digit is the floor. Returns null for anything else.
 */
export function parseRoomCode(
  input: string,
): { buildingCode: string; floor: number; code: string } | null {
  const match = input
    .toUpperCase()
    .replace(/\s+/g, '')
    .match(/^([A-Z]{1,3})(\d{3})$/);
  if (!match) return null;
  const [, buildingCode, digits] = match;
  return {
    buildingCode: buildingCode!,
    floor: Number(digits![0]),
    code: `${buildingCode}${digits}`,
  };
}

/** Finds a building by id, code, or a room code inside it. */
export function findBuilding(map: CampusMap, query: string): Building | null {
  const q = query.trim().toLowerCase();
  const room = parseRoomCode(query);
  return (
    map.buildings.find((b) => b.id === q) ??
    map.buildings.find((b) => b.code.toLowerCase() === q) ??
    (room ? map.buildings.find((b) => b.code === room.buildingCode) : undefined) ??
    map.buildings.find((b) => b.name.toLowerCase().includes(q)) ??
    null
  );
}

const distance = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Shortest walking route between two waypoints (Dijkstra over the path
 * graph). The graph is tiny, so a linear scan for the next node is plenty.
 */
export function shortestPath(map: CampusMap, from: string, to: string): string[] | null {
  const points = new Map(map.waypoints.map((w) => [w.id, w.point]));
  if (!points.has(from) || !points.has(to)) return null;

  const neighbours = new Map<string, string[]>();
  for (const [a, b] of map.paths) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }

  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const unvisited = new Set(points.keys());

  while (unvisited.size > 0) {
    let current: string | null = null;
    for (const id of unvisited) {
      if (dist.has(id) && (current === null || dist.get(id)! < dist.get(current)!)) current = id;
    }
    if (current === null) break;
    if (current === to) break;
    unvisited.delete(current);
    for (const next of neighbours.get(current) ?? []) {
      if (!unvisited.has(next)) continue;
      const alt = dist.get(current)! + distance(points.get(current)!, points.get(next)!);
      if (!dist.has(next) || alt < dist.get(next)!) {
        dist.set(next, alt);
        prev.set(next, current);
      }
    }
  }

  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) {
    const p = prev.get(path[0]!);
    if (!p) return null;
    path.unshift(p);
  }
  return path;
}

type Heading = 'north' | 'south' | 'east' | 'west';

const heading = (a: MapPoint, b: MapPoint): Heading => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
};

const turn = (from: Heading, to: Heading): 'left' | 'right' | 'straight' | 'back' => {
  const order: Heading[] = ['north', 'east', 'south', 'west'];
  const delta = (order.indexOf(to) - order.indexOf(from) + 4) % 4;
  return delta === 0 ? 'straight' : delta === 1 ? 'right' : delta === 3 ? 'left' : 'back';
};

/** Walking route from a waypoint to a building's entrance, with spoken steps. */
export function routeTo(
  map: CampusMap,
  fromWaypoint: string,
  building: Building,
  floor?: number,
): Route | null {
  const ids = shortestPath(map, fromWaypoint, building.entrance);
  if (!ids) return null;
  const byId = new Map(map.waypoints.map((w) => [w.id, w]));
  const points = ids.map((id) => byId.get(id)!.point);
  points.push(building.position);

  let units = 0;
  for (let i = 1; i < points.length; i++) units += distance(points[i - 1]!, points[i]!);
  const metres = Math.round((units * METRES_PER_UNIT) / 10) * 10;

  const steps: string[] = [];
  const start = byId.get(ids[0]!)!;
  if (ids.length > 1) {
    let current = heading(points[0]!, points[1]!);
    steps.push(`Head ${current} from ${start.label ?? 'your start'}`);
    for (let i = 1; i < ids.length - 1; i++) {
      const next = heading(points[i]!, points[i + 1]!);
      const t = turn(current, next);
      const at = byId.get(ids[i]!)!.label ?? 'the junction';
      if (t === 'left' || t === 'right') steps.push(`Turn ${t} at ${at}`);
      current = next;
    }
  }
  steps.push(`${building.name} (${building.code}) is ahead`);
  if (floor !== undefined && floor > 0) {
    steps.push(`Take the stairs or lift to level ${floor}`);
  }

  return {
    from: fromWaypoint,
    to: building.id,
    points,
    metres,
    walkingMinutes: Math.max(1, Math.round(metres / WALKING_METRES_PER_MINUTE)),
    steps,
  };
}
