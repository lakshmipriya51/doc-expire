import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, setApiBaseUrl } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

/**
 * Lets an installed APK be pointed at a real DocExpire server from the phone.
 *
 * Because the app ships without a login screen, a build with no backend baked
 * in would otherwise open onto an empty dashboard with no obvious way out.
 * Saving an address here retries the device session immediately, so the same
 * signed APK works against a freshly deployed backend without being rebuilt.
 */
export default function ServerSetup() {
  const navigate = useNavigate();
  const { retryProvisioning } = useAuth();
  const [url, setUrl] = useState(() => getApiBaseUrl());
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const clean = url.trim().replace(/\/+$/, '');

    if (!/^https?:\/\/.+/i.test(clean)) {
      setError('Enter the full address, including https://');
      return;
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(clean)) {
      setError('A phone cannot reach your computer. Use the address of your deployed server.');
      return;
    }

    setError('');
    setApiBaseUrl(clean);
    retryProvisioning();
    navigate('/', { replace: true });
  };

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Connect to a server</h1>
        <p className="page__subtitle">
          DocExpire keeps your documents on a DocExpire server. Enter its address to
          continue.
        </p>
      </header>

      <section className="panel">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="server-url">
              Server address
            </label>
            <input
              id="server-url"
              type="url"
              className="field__input"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="https://your-docexpire-server.onrender.com"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError('');
              }}
              aria-invalid={Boolean(error)}
            />
            <p className="field__hint">
              This is saved on this device only. It is the address of the server, without
              a trailing /api.
            </p>
          </div>

          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              Connect
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}