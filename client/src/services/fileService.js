import { api } from './api';

/**
 * Files are served from authenticated API endpoints, so they cannot be opened
 * with a plain link or a new tab - the browser would not send the JWT. Instead
 * the bytes are fetched here and turned into a temporary object URL.
 */
async function fetchBlob(path) {
  const response = await api.get(path, { responseType: 'blob' });
  return response.data;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const fileService = {
  async loadForPreview(documentId) {
    return fetchBlob(`/documents/${documentId}/file`);
  },

  async download(documentId, filename) {
    const blob = await fetchBlob(`/documents/${documentId}/download`);
    triggerDownload(blob, filename);
  },
};

export { triggerDownload };
export default fileService;
