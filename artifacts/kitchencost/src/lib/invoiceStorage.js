import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const uploadInvoiceFile = async (restaurantId, invoiceId, file) => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `restaurants/${restaurantId}/invoices/${invoiceId}.${ext}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return { url, path: snapshot.ref.fullPath, fileType: file.type };
};
