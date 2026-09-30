import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import authService from '../services/authService';
import Alert from '../components/Alert';
import { hasErrors, validatePasswordForm, validateProfileForm } from '../utils/validation';
import { formatDate } from '../utils/date';
import { getInitials } from '../utils/status';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { showSuccess } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [nameErrors, setNameErrors] = useState({});
  const [nameFormError, setNameFormError] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordFormError, setPasswordFormError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleNameSubmit = async (event) => {
    event.preventDefault();
    setNameFormError('');

    const errors = validateProfileForm({ name });
    setNameErrors(errors);
    if (hasErrors(errors)) return;

    setIsSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      showSuccess('Your name has been updated.');
    } catch (error) {
      setNameFormError(error.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name: field, value } = event.target;
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: '' }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordFormError('');

    const errors = validatePasswordForm(passwordForm);
    setPasswordErrors(errors);
    if (hasErrors(errors)) return;

    setIsSavingPassword(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showSuccess('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordFormError(error.message);
      if (error.fieldErrors) setPasswordErrors((current) => ({ ...current, ...error.fieldErrors }));
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <div>
          <h1 className="page__title">Profile</h1>
          <p className="page__subtitle">Manage your account details and password.</p>
        </div>
      </header>

      <section className="panel">
        <div className="profile-header">
          <span className="profile-header__avatar" aria-hidden="true">
            {getInitials(user?.name || '')}
          </span>
          <div>
            <p className="profile-header__name">{user?.name}</p>
            <p className="profile-header__email">{user?.email}</p>
            {user?.createdAt ? (
              <p className="profile-header__since">Member since {formatDate(user.createdAt)}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Update your name</h2>
        </div>
        {nameFormError ? <Alert tone="error">{nameFormError}</Alert> : null}
        <form className="form" onSubmit={handleNameSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="profile-name">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              className="field__input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameErrors((current) => ({ ...current, name: '' }));
              }}
              aria-invalid={Boolean(nameErrors.name)}
            />
            {nameErrors.name ? <p className="field__error">{nameErrors.name}</p> : null}
          </div>

          <div className="form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSavingName || name.trim() === user?.name}
            >
              {isSavingName ? 'Saving...' : 'Save name'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Change password</h2>
        </div>
        {passwordFormError ? <Alert tone="error">{passwordFormError}</Alert> : null}
        <form className="form" onSubmit={handlePasswordSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              className="field__input"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              aria-invalid={Boolean(passwordErrors.currentPassword)}
            />
            {passwordErrors.currentPassword ? (
              <p className="field__error">{passwordErrors.currentPassword}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="field__input"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              aria-invalid={Boolean(passwordErrors.newPassword)}
            />
            {passwordErrors.newPassword ? (
              <p className="field__error">{passwordErrors.newPassword}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="field__input"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              aria-invalid={Boolean(passwordErrors.confirmPassword)}
            />
            {passwordErrors.confirmPassword ? (
              <p className="field__error">{passwordErrors.confirmPassword}</p>
            ) : null}
          </div>

          <div className="form__actions">
            <button type="submit" className="btn btn--primary" disabled={isSavingPassword}>
              {isSavingPassword ? 'Updating...' : 'Change password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
