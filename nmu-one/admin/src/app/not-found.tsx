import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <strong>That page isn’t in the console</strong>
      <p>Check the address, or go back to the dashboard.</p>
      <Link className="btn" href="/">
        Dashboard
      </Link>
    </div>
  );
}
