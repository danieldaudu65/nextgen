import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="sec" style={{ textAlign: 'center' }}>
      <div className="wrap">
        <span className="tagbar">404</span>
        <h1 className="display" style={{ fontSize: 'clamp(48px,8vw,96px)', margin: '18px 0 12px' }}>This page don japa.</h1>
        <p style={{ color: 'var(--muted)', fontSize: 18, marginBottom: 28 }}>We couldn&apos;t find that story. It may have moved or never existed. No cap.</p>
        <Link className="btn dark" href="/">Back to the homepage →</Link>
      </div>
    </section>
  );
}
