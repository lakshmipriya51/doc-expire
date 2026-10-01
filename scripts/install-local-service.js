'use strict';

/**
 * Installs DocExpire as a macOS background service so the app is always
 * available at the same fixed address, without opening a terminal.
 *
 *   npm run service:install     # deploy, start automatically at login
 *   npm run service:uninstall   # remove it again
 *
 * It registers a LaunchAgent, which is the right tool for a per-user app: it
 * starts at login, restarts if the process dies, and does not need root.
 * On Linux the equivalent would be a systemd user unit.
 *
 * Why a copy is deployed instead of running from the project folder:
 * this project usually lives in a cloud-synced folder (iCloud, Drive,
 * Dropbox). Those folders are network filesystems, and they fail reads
 * intermittently with EAGAIN. Node turns that into
 * "Cannot find module ..." while starting, so the service crash-looped
 * there. The runtime copy lives on the local disk in
 * ~/Library/Application Support/DocExpire, which is not synced and is
 * always fast.
 *
 * Re-running this command redeploys the current code and restarts the
 * service, so it doubles as the update command.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LABEL = 'dev.docexpire.server';
const PLIST_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = path.join(PLIST_DIR, `${LABEL}.plist`);

// Must stay out of any synced folder. Application Support is local.
const RUNTIME_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'DocExpire');
const RUNTIME_SERVER = path.join(RUNTIME_DIR, 'server');
const RUNTIME_LOGS = path.join(RUNTIME_DIR, 'logs');

const SOURCE_SERVER = path.join(ROOT, 'server');
const SOURCE_CLIENT_DIST = path.join(ROOT, 'client', 'dist');

// LaunchAgent environments have a minimal PATH, so the directory holding the
// Node that installed this project has to be added explicitly. Without it a
// version manager such as nvm is bypassed, launchd picks up a different Node,
// and the project fails to resolve its own dependencies.
const NODE_DIR = path.dirname(process.execPath);

function isMac() {
  return process.platform === 'darwin';
}

function ensureBuilt() {
  if (fs.existsSync(path.join(SOURCE_CLIENT_DIST, 'index.html'))) return true;

  console.log('[service] No client build found, building it once...');
  const result = spawnSync('npm', ['run', 'build', '--prefix', path.join(ROOT, 'client')], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  return result.status === 0;
}

function ensureEnv(targetServerDir) {
  const envPath = path.join(targetServerDir, '.env');
  if (fs.existsSync(envPath)) return;

  const sourceEnv = path.join(SOURCE_SERVER, '.env');
  if (fs.existsSync(sourceEnv)) {
    fs.copyFileSync(sourceEnv, envPath);
    console.log('[service] Copied your existing server/.env into the runtime copy.');
    return;
  }

  const template = path.join(SOURCE_SERVER, '.env.example');
  if (!fs.existsSync(template)) return;

  // A generated secret means the service can start even if .env was never set
  // up, instead of silently failing on every boot.
  const secret = spawnSync(
    process.execPath,
    ['-e', "console.log(require('crypto').randomBytes(48).toString('hex'))"],
    { encoding: 'utf8' },
  ).stdout.trim();

  const contents = fs
    .readFileSync(template, 'utf8')
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);

  fs.writeFileSync(envPath, contents);
  console.log('[service] Created a server/.env with a generated JWT secret.');
}

// Copies the server without the parts that only matter for development.
// node_modules is excluded because installing it fresh on local disk is far
// faster and more reliable than reading it back off the synced folder.
function copyServer() {
  const excluded = new Set(['node_modules', 'uploads', 'tests', '.env', 'logs']);
  fs.cpSync(SOURCE_SERVER, RUNTIME_SERVER, {
    recursive: true,
    force: true,
    filter: (source) => !excluded.has(path.basename(source)),
  });
}

function installServerDependencies() {
  // Fast path: already installed in the runtime copy.
  if (fs.existsSync(path.join(RUNTIME_SERVER, 'node_modules', 'express'))) {
    console.log('[service] Runtime dependencies already installed.');
    return true;
  }

  console.log('[service] Installing runtime dependencies (first run only)...');
  const result = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    stdio: 'inherit',
    cwd: RUNTIME_SERVER,
  });
  return result.status === 0;
}

function deploy() {
  console.log(`[service] Deploying to ${RUNTIME_DIR}`);
  fs.mkdirSync(RUNTIME_LOGS, { recursive: true });

  copyServer();

  // The built client is what the service serves, so it travels with the copy.
  const runtimeClientDist = path.join(RUNTIME_DIR, 'client', 'dist');
  fs.rmSync(runtimeClientDist, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(runtimeClientDist), { recursive: true });
  fs.cpSync(SOURCE_CLIENT_DIST, runtimeClientDist, { recursive: true, force: true });

  // serve-local.js resolves paths relative to its own location, so copying it
  // into the runtime root keeps the same layout it expects.
  fs.mkdirSync(path.join(RUNTIME_DIR, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'serve-local.js'), path.join(RUNTIME_DIR, 'scripts', 'serve-local.js'));

  ensureEnv(RUNTIME_SERVER);
  return installServerDependencies();
}

function buildPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${path.join(RUNTIME_DIR, 'scripts', 'serve-local.js')}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${RUNTIME_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${NODE_DIR}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>StandardOutPath</key>
  <string>${path.join(RUNTIME_LOGS, 'service.out.log')}</string>

  <key>StandardErrorPath</key>
  <string>${path.join(RUNTIME_LOGS, 'service.err.log')}</string>
</dict>
</plist>
`;
}

function launchctl(...args) {
  const result = spawnSync('launchctl', args, { stdio: 'inherit' });
  return result.status === 0;
}

function main() {
  if (!isMac()) {
    console.error(
      '[service] Automatic start is only set up for macOS here.\n' +
        `          On ${process.platform}, run "npm run serve:local" yourself.`,
    );
    process.exit(1);
  }

  if (process.argv.includes('--uninstall')) {
    launchctl('bootout', `gui/${os.userInfo().uid}/${LABEL}`);
    if (fs.existsSync(PLIST_PATH)) fs.unlinkSync(PLIST_PATH);
    console.log('[service] DocExpire has been removed from background services.');

    if (process.argv.includes('--purge')) {
      fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
      console.log('[service] The deployed runtime copy has been deleted.');
    } else {
      console.log(`[service] The deployed copy is still in ${RUNTIME_DIR}`);
      console.log('[service] Delete it with: npm run service:uninstall -- --purge');
    }
    return;
  }

  if (!ensureBuilt()) {
    console.error('[service] Client build failed, aborting install.');
    process.exit(1);
  }

  if (!deploy()) {
    console.error('[service] Dependency install failed, aborting install.');
    process.exit(1);
  }

  fs.mkdirSync(PLIST_DIR, { recursive: true });
  fs.writeFileSync(PLIST_PATH, buildPlist());

  // bootout first so re-running the installer replaces the service cleanly.
  launchctl('bootout', `gui/${os.userInfo().uid}/${LABEL}`);

  if (!launchctl('bootstrap', `gui/${os.userInfo().uid}`, PLIST_PATH)) {
    console.error(`[service] Could not start the service. Try: launchctl bootstrap gui/${os.userInfo().uid} ${PLIST_PATH}`);
    process.exit(1);
  }

  console.log('[service] DocExpire is installed and starts automatically at login.');
  console.log('[service] App:  http://localhost:5050');
  console.log(`[service] Logs: ${path.join(RUNTIME_LOGS, 'service.out.log')}`);
  console.log(`[service]       ${path.join(RUNTIME_LOGS, 'service.err.log')}`);
  console.log('[service] Update it after code changes with: npm run service:install');
  console.log('[service] Stop it with: npm run service:uninstall');
}

main();