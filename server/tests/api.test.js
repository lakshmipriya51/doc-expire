'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';

const {
  startTestDatabase,
  stopTestDatabase,
  resetDatabase,
  samplePdfBuffer,
  registerUser,
  loginUser,
  authHeader,
  dateOnly,
  documentPayload,
} = require('./setup');

const createApp = require('../app');
const User = require('../models/User');
const Document = require('../models/Document');
const Notification = require('../models/Notification');

let app;
let owner;
let stranger;

test.before(async () => {
  await startTestDatabase();
  app = createApp();
});

test.after(async () => {
  await stopTestDatabase();
});

test.beforeEach(async () => {
  await resetDatabase();
  owner = await registerUser(app);
  stranger = await registerUser(app, {
    name: 'Other Person',
    email: 'other.person@example.com',
  });
});

async function createDocument(token, overrides = {}, file) {
  let req = request(app)
    .post('/api/documents')
    .set('Authorization', authHeader(token))
    .field(documentPayload(overrides));

  if (file) {
    req = req.attach('documentFile', file.buffer, {
      filename: file.filename,
      contentType: file.contentType,
    });
  }

  const response = await req;
  return response;
}

// ---------------------------------------------------------------- health ---

test('health endpoint reports service and database status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.database, 'connected');
});

test('unknown routes return 404 with a friendly message', async () => {
  const response = await request(app).get('/api/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /not found/i);
});

// ------------------------------------------------------------- auth tests ---

test('registers a user, hashes the password and returns a token', async () => {
  const { response, user, token } = owner;

  assert.equal(response.status, 201);
  assert.ok(token.split('.').length === 3, 'token is a JWT');
  assert.equal(user.email, 'test.user@example.com');
  assert.equal(user.name, 'Test User');
  assert.equal(user.password, undefined, 'password hash is never returned');
  assert.ok(user.id);

  const stored = await User.findOne({ email: 'test.user@example.com' }).select('+password');
  assert.notEqual(stored.password, 'Passw0rd123');
  assert.match(stored.password, /^\$2[aby]\$/, 'password is a bcrypt hash');
  assert.ok(await stored.matchesPassword('Passw0rd123'));
});

test('rejects duplicate email registration with 409', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Duplicate',
    email: 'test.user@example.com',
    password: 'Passw0rd123',
    confirmPassword: 'Passw0rd123',
  });

  assert.equal(response.status, 409);
  assert.match(response.body.message, /already exists/i);
});

test('validates registration input on the server', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: '',
    email: 'not-an-email',
    password: 'short',
    confirmPassword: 'different',
  });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.name);
  assert.ok(response.body.errors.email);
  assert.ok(response.body.errors.password);
  assert.ok(response.body.errors.confirmPassword);
});

test('rejects a weak password that has no digits', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Weak Pass',
    email: 'weak@example.com',
    password: 'onlyletters',
    confirmPassword: 'onlyletters',
  });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.password);
});

test('logs in with correct credentials and rejects wrong ones', async () => {
  const good = await loginUser(app, {
    email: 'test.user@example.com',
    password: 'Passw0rd123',
  });
  assert.equal(good.response.status, 200);
  assert.ok(good.token);

  const wrongPassword = await loginUser(app, {
    email: 'test.user@example.com',
    password: 'WrongPass123',
  });
  assert.equal(wrongPassword.response.status, 401);

  const unknownEmail = await loginUser(app, {
    email: 'ghost@example.com',
    password: 'Passw0rd123',
  });
  assert.equal(unknownEmail.response.status, 401);
  assert.equal(
    unknownEmail.response.body.message,
    wrongPassword.response.body.message,
    'the same message is used for both failures so accounts cannot be enumerated',
  );
});

test('login is case insensitive on the email address', async () => {
  const result = await loginUser(app, {
    email: 'TEST.USER@EXAMPLE.COM',
    password: 'Passw0rd123',
  });

  assert.equal(result.response.status, 200);
  assert.ok(result.token);
});

