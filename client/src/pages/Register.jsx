import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../components/AuthLayout';
import Alert from '../components/Alert';
import {
  hasErrors,
  passwordRuleText,
  validateEmail,
  validatePassword,
  validateRequired,
} from '../utils/validation';

export default function Register() {
  const { register } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {
      name: validateRequired(form.name, 'Name'),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirmPassword: '',
    };

    if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';

    if (errors.name === '' && form.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const errors = validateForm();
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setIsSubmitting(true);
    try {
      const user = await register(form);
      showSuccess(`Account created. Welcome, ${user.name}.`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(error.message);
      if (error.fieldErrors) setFieldErrors((current) => ({ ...current, ...error.fieldErrors }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking your documents in under a minute."
      footer={
        <>
          Already registered? <Link to="/login">Login instead</Link>
        </>
      }
    >
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="field__input"
            autoComplete="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? <p className="field__error">{fieldErrors.name}</p> : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field__input"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <p className="field__error">{fieldErrors.email}</p> : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field__input"
            autoComplete="new-password"
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <p className="field__hint">{passwordRuleText}</p>
          {fieldErrors.password ? <p className="field__error">{fieldErrors.password}</p> : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="field__input"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
          />
          {fieldErrors.confirmPassword ? (
            <p className="field__error">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
