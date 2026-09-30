'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { handleUpload, discardRejectedUpload } = require('../middleware/upload');
const controller = require('../controllers/documentController');
const {
  documentBodyRules,
  documentUpdateRules,
  documentIdRules,
  listQueryRules,
} = require('../validators/documentValidators');

const router = express.Router();

router.use(protect);

// Multer must run before the validators: for multipart requests the form
// fields only exist once the upload has been parsed.
router.get('/', listQueryRules, validate, controller.listDocuments);
router.post(
  '/',
  handleUpload,
  documentBodyRules,
  validate,
  discardRejectedUpload,
  controller.createDocument,
);

router.get('/:id', documentIdRules, validate, controller.getDocument);
router.put(
  '/:id',
  handleUpload,
  [...documentIdRules, ...documentUpdateRules],
  validate,
  discardRejectedUpload,
  controller.updateDocument,
);
router.delete('/:id', documentIdRules, validate, controller.deleteDocument);

// File access always goes through the authenticated API so an uploaded
// document is never reachable by guessing a URL.
router.get('/:id/file', documentIdRules, validate, controller.viewFile);
router.get('/:id/download', documentIdRules, validate, controller.downloadFile);

module.exports = router;
