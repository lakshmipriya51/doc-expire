export const DOCUMENT_TYPES = [
  'Aadhaar',
  'PAN',
  'Passport',
  'Driving License',
  'Vehicle RC',
  'Insurance',
  'College ID',
  'Other',
];

export const STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
};

export const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring-soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];

export const SORT_OPTIONS = [
  { value: 'expiry-asc', label: 'Expiry date (soonest first)' },
  { value: 'expiry-desc', label: 'Expiry date (latest first)' },
  { value: 'newest', label: 'Recently added' },
  { value: 'oldest', label: 'Oldest first' },
];

export const REMINDER_LEVELS = [30, 15, 7, 1];

export const MAX_UPLOAD_MB = 5;

export const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png';
export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
