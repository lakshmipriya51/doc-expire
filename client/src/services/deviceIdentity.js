const IDENTITY_KEY = 'docexpire.device';

function randomSegment(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join('');
}

/**
 * A stable, anonymous identity for this installation.
 *
 * The Android app has no login or registration screen, but the API still needs
 * a bearer token and still isolates documents per account. So the app mints
 * itself an account on first launch and remembers the credentials. Each install
 * gets its own account, which means one phone never sees another phone's
 * documents - the ownership checks on the server keep working unchanged.
 *
 * This is deliberately not a shared or hardcoded account: if every install
 * signed in as the same user, every user of the APK would see the same
 * documents and uploaded files.
 */
export const deviceIdentity = {
  get() {
    try {
      const raw = window.localStorage.getItem(IDENTITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email && parsed?.password) return parsed;
      }
    } catch {
      // fall through and mint a new identity
    }

    const suffix = randomSegment(10);
    const identity = {
      name: 'DocExpire Device',
      email: `device-${suffix}@docexpire.app`,
      password: `Dv-${randomSegment(20)}-${randomSegment(6)}`,
    };

    try {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      // Private browsing with storage disabled: the identity simply will not
      // survive a restart, and a fresh account is minted next launch.
    }

    return identity;
  },

  clear() {
    window.localStorage.removeItem(IDENTITY_KEY);
  },
};

export default deviceIdentity;