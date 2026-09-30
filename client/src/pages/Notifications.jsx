import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/date';
import { NOTIFICATION_META } from '../utils/status';

export default function Notifications() {
  const { showError } = useToast();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(await notificationService.list());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAsRead = async (notificationId) => {
    setBusyId(notificationId);
    try {
      const result = await notificationService.markAsRead(notificationId);
      setData((current) => ({
        notifications: current.notifications.map((item) =>
          item.id === notificationId ? { ...item, isRead: true } : item,
        ),
        unreadCount: result.unreadCount,
      }));
    } catch (markError) {
      showError(markError.message);
    } finally {
      setBusyId('');
    }
  };

  const handleMarkAllAsRead = async () => {
    setBusyId('all');
    try {
      await notificationService.markAllAsRead();
      await load();
    } catch (markAllError) {
      showError(markAllError.message);
    } finally {
      setBusyId('');
    }
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <div>
          <h1 className="page__title">Notifications</h1>
          <p className="page__subtitle">
            Reminders appear 30, 15, 7 and 1 day before a document expires, and again once it has
            expired.
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleMarkAllAsRead}
            disabled={busyId === 'all'}
          >
            {busyId === 'all' ? 'Marking...' : 'Mark all as read'}
          </button>
        ) : null}
      </header>

      {error ? (
        <Alert tone="error" title="Could not load notifications">
          {error}
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            Try again
          </button>
        </Alert>
      ) : null}

      {isLoading ? <Spinner label="Loading notifications..." /> : null}

      {!isLoading && !error ? (
        notifications.length === 0 ? (
          <EmptyState
            title="Nothing to worry about"
            description="When a document is close to expiry, its reminder will appear here."
            action={
              <Link className="btn btn--primary" to="/documents">
                Go to documents
              </Link>
            }
          />
        ) : (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const meta = NOTIFICATION_META[notification.type] || NOTIFICATION_META.REMINDER;
              return (
                <li
                  key={notification.id}
                  className={`notification ${meta.className}${notification.isRead ? ' notification--read' : ''}`}
                >
                  <span className="notification__icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <div className="notification__body">
                    <p className="notification__message">{notification.message}</p>
                    <p className="notification__meta">
                      {notification.isRead ? 'Read' : 'New'} &middot; expires{' '}
                      {formatDate(notification.expiryDate)}
                    </p>
                    <Link
                      className="notification__link"
                      to={`/documents/${notification.documentId}`}
                    >
                      View document
                    </Link>
                  </div>
                  {!notification.isRead ? (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={busyId === notification.id}
                    >
                      {busyId === notification.id ? 'Saving...' : 'Mark as read'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
