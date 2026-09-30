import { Link } from 'react-router-dom';

/** Split auth shell so login and register stay visually consistent. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__card">
        <Link className="auth__brand" to="/">
          <span className="auth__logo" aria-hidden="true">
            D
          </span>
          DocExpire
        </Link>
        <h1 className="auth__title">{title}</h1>
        {subtitle ? <p className="auth__subtitle">{subtitle}</p> : null}
        {children}
        {footer ? <p className="auth__footer">{footer}</p> : null}
      </div>
    </div>
  );
}
