import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isMissingServerUrl, isNativePlatform } from '../services/storage';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/documents', label: 'Documents' },
  { to: '/documents/new', label: 'Add Document' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/profile', label: 'Profile' },
];

/**
 * App shell for signed-in users. The sidebar collapses into a slide-in drawer
 * on small screens and a sticky top bar on mobile.
 */
export default function AppLayout() {
  const { user, logout, provisionError, retryProvisioning } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Native builds have no server address yet, so show how to add one rather
  // than an empty dashboard with no explanation. The setup page itself must
  // stay reachable, otherwise there would be no way to fix it.
  const needsServer =
    isNativePlatform && isMissingServerUrl() && location.pathname !== '/server';

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="topbar__toggle"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="app-sidebar"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span aria-hidden="true">{isMenuOpen ? 'x' : '='}</span>
        </button>
        <span className="topbar__brand">DocExpire</span>
        <span className="topbar__user">{user?.name}</span>
      </header>

      {isMenuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`sidebar${isMenuOpen ? ' sidebar--open' : ''}`}
        id="app-sidebar"
        aria-label="Main navigation"
      >
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            D
          </span>
          <div>
            <p className="sidebar__name">DocExpire</p>
            <p className="sidebar__tagline">Document reminders</p>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/documents'}
              className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <p className="sidebar__user">
            {isNativePlatform ? 'Running on this device' : 'Signed in as'}{' '}
            <strong>{isNativePlatform ? 'DocExpire' : user?.name}</strong>
          </p>
          {isNativePlatform ? (
            <NavLink
              to="/server"
              className="btn btn--ghost btn--block"
              onClick={() => setIsMenuOpen(false)}
            >
              Server settings
            </NavLink>
          ) : (
            <button type="button" className="btn btn--ghost btn--block" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </aside>

      <main className="app-main">
        {needsServer ? (
          <section className="panel panel--accent">
            <div className="panel__header">
              <h2 className="panel__title">No server connected yet</h2>
            </div>
            <p className="panel__text">
              DocExpire keeps your documents on a DocExpire server. Add the server
              address to start using the app.
            </p>
            <div className="form__actions">
              <NavLink className="btn btn--primary" to="/server">
                Connect a server
              </NavLink>
            </div>
          </section>
        ) : provisionError ? (
          <section className="panel panel--accent">
            <div className="panel__header">
              <h2 className="panel__title">Could not reach DocExpire</h2>
            </div>
            <p className="panel__text">{provisionError}</p>
            <div className="form__actions">
              <button type="button" className="btn btn--primary" onClick={retryProvisioning}>
                Try again
              </button>
              {isNativePlatform ? (
                <NavLink className="btn btn--ghost" to="/server">
                  Change server
                </NavLink>
              ) : null}
            </div>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
