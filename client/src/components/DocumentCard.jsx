import { Link } from 'react-router-dom';
import { formatDate, formatFileSize } from '../utils/date';
import StatusBadge from './StatusBadge';

/**
 * Card layout used on the dashboard and on screens where a table would be too
 * cramped. The documents page uses the table below for wider viewports.
 */
export default function DocumentCard({ document }) {
  return (
    <article className="document-card">
      <header className="document-card__header">
        <div>
          <h3 className="document-card__title">{document.documentName}</h3>
          <p className="document-card__type">{document.documentType}</p>
        </div>
        <StatusBadge status={document.status} />
      </header>

      <dl className="document-card__meta">
        <div>
          <dt>Document number</dt>
          <dd>{document.documentNumber}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{formatDate(document.expiryDate)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{document.remainingLabel}</dd>
        </div>
        {document.documentFile ? (
          <div>
            <dt>File</dt>
            <dd>{formatFileSize(document.documentFile.size)}</dd>
          </div>
        ) : null}
      </dl>

      <footer className="document-card__actions">
        <Link className="btn btn--sm btn--ghost" to={`/documents/${document.id}`}>
          View details
        </Link>
        <Link className="btn btn--sm btn--primary" to={`/documents/${document.id}/edit`}>
          Edit
        </Link>
      </footer>
    </article>
  );
}
