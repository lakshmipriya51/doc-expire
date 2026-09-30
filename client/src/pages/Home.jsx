import { Link } from 'react-router-dom';

const FEATURES = [
  {
    title: 'Document Management',
    description: 'Store passports, licences, insurance and IDs in one secure place.',
  },
  {
    title: 'Expiry Tracking',
    description: 'Every document is automatically sorted into Active, Expiring Soon or Expired.',
  },
  {
    title: 'Smart Reminders',
    description: 'Get alerted 30, 15, 7 and 1 day before a document expires.',
  },
  {
    title: 'Secure Access',
    description: 'Password hashing, JWT sessions and per-user data isolation by default.',
  },
];

export default function Home() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <span className="landing__brand">
          <span className="landing__logo" aria-hidden="true">
            D
          </span>
          DocExpire
        </span>
        <nav className="landing__nav-links">
          <Link className="btn btn--ghost btn--sm" to="/login">
            Login
          </Link>
          <Link className="btn btn--primary btn--sm" to="/register">
            Get Started
          </Link>
        </nav>
      </header>

      <main className="landing__main">
        <section className="hero">
          <span className="hero__eyebrow">Document expiry reminder system</span>
          <h1 className="hero__title">Never Miss a Document Renewal Again.</h1>
          <p className="hero__text">
            DocExpire helps you securely manage important documents and reminds you before they
            expire.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--primary btn--lg" to="/register">
              Get Started
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/login">
              Login
            </Link>
          </div>
        </section>

        <section className="features" aria-label="Features">
          {FEATURES.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h2 className="feature-card__title">{feature.title}</h2>
              <p className="feature-card__text">{feature.description}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing__footer">
        <p>DocExpire - a full-stack document expiry reminder system.</p>
      </footer>
    </div>
  );
}
