import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { user, logout } = useAuth();
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
            Signed in as <strong>{user?.name}</strong>
          </p>
          <button type="button" className="btn btn--ghost btn--block" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