test('protects private routes: no token, bad token, valid token', async () => {
  const noToken = await request(app).get('/api/documents');
  assert.equal(noToken.status, 401);

  const badToken = await request(app)
    .get('/api/documents')
    .set('Authorization', 'Bearer not-a-real-token');
  assert.equal(badToken.status, 401);

  const withToken = await request(app)
    .get('/api/documents')
    .set('Authorization', authHeader(owner.token));
  assert.equal(withToken.status, 200);
});

test('reads and updates the profile, and changes the password', async () => {
  const profile = await request(app)
    .get('/api/auth/profile')
    .set('Authorization', authHeader(owner.token));
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.email, 'test.user@example.com');

  const renamed = await request(app)
    .put('/api/auth/profile')
    .set('Authorization', authHeader(owner.token))
    .send({ name: 'Renamed Person' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.user.name, 'Renamed Person');

  const badName = await request(app)
    .put('/api/auth/profile')
    .set('Authorization', authHeader(owner.token))
    .send({ name: 'A' });
  assert.equal(badName.status, 400);

  const wrongCurrent = await request(app)
    .put('/api/auth/password')
    .set('Authorization', authHeader(owner.token))
    .send({ currentPassword: 'NotIt12345', newPassword: 'BrandNew123' });
  assert.equal(wrongCurrent.status, 401);

  const changed = await request(app)
    .put('/api/auth/password')
    .set('Authorization', authHeader(owner.token))
    .send({ currentPassword: 'Passw0rd123', newPassword: 'BrandNew123' });
  assert.equal(changed.status, 200);

  const relogin = await loginUser(app, {
    email: 'test.user@example.com',
    password: 'BrandNew123',
  });
  assert.equal(relogin.response.status, 200, 'the new password works');
});

// --------------------------------------------------------- document CRUD ----

test('creates, reads, updates and deletes a document', async () => {
  const created = await createDocument(owner.token, { documentName: 'My Passport' });
  assert.equal(created.status, 201);
  const id = created.body.data.document.id;

  const read = await request(app)
    .get(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token));
  assert.equal(read.status, 200);
  assert.equal(read.body.data.document.documentName, 'My Passport');
  assert.equal(read.body.data.document.status, 'ACTIVE');
  assert.equal(read.body.data.document.totalValidityDays, 765);

  const updated = await request(app)
    .put(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token))
    .field(
      documentPayload({
        documentName: 'My Passport (Renewed)',
        documentNumber: 'X7654321',
        issueDate: dateOnly(-10),
        expiryDate: dateOnly(3550),
      }),
    );
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.document.documentName, 'My Passport (Renewed)');
  assert.equal(updated.body.data.document.documentNumber, 'X7654321');

  const removed = await request(app)
    .delete(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token));
  assert.equal(removed.status, 200);
  assert.equal(await Document.countDocuments({}), 0);

  const gone = await request(app)
    .get(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token));
  assert.equal(gone.status, 404);
});

test('validates document input on the server', async () => {
  const missingFields = await createDocument(owner.token, {
    documentName: '',
    documentType: '',
    documentNumber: '',
  });
  assert.equal(missingFields.status, 400);
  assert.ok(missingFields.body.errors.documentName);
  assert.ok(missingFields.body.errors.documentType);
  assert.ok(missingFields.body.errors.documentNumber);

  const badType = await createDocument(owner.token, { documentType: 'Spaceship' });
  assert.equal(badType.status, 400);

  const badDate = await createDocument(owner.token, { issueDate: '2023-02-30' });
  assert.equal(badDate.status, 400);
  assert.match(badDate.body.errors.issueDate, /valid date/i);

  const reversed = await createDocument(owner.token, {
    issueDate: dateOnly(100),
    expiryDate: dateOnly(10),
  });
  assert.equal(reversed.status, 400);
  assert.match(reversed.body.errors.expiryDate, /earlier than the issue date/i);

  const badNumber = await createDocument(owner.token, { documentNumber: '!!!@@@' });
  assert.equal(badNumber.status, 400);

  const badId = await request(app)
    .get('/api/documents/not-an-id')
    .set('Authorization', authHeader(owner.token));
  assert.equal(badId.status, 400);
});

