import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import documentService from '../services/documentService';
import { useToast } from '../context/ToastContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import FileInput from '../components/FileInput';
import { DOCUMENT_TYPES } from '../utils/constants';
import { hasErrors, validateDocumentForm } from '../utils/validation';
import { addDays } from '../utils/date';

const EMPTY_FORM = {
  documentName: '',
  documentType: '',
  documentNumber: '',
  issueDate: '',
  expiryDate: '',
  description: '',
};

/** Shared add/edit form - the route decides which mode it runs in. */
export default function DocumentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [existingFile, setExistingFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      // Sensible default so the expiry field is never empty on a new record.
      setForm((current) => ({ ...current, issueDate: addDays(0), expiryDate: addDays(365) }));
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    documentService
      .getById(id)
      .then((document) => {
        if (cancelled) return;
        setForm({
          documentName: document.documentName,
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          issueDate: String(document.issueDate).slice(0, 10),
          expiryDate: String(document.expiryDate).slice(0, 10),
          description: document.description || '',
        });
        setExistingFile(document.documentFile);
      })
      .catch((loadError) => {
        if (!cancelled) setFormError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const errors = validateDocumentForm(form);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value ?? ''));
    if (file) payload.append('documentFile', file);
    if (isEdit && removeFile && !file) payload.append('removeFile', 'true');

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await documentService.update(id, payload);
        showSuccess('Document updated.');
      } else {
        await documentService.create(payload);
        showSuccess('Document added.');
      }
      navigate('/documents');
    } catch (error) {
      setFormError(error.message);
      if (error.fieldErrors) setFieldErrors((current) => ({ ...current, ...error.fieldErrors }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <Spinner label="Loading document..." />
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <div>
          <h1 className="page__title">{isEdit ? 'Edit document' : 'Add document'}</h1>
          <p className="page__subtitle">
            {isEdit
              ? 'Update the details below. Your changes take effect immediately.'
              : 'Record the document details and we will handle the reminders.'}
          </p>
        </div>
        <Link className="btn btn--ghost" to="/documents">
          Back to documents
        </Link>
      </header>

      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <form className="panel form" onSubmit={handleSubmit} noValidate>
        <div className="form__grid">
          <div className="field">
            <label className="field__label" htmlFor="documentName">
              Document name <span className="required">*</span>
            </label>
            <input
              id="documentName"
              name="documentName"
              type="text"
              className="field__input"
              placeholder="e.g. Passport"
              value={form.documentName}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.documentName)}
            />
            {fieldErrors.documentName ? (
              <p className="field__error">{fieldErrors.documentName}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="documentType">
              Document type <span className="required">*</span>
            </label>
            <select
              id="documentType"
              name="documentType"
              className="field__input"
              value={form.documentType}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.documentType)}
            >
              <option value="">Select a type</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {fieldErrors.documentType ? (
              <p className="field__error">{fieldErrors.documentType}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="documentNumber">
              Document number <span className="required">*</span>
            </label>
            <input
              id="documentNumber"
              name="documentNumber"
              type="text"
              className="field__input"
              placeholder="e.g. X1234567"
              value={form.documentNumber}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.documentNumber)}
            />
            {fieldErrors.documentNumber ? (
              <p className="field__error">{fieldErrors.documentNumber}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="issueDate">
              Issue date <span className="required">*</span>
            </label>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              className="field__input"
              value={form.issueDate}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.issueDate)}
            />
            {fieldErrors.issueDate ? <p className="field__error">{fieldErrors.issueDate}</p> : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="expiryDate">
              Expiry date <span className="required">*</span>
            </label>
            <input
              id="expiryDate"
              name="expiryDate"
              type="date"
              className="field__input"
              value={form.expiryDate}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.expiryDate)}
            />
            {fieldErrors.expiryDate ? (
              <p className="field__error">{fieldErrors.expiryDate}</p>
            ) : null}
          </div>

          <div className="field field--full">
            <label className="field__label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="field__input field__textarea"
              rows="4"
              maxLength={500}
              placeholder="Optional notes about this document"
              value={form.description}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.description)}
            />
            <p className="field__hint">{form.description.length}/500 characters</p>
            {fieldErrors.description ? (
              <p className="field__error">{fieldErrors.description}</p>
            ) : null}
          </div>
        </div>

        <FileInput
          file={file}
          error={fieldErrors.documentFile}
          onSelect={setFile}
          onClear={() => {
            setFile(null);
            if (existingFile) setRemoveFile(false);
          }}
        />

        {isEdit && existingFile ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={removeFile}
              disabled={Boolean(file)}
              onChange={(event) => setRemoveFile(event.target.checked)}
            />
            <span>
              Remove the current file (<strong>{existingFile.originalName}</strong>)
            </span>
          </label>
        ) : null}

        <div className="form__actions">
          <Link className="btn btn--ghost" to="/documents">
            Cancel
          </Link>
          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add document'}
          </button>
        </div>
      </form>
    </div>
  );
}
