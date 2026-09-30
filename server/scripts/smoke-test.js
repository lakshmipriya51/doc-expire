'use strict';

/**
 * End-to-end smoke test against a REAL http server + REAL in-memory MongoDB.
 * Uses only built-in node modules so it can run without extra installs.
 */

const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'smoke-test-secret-not-for-production-use';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.PORT = '5099';

const { MongoMemoryServer } = require(path.join(__dirname, '..', 'node_modules', 'mongodb-memory-server'));
const { connectDatabase } = require(path.join(__dirname, '..', 'config', 'db'));
const createApp = require(path.join(__dirname, '..', 'app'));

const BASE = 'http://127.0.0.1:5099';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

async function req(method, endpoint, { token, body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };
  if (token) options.headers.Authorization = `Bearer ${token}`;

  if (body instanceof FormData) {
    options.body = body;
  } else if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${endpoint}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json, text, headers: response.headers };
}

function dateOnly(offsetDays) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today + offsetDays * 86400000).toISOString().slice(0, 10);
}

function docPayload(overrides = {}) {
  const merged = {
    documentName: 'Passport',
    documentType: 'Passport',
    issueDate: dateOnly(-365),
    expiryDate: dateOnly(400),
    description: 'Smoke test document',
    ...overrides,
  };

  // Give every document its own number, otherwise searching by number matches
  // all of them and the assertion cannot tell documents apart.
  if (!overrides.documentNumber) {
    merged.documentNumber = `NUM-${merged.documentName.replace(/[^A-Za-z0-9]+/g, '-')}`;
  }

  return merged;
}