test('a user cannot read, update or delete another user document', async () => {
  const created = await createDocument(owner.token, { documentName: 'Private Passport' });
  const id = created.body.data.document.id;

  const read = await request(app)
    .get(`/api/documents/${id}`)
    .set('Authorization', authHeader(stranger.token));
  assert.equal(read.status, 404, 'another user gets 404, not the document');

  const updated = await request(app)
    .put(`/api/documents/${id}`)
    .set('Authorization', authHeader(stranger.token))
    .field(documentPayload({ documentName: 'Hijacked' }));
  assert.equal(updated.status, 404);

  const removed = await request(app)
    .delete(`/api/documents/${id}`)
    .set('Authorization', authHeader(stranger.token));
  assert.equal(removed.status, 404);

  const stillThere = await request(app)
    .get(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token));
  assert.equal(stillThere.status, 200, 'the original owner still has the document');
});

test('the list only returns the logged-in user documents', async () => {
  await createDocument(owner.token, { documentName: 'Owner Document' });
  await createDocument(stranger.token, { documentName: 'Stranger Document' });

  const list = await request(app)
    .get('/api/documents')
    .set('Authorization', authHeader(owner.token));

  assert.equal(list.status, 200);
  assert.equal(list.body.data.documents.length, 1);
  assert.equal(list.body.data.documents[0].documentName, 'Owner Document');
});

// --------------------------------------------------------- file uploads -----

test('uploads a PDF, then views and downloads it with ownership checks', async () => {
  const buffer = samplePdfBuffer('secret contents');

  const created = await createDocument(owner.token, { documentName: 'Scanned Passport' }, {
    buffer,
    filename: 'passport.pdf',
    contentType: 'application/pdf',
  });

  assert.equal(created.status, 201);
  const id = created.body.data.document.id;
  const fileMeta = created.body.data.document.documentFile;
  assert.equal(fileMeta.originalName, 'passport.pdf');
  assert.equal(fileMeta.mimeType, 'application/pdf');
  assert.equal(fileMeta.size, buffer.length);

  const view = await request(app)
    .get(`/api/documents/${id}/file`)
    .set('Authorization', authHeader(owner.token))
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });

  assert.equal(view.status, 200);
  assert.equal(view.headers['content-type'], 'application/pdf');
  assert.match(view.headers['content-disposition'], /inline/);
  assert.equal(view.body.toString(), buffer.toString());

  const download = await request(app)
    .get(`/api/documents/${id}/download`)
    .set('Authorization', authHeader(owner.token))
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });

  assert.equal(download.status, 200);
  assert.match(download.headers['content-disposition'], /attachment; filename="passport.pdf"/);

  const strangerView = await request(app)
    .get(`/api/documents/${id}/file`)
    .set('Authorization', authHeader(stranger.token));
  assert.equal(strangerView.status, 404, 'files are not readable by other users');

  const anonymous = await request(app).get(`/api/documents/${id}/file`);
  assert.equal(anonymous.status, 401);
});

test('accepts jpg and png uploads', async () => {
  const png = Buffer.from('\x89PNG\r\n\x1a\n test image payload', 'binary');

  const created = await createDocument(owner.token, { documentName: 'Aadhaar Scan' }, {
    buffer: png,
    filename: 'aadhaar.png',
    contentType: 'image/png',
  });

  assert.equal(created.status, 201);
  assert.match(created.body.data.document.documentFile.filename, /^[a-f0-9]{24}-.*\.png$/);
});

test('rejects disallowed file types', async () => {
  const created = await createDocument(owner.token, {}, {
    buffer: Buffer.from('<script>alert(1)</script>'),
    filename: 'evil.html',
    contentType: 'text/html',
  });

  assert.equal(created.status, 400);
  assert.match(created.body.message, /only pdf, jpg, jpeg and png/i);
});

test('rejects a file whose contents do not match its declared type', async () => {
  const fs = require('fs');
  const config = require('../config');

  // Declares itself as a PDF but contains a Windows executable. Only the bytes
  // on disk can catch this, because the client controls the Content-Type.
  const disguised = Buffer.concat([
    Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]),
    Buffer.alloc(2048, 0x41),
  ]);

  const before = fs.readdirSync(config.uploadDir);

  const created = await createDocument(owner.token, {}, {
    buffer: disguised,
    filename: 'invoice.pdf',
    contentType: 'application/pdf',
  });

  assert.equal(created.status, 400, 'a spoofed file is refused');
  assert.match(created.body.message, /not a valid pdf, jpg or png/i);

  // Nothing may be left behind on disk after the rejection.
  const after = fs.readdirSync(config.uploadDir);
  assert.deepEqual(
    after.filter((name) => !before.includes(name)),
    [],
    'the rejected file is deleted from the uploads directory',
  );
});

