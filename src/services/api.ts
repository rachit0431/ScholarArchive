import { Paper, Note, Subject, StudentUser, AdminUser, SystemStats, SavedPaperEntry, SavedNoteEntry, ArchiveResponse } from '../types';

const TOKEN_KEY = 'scholararchive_session_token';

export const tokenStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string, remember: boolean = true) {
    try {
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(TOKEN_KEY);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to save session token:', e);
    }
  },
  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('Failed to clear session token:', e);
    }
  },
};

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.getToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}

export function cleanErrorMessage(rawText: string, status?: number): string {
  if (!rawText) {
    if (status === 413) {
      return 'File size is too large (HTTP 413). Maximum allowed PDF upload size is 60 MB.';
    }
    return status ? `Request failed with status ${status}` : 'Unknown request error occurred.';
  }

  // 1. Try parsing JSON error structure
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.error) return String(parsed.error);
    if (parsed.message) return String(parsed.message);
  } catch {
    // not JSON
  }

  // 2. Specific status 413 / Request Entity Too Large detection
  if (status === 413 || rawText.includes('413 Request Entity Too Large') || rawText.includes('request that was too large')) {
    return 'File is too large for the server request limit (HTTP 413). Please ensure your document is 60 MB or less.';
  }

  // 3. Extract text from HTML if rawText contains markup
  if (rawText.includes('<html') || rawText.includes('<body') || rawText.includes('<!DOCTYPE')) {
    const titleMatch = rawText.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].replace(/Error:?\s*/i, '').trim();
    }
    const h1Match = rawText.match(/<h1>(.*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return h1Match[1].replace(/Error:?\s*/i, '').trim();
    }
    const stripped = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length > 0 && stripped.length < 150) {
      return stripped;
    }
    return `Server error (${status || 500})`;
  }

  return rawText.trim();
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function getResponseErrorMessage(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    return cleanErrorMessage(raw, res.status);
  } catch (e: any) {
    return `Server returned HTTP ${res.status}: ${e?.message || 'Failed to read response body'}`;
  }
}

/**
 * Downloads a PDF binary as a Blob, transparently using HTTP Range chunking
 * for large files (> 20 MB) so that Cloud Run's 32 MiB body limits are never exceeded.
 */
export async function fetchPdfBlob(
  url: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<Blob> {
  let totalBytes = 0;
  let supportsRange = false;
  let contentType = 'application/pdf';

  // Probe with Range: bytes=0-0 to check range support and discover total content length
  try {
    const probeRes = await authFetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });

    if (probeRes.status === 206) {
      supportsRange = true;
      const contentRange = probeRes.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          totalBytes = parseInt(match[1], 10);
        }
      }
      contentType = probeRes.headers.get('content-type') || contentType;
    } else if (probeRes.ok) {
      // Server returned entire document directly (e.g. 200 OK without range)
      const blob = await probeRes.blob();
      if (onProgress) {
        onProgress(blob.size, blob.size);
      }
      return blob;
    } else {
      const errMsg = await getResponseErrorMessage(probeRes);
      throw new Error(errMsg);
    }
  } catch (probeErr: any) {
    if (probeErr.message && !probeErr.message.includes('fetch')) {
      throw probeErr;
    }
  }

  // If the file is large (> 20 MB) and the server supports range requests, download in 8 MB chunks
  const CHUNK_SIZE = 8 * 1024 * 1024;
  if (supportsRange && totalBytes > 20 * 1024 * 1024) {
    const chunks: BlobPart[] = [];
    let received = 0;

    for (let start = 0; start < totalBytes; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1);
      const res = await authFetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
      });

      if (!res.ok && res.status !== 206) {
        const errMsg = await getResponseErrorMessage(res);
        throw new Error(`Failed to load PDF chunk (${start}-${end}): ${errMsg}`);
      }

      const ab = await res.arrayBuffer();
      chunks.push(ab);
      received += ab.byteLength;

      if (onProgress) {
        onProgress(received, totalBytes);
      }
    }

    return new Blob(chunks, { type: contentType.includes('pdf') ? 'application/pdf' : contentType });
  }

  // Standard fetch for files <= 20 MB or when range probe didn't indicate large file
  const res = await authFetch(url);
  if (!res.ok) {
    const errMsg = await getResponseErrorMessage(res);
    throw new Error(errMsg);
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/pdf') && !ct.includes('application/octet-stream')) {
    throw new Error(`Unexpected content format received (${ct || 'unknown'}). Expected authentic PDF document.`);
  }

  const blob = await res.blob();
  if (onProgress) {
    onProgress(blob.size, blob.size);
  }
  return blob;
}

