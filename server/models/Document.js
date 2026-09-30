'use strict';

const mongoose = require('mongoose');
const { DOCUMENT_TYPES } = require('../utils/documentTypes');

const fileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentName: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
      maxlength: [80, 'Document name must be at most 80 characters'],
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: DOCUMENT_TYPES,
        message: '`{VALUE}` is not a supported document type',
      },
    },
    documentNumber: {
      type: String,
      required: [true, 'Document number is required'],
      trim: true,
      uppercase: true,
      maxlength: [40, 'Document number must be at most 40 characters'],
    },
    issueDate: {
      type: Date,
      required: [true, 'Issue date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
      default: '',
    },
    documentFile: { type: fileSchema, default: null },
  },
  { timestamps: true },
);

documentSchema.index({ userId: 1, expiryDate: 1 });
documentSchema.index({ userId: 1, documentType: 1 });
documentSchema.index({ userId: 1, documentName: 'text', documentNumber: 'text' });

module.exports = mongoose.model('Document', documentSchema);
