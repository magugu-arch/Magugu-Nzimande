/**
 * Keeps a browser context to the site under test. Requests to any other host
 * (the Google map embedded on /visit, the weather service) are aborted, as they
 * are when the tests run without internet access.
 *
 * Without this, CI depended on outside services: the Google map logs console
 * errors of its own (a CORS-blocked request inside Google's frame), which the
 * tests counted as the site's, and a slow embed would hold up every page load.
 */
export async function siteOnly(context, base) {
  const origin = new URL(base).origin;
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  return context;
}
