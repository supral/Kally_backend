import { useEffect, useState, useCallback, useRef } from 'react';
import { getSalesImages, getSalesImage, createSalesImage, type SalesImageItem } from '../../../api/salesImages';
import { getBranches } from '../../../api/branches';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Branch } from '../../../types/common';

export default function SalesImagesPage() {
  const { user } = useAuth();
  const [images, setImages] = useState<SalesImageItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const canUpload = (user?.role === 'vendor' && user?.branchId) || (isAdmin && !!branchFilter);

  const fetchImages = useCallback(() => {
    setLoading(true);
    setError('');
    getSalesImages(isAdmin && branchFilter ? { branchId: branchFilter } : undefined)
      .then((r) => {
        setLoading(false);
        if (r.success) setImages(r.images || []);
        else setError(r.message || 'Failed to load');
      })
      .catch(() => setLoading(false));
  }, [isAdmin, branchFilter]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  useEffect(() => {
    if (isAdmin) getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, [isAdmin]);

  async function handleView(id: string) {
    setViewingId(id);
    setViewImage(null);
    const r = await getSalesImage(id);
    if (r.success && r.image?.imageBase64) setViewImage(r.image.imageBase64);
    setViewingId(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError('');
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadDate) {
      setUploadError('Date is required.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select an image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        setUploadError('Could not read image.');
        return;
      }
      setUploading(true);
      const r = await createSalesImage({
        title: uploadTitle.trim(),
        date: uploadDate,
        imageBase64: dataUrl,
        ...(isAdmin && branchFilter ? { branchId: branchFilter } : {}),
      });
      setUploading(false);
      if (r.success) {
        setShowUpload(false);
        setUploadTitle('');
        setUploadDate(new Date().toISOString().slice(0, 10));
        setUploadFile(null);
        fetchImages();
      } else setUploadError(r.message || 'Upload failed');
    };
    reader.readAsDataURL(uploadFile);
  }

  return (
    <div className="dashboard-content sales-images-page">
      <header className="sales-images-hero">
        <div className="sales-images-hero-content">
          <h1 className="sales-images-hero-title">Sales images</h1>
          <p className="sales-images-hero-subtitle">
            Daily sales receipts and photos. Images are kept for 7 days. Each card shows the sales count for that date.
          </p>
        </div>
        <div className="sales-images-hero-actions">
          {isAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="branch-filter-select"
              aria-label="Filter by branch"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {canUpload && (
            <button type="button" className="btn-primary sales-images-upload-btn" onClick={() => setShowUpload(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload receipt
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={fetchImages} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {showUpload && canUpload && (
        <section className="sales-images-upload-section content-card">
          <div className="sales-images-upload-header">
            <div className="sales-images-upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div>
              <h2 className="sales-images-upload-title">Upload sales receipt</h2>
              <p className="sales-images-upload-subtitle">
                Add a daily sales photo. Images are retained for 7 days and linked to sales counts.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="sales-images-upload-form">
            <div className="sales-images-upload-fields">
              <div className="sales-images-field">
                <label htmlFor="si-title">Title</label>
                <input
                  id="si-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Daily sales Feb 23"
                />
              </div>
              <div className="sales-images-field">
                <label htmlFor="si-date">Date</label>
                <input
                  id="si-date"
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                />
              </div>
            </div>

            <div className="sales-images-dropzone-wrap">
              <label
                htmlFor="si-file"
                className={`sales-images-dropzone ${dropActive ? 'sales-images-dropzone-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropActive(false);
                  const file = e.dataTransfer?.files?.[0];
                  if (file?.type?.startsWith('image/')) setUploadFile(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  id="si-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="sales-images-file-input"
                />
                {uploadFile ? (
                  <div className="sales-images-dropzone-preview">
                    <span className="sales-images-dropzone-filename">{uploadFile.name}</span>
                    <span className="sales-images-dropzone-size">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      className="sales-images-dropzone-clear"
                      onClick={(e) => {
                        e.preventDefault();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="sales-images-dropzone-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span className="sales-images-dropzone-text">Drag & drop or click to browse</span>
                    <span className="sales-images-dropzone-hint">PNG, JPG up to 10MB</span>
                  </>
                )}
              </label>
            </div>

            {uploadError && <div className="alert alert-error sales-images-upload-error">{uploadError}</div>}

            <div className="sales-images-upload-actions">
              <button type="submit" className="btn-primary sales-images-submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <span className="sales-images-spinner" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg className="sales-images-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowUpload(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="sales-images-loading">
          <span className="sales-images-loading-spinner" />
          <span>Loading sales images…</span>
        </div>
      ) : images.length === 0 ? (
        <div className="sales-images-empty content-card">
          <div className="sales-images-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className="sales-images-empty-title">No sales images yet</h3>
          <p className="sales-images-empty-desc">Images are retained for 7 days. Upload your first receipt above.</p>
        </div>
      ) : (
        <div className="sales-images-grid">
          {images.map((img) => (
            <article key={img.id} className="sales-image-card content-card">
              <div className="sales-image-card-header">
                <h3 className="sales-image-card-title">{img.title}</h3>
                <span className="sales-image-card-date">{new Date(img.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {isAdmin && <span className="sales-image-card-badge">{img.branchName}</span>}
              </div>
              <div className="sales-image-card-stat">
                <span className="sales-image-card-count">{img.salesCount}</span>
                <span className="sales-image-card-count-label">sales</span>
              </div>
              <button
                type="button"
                className="sales-image-card-view"
                onClick={() => handleView(img.id)}
                disabled={!!viewingId}
              >
                {viewingId === img.id ? (
                  <span className="sales-images-loading-spinner" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View receipt
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      )}

      {viewImage && (
        <div
          className="sales-images-modal-overlay"
          onClick={() => setViewImage(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setViewImage(null)}
        >
          <div className="sales-images-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewImage.startsWith('data:') ? viewImage : `data:image/jpeg;base64,${viewImage}`}
              alt="Sales receipt"
              className="sales-images-modal-img"
            />
            <button type="button" className="sales-images-modal-close" onClick={() => setViewImage(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
