/** True only in the static preview build (`npm run build:demo`); constant-folded away otherwise. */
export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';
