import { STATUS } from './constants';
import { humaniseRemaining } from './date';

/** Single source of truth for status wording and colours, shared by the UI. */
export const STATUS_META = {
  [STATUS.ACTIVE]: { label: 'Active', className: 'badge badge--success' },
  [STATUS.EXPIRING_SOON]: { label: 'Expiring Soon', className: 'badge badge--warning' },
  [STATUS.EXPIRED]: { label: 'Expired', className: 'badge badge--danger' },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || { label: 'Unknown', className: 'badge' };
}

export function getStatusLabel(status) {
  return getStatusMeta(status).label;
}

export function getRemainingLabel(days) {
  return humaniseRemaining(days);
}

export function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Notification icons per reminder type, kept as text so no icon library is needed. */
export const NOTIFICATION_META = {
  REMINDER: { icon: '!', className: 'notification--warning' },
  EXPIRY_TODAY: { icon: '!', className: 'notification--warning' },
  EXPIRED: { icon: 'x', className: 'notification--danger' },
};
