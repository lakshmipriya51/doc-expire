'use strict';

/**
 * Runs the API and the Vite dev server together with one command.
 * Ctrl+C stops both. Output from each process is prefixed for readability.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const targets = [
  { name: 'server', cwd: path.join(ROOT, 'server'), args: ['run', 'dev'], colour: '[36m' },
  { name: 'client', cwd: path.join(ROOT, 'client'), args: ['run', 'dev'], colour: '[35m' },
];

const RESET = '[0m';
const children = [];
let shuttingDown = false;

function prefix(name, colour, chunk) {
  const text = chunk.toString();
  return text
    .split('\n')
    .filter((line, index, lines) => line.trim() !== '' || index < lines.length - 1)
    .map((line) => `${colour}[${name}]${RESET} ${line}`)
    .join('\n');
}

function start(target) {
  const child = spawn('npm', target.args, {
    cwd: target.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout.on('data', (chunk) => console.log(prefix(target.name, target.colour, chunk)));
  child.stderr.on('data', (chunk) => console.error(prefix(target.name, target.colour, chunk)));

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`${target.colour}[${target.name}]${RESET} exited with code ${code}.`);
    shutdown(code ?? 0);
  });

  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('DocExpire dev - starting API and client. Press Ctrl+C to stop both.');
targets.forEach(start);
