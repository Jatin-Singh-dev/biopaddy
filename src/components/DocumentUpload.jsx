import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * Reusable Document Upload Component
 * @param {string} label - Display label
 * @param {string} documentType - 'aadhaar_front', 'aadhaar_back', 'land_doc'
 * @param {function} onFileSelect - Callback when file is selected (for registration flow)
 * @param {function} onUploadSuccess - Callback when uploaded directly (for profile flow)
 * @param {boolean} directUpload - If true, uploads to API immediately. If false, just passes file object.
 * @param {string} defaultPreview - URL of existing document
 * @param {string} icon - Emoji icon
 */
export default function DocumentUpload({ 
  label, documentType, onFileSelect, onUploadSuccess, 
  directUpload = false, defaultPreview = null, icon = '📄' 
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(defaultPreview);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File must be smaller than 5MB');
      return;
    }
    const validMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validMimes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    setError('');
    setFile(selectedFile);
    
    // Generate local preview if image
    if (selectedFile.type.startsWith('image/')) {
      const objUrl = URL.createObjectURL(selectedFile);
      setPreview(objUrl);
    } else {
      setPreview('PDF_DOCUMENT');
    }

    if (!directUpload && onFileSelect) {
      onFileSelect(documentType, selectedFile);
      return;
    }

    if (directUpload) {
      await performUpload(selectedFile);
    }
  };

  const performUpload = async (uploadFile) => {
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('document_type', documentType);

      const res = await api.post('/farmers/me/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      if (res.data.success) {
        setPreview(res.data.data.url);
        if (onUploadSuccess) onUploadSuccess(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload document');
      setFile(null);
      setPreview(defaultPreview);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <label className="input-label block mb-2">{label}</label>
      
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative overflow-hidden border-2 border-dashed rounded-xl p-6 text-center transition-colors 
          ${uploading ? 'border-surface-200 bg-surface-50 cursor-wait' : 'border-surface-200 hover:border-brand-300 cursor-pointer'}
          ${error ? 'border-red-300 bg-red-50' : ''}`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".jpg,.jpeg,.png,.pdf" 
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="w-8 h-8 rounded-full border-4 border-surface-200 border-t-brand-500 animate-spin mx-auto" />
              <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs font-medium text-surface-500">Uploading... {progress}%</p>
            </motion.div>
          ) : preview ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {preview === 'PDF_DOCUMENT' || (file && file.type === 'application/pdf') ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl text-red-500">📄</span>
                  <p className="text-sm font-medium text-surface-700 truncate max-w-[200px]">{file?.name || 'Document Uploaded'}</p>
                </div>
              ) : (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-surface-200">
                  <img src={preview} alt="Document Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                    Click to replace
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-3xl mb-2">{icon}</div>
              <p className="text-sm text-surface-500">Click to upload or drag & drop</p>
              <p className="text-xs text-surface-400 mt-1">JPG, PNG or PDF (max 5MB)</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
    </div>
  );
}
