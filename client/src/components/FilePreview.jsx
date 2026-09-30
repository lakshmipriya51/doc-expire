import { useEffect, useState } from 'react';
import fileService from '../services/fileService';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { formatFileSize } from '../utils/date';

const isImage = (mimeType) => mimeType === 'image/jpeg' || mimeType === 'image/png';

/**
 * Previews a stored file. The bytes are fetched with the JWT and shown through
 * a temporary object URL, so the document is never publicly addressable.
 */
export default function FilePreview({ document }) {
  const file = document.documentFile;
  const [objectUrl, setObjectUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return undefined;

    let active = true;
    let createdUrl = null;

    setIsLoading(true);
    setError('');

    fileService
      .loadForPreview(document.id)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || 'The file could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [document.id, file]);

  if (!file) {
    return <p className="muted">No file has been uploaded for this document.</p>;
  }

  const handleDownload = async () => {
    try {
      await fileService.download(document.id, file.originalName);
    } catch (downloadError) {
      setError(downloadError.message || 'The download failed.');
    }
  };

  return (
    <div className="file-preview">
      <div className="file-preview__meta">
        <p className="file-preview__name">{file.originalName}</p>
        <p className="file-preview__detail">
          {formatFileSize(file.size)} &middot; {file.mimeType}
        </p>
      </div>

      {isLoading ? <Spinner label="Loading file..." /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {objectUrl && isImage(file.mimeType) ? (
        <img className="file-preview__image" src={objectUrl} alt={`${document.documentName} scan`} />
      ) : null}

      {objectUrl && !isImage(file.mimeType) ? (
        <iframe className="file-preview__frame" src={objectUrl} title={`${document.documentName} preview`} />
      ) : null}

      <div className="file-preview__actions">
        {objectUrl && isImage(file.mimeType) ? (
          <a className="btn btn--sm btn--ghost" href={objectUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        ) : null}
        <button type="button" className="btn btn--sm btn--primary" onClick={handleDownload}>
          Download file
        </button>
      </div>
    </div>
  );
}
