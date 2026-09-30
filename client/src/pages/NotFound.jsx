import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth">
      <div className="auth__card auth__card--center">
        <span className="auth__logo" aria-hidden="true">
          D
        </span>
        <h1 className="auth__title">Page not found</h1>
        <p className="auth__subtitle">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link className="btn btn--primary btn--block" to="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
