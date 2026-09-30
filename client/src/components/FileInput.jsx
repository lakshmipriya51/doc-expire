import { useRef, useState } from 'react';
import { ACCEPTED_FILE_TYPES, MAX_UPLOAD_MB } from '../utils/constants';
import { validateFile } from '../utils/validation';
import { formatFileSize } from '../utils/date';

/**
 * File picker with client-side validation. The server validates again - this
 * only exists to give immediate feedback.
 */
export default function FileInput({ file, onSelect, onClear, error }) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');

  const handleChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      onSelect(null);
      return;
    }

    const message = validateFile(selected);
    setLocalError(message);

    if (message) {
      event.target.value = '';
      onSelect(null);
      return;
    }

    onSelect(selected);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    setLocalError('');
    onClear();
  };

  const shownError = localError || error;

  return (
    <div className="file-input">
      <label className="file-input__label" htmlFor="documentFile">
        Upload document copy
      </label>
      <p className="field__hint">
        PDF, JPG, JPEG or PNG. Maximum {MAX_UPLOAD_MB} MB. Files are private to your account.
      </p>

      <div className="file-input__row">
        <input
          id="documentFile"
          ref={inputRef}
          type="file"
          name="documentFile"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleChange}
          className="file-input__control"
          aria-describedby={shownError ? 'documentFile-error' : undefined}
          aria-invalid={shownError ? 'true' : 'false'}
        />
        {file || (inputRef.current && inputRef.current.value) ? (
          <button type="button" className="btn btn--sm btn--ghost" onClick={clear}>
            Remove
          </button>
        ) : null}
      </div>

      {file ? (
        <p className="file-input__selected">
          Selected: <strong>{file.name}</strong> ({formatFileSize(file.size)})
        </p>
      ) : null}

      {shownError ? (
        <p className="field__error" id="documentFile-error">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
