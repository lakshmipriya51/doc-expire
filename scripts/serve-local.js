'use strict';

/**
 * Serves the whole DocExpire app (API + web client) on a fixed port.
 *
 * This is the "permanent localhost": the same command always produces the same
 * address, regardless of how many other apps are running.
 *
 *   npm run serve:local
 *
 * It builds the client if needed, then starts the API on LOCAL_PORT.
 * Pair it with `npm run service:install` to have macOS start it automatically at
 * login.
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync, spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIST = path.join(CLIENT_DIR, 'dist');
const ENV_FILE = path.join(SERVER_DIR, '.env');

const DEFAULT_PORT = 5050;

function localPort() {
  // Read the .env by hand so dotenv stays inside the server process, which
  // needs to keep ownership of its own configuration.
  if (!fs.existsSync(ENV_FILE)) return DEFAULT_PORT;

  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const match = line.match(/^\s*LOCAL_PORT\s*=\s*(\d+)\s*$/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return DEFAULT_PORT;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: ROOT,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildClientIfNeeded({ force }) {
  const built = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

  // In the deployed runtime copy only client/dist is shipped, because that is
  // all the server ever reads. Building is only possible from the source tree.
  const canBuild = fs.existsSync(path.join(CLIENT_DIR, 'package.json'));

  if (built && !force) {
    console.log('[serve-local] Using the existing client build.');
    return;
  }

  if (!canBuild) {
    if (built) {
      console.log('[serve-local] Using the existing client build.');
      return;
    }
    console.error(`[serve-local] No client build found at ${CLIENT_DIST}.`);
    console.error('[serve-local] Run "npm run build" in the project first.');
    process.exit(1);
  }

  console.log('[serve-local] Building the client...');
  run('npm', ['run', 'build', '--prefix', CLIENT_DIR]);
}

function main() {
  const force = process.argv.includes('--rebuild');
  buildClientIfNeeded({ force });

  const port = localPort();
  console.log(`[serve-local] Starting DocExpire on http://localhost:${port}`);
  console.log(`[serve-local] Phones on the same wifi can reach it at http://<your-lan-ip>:${port}`);

  const child = spawn('npm', ['start', '--prefix', SERVER_DIR], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  const stop = (signal) => {
    console.log(`\n[serve-local] ${signal} received, stopping.`);
    child.kill(signal);
  };

  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  child.on('exit', (code, signal) => {
    process.exit(signal ? 0 : (code ?? 0));
  });
}

main();