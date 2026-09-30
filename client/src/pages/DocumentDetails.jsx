import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import documentService from '../services/documentService';
import fileService from '../services/fileService';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import FilePreview from '../components/FilePreview';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatDateTime, formatFileSize } from '../utils/date';

export default function DocumentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [document, setDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setDocument(await documentService.getById(id));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await documentService.remove(id);
      showSuccess('Document deleted.');
      navigate('/documents', { replace: true });
    } catch (deleteError) {
      showError(deleteError.message);
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  const handleDownload = async () => {
    try {
      await fileService.download(id, document.documentFile.originalName);
    } catch (downloadError) {
      showError(downloadError.message);
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <Spinner label="Loading document..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Alert tone="error" title="Document unavailable">
          {error}
        </Alert>
        <Link className="btn btn--ghost" to="/documents">
          Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">{document.documentType}</p>
          <h1 className="page__title">{document.documentName}</h1>
          <StatusBadge status={document.status} />
        </div>
        <Link className="btn btn--ghost" to="/documents">
          Back
        </Link>
      </header>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Document details</h2>
        </div>

        <dl className="detail-grid">
          <div className="detail-grid__item">
            <dt>Document name</dt>
            <dd>{document.documentName}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Document type</dt>
            <dd>{document.documentType}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Document number</dt>
            <dd className="table__mono">{document.documentNumber}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Issue date</dt>
            <dd>{formatDate(document.issueDate)}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Expiry date</dt>
            <dd>{formatDate(document.expiryDate)}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Remaining</dt>
            <dd className={document.status === 'EXPIRED' ? 'text-danger' : ''}>
              {document.remainingLabel}
            </dd>
          </div>
          <div className="detail-grid__item">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={document.status} />
            </dd>
          </div>
          {document.totalValidityDays ? (
            <div className="detail-grid__item">
              <dt>Valid for</dt>
              <dd>{document.totalValidityDays} days</dd>
            </div>
          ) : null}
          <div className="detail-grid__item detail-grid__item--full">
            <dt>Description</dt>
            <dd>{document.description || 'No description provided.'}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Added on</dt>
            <dd>{formatDateTime(document.createdAt)}</dd>
          </div>
          <div className="detail-grid__item">
            <dt>Last updated</dt>
            <dd>{formatDateTime(document.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Uploaded file</h2>
          {document.documentFile ? (
            <span className="muted">{formatFileSize(document.documentFile.size)}</span>
          ) : null}
        </div>
        <FilePreview document={document} />
      </section>

      <div className="form__actions">
        <Link className="btn btn--ghost" to="/documents">
          Back to documents
        </Link>
        {document.documentFile ? (
          <button type="button" className="btn btn--ghost" onClick={handleDownload}>
            Download file
          </button>
        ) : null}
        <Link className="btn btn--primary" to={`/documents/${id}/edit`}>
          Edit
        </Link>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isDeleting}
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete this document?"
        message={`"${document.documentName}" and its uploaded file will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete document"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
