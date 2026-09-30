'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const ApiError = require('../utils/ApiError');

fs.mkdirSync(config.uploadDir, { recursive: true });

const EXTENSION_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    // Filenames are generated server-side so a hostile client can never
    // control the path written to disk.
    const extension = EXTENSION_BY_MIME[file.mimetype] || '';
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `${req.user._id}-${unique}${extension}`);
  },
});

function fileFilter(req, file, cb) {
  if (!config.allowedUploadMimeTypes.includes(file.mimetype)) {
    return cb(
      ApiError.badRequest('Only PDF, JPG, JPEG and PNG files are allowed.', {
        documentFile: 'Unsupported file type. Allowed types: PDF, JPG, JPEG, PNG.',
      }),
    );
  }
  return cb(null, true);
}

const uploadDocumentFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
}).single('documentFile');

/** Wraps multer so its errors use our error shape. */
function handleUpload(req, res, next) {
  uploadDocumentFile(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.round(config.maxUploadBytes / (1024 * 1024));
        return next(ApiError.payloadTooLarge(`File is too large. Maximum size is ${maxMb} MB.`));
      }
      return next(ApiError.badRequest(`Upload failed: ${error.message}`));
    }

    return next(error);
  });
}

function removeStoredFile(fileMeta) {
  if (!fileMeta || !fileMeta.filename) return;

  const target = path.join(config.uploadDir, path.basename(fileMeta.filename));
  fs.promises.unlink(target).catch(() => {
    // The file may already be gone; nothing else to do.
  });
}

/**
 * Uploads must be parsed before validation for multipart requests, so this
 * runs straight after `validate` to delete a file that arrived with invalid
 * form data.
 */
function discardRejectedUpload(req, res, next) {
  if (req.validationFailed && req.file) {
    removeStoredFile(req.file);
    req.file = undefined;
  }
  return next();
}

module.exports = { handleUpload, discardRejectedUpload, removeStoredFile };
