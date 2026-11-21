import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="sign-in">
      <div className="sign-in__panel">
        <div>
          <p className="eyebrow">Not found</p>
          <h1>That page is not in the console</h1>
          <p className="lede">
            The item may have been removed, or the demo store may have been reset by a server
            restart.
          </p>
        </div>
        <div className="row">
          <Link className="btn btn--secondary" href="/">
            Go to the overview
          </Link>
        </div>
      </div>
    </main>
  );
}
