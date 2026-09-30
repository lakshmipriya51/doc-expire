import { Link } from 'react-router-dom';
import { formatDate } from '../utils/date';
import StatusBadge from './StatusBadge';

export default function DocumentTable({ documents }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Type</th>
            <th scope="col">Number</th>
            <th scope="col">Expiry date</th>
            <th scope="col">Remaining</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td data-label="Document">
                <Link className="table__primary-link" to={`/documents/${document.id}`}>
                  {document.documentName}
                </Link>
              </td>
              <td data-label="Type">{document.documentType}</td>
              <td data-label="Number" className="table__mono">
                {document.documentNumber}
              </td>
              <td data-label="Expiry date">{formatDate(document.expiryDate)}</td>
              <td data-label="Remaining">{document.remainingLabel}</td>
              <td data-label="Status">
                <StatusBadge status={document.status} />
              </td>
              <td className="table__actions">
                <Link className="btn btn--sm btn--ghost" to={`/documents/${document.id}`}>
                  View
                </Link>
                <Link className="btn btn--sm btn--primary" to={`/documents/${document.id}/edit`}>
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
