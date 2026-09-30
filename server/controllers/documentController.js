'use strict';

const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');
const { removeStoredFile } = require('../middleware/upload');
const { syncNotificationsForUser, removeNotificationsForDocument } = require('../utils/notificationService');
const { getExpiryStatus, totalValidityDays, toUtcDay } = require('../utils/expiry');

/** Shapes a stored document for the API, adding the derived expiry status. */
function toApiDocument(document) {
  const status = getExpiryStatus(document.expiryDate, config.expiringSoonDays);
  return {
    id: document._id.toString(),
    documentName: document.documentName,
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    description: document.description,
    documentFile: document.documentFile
      ? {
          filename: document.documentFile.filename,
          originalName: document.documentFile.originalName,
          mimeType: document.documentFile.mimeType,
          size: document.documentFile.size,
          uploadedAt: document.documentFile.uploadedAt,
          viewUrl: `/api/documents/${document._id}/file`,
          downloadUrl: `/api/documents/${document._id}/download`,
        }
      : null,
    status: status.status,
    daysRemaining: status.daysRemaining,
    remainingLabel: status.remainingLabel,
    totalValidityDays: totalValidityDays(document.issueDate, document.expiryDate),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** Loads a document and enforces ownership in one step. */
async function findOwnedDocument(req) {
  const document = await Document.findOne({ _id: req.params.id, userId: req.user._id });

  if (!document) {
    // 404 rather than 403 so the API does not confirm that another user's
    // document id exists.
    throw ApiError.notFound('Document not found.');
  }

  return document;
}

const listDocuments = asyncHandler(async (req, res) => {
  const { search = '', status = 'all', type = '', sort = 'expiry-asc' } = req.query;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);

  const filter = { userId: req.user._id };

  if (type) filter.documentType = type;

  if (search) {
    // Escaped so a user-supplied string cannot act as a regex wildcard.
    const safeTerm = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeTerm, 'i');
    filter.$or = [
      { documentName: regex },
      { documentNumber: regex },
      { documentType: regex },
    ];
  }

  const documents = await Document.find(filter).lean();

  // Status is derived, not stored, so it is applied after the database query.
  let enriched = documents.map((document) => {
    const statusInfo = getExpiryStatus(document.expiryDate, config.expiringSoonDays);
    return {
      ...document,
      status: statusInfo.status,
      daysRemaining: statusInfo.daysRemaining,
      remainingLabel: statusInfo.remainingLabel,
    };
  });

  if (status === 'active') {
    enriched = enriched.filter((item) => item.status === 'ACTIVE');
  } else if (status === 'expiring-soon') {
    enriched = enriched.filter((item) => item.status === 'EXPIRING_SOON');
  } else if (status === 'expired') {
    enriched = enriched.filter((item) => item.status === 'EXPIRED');
  }

  const byExpiryAsc = (a, b) => toUtcDay(a.expiryDate) - toUtcDay(b.expiryDate);

  if (sort === 'expiry-desc') {
    enriched.sort((a, b) => -byExpiryAsc(a, b));
  } else if (sort === 'newest') {
    enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'oldest') {
    enriched.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    enriched.sort(byExpiryAsc);
  }

  const total = enriched.length;
  const start = (page - 1) * limit;
  const pageItems = enriched.slice(start, start + limit);

  res.json({
    success: true,
    data: {
      documents: pageItems.map((item) => ({ ...item, id: item._id.toString() })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    },
  });
});

const getDocument = asyncHandler(async (req, res) => {
  const document = await findOwnedDocument(req);
  res.json({ success: true, data: { document: toApiDocument(document) } });
});

const createDocument = asyncHandler(async (req, res) => {
  const payload = {
    userId: req.user._id,
    documentName: req.body.documentName,
    documentType: req.body.documentType,
    documentNumber: req.body.documentNumber,
    issueDate: new Date(req.body.issueDate),
    expiryDate: new Date(req.body.expiryDate),
    description: req.body.description || '',
  };

  if (req.file) {
    payload.documentFile = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };
  }

  const document = await Document.create(payload);

  await syncNotificationsForUser(req.user._id);

  res.status(201).json({ success: true, message: 'Document added.', data: { document: toApiDocument(document) } });
});

const updateDocument = asyncHandler(async (req, res) => {
  const document = await findOwnedDocument(req);

  document.documentName = req.body.documentName;
  document.documentType = req.body.documentType;
  document.documentNumber = req.body.documentNumber;
  document.issueDate = new Date(req.body.issueDate);
  document.expiryDate = new Date(req.body.expiryDate);
  document.description = req.body.description || '';

  if (req.file) {
    const previous = document.documentFile;
    document.documentFile = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };
    if (previous) removeStoredFile(previous);
  } else if (req.body.removeFile === 'true') {
    const previous = document.documentFile;
    document.documentFile = null;
    if (previous) removeStoredFile(previous);
  }

  await document.save();

  await syncNotificationsForUser(req.user._id);

  res.json({ success: true, message: 'Document updated.', data: { document: toApiDocument(document) } });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const document = await findOwnedDocument(req);

  await document.deleteOne();
  if (document.documentFile) removeStoredFile(document.documentFile);
  await removeNotificationsForDocument(req.user._id, document._id);

  res.json({ success: true, message: 'Document deleted.' });
});

/** Shared handler for viewing (inline) and downloading (attachment) files. */
function sendFile(disposition) {
  return asyncHandler(async (req, res) => {
    const document = await findOwnedDocument(req);

    if (!document.documentFile) {
      throw ApiError.notFound('This document has no uploaded file.');
    }

    const filePath = path.join(config.uploadDir, path.basename(document.documentFile.filename));

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('The stored file could not be found.');
    }

    // Stored filenames are server-generated, so the value is safe to use as a
    // Content-Disposition filename. The original name is sanitised anyway.
    const safeName = document.documentFile.originalName.replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Type', document.documentFile.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    // Neutralise active content for PDFs opened in the browser.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; object-src 'none'; sandbox");

    fs.createReadStream(filePath).pipe(res);
  });
}

const viewFile = sendFile('inline');
const downloadFile = sendFile('attachment');

module.exports = {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  viewFile,
  downloadFile,
  toApiDocument,
};
