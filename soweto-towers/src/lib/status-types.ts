/**
 * Live tower status, set by the crew from the console. 'auto' follows the
 * opening schedule; the others override it for the day.
 */
export type TowerState = 'auto' | 'open' | 'hold' | 'closed';

export type TowerStatus = {
  state: TowerState;
  note: string | null;
  queueMinutes: number | null;
  updatedAt: string;
};

export const defaultStatus: TowerStatus = {
  state: 'auto',
  note: null,
  queueMinutes: null,
  updatedAt: new Date(0).toISOString(),
};
