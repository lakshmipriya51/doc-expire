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

// Magic-byte signatures. The declared Content-Type comes from the client and
// can be set to anything, so the bytes on disk are what actually get checked.
const FILE_SIGNATURES = [
  { mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
];

/**
 * Confirms the stored file really is the type it claims to be.
 * @returns {boolean} true when the signature matches the declared MIME type
 */
function matchesSignature(filePath, mimeType) {
  const expected = FILE_SIGNATURES.find((entry) => entry.mimeType === mimeType);
  if (!expected) return false;

  let handle;
  try {
    handle = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(expected.bytes.length);
    const read = fs.readSync(handle, buffer, 0, buffer.length, 0);
    if (read < expected.bytes.length) return false;
    return expected.bytes.every((byte, index) => buffer[index] === byte);
  } catch {
    return false;
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

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
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(config.maxUploadBytes / (1024 * 1024));
          return next(ApiError.payloadTooLarge(`File is too large. Maximum size is ${maxMb} MB.`));
        }
        return next(ApiError.badRequest(`Upload failed: ${error.message}`));
      }

      return next(error);
    }

    // A mismatched signature means the extension/content type was spoofed, so
    // the file is deleted instead of being stored and served back later.
    if (req.file) {
      const filePath = path.join(config.uploadDir, path.basename(req.file.filename));
      if (!matchesSignature(filePath, req.file.mimetype)) {
        removeStoredFile({ filename: req.file.filename });
        req.file = undefined;
        return next(
          ApiError.badRequest('That file is not a valid PDF, JPG or PNG. The contents did not match the file type.', {
            documentFile: 'The uploaded file contents do not match the selected file type.',
          }),
        );
      }
    }

    return next();
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