test('rejects a file that exceeds the size limit', async () => {
  const oversize = Buffer.alloc(6 * 1024 * 1024, 'a');

  const created = await createDocument(owner.token, {}, {
    buffer: oversize,
    filename: 'huge.pdf',
    contentType: 'application/pdf',
  });

  assert.equal(created.status, 413);
  assert.match(created.body.message, /too large/i);
});

test('deleting a document also removes its file and reminders', async () => {
  const created = await createDocument(
    owner.token,
    { documentName: 'Expiring Soon', expiryDate: dateOnly(7) },
    { buffer: samplePdfBuffer(), filename: 'soon.pdf', contentType: 'application/pdf' },
  );

  const id = created.body.data.document.id;
  const stored = await Document.findById(id);
  assert.equal(await Notification.countDocuments({ documentId: id }), 1);

  await request(app)
    .delete(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token));

  assert.equal(await Notification.countDocuments({ documentId: id }), 0);

  const fs = require('fs');
  const path = require('path');
  const config = require('../config');
  const filePath = path.join(config.uploadDir, stored.documentFile.filename);
  // Allow a moment for the unlink promise to settle.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(filePath), false, 'the stored file is deleted from disk');
});

test('replacing the file on update removes the previous file', async () => {
  const created = await createDocument(owner.token, {}, {
    buffer: samplePdfBuffer('first'),
    filename: 'first.pdf',
    contentType: 'application/pdf',
  });
  const id = created.body.data.document.id;
  const firstName = created.body.data.document.documentFile.filename;

  const updated = await request(app)
    .put(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token))
    .field(documentPayload())
    .attach('documentFile', samplePdfBuffer('second'), {
      filename: 'second.pdf',
      contentType: 'application/pdf',
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.document.documentFile.originalName, 'second.pdf');
  assert.notEqual(updated.body.data.document.documentFile.filename, firstName);

  const fs = require('fs');
  const path = require('path');
  const config = require('../config');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(path.join(config.uploadDir, firstName)), false);
});

// ------------------------------------------------- search, filter, sort -----

test('searches by name, number and type', async () => {
  await createDocument(owner.token, {
    documentName: 'Passport',
    documentType: 'Passport',
    documentNumber: 'X0000001',
  });
  await createDocument(owner.token, {
    documentName: 'Passport Renewal Form',
    documentType: 'Other',
    documentNumber: 'FORM-9',
  });
  await createDocument(owner.token, {
    documentName: 'Vehicle Insurance',
    documentType: 'Insurance',
    documentNumber: 'POL-0001',
  });

  const byName = await request(app)
    .get('/api/documents?search=passport')
    .set('Authorization', authHeader(owner.token));
  assert.equal(byName.body.data.documents.length, 2);

  const byNumber = await request(app)
    .get('/api/documents?search=FORM-9')
    .set('Authorization', authHeader(owner.token));
  assert.equal(byNumber.body.data.documents.length, 1);
  assert.equal(byNumber.body.data.documents[0].documentName, 'Passport Renewal Form');

  const byType = await request(app)
    .get('/api/documents?search=insurance')
    .set('Authorization', authHeader(owner.token));
  assert.equal(byType.body.data.documents.length, 1);
  assert.equal(byType.body.data.documents[0].documentName, 'Vehicle Insurance');

  const noMatch = await request(app)
    .get('/api/documents?search=zzzznotfound')
    .set('Authorization', authHeader(owner.token));
  assert.equal(noMatch.body.data.documents.length, 0);
});

