import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_MB } from './constants';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]*$/;

/** Mirrors the server rules so users get instant feedback. */
export const passwordRuleText = 'At least 8 characters, including a letter and a number.';

export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required.';
  if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address.';
  return '';
}

export function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < 8) return passwordRuleText;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return passwordRuleText;
  return '';
}

export function validateRequired(value, label) {
  if (!value || !String(value).trim()) return `${label} is required.`;
  return '';
}

export function validateDocumentForm(values) {
  const errors = {};

  const nameError = validateRequired(values.documentName, 'Document name');
  if (nameError) errors.documentName = nameError;
  else if (values.documentName.trim().length > 80) {
    errors.documentName = 'Document name must be at most 80 characters.';
  }

  if (!values.documentType) errors.documentType = 'Document type is required.';

  const numberError = validateRequired(values.documentNumber, 'Document number');
  if (numberError) errors.documentNumber = numberError;
  else if (!DOCUMENT_NUMBER_PATTERN.test(values.documentNumber.trim())) {
    errors.documentNumber = 'Use letters, numbers, spaces, - or / only.';
  } else if (values.documentNumber.trim().length > 40) {
    errors.documentNumber = 'Document number must be at most 40 characters.';
  }

  if (!values.issueDate) {
    errors.issueDate = 'Issue date is required.';
  }
  if (!values.expiryDate) {
    errors.expiryDate = 'Expiry date is required.';
  }

  if (values.issueDate && values.expiryDate) {
    if (values.expiryDate < values.issueDate) {
      errors.expiryDate = 'Expiry date cannot be earlier than the issue date.';
    }
  }

  if (values.description && values.description.length > 500) {
    errors.description = 'Description must be at most 500 characters.';
  }

  return errors;
}

export function validateFile(file) {
  if (!file) return '';
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'Only PDF, JPG, JPEG and PNG files are allowed.';
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `File is too large. Maximum size is ${MAX_UPLOAD_MB} MB.`;
  }
  return '';
}

export function validateProfileForm(values) {
  const errors = {};
  const nameError = validateRequired(values.name, 'Name');
  if (nameError) errors.name = nameError;
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  else if (values.name.trim().length > 60) errors.name = 'Name must be at most 60 characters.';
  return errors;
}

export function validatePasswordForm(values) {
  const errors = {};
  if (!values.currentPassword) errors.currentPassword = 'Current password is required.';

  const newPasswordError = validatePassword(values.newPassword);
  if (newPasswordError) errors.newPassword = newPasswordError;
  else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'New password must be different from the current password.';
  }

  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your new password.';
  else if (values.newPassword && values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors || {}).length > 0;
}
