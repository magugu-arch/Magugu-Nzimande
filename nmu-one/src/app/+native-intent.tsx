import { isHandoffReturn } from '@/core/auth/oidc';

/**
 * Deep links from the system browser. NMU SSO and the payment provider send
 * people back to nmuone://auth/callback and nmuone://payments/return, and
 * the sign-in screen or payment sheet that opened the browser is already
 * waiting for that result. Routing to it as well would cover the waiting
 * screen, so while the app is running those links are left to the browser
 * session. A cold start still routes, and those screens start over cleanly.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    return !initial && isHandoffReturn(path) ? null : path;
  } catch {
    return '/';
  }
}
