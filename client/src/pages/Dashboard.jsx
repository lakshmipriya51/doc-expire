import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/date';
import { getInitials } from '../utils/status';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(await dashboardService.getStats());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const stats = data?.stats;
  const upcoming = data?.upcomingExpiry || [];

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">
            {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="page__subtitle">Here is how your documents are doing.</p>
        </div>
        <Link className="btn btn--primary" to="/documents/new">
          Add Document
        </Link>
      </header>

      {error ? (
        <Alert tone="error" title="Could not load your dashboard">
          {error}
          <button type="button" className="btn btn--sm btn--ghost" onClick={loadStats}>
            Try again
          </button>
        </Alert>
      ) : null}

      {isLoading ? <Spinner label="Loading your documents..." /> : null}

      {stats ? (
        <>
          <section className="stat-grid" aria-label="Document statistics">
            <StatCard label="Total Documents" value={stats.totalDocuments} tone="primary" />
            <StatCard label="Active" value={stats.activeDocuments} tone="success" />
            <StatCard label="Expiring Soon" value={stats.expiringSoon} tone="warning" />
            <StatCard label="Expired" value={stats.expiredDocuments} tone="danger" />
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Upcoming Expiries</h2>
              <Link className="btn btn--sm btn--ghost" to="/documents?sort=expiry-asc">
                View all
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="Add your first document and DocExpire will start tracking it for you."
                action={
                  <Link className="btn btn--primary" to="/documents/new">
                    Add your first document
                  </Link>
                }
              />
            ) : (
              <ul className="expiry-list">
                {upcoming.map((item) => (
                  <li className="expiry-list__item" key={item.id}>
                    <div className="expiry-list__info">
                      <Link className="expiry-list__name" to={`/documents/${item.id}`}>
                        {item.documentName}
                      </Link>
                      <p className="expiry-list__meta">
                        {item.documentType} &middot; expires {formatDate(item.expiryDate)}
                      </p>
                    </div>
                    <div className="expiry-list__status">
                      <StatusBadge status={item.status} />
                      <span className={`expiry-list__remaining expiry-list__remaining--${item.status.toLowerCase()}`}>
                        {item.remainingLabel}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.unreadNotifications > 0 ? (
            <section className="panel panel--accent">
              <div className="panel__body panel__body--row">
                <div>
                  <h2 className="panel__title">
                    You have {data.unreadNotifications} unread reminder
                    {data.unreadNotifications === 1 ? '' : 's'}
                  </h2>
                  <p className="panel__text">Check what needs your attention soon.</p>
                </div>
                <div className="panel__actions">
                  <Link className="btn btn--primary" to="/notifications">
                    View notifications
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Your account</h2>
            </div>
            <div className="profile-summary">
              <span className="profile-summary__avatar" aria-hidden="true">
                {getInitials(user?.name || '')}
              </span>
              <div>
                <p className="profile-summary__name">{user?.name}</p>
                <p className="profile-summary__email">{user?.email}</p>
              </div>
              <Link className="btn btn--sm btn--ghost" to="/profile">
                Manage profile
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