test('search treats regex metacharacters as literal text', async () => {
  await createDocument(owner.token, { documentName: 'Plain Document' });

  const response = await request(app)
    .get('/api/documents?search=.*')
    .set('Authorization', authHeader(owner.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.documents.length, 0, 'a wildcard is not treated as a regex');
});

test('filters by derived status and by type', async () => {
  await createDocument(owner.token, {
    documentName: 'Active Doc',
    documentType: 'Passport',
    issueDate: dateOnly(-100),
    expiryDate: dateOnly(300),
  });
  await createDocument(owner.token, {
    documentName: 'Soon Doc',
    documentType: 'Insurance',
    issueDate: dateOnly(-350),
    expiryDate: dateOnly(10),
  });
  await createDocument(owner.token, {
    documentName: 'Expired Doc',
    documentType: 'PAN',
    issueDate: dateOnly(-400),
    expiryDate: dateOnly(-5),
  });

  const active = await request(app)
    .get('/api/documents?status=active')
    .set('Authorization', authHeader(owner.token));
  assert.equal(active.body.data.documents.length, 1);
  assert.equal(active.body.data.documents[0].documentName, 'Active Doc');

  const soon = await request(app)
    .get('/api/documents?status=expiring-soon')
    .set('Authorization', authHeader(owner.token));
  assert.equal(soon.body.data.documents.length, 1);
  assert.equal(soon.body.data.documents[0].status, 'EXPIRING_SOON');

  const expired = await request(app)
    .get('/api/documents?status=expired')
    .set('Authorization', authHeader(owner.token));
  assert.equal(expired.body.data.documents.length, 1);
  assert.equal(expired.body.data.documents[0].daysRemaining, -5);

  const all = await request(app)
    .get('/api/documents?status=all')
    .set('Authorization', authHeader(owner.token));
  assert.equal(all.body.data.documents.length, 3);

  const byType = await request(app)
    .get('/api/documents?type=Insurance')
    .set('Authorization', authHeader(owner.token));
  assert.equal(byType.body.data.documents.length, 1);
  assert.equal(byType.body.data.documents[0].documentName, 'Soon Doc');

  const combined = await request(app)
    .get('/api/documents?type=Insurance&status=expired')
    .set('Authorization', authHeader(owner.token));
  assert.equal(combined.body.data.documents.length, 0);

  const badFilter = await request(app)
    .get('/api/documents?status=bogus')
    .set('Authorization', authHeader(owner.token));
  assert.equal(badFilter.status, 400);
});

test('sorts by expiry ascending, descending and by recency', async () => {
  await createDocument(owner.token, { documentName: 'Middle', expiryDate: dateOnly(100) });
  await createDocument(owner.token, { documentName: 'Nearest', expiryDate: dateOnly(5) });
  await createDocument(owner.token, { documentName: 'Farthest', expiryDate: dateOnly(500) });

  const ascending = await request(app)
    .get('/api/documents?sort=expiry-asc')
    .set('Authorization', authHeader(owner.token));
  assert.deepEqual(
    ascending.body.data.documents.map((item) => item.documentName),
    ['Nearest', 'Middle', 'Farthest'],
  );

  const descending = await request(app)
    .get('/api/documents?sort=expiry-desc')
    .set('Authorization', authHeader(owner.token));
  assert.deepEqual(
    descending.body.data.documents.map((item) => item.documentName),
    ['Farthest', 'Middle', 'Nearest'],
  );

  const newest = await request(app)
    .get('/api/documents?sort=newest')
    .set('Authorization', authHeader(owner.token));
  assert.equal(newest.body.data.documents[0].documentName, 'Farthest', 'last created comes first');

  const oldest = await request(app)
    .get('/api/documents?sort=oldest')
    .set('Authorization', authHeader(owner.token));
  assert.equal(oldest.body.data.documents[0].documentName, 'Middle');
});

test('paginates the document list', async () => {
  for (let index = 0; index < 5; index += 1) {
    await createDocument(owner.token, {
      documentName: `Doc ${index}`,
      expiryDate: dateOnly(10 + index),
    });
  }

  const firstPage = await request(app)
    .get('/api/documents?page=1&limit=2')
    .set('Authorization', authHeader(owner.token));
  assert.equal(firstPage.body.data.documents.length, 2);
  assert.equal(firstPage.body.data.pagination.total, 5);
  assert.equal(firstPage.body.data.pagination.totalPages, 3);

  const lastPage = await request(app)
    .get('/api/documents?page=3&limit=2')
    .set('Authorization', authHeader(owner.token));
  assert.equal(lastPage.body.data.documents.length, 1);

  const badLimit = await request(app)
    .get('/api/documents?limit=9999')
    .set('Authorization', authHeader(owner.token));
  assert.equal(badLimit.status, 400);
});

// --------------------------------------------------------- notifications ----

test('generates reminders at each threshold without duplicating them', async () => {
  await createDocument(owner.token, { documentName: 'Passport', expiryDate: dateOnly(30) });

  const first = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(first.body.data.notifications.length, 1);
  assert.equal(first.body.data.notifications[0].level, 30);
  assert.equal(first.body.data.notifications[0].isRead, false);
  assert.equal(first.body.data.unreadCount, 1);

  const second = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(second.body.data.notifications.length, 1, 'reading twice does not duplicate');
  assert.equal(await Notification.countDocuments({}), 1);
});

test('removes stale reminders when the expiry date changes', async () => {
  const created = await createDocument(owner.token, {
    documentName: 'Passport',
    expiryDate: dateOnly(30),
  });
  const id = created.body.data.document.id;

  await request(app)
    .put(`/api/documents/${id}`)
    .set('Authorization', authHeader(owner.token))
    .field(documentPayload({ expiryDate: dateOnly(900) }));

  const notifications = await Notification.find({});
  assert.equal(notifications.length, 0, 'the 30 day reminder no longer applies');
});

test('marks notifications as read individually and all at once', async () => {
  await createDocument(owner.token, { documentName: 'Alpha', expiryDate: dateOnly(15) });
  await createDocument(owner.token, { documentName: 'Beta', expiryDate: dateOnly(7) });

  const list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(list.body.data.notifications.length, 2);
  assert.equal(list.body.data.unreadCount, 2);

  const firstId = list.body.data.notifications[0].id;
  const marked = await request(app)
    .put(`/api/notifications/${firstId}/read`)
    .set('Authorization', authHeader(owner.token));
  assert.equal(marked.status, 200);
  assert.equal(marked.body.data.notification.isRead, true);
  assert.equal(marked.body.data.unreadCount, 1);

  const unreadOnly = await request(app)
    .get('/api/notifications?unreadOnly=true')
    .set('Authorization', authHeader(owner.token));
  assert.equal(unreadOnly.body.data.notifications.length, 1);

  const markAll = await request(app)
    .put('/api/notifications/read-all')
    .set('Authorization', authHeader(owner.token));
  assert.equal(markAll.status, 200);
  assert.equal(markAll.body.data.updated, 1);

  const after = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(after.body.data.unreadCount, 0);
});

test('notifications are private to their owner', async () => {
  await createDocument(owner.token, { documentName: 'Owner Reminder', expiryDate: dateOnly(7) });

  const strangerList = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(stranger.token));
  assert.equal(strangerList.body.data.notifications.length, 0);

  const ownerList = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  const notificationId = ownerList.body.data.notifications[0].id;

  const stolen = await request(app)
    .put(`/api/notifications/${notificationId}/read`)
    .set('Authorization', authHeader(stranger.token));
  assert.equal(stolen.status, 404);
});

