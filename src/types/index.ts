export type * from './menu';
export type * from './order';
export type * from './rewards';
export type * from './user';

/** Shape every service rejection is normalised to. */
export interface ApiError {
  code: string;
  message: string;
  /** Field-level messages for form validation. */
  fieldErrors?: Record<string, string>;
  status?: number;
}

/** Discriminated result used by services that must not throw. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };
