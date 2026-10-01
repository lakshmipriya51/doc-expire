'use strict';

/**
 * Removes the macOS background service installed by
 * `npm run service:install`.
 *
 * The installer and the uninstaller share one implementation; this wrapper just
 * passes the flag so uninstalling can never re-create the service on the way
 * out.
 *
 *   npm run service:uninstall              # keep the deployed copy
 *   npm run service:uninstall -- --purge   # also delete the deployed copy
 */

for (const arg of process.argv.slice(2)) {
  process.argv.push(arg);
}
process.argv.push('--uninstall');
require('./install-local-service.js');
