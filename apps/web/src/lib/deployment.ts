/**
 * Facts about this deployment that are not about any one feature.
 *
 * `publicBaseUrl` started inside the payment registry, because payments needed
 * it first for PayFast's redirect URLs. It is not a payment fact: the password
 * reset email needs the same value to carry a link, and a notification module
 * importing from the payment registry to find out what this site is called says
 * the value is in the wrong place.
 */

export type DeploymentEnv = {
  BBQ_PUBLIC_URL?: string | undefined;
  readonly [other: string]: string | undefined;
};

/**
 * This deployment's own address, without its trailing slash, or null.
 *
 * Null rather than a guess. A URL assembled from request headers can be set by
 * whoever made the request, and a reset link or a payment return URL built from
 * one of those points wherever they said — so a deployment that has not been
 * told its address does without the link rather than inventing one.
 */
export function publicBaseUrl(env: DeploymentEnv = process.env): string | null {
  const url = env.BBQ_PUBLIC_URL;
  return url ? url.replace(/\/+$/, '') : null;
}
