const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const validateInvoiceFile = (file) => {
  if (!file) return 'Nenhum arquivo selecionado.';
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Formato inválido. Use JPG, PNG, WEBP ou PDF.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Arquivo muito grande. Tamanho máximo: 20 MB.';
  }
  return null;
};

export const uploadInvoiceFile = async (restaurantId, invoiceId, file, userId = '') => {
  const validationError = validateInvoiceFile(file);
  if (validationError) throw new Error(validationError);

  const folder = `restaurants/${restaurantId}/invoices`;
  const publicId = `${folder}/${invoiceId}`;

  const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('public_id', publicId);
  formData.append('context', `restaurantId=${restaurantId}|invoiceId=${invoiceId}|uploadedBy=${userId}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro no upload. Tente novamente.');
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    format: data.format,
    width: data.width || null,
    height: data.height || null,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  };
};

export const getCloudinaryPreviewUrl = (url, mimeType, options = {}) => {
  if (!url) return null;
  if (mimeType === 'application/pdf') return url;

  const { width = 800, quality = 'auto', format = 'auto' } = options;

  if (url.includes('res.cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${width},q_${quality},f_${format}/`);
  }
  return url;
};

export const getCloudinaryThumbnailUrl = (url, mimeType) => {
  if (!url || mimeType === 'application/pdf') return null;
  if (url.includes('res.cloudinary.com')) {
    return url.replace('/upload/', '/upload/w_120,h_120,c_fill,q_auto,f_auto/');
  }
  return url;
};