test('generates the expiry-day and expired notifications', async () => {
  await createDocument(owner.token, { documentName: 'Insurance', expiryDate: dateOnly(0) });
  await createDocument(owner.token, { documentName: 'Vehicle RC', expiryDate: dateOnly(-2) });

  const list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));

  const types = list.body.data.notifications.map((item) => item.type).sort();
  assert.deepEqual(types, ['EXPIRED', 'EXPIRY_TODAY']);

  const expired = list.body.data.notifications.find((item) => item.type === 'EXPIRED');
  assert.equal(expired.message, 'Vehicle RC has expired (2 days ago).');
});

test('reminders survive a re-sync and disappear once the document is gone', async () => {
  await createDocument(owner.token, { documentName: 'Alpha', expiryDate: dateOnly(15) });
  const created = await createDocument(owner.token, { documentName: 'Beta', expiryDate: dateOnly(7) });
  const documentId = created.body.data.document.id;

  let list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(list.body.data.notifications.length, 2);

  await request(app)
    .delete(`/api/documents/${documentId}`)
    .set('Authorization', authHeader(owner.token));

  list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(list.body.data.notifications.length, 1, 'the deleted document reminder is gone');
  assert.equal(list.body.data.notifications[0].documentName, 'Alpha');
});

test('a read notification stays read after re-syncing', async () => {
  await createDocument(owner.token, { documentName: 'Alpha', expiryDate: dateOnly(7) });

  let list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  const notificationId = list.body.data.notifications[0].id;

  await request(app)
    .put(`/api/notifications/${notificationId}/read`)
    .set('Authorization', authHeader(owner.token));

  list = await request(app)
    .get('/api/notifications')
    .set('Authorization', authHeader(owner.token));
  assert.equal(list.body.data.notifications.length, 1);
  assert.equal(list.body.data.notifications[0].isRead, true, 'read state is not reset by a re-sync');
  assert.equal(list.body.data.unreadCount, 0);
});

