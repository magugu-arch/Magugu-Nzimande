import { isRouteErrorResponse, useRouteError } from 'react-router';
import { site } from '../data/site';

/**
 * Last line of defence when a page throws, including a lazy chunk that
 * failed to download after a deploy. Plain markup and a hard reload, because
 * whatever broke may be the router itself.
 */
export default function RouteError() {
  const error = useRouteError();
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
  if (!isRouteErrorResponse(error)) console.error(error);

  return (
    <main className="page-gutter flex min-h-dvh flex-col justify-end bg-black pt-32 pb-24 text-white">
      <p className="ui-label mb-8 opacity-60">(Something went wrong)</p>
      <h1 className="editorial-title text-5xl lg:text-7xl">
        {chunkFailed ? 'The site has been updated.' : 'This page stumbled.'}
        <br />
        <span className="editorial-italic">Please try again.</span>
      </h1>
      <p className="mt-6 max-w-md opacity-70">
        If it keeps happening, call {site.phone} or email {site.email} and we will help you directly.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => window.location.reload()} className="ui-label inline-flex min-h-11 items-center justify-center bg-white px-6 text-black">
          Reload the page
        </button>
        <a href="/" className="ui-label inline-flex min-h-11 items-center justify-center border border-white/40 px-6">
          Back to home
        </a>
      </div>
    </main>
  );
}