export const api = {
  // Stats
  async getStats(): Promise<SystemStats> {
    const res = await authFetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch repository statistics');
    return res.json();
  },

  // Papers Query
  async getPapers(params?: {
    search?: string;
    year?: string;
    btechYear?: string;
    semester?: string;
    examType?: string;
    subject?: string;
  }): Promise<Paper[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'All') {
          searchParams.append(k, v);
        }
      });
    }
    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await authFetch(`/api/papers${queryStr}`);
    if (!res.ok) throw new Error('Failed to fetch question papers');
    return res.json();
  },

  async getPaperById(id: string): Promise<Paper> {
    try {
      const res = await authFetch(`/api/papers/${id}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback to question-papers alias
    }
    const res2 = await authFetch(`/api/question-papers/${id}`);
    if (!res2.ok) throw new Error('Failed to fetch paper details');
    return res2.json();
  },

  async uploadPaperChunked(formData: FormData, file: File, onProgress?: (percent: number) => void): Promise<Paper> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk (well below Cloud Run 32 MB HTTP/1 request limit)
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    const uploadId = 'chunk-paper-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const token = tokenStorage.getToken();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(fileSize, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      const chunkFormData = new FormData();
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('totalSize', fileSize.toString());
      chunkFormData.append('chunk', chunkBlob, file.name);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/papers/upload-chunk', true);
        xhr.timeout = 600000;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const currentChunkLoaded = e.loaded;
              const overallLoaded = start + currentChunkLoaded;
              const percent = Math.min(98, Math.round((overallLoaded / fileSize) * 100));
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            const cleanMsg = cleanErrorMessage(xhr.responseText, xhr.status);
            reject(new Error(cleanMsg));
          }
        };

        xhr.onerror = () => reject(new Error(`Network error uploading paper chunk ${chunkIndex + 1} of ${totalChunks}`));
        xhr.ontimeout = () => reject(new Error(`Chunk upload timed out for part ${chunkIndex + 1}`));
        xhr.send(chunkFormData);
      });
    }

    if (onProgress) onProgress(99);

    const completeRes = await authFetch('/api/papers/complete-chunk-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        subjectName: formData.get('subjectName') as string,
        subjectCode: formData.get('subjectCode') as string,
        examType: formData.get('examType') as string,
        academicYear: formData.get('academicYear') as string,
        btechYear: formData.get('btechYear') as string,
        semester: formData.get('semester') as string,
        paperDate: formData.get('paperDate') as string,
        maxMarks: formData.get('maxMarks') as string,
        durationMinutes: formData.get('durationMinutes') as string,
        description: formData.get('description') as string,
        originalFilename: file.name,
        totalSize: fileSize,
      }),
    });

    if (!completeRes.ok) {
      let errMsg = 'Failed to finalize paper upload.';
      try {
        const errJson = await completeRes.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {
        const text = await completeRes.text();
        errMsg = cleanErrorMessage(text, completeRes.status);
      }
      throw new Error(errMsg);
    }

    if (onProgress) onProgress(100);
    return await completeRes.json();
  },

  async uploadPaper(formData: FormData, onProgress?: (percent: number) => void): Promise<Paper> {
    const file = (formData.get('pdfFile') || formData.get('file')) as File | null;
    const CHUNK_THRESHOLD = 20 * 1024 * 1024; // 20 MB threshold (Cloud Run limit is 32 MB)

    // For files > 20 MB, use chunked upload to safely bypass proxy limits (Cloud Run 32MB limit)
    if (file && file.size > CHUNK_THRESHOLD) {
      return this.uploadPaperChunked(formData, file, onProgress);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/papers', true);
      // Generous 10-minute timeout for large PDF documents over varied connections
      xhr.timeout = 600000;

      const token = tokenStorage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch {
            reject(new Error('Invalid response from server after upload.'));
          }
        } else if (xhr.status === 413 && file) {
          // If 413 was returned from intermediate proxy, retry automatically via chunked upload
          try {
            const chunkedResult = await this.uploadPaperChunked(formData, file, onProgress);
            resolve(chunkedResult);
          } catch (chunkErr: any) {
            reject(chunkErr);
          }
        } else {
          const cleanMsg = cleanErrorMessage(xhr.responseText, xhr.status);
          reject(new Error(cleanMsg));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload. Please check your internet connection.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out. The file took longer than 10 minutes to transmit. Please check connection and try again.'));
      };

      xhr.onabort = () => {
        reject(new Error('Upload operation was aborted.'));
      };

      xhr.send(formData);
    });
  },

  async updatePaper(id: string, formData: FormData, onProgress?: (percent: number) => void): Promise<Paper> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/papers/${id}`, true);
      xhr.timeout = 600000;

      const token = tokenStorage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch {
            reject(new Error('Invalid response from server after update.'));
          }
        } else {
          try {
            const errObj = JSON.parse(xhr.responseText);
            reject(new Error(errObj.error || `Update failed (status ${xhr.status})`));
          } catch {
            reject(new Error(xhr.responseText || `Update failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file update.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Update timed out. The file took longer than 10 minutes to transmit.'));
      };

      xhr.send(formData);
    });
  },

  async deletePaper(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`/api/papers/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      let errMsg = 'Failed to delete paper';
      try {
        const err = await res.json();
        errMsg = err.error || err.message || errMsg;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    return res.json().catch(() => ({ success: true, message: 'Deleted' }));
  },

  getViewUrl(id: string): string {
    const token = tokenStorage.getToken();
    return token ? `/api/question-papers/${id}/pdf?token=${encodeURIComponent(token)}` : `/api/question-papers/${id}/pdf`;
  },

  getQuestionPaperPdfUrl(id: string): string {
    const token = tokenStorage.getToken();
    return token ? `/api/question-papers/${id}/pdf?token=${encodeURIComponent(token)}` : `/api/question-papers/${id}/pdf`;
  },

  getDownloadUrl(id: string): string {
    const token = tokenStorage.getToken();
    return token ? `/api/papers/download/${id}?token=${encodeURIComponent(token)}` : `/api/papers/download/${id}`;
  },

  async downloadPaperBlob(id: string, filename: string): Promise<void> {
    const downloadUrl = this.getDownloadUrl(id);

    try {
      const blob = await fetchPdfBlob(downloadUrl);
      if (blob.size >= 5) {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || `paper-${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        return;
      }
    } catch (fetchErr: any) {
      if (fetchErr.message && (fetchErr.message.includes('Authentication') || fetchErr.message.includes('not found'))) {
        throw fetchErr;
      }
      console.warn('In-memory blob download failed, falling back to direct browser download stream:', fetchErr);
    }

    // Direct browser download trigger fallback
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename || `paper-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // --- Notes Management ---
  async getNotes(params?: {
    search?: string;
    btechYear?: string;
    semester?: string;
    subject?: string;
  }): Promise<Note[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'All') {
          searchParams.append(k, v);
        }
      });
    }
    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await authFetch(`/api/notes${queryStr}`);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  async getNoteById(id: string): Promise<Note> {
    const res = await authFetch(`/api/notes/${id}`);
    if (!res.ok) throw new Error('Failed to fetch note details');
    return res.json();
  },

  async uploadNoteChunked(formData: FormData, file: File, onProgress?: (percent: number) => void): Promise<Note> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk (well below Cloud Run 32 MB HTTP/1 request limit)
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    const uploadId = 'chunk-note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const token = tokenStorage.getToken();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(fileSize, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      const chunkFormData = new FormData();
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('totalSize', fileSize.toString());
      chunkFormData.append('chunk', chunkBlob, file.name);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/notes/upload-chunk', true);
        xhr.timeout = 600000;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const currentChunkLoaded = e.loaded;
              const overallLoaded = start + currentChunkLoaded;
              const percent = Math.min(98, Math.round((overallLoaded / fileSize) * 100));
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            const cleanMsg = cleanErrorMessage(xhr.responseText, xhr.status);
            reject(new Error(cleanMsg));
          }
        };

        xhr.onerror = () => reject(new Error(`Network error uploading note chunk ${chunkIndex + 1} of ${totalChunks}`));
        xhr.ontimeout = () => reject(new Error(`Chunk upload timed out for part ${chunkIndex + 1}`));
        xhr.send(chunkFormData);
      });
    }

    if (onProgress) onProgress(99);

    const completeRes = await authFetch('/api/notes/complete-chunk-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        title: formData.get('title') as string,
        subjectName: formData.get('subjectName') as string,
        subjectCode: formData.get('subjectCode') as string,
        btechYear: formData.get('btechYear') as string,
        semester: formData.get('semester') as string,
        description: formData.get('description') as string,
        originalFilename: file.name,
        totalSize: fileSize,
      }),
    });

    if (!completeRes.ok) {
      let errMsg = 'Failed to finalize note upload.';
      try {
        const errJson = await completeRes.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {
        const text = await completeRes.text();
        errMsg = cleanErrorMessage(text, completeRes.status);
      }
      throw new Error(errMsg);
    }

    if (onProgress) onProgress(100);
    return await completeRes.json();
  },

  async uploadNote(formData: FormData, onProgress?: (percent: number) => void): Promise<Note> {
    const file = (formData.get('file') || formData.get('pdfFile')) as File | null;
    const CHUNK_THRESHOLD = 20 * 1024 * 1024; // 20 MB threshold (Cloud Run limit is 32 MB)

    // For files > 20 MB, use chunked upload to safely bypass proxy limits (Cloud Run 32MB limit)
    if (file && file.size > CHUNK_THRESHOLD) {
      return this.uploadNoteChunked(formData, file, onProgress);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/notes', true);
      xhr.timeout = 600000;

      const token = tokenStorage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch {
            reject(new Error('Invalid response from server after uploading note.'));
          }
        } else if (xhr.status === 413 && file) {
          // If 413 was returned from intermediate proxy, retry automatically via chunked upload
          try {
            const chunkedResult = await this.uploadNoteChunked(formData, file, onProgress);
            resolve(chunkedResult);
          } catch (chunkErr: any) {
            reject(chunkErr);
          }
        } else {
          const cleanMsg = cleanErrorMessage(xhr.responseText, xhr.status);
          reject(new Error(cleanMsg));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during note upload. Please check your internet connection.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out. The note file took longer than 10 minutes to transmit.'));
      };

      xhr.onabort = () => {
        reject(new Error('Note upload operation was aborted.'));
      };

      xhr.send(formData);
    });
  },

  async deleteNote(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`/api/notes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      let errMsg = 'Failed to delete note';
      try {
        const err = await res.json();
        errMsg = err.error || err.message || errMsg;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    return res.json().catch(() => ({ success: true, message: 'Deleted' }));
  },

  getNoteViewUrl(id: string): string {
    const token = tokenStorage.getToken();
    return token ? `/api/notes/view/${id}?token=${encodeURIComponent(token)}` : `/api/notes/view/${id}`;
  },

  getNoteDownloadUrl(id: string): string {
    const token = tokenStorage.getToken();
    return token ? `/api/notes/download/${id}?token=${encodeURIComponent(token)}` : `/api/notes/download/${id}`;
  },

  async downloadNoteBlob(id: string, filename: string): Promise<void> {
    const downloadUrl = this.getNoteDownloadUrl(id);

    try {
      const blob = await fetchPdfBlob(downloadUrl);
      if (blob.size >= 5) {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || `note-${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        return;
      }
    } catch (fetchErr: any) {
      if (fetchErr.message && (fetchErr.message.includes('Authentication') || fetchErr.message.includes('not found'))) {
        throw fetchErr;
      }
      console.warn('In-memory blob download failed, falling back to direct browser download stream:', fetchErr);
    }

    // Direct browser download trigger fallback (streams directly to user Downloads folder via native browser pipeline)
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename || `note-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async getSubjects(): Promise<Subject[]> {
    const res = await authFetch('/api/subjects');
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  },

  async addSubject(sub: Partial<Subject>): Promise<Subject> {
    const res = await authFetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create subject' }));
      throw new Error(err.error || 'Failed to create subject');
    }
    return res.json();
  },

  async deleteSubject(id: string): Promise<void> {
    const res = await authFetch(`/api/subjects/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete subject' }));
      throw new Error(err.error || 'Failed to delete subject');
    }
  },

  // Academic Years
  async getYears(): Promise<string[]> {
    const res = await authFetch('/api/years');
    if (!res.ok) throw new Error('Failed to fetch years');
    return res.json();
  },

  async addYear(year: string): Promise<string[]> {
    const res = await authFetch('/api/years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add year' }));
      throw new Error(err.error || 'Failed to add year');
    }
    return res.json();
  },

  async deleteYear(year: string): Promise<string[]> {
    const res = await authFetch(`/api/years/${encodeURIComponent(year)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete year' }));
      throw new Error(err.error || 'Failed to delete year');
    }
    const data = await res.json();
    return data.years;
  },

  // Exam Types
  async getExamTypes(): Promise<string[]> {
    const res = await authFetch('/api/exam-types');
    if (!res.ok) throw new Error('Failed to fetch exam types');
    return res.json();
  },

  async addExamType(typeName: string): Promise<string[]> {
    const res = await authFetch('/api/exam-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add exam type' }));
      throw new Error(err.error || 'Failed to add exam type');
    }
    return res.json();
  },

  async deleteExamType(type: string): Promise<string[]> {
    const res = await authFetch(`/api/exam-types/${encodeURIComponent(type)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete exam type' }));
      throw new Error(err.error || 'Failed to delete exam type');
    }
    const data = await res.json();
    return data.examTypes;
  },

  // --- Real Authentication System ---

  // Check current session on mount / page refresh
  async getMe(): Promise<{ role: 'student' | 'admin'; user?: StudentUser; admin?: AdminUser } | null> {
    const token = tokenStorage.getToken();
    if (!token) return null;

    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) {
        tokenStorage.clearToken();
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  },

  // Student Sign Up
  async studentSignup(data: {
    name: string;
    email: string;
    password: string;
    year: string;
    semester: string;
  }): Promise<{ success: boolean; token: string; user: StudentUser }> {
    const res = await fetch('/api/auth/student-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Sign up failed' }));
      throw new Error(err.error || 'Failed to register account');
    }
    const result = await res.json();
    if (result.token) {
      tokenStorage.setToken(result.token, true);
    }
    return result;
  },

  // Student Login
  async studentLogin(
    email: string,
    password?: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; token: string; user: StudentUser }> {
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Invalid email or password.');
    }
    const result = await res.json();
    if (result.token) {
      tokenStorage.setToken(result.token, rememberMe);
    }
    return result;
  },

  // Admin Login
  async adminLogin(email: string, password: string): Promise<{ success: boolean; token: string; admin: AdminUser }> {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Admin login failed' }));
      throw new Error(err.error || 'Invalid administrator authorization');
    }
    const result = await res.json();
    if (result.token) {
      tokenStorage.setToken(result.token, true);
    }
    return result;
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue clearing client token even if network fails
    } finally {
      tokenStorage.clearToken();
    }
  },

  // Real Password Reset Request
  async forgotPassword(email: string): Promise<{ success: boolean; message: string; resetCode?: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to request reset' }));
      throw new Error(err.error || 'Failed to dispatch password recovery');
    }
    return res.json();
  },

  // Real Password Reset Completion
  async resetPassword(data: {
    email: string;
    resetCode: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Reset failed' }));
      throw new Error(err.error || 'Failed to reset password');
    }
    return res.json();
  },

  // Auth Configuration (e.g. Google OAuth Client ID)
  async getAuthConfig(): Promise<{ googleClientId?: string }> {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) return res.json();
    } catch {
      // ignore
    }
    return {};
  },

  // Real Google OAuth Login
  async googleLogin(data: {
    credential?: string;
    accessToken?: string;
  }): Promise<{ success: boolean; token: string; user: StudentUser }> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Google login failed' }));
      throw new Error(err.error || 'Google authentication failed');
    }
    const result = await res.json();
    if (result.token) {
      tokenStorage.setToken(result.token, true);
    }
    return result;
  },

  // Student Actions & Persistent Archive
  async getStudentArchive(): Promise<ArchiveResponse> {
    const res = await authFetch('/api/student/archive');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load archive' }));
      throw new Error(err.error || 'Failed to fetch personal archive');
    }
    return res.json();
  },

  async savePaperToArchive(paperId: string): Promise<{ success: boolean; isSaved: boolean; isBookmarked: boolean; savedPapers: SavedPaperEntry[]; bookmarks: string[] }> {
    const res = await authFetch('/api/student/archive/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save paper to archive' }));
      throw new Error(err.error || 'Failed to save paper to archive');
    }
    return res.json();
  },

  async removePaperFromArchive(paperId: string): Promise<{ success: boolean; isSaved: boolean; isBookmarked: boolean; savedPapers: SavedPaperEntry[]; bookmarks: string[] }> {
    const res = await authFetch('/api/student/archive/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove paper from archive' }));
      throw new Error(err.error || 'Failed to remove paper from archive');
    }
    return res.json();
  },

  async toggleArchive(paperId: string): Promise<{ success: boolean; isSaved: boolean; isBookmarked: boolean; savedPapers: SavedPaperEntry[]; bookmarks: string[] }> {
    const res = await authFetch('/api/student/archive/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update archive' }));
      throw new Error(err.error || 'Failed to update archive');
    }
    return res.json();
  },

  async toggleBookmark(paperId: string): Promise<{ bookmarks: string[]; savedPapers?: SavedPaperEntry[]; isBookmarked: boolean; isSaved?: boolean }> {
    const res = await authFetch('/api/student/bookmarks/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bookmark failed' }));
      throw new Error(err.error || 'Failed to update bookmark');
    }
    return res.json();
  },

  async recordDownload(id: string, type: 'paper' | 'note' = 'paper'): Promise<{ success: boolean; alreadyArchived?: boolean; savedPapers?: SavedPaperEntry[]; savedNotes?: SavedNoteEntry[]; bookmarks?: string[]; recentDownloads?: any[] }> {
    const res = await authFetch('/api/student/downloads/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paperId: type === 'paper' ? id : undefined,
        noteId: type === 'note' ? id : undefined,
        type,
      }),
    });
    if (!res.ok) {
      return { success: false };
    }
    return res.json().catch(() => ({ success: true }));
  },

  async saveNoteToArchive(noteId: string): Promise<{ success: boolean; isSaved: boolean; savedNotes: SavedNoteEntry[] }> {
    const res = await authFetch('/api/student/archive/notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save note to archive' }));
      throw new Error(err.error || 'Failed to save note to archive');
    }
    return res.json();
  },

  async removeNoteFromArchive(noteId: string): Promise<{ success: boolean; isSaved: boolean; savedNotes: SavedNoteEntry[] }> {
    const res = await authFetch('/api/student/archive/notes/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove note from archive' }));
      throw new Error(err.error || 'Failed to remove note from archive');
    }
    return res.json();
  },

  async toggleNoteArchive(noteId: string): Promise<{ success: boolean; isSaved: boolean; savedNotes: SavedNoteEntry[] }> {
    const res = await authFetch('/api/student/archive/notes/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update note archive' }));
      throw new Error(err.error || 'Failed to update note archive');
    }
    return res.json();
  },

  async getStudents(params?: {
    search?: string;
    year?: string;
    semester?: string;
    status?: string;
    authMethod?: string;
  }): Promise<StudentUser[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.year && params.year !== 'All') query.set('year', params.year);
    if (params?.semester && params.semester !== 'All') query.set('semester', params.semester);
    if (params?.status && params.status !== 'All') query.set('status', params.status);
    if (params?.authMethod && params.authMethod !== 'All') query.set('authMethod', params.authMethod);

    const url = `/api/students${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unauthorized' }));
      throw new Error(err.error || 'Access denied. Administrative authorization required.');
    }
    return res.json();
  },

  async getStudentById(id: string): Promise<StudentUser> {
    const res = await authFetch(`/api/students/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch student record' }));
      throw new Error(err.error || 'Student record not found.');
    }
    return res.json();
  },

  async updateStudentStatus(
    id: string,
    status: 'active' | 'disabled'
  ): Promise<{ success: boolean; message: string; student: StudentUser }> {
    const res = await authFetch(`/api/students/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update student status' }));
      throw new Error(err.error || 'Failed to update student status');
    }
    return res.json();
  },

  async deleteStudent(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete student account' }));
      throw new Error(err.error || 'Failed to delete student account');
    }
    return res.json();
  },

  // Contact Form Submission (Direct email to rqchit2009@gmail.com via backend)
  async sendContactMessage(payload: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; message: string; messageId?: string; previewUrl?: string }> {
    const res = await authFetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({
      error: 'Unexpected server response while delivering your message.',
    }));

    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit contact inquiry.');
    }

    return data;
  },
};