// -------------------------------------------------------------- dashboard ---

test('dashboard statistics count every status correctly', async () => {
  await createDocument(owner.token, { documentName: 'Active 1', expiryDate: dateOnly(400) });
  await createDocument(owner.token, { documentName: 'Active 2', expiryDate: dateOnly(200) });
  await createDocument(owner.token, { documentName: 'Soon 1', expiryDate: dateOnly(12) });
  await createDocument(owner.token, { documentName: 'Soon 2', expiryDate: dateOnly(3) });
  await createDocument(owner.token, { documentName: 'Expired 1', expiryDate: dateOnly(-4) });

  const response = await request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', authHeader(owner.token));

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.stats, {
    totalDocuments: 5,
    activeDocuments: 2,
    expiringSoon: 2,
    expiredDocuments: 1,
  });

  const upcoming = response.body.data.upcomingExpiry;
  assert.equal(upcoming.length, 5, 'upcoming expiries are capped at five');
  assert.equal(upcoming[0].documentName, 'Expired 1', 'the most urgent document is first');
  assert.equal(upcoming[0].status, 'EXPIRED');
  assert.equal(upcoming[0].daysRemaining, -4);
});

test('dashboard statistics only count the current user documents', async () => {
  await createDocument(owner.token, { documentName: 'Mine', expiryDate: dateOnly(100) });
  await createDocument(stranger.token, { documentName: 'Theirs', expiryDate: dateOnly(-10) });

  const response = await request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', authHeader(owner.token));

  assert.equal(response.body.data.stats.totalDocuments, 1);
  assert.equal(response.body.data.stats.expiredDocuments, 0);
});

test('dashboard is empty but valid for a brand new account', async () => {
  const response = await request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', authHeader(stranger.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.stats.totalDocuments, 0);
  assert.deepEqual(response.body.data.upcomingExpiry, []);
});

test('expired documents keep reporting their true remaining days', async () => {
  await createDocument(owner.token, { documentName: 'Old PAN', expiryDate: dateOnly(-100) });

  const response = await request(app)
    .get('/api/documents')
    .set('Authorization', authHeader(owner.token));

  const [document] = response.body.data.documents;
  assert.equal(document.status, 'EXPIRED');
  assert.equal(document.daysRemaining, -100);
  assert.equal(document.remainingLabel, 'Expired 100 days ago');
});

// --- CORS -----------------------------------------------------------------
//
// The packaged mobile app loads the web build from the device, so it sends a
// Capacitor shell origin rather than the deployed web origin. If the API
// rejected those, every mobile request - including registration - would fail
// against a real deployment while still working in a browser.

test('the packaged mobile app origin is allowed through CORS', async () => {
  for (const origin of ['capacitor://localhost', 'https://localhost', 'http://localhost']) {
    const response = await request(app).get('/api/health').set('Origin', origin);
    assert.equal(response.status, 200, `${origin} should be allowed`);
    assert.match(
      response.headers['access-control-allow-origin'],
      new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      `${origin} should be echoed back in Access-Control-Allow-Origin`,
    );
  }
});

test('an unrelated website origin is still blocked by CORS', async () => {
  const response = await request(app).get('/api/health').set('Origin', 'https://evil.example');

  assert.notEqual(response.headers['access-control-allow-origin'], 'https://evil.example');
  assert.ok(
    response.status >= 400,
    `expected a CORS rejection, got ${response.status}`,
  );
});
