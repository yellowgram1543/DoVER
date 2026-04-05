const BASE_URL = process.env.REACT_APP_API_URL || '';

export const uploadDocument = async (file, uploadedBy) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user', uploadedBy);

  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
};

export const verifyDocument = async (documentId, file) => {
  const formData = new FormData();
  if (documentId) formData.append('document_id', documentId);
  if (file) formData.append('file', file);

  const response = await fetch(`${BASE_URL}/api/verify`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Verification failed with status ${response.status}`);
  }

  return response.json();
};

export const getChain = async () => {
  const response = await fetch(`${BASE_URL}/api/chain`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch chain with status ${response.status}`);
  }

  return response.json();
};

export const getStats = async () => {
  const response = await fetch(`${BASE_URL}/api/stats`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch stats with status ${response.status}`);
  }

  return response.json();
};