async function main() {
  const memoryServer = await MongoMemoryServer.create();
  await connectDatabase(memoryServer.getUri('smoke'));
  const app = createApp();

  const server = await new Promise((resolve) => {
    const instance = app.listen(5099, '127.0.0.1', () => resolve(instance));
  });

  console.log('\nDocExpire end-to-end smoke test (real HTTP + real MongoDB)\n');

  let token = '';
  let documentId = '';
  let otherToken = '';

  await check('GET /api/health returns ok + connected database', async () => {
    const res = await req('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.data.database, 'connected');
  });

  await check('POST /api/auth/register returns 201 and a JWT', async () => {
    const res = await req('POST', '/api/auth/register', {
      body: {
        name: 'Smoke Tester',
        email: 'smoke@example.com',
        password: 'Passw0rd123',
        confirmPassword: 'Passw0rd123',
      },
    });
    assert.equal(res.status, 201, `got ${res.status}: ${res.text}`);
    assert.equal(res.body.data.token.split('.').length, 3);
    assert.equal(res.body.data.user.password, undefined);
    token = res.body.data.token;
  });

  await check('POST /api/auth/register rejects a weak password', async () => {
    const res = await req('POST', '/api/auth/register', {
      body: { name: 'Weak', email: 'weak@example.com', password: 'abc', confirmPassword: 'abc' },
    });
    assert.equal(res.status, 400);
  });

  await check('POST /api/auth/login succeeds with correct credentials', async () => {
    const res = await req('POST', '/api/auth/login', {
      body: { email: 'smoke@example.com', password: 'Passw0rd123' },
    });
    assert.equal(res.status, 200, `got ${res.status}: ${res.text}`);
    assert.ok(res.body.data.token);
  });

  await check('POST /api/auth/login fails with a wrong password', async () => {
    const res = await req('POST', '/api/auth/login', {
      body: { email: 'smoke@example.com', password: 'WrongPass123' },
    });
    assert.equal(res.status, 401);
  });

  await check('GET /api/documents without a token returns 401', async () => {
    const res = await req('GET', '/api/documents');
    assert.equal(res.status, 401);
  });

  await check('GET /api/auth/profile returns the signed-in user', async () => {
    const res = await req('GET', '/api/auth/profile', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, 'smoke@example.com');
  });

  await check('POST /api/documents creates a document (json)', async () => {
    const res = await req('POST', '/api/documents', { token, body: docPayload() });
    assert.equal(res.status, 201, `got ${res.status}: ${res.text}`);
    assert.equal(res.body.data.document.status, 'ACTIVE');
    assert.equal(res.body.data.document.daysRemaining, 400);
    documentId = res.body.data.document.id;
  });

  await check('POST /api/documents rejects expiry before issue date', async () => {
    const res = await req('POST', '/api/documents', {
      token,
      body: docPayload({ issueDate: dateOnly(50), expiryDate: dateOnly(10) }),
    });
    assert.equal(res.status, 400);
  });

  await check('POST /api/documents uploads a real PDF file', async () => {
    const form = new FormData();
    Object.entries(docPayload({ documentName: 'Insurance Policy', documentType: 'Insurance' })).forEach(
      ([key, value]) => form.append(key, value),
    );
    form.append(
      'documentFile',
      new Blob([Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF\n')], { type: 'application/pdf' }),
      'policy.pdf',
    );

    const res = await req('POST', '/api/documents', { token, body: form });
    assert.equal(res.status, 201, `got ${res.status}: ${res.text}`);
    assert.equal(res.body.data.document.documentFile.originalName, 'policy.pdf');
    assert.equal(res.body.data.document.documentFile.mimeType, 'application/pdf');
  });

  await check('POST /api/documents rejects a .txt upload', async () => {
    const form = new FormData();
    Object.entries(docPayload()).forEach(([key, value]) => form.append(key, value));
    form.append('documentFile', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');

    const res = await req('POST', '/api/documents', { token, body: form });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /only pdf/i);
  });

  await check('GET /api/documents/:id/file streams the stored PDF', async () => {
    const list = await req('GET', '/api/documents?search=Insurance', { token });
    const withFile = list.body.data.documents.find((item) => item.documentFile);
    assert.ok(withFile, 'expected a document with a file');

    const res = await fetch(`${BASE}/api/documents/${withFile.id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /inline/);
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.ok(buffer.includes(Buffer.from('%%EOF')), 'the PDF bytes came back intact');
  });

  await check('GET /api/documents/:id/download sets attachment disposition', async () => {
    const list = await req('GET', '/api/documents?search=Insurance', { token });
    const withFile = list.body.data.documents.find((item) => item.documentFile);

    const res = await fetch(`${BASE}/api/documents/${withFile.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="policy.pdf"/);
    await res.arrayBuffer();
  });

  await check('file access without a token returns 401', async () => {
    const res = await fetch(`${BASE}/api/documents/${documentId}/file`);
    assert.equal(res.status, 401);
  });

  await check('search matches by name, number and type', async () => {
    const byName = await req('GET', '/api/documents?search=Passport', { token });
    assert.equal(byName.body.data.documents.length, 1);
    assert.equal(byName.body.data.documents[0].documentName, 'Passport');

    const byNumber = await req('GET', '/api/documents?search=NUM-Insurance-Policy', { token });
    assert.equal(byNumber.body.data.documents.length, 1);
    // Document numbers are normalised to uppercase so they stay comparable.
    assert.equal(byNumber.body.data.documents[0].documentNumber, 'NUM-INSURANCE-POLICY');

    const byType = await req('GET', '/api/documents?search=Insurance', { token });
    assert.equal(byType.body.data.documents.length, 1);
    assert.equal(byType.body.data.documents[0].documentType, 'Insurance');

    const none = await req('GET', '/api/documents?search=zzzznope', { token });
    assert.equal(none.body.data.documents.length, 0);
  });

  await check('filter by status splits active / expiring / expired', async () => {
    await req('POST', '/api/documents', {
      token,
      body: docPayload({ documentName: 'Soon Doc', expiryDate: dateOnly(9) }),
    });
    await req('POST', '/api/documents', {
      token,
      body: docPayload({ documentName: 'Old Doc', issueDate: dateOnly(-900), expiryDate: dateOnly(-20) }),
    });

    // The passport and the uploaded insurance policy are both well over the
    // 30 day window, so "active" is expected to contain exactly those two.
    const active = await req('GET', '/api/documents?status=active', { token });
    assert.deepEqual(
      active.body.data.documents.map((item) => item.documentName).sort(),
      ['Insurance Policy', 'Passport'],
    );

    const soon = await req('GET', '/api/documents?status=expiring-soon', { token });
    assert.equal(soon.body.data.documents.length, 1);
    assert.equal(soon.body.data.documents[0].status, 'EXPIRING_SOON');
    assert.equal(soon.body.data.documents[0].documentName, 'Soon Doc');

    const expired = await req('GET', '/api/documents?status=expired', { token });
    assert.equal(expired.body.data.documents.length, 1);
    assert.equal(expired.body.data.documents[0].daysRemaining, -20);
    assert.equal(expired.body.data.documents[0].documentName, 'Old Doc');
  });

  await check('sort by expiry ascending puts the nearest deadline first', async () => {
    const res = await req('GET', '/api/documents?sort=expiry-asc', { token });
    const days = res.body.data.documents.map((item) => item.daysRemaining);
    const sorted = [...days].sort((a, b) => a - b);
    assert.deepEqual(days, sorted);
  });

  await check('PUT /api/documents/:id updates the document', async () => {
    const res = await req('PUT', `/api/documents/${documentId}`, {
      token,
      body: docPayload({ documentName: 'Passport (Renewed)', expiryDate: dateOnly(5000) }),
    });
    assert.equal(res.status, 200, `got ${res.status}: ${res.text}`);
    assert.equal(res.body.data.document.documentName, 'Passport (Renewed)');
  });

  await check('dashboard stats count every status', async () => {
    const res = await req('GET', '/api/dashboard/stats', { token });
    assert.equal(res.status, 200);
    const { stats } = res.body.data;
    assert.equal(stats.totalDocuments, 4);
    assert.equal(stats.expiringSoon, 1);
    assert.equal(stats.expiredDocuments, 1);
    assert.equal(stats.activeDocuments, 2);
    assert.equal(res.body.data.upcomingExpiry[0].status, 'EXPIRED');
  });

  await check('notifications are generated at the 9 and expiry-day windows', async () => {
    const res = await req('GET', '/api/notifications', { token });
    assert.equal(res.status, 200);
    const messages = res.body.data.notifications.map((item) => item.message);
    assert.ok(messages.some((m) => m.includes('has expired')), `messages: ${messages.join(' | ')}`);
    assert.ok(res.body.data.unreadCount >= 1);
  });

  await check('notifications can be marked as read and as all read', async () => {
    const list = await req('GET', '/api/notifications', { token });
    const id = list.body.data.notifications[0].id;

    const one = await req('PUT', `/api/notifications/${id}/read`, { token });
    assert.equal(one.status, 200);
    assert.equal(one.body.data.notification.isRead, true);

    const all = await req('PUT', '/api/notifications/read-all', { token });
    assert.equal(all.status, 200);

    const after = await req('GET', '/api/notifications', { token });
    assert.equal(after.body.data.unreadCount, 0);
  });

  await check('a second user cannot read the first user document', async () => {
    const reg = await req('POST', '/api/auth/register', {
      body: {
        name: 'Other Person',
        email: 'other@example.com',
        password: 'Passw0rd123',
        confirmPassword: 'Passw0rd123',
      },
    });
    otherToken = reg.body.data.token;

    const read = await req('GET', `/api/documents/${documentId}`, { token: otherToken });
    assert.equal(read.status, 404);

    const remove = await req('DELETE', `/api/documents/${documentId}`, { token: otherToken });
    assert.equal(remove.status, 404);

    const list = await req('GET', '/api/documents', { token: otherToken });
    assert.equal(list.body.data.documents.length, 0, 'the other user sees none of these documents');

    const stillThere = await req('GET', `/api/documents/${documentId}`, { token });
    assert.equal(stillThere.status, 200, 'the original document survived the attack');
  });

  await check('PUT /api/auth/profile updates the name', async () => {
    const res = await req('PUT', '/api/auth/profile', { token, body: { name: 'Renamed Tester' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.name, 'Renamed Tester');
  });

  await check('PUT /api/auth/password requires the current password', async () => {
    const wrong = await req('PUT', '/api/auth/password', {
      token,
      body: { currentPassword: 'NotIt12345', newPassword: 'BrandNew123' },
    });
    assert.equal(wrong.status, 401);

    const right = await req('PUT', '/api/auth/password', {
      token,
      body: { currentPassword: 'Passw0rd123', newPassword: 'BrandNew123' },
    });
    assert.equal(right.status, 200);

    const relogin = await req('POST', '/api/auth/login', {
      body: { email: 'smoke@example.com', password: 'BrandNew123' },
    });
    assert.equal(relogin.status, 200);
  });

  await check('DELETE /api/documents/:id removes the document', async () => {
    const res = await req('DELETE', `/api/documents/${documentId}`, { token });
    assert.equal(res.status, 200);

    const after = await req('GET', `/api/documents/${documentId}`, { token });
    assert.equal(after.status, 404);
  });

  await check('unknown routes return 404 json', async () => {
    const res = await req('GET', '/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  await check('server errors never leak a stack trace', async () => {
    const res = await req('GET', '/api/documents/not-an-id', { token });
    assert.equal(res.status, 400);
    assert.equal(res.text.includes('at Object.'), false, res.text);
    assert.equal(res.text.includes('node_modules'), false, res.text);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);

  server.close();
  await memoryServer.stop();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
