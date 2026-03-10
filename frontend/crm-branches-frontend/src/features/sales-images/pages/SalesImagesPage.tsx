import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getSalesImages, getSalesImage, createSalesImage, updateSalesImage, type SalesImageItem, type SalesImageDetail } from '../../../api/salesImages';
import { getBranches } from '../../../api/branches';
import { useAuth } from '../../../auth/hooks/useAuth';
import { formatCurrency } from '../../../utils/money';
import type { Branch } from '../../../types/common';

type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';

function getPeriodBounds(period: PeriodFilter): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'daily') {
    return { start, end };
  }
  if (period === 'weekly') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return { start, end };
  }
  if (period === 'monthly') {
    start.setDate(1);
    return { start, end };
  }
  start.setMonth(0, 1);
  return { start, end };
}

function isInRange(date: Date, start: Date, end: Date): boolean {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

export default function SalesImagesPage() {
  const { user } = useAuth();
  const [images, setImages] = useState<SalesImageItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('yearly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<SalesImageDetail | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);
  const [manualCountInput, setManualCountInput] = useState<string>('');
  const [savingCount, setSavingCount] = useState(false);
  const [countError, setCountError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadSalesAmount, setUploadSalesAmount] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const canUpload = (user?.role === 'vendor' && user?.branchId) || (isAdmin && !!branchFilter);

  const { totalSales, totalAmount, dailyAmount, dailyCount, weeklyCount, monthlyCount, yearlyCount, filteredImages } = useMemo(() => {
    const daily = getPeriodBounds('daily');
    const weekly = getPeriodBounds('weekly');
    const monthly = getPeriodBounds('monthly');
    const yearly = getPeriodBounds('yearly');
    let d = 0, w = 0, m = 0, y = 0;
    let totalS = 0, totalA = 0, dailyA = 0;
    images.forEach((img) => {
      const dte = new Date(img.date);
      const count = img.manualSalesCount ?? img.salesCount ?? 0;
      const amount = img.salesAmount ?? 0;
      totalS += count;
      totalA += amount;
      if (isInRange(dte, daily.start, daily.end)) {
        d++;
        dailyA += amount;
      }
      if (isInRange(dte, weekly.start, weekly.end)) w++;
      if (isInRange(dte, monthly.start, monthly.end)) m++;
      if (isInRange(dte, yearly.start, yearly.end)) y++;
    });
    const bounds = dateFrom && dateTo
      ? {
          start: new Date(dateFrom),
          end: new Date(dateTo),
        }
      : getPeriodBounds(periodFilter);
    const filtered = images.filter((img) => isInRange(new Date(img.date), bounds.start, bounds.end));
    return {
      totalSales: totalS,
      totalAmount: totalA,
      dailyAmount: dailyA,
      dailyCount: d,
      weeklyCount: w,
      monthlyCount: m,
      yearlyCount: y,
      filteredImages: filtered,
    };
  }, [images, periodFilter, dateFrom, dateTo]);

  const fetchImages = useCallback(() => {
    setLoading(true);
    setError('');
    getSalesImages(isAdmin && branchFilter ? { branchId: branchFilter } : undefined)
      .then((r) => {
        setLoading(false);
        if (r.success) setImages((r.images || []).map((img) => ({ ...img, description: img.description ?? '', manualSalesCount: img.manualSalesCount ?? null, salesAmount: img.salesAmount ?? null })));
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
    setViewDetail(null);
    setCountError('');
    const r = await getSalesImage(id);
    if (r.success && r.image) {
      setViewDetail(r.image);
      setViewImageIndex(0);
      setManualCountInput(r.image.manualSalesCount != null ? String(r.image.manualSalesCount) : '');
    }
    setViewingId(null);
  }

  function closeModal() {
    setViewDetail(null);
    setViewImageIndex(0);
    setManualCountInput('');
    setCountError('');
  }

  useEffect(() => {
    if (viewDetail) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [viewDetail]);

  function handleExport() {
    const headers = ['Title', ...(isAdmin ? ['Branch'] : []), 'Date', 'Description', 'Sales count', 'Amount'];
    const rows = filteredImages.map((img) => {
      const dateStr = new Date(img.date).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      const desc = (img.description ?? '').replace(/"/g, '""');
      const count = img.manualSalesCount ?? img.salesCount ?? 0;
      const amount = (img.salesAmount != null && img.salesAmount > 0) ? String(img.salesAmount) : '';
      const base = [img.title, ...(isAdmin ? [img.branchName ?? ''] : []), dateStr, `"${desc}"`, String(count), amount];
      return base.join(',');
    });
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadImage(base64: string, index: number) {
    const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = viewDetail ? `${viewDetail.title.replace(/[^a-z0-9]/gi, '-')}-${index + 1}.jpg` : `receipt-${index + 1}.jpg`;
    a.click();
  }

  async function handleSaveManualCount() {
    if (!viewDetail) return;
    const val = manualCountInput.trim();
    const num = val === '' ? null : parseInt(val, 10);
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      setCountError('Enter a non-negative number.');
      return;
    }
    setCountError('');
    setSavingCount(true);
    const r = await updateSalesImage(viewDetail.id, { manualSalesCount: num });
    setSavingCount(false);
    if (r.success && r.image) {
      setViewDetail({ ...viewDetail, ...r.image, imageBase64s: viewDetail.imageBase64s });
      setManualCountInput(r.image.manualSalesCount != null ? String(r.image.manualSalesCount) : '');
      setImages((prev) => prev.map((img) => (img.id === viewDetail.id ? { ...img, ...r.image } : img)));
    } else setCountError(r.message || 'Failed to save');
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
    if (uploadFiles.length === 0) {
      setUploadError('Please select at least one image.');
      return;
    }
    const imageFiles = uploadFiles.filter((f) => f.type?.startsWith('image/'));
    if (imageFiles.length === 0) {
      setUploadError('Please select image files (PNG, JPG, etc.).');
      return;
    }
    setUploading(true);
    const imageBase64s: string[] = [];
    for (const file of imageFiles) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });
      if (dataUrl && dataUrl.startsWith('data:image/')) imageBase64s.push(dataUrl);
    }
    if (imageBase64s.length === 0) {
      setUploadError('Could not read any image.');
      setUploading(false);
      return;
    }
    const amountNum = uploadSalesAmount.trim() === '' ? null : Number(uploadSalesAmount);
    const r = await createSalesImage({
      title: uploadTitle.trim(),
      description: uploadDescription.trim() || undefined,
      date: uploadDate,
      imageBase64s,
      ...(amountNum != null && !Number.isNaN(amountNum) && amountNum >= 0 ? { salesAmount: amountNum } : {}),
      ...(isAdmin && branchFilter ? { branchId: branchFilter } : {}),
    });
    setUploading(false);
    if (r.success) {
      setShowUpload(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadDate(new Date().toISOString().slice(0, 10));
      setUploadSalesAmount('');
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchImages();
    } else {
      setUploadError(r.message || 'Upload failed');
    }
  }

  return (
    <div className="dashboard-content sales-images-page">
      <header className="sales-images-hero">
        <div className="sales-images-hero-content">
          <h1 className="sales-images-hero-title">Sales Data</h1>
          <p className="sales-images-hero-subtitle">
            Daily Sales Data. Records are kept for 7 days. The table shows the sales count and amount for each date.
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
              Upload receipts
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={handleExport} disabled={loading || filteredImages.length === 0}>
            Export
          </button>
          <button type="button" className="btn-secondary" onClick={fetchImages} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="sales-images-summary-bar">
        <div className="sales-images-summary-item">
          <span className="sales-images-summary-label">Total sales</span>
          <span className="sales-images-summary-value">{totalSales}</span>
        </div>
        <div className="sales-images-summary-item">
          <span className="sales-images-summary-label">Total amount</span>
          <span className="sales-images-summary-value">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="sales-images-summary-item">
          <span className="sales-images-summary-label">Daily sales amount</span>
          <span className="sales-images-summary-value">{formatCurrency(dailyAmount)}</span>
        </div>
      </div>

      <div className="sales-images-period-bar">
        <div className="sales-images-period-filter-wrap" aria-label="Date filter">
          <label className="sales-images-date-filter-label">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="sales-images-date-input"
              aria-label="Filter from date"
            />
          </label>
          <label className="sales-images-date-filter-label">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="sales-images-date-input"
              aria-label="Filter to date"
            />
          </label>
        </div>
        <div className="sales-images-period-filter-wrap" aria-label="Period filter (left)">
          <select
            value={periodFilter}
            onChange={(e) => { setPeriodFilter(e.target.value as PeriodFilter); setDateFrom(''); setDateTo(''); }}
            className="sales-images-period-select"
            aria-label="Filter by period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="sales-images-period-stats">
          <span className="sales-images-period-stat"><strong>Daily</strong> {dailyCount}</span>
          <span className="sales-images-period-stat"><strong>Weekly</strong> {weeklyCount}</span>
          <span className="sales-images-period-stat"><strong>Monthly</strong> {monthlyCount}</span>
          <span className="sales-images-period-stat"><strong>Yearly</strong> {yearlyCount}</span>
        </div>
        <div className="sales-images-period-filter-wrap" aria-label="Period filter (right)">
          <select
            value={periodFilter}
            onChange={(e) => { setPeriodFilter(e.target.value as PeriodFilter); setDateFrom(''); setDateTo(''); }}
            className="sales-images-period-select"
            aria-label="Filter by period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

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
              <h2 className="sales-images-upload-title">Upload sales receipts</h2>
              <p className="sales-images-upload-subtitle">
                Add daily Sales Data (photo/receipt). Records are retained for 7 days and linked to sales counts.
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
              <div className="sales-images-field sales-images-field-full">
                <label htmlFor="si-description">Description (optional)</label>
                <textarea
                  id="si-description"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g. Notes about this day's sales"
                  rows={2}
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
              <div className="sales-images-field">
                <label htmlFor="si-sales-amount">Sales amount (optional)</label>
                <input
                  id="si-sales-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={uploadSalesAmount}
                  onChange={(e) => setUploadSalesAmount(e.target.value)}
                  placeholder="e.g. 1250.00"
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
                  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type?.startsWith('image/'));
                  if (files.length > 0) setUploadFiles((prev) => [...prev, ...files]);
                }}
              >
                <input
                  ref={fileInputRef}
                  id="si-file"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) setUploadFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }}
                  className="sales-images-file-input"
                />
                {uploadFiles.length > 0 ? (
                  <div className="sales-images-dropzone-preview sales-images-dropzone-preview-multi">
                    {uploadFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="sales-images-dropzone-file-item">
                        <span className="sales-images-dropzone-filename">{file.name}</span>
                        <span className="sales-images-dropzone-size">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          className="sales-images-dropzone-clear"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="sales-images-dropzone-add-more"
                      onClick={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                    >
                      + Add more images
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
                    <span className="sales-images-dropzone-hint">PNG, JPG up to 10MB. Multiple images supported.</span>
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
          <span>Loading Sales Data…</span>
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
          <h3 className="sales-images-empty-title">No Sales Data yet</h3>
          <p className="sales-images-empty-desc">Records are retained for 7 days. Upload receipts above. Admin and staff can both view images.</p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="sales-images-empty content-card">
          <p className="sales-images-empty-desc">No records in the selected period ({periodFilter}).</p>
        </div>
      ) : (
        <div className="sales-images-table-wrap content-card">
          <table className="sales-images-table">
            <thead>
              <tr>
                <th>Title</th>
                {isAdmin && <th>Branch</th>}
                <th>Date</th>
                <th>Description</th>
                <th>Sales count</th>
                <th>Amount</th>
                <th className="th-actions">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredImages.map((img) => (
                <tr
                  key={img.id}
                  onClick={() => handleView(img.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleView(img.id)}
                >
                  <td><strong>{img.title}</strong></td>
                  {isAdmin && <td><span className="sales-images-table-badge">{img.branchName}</span></td>}
                  <td>{new Date(img.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="sales-images-table-desc">{(img.description != null && img.description !== '') ? img.description : '—'}</td>
                  <td>{img.manualSalesCount ?? img.salesCount}{img.manualSalesCount != null ? ' (manual)' : ''}</td>
                  <td>{(img.salesAmount != null && img.salesAmount > 0) ? formatCurrency(img.salesAmount) : '—'}</td>
                  <td className="branch-actions">
                    {viewingId === img.id ? (
                      <span className="sales-images-table-view-loading"><span className="sales-images-loading-spinner" /></span>
                    ) : (
                      <span className="branch-action-btn branch-action-view">View receipt →</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewDetail && (
        <div
          className="sales-images-modal-overlay"
          onClick={closeModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && closeModal()}
        >
          <div className="sales-images-modal sales-images-modal-with-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sales-images-modal-main">
              {viewDetail.imageBase64s && viewDetail.imageBase64s.length > 0 ? (
                <>
                  <img
                    src={viewDetail.imageBase64s[viewImageIndex]?.startsWith('data:') ? viewDetail.imageBase64s[viewImageIndex] : `data:image/jpeg;base64,${viewDetail.imageBase64s[viewImageIndex]}`}
                    alt={`Sales receipt ${viewImageIndex + 1} of ${viewDetail.imageBase64s.length}`}
                    className="sales-images-modal-img"
                  />
                  <div className="sales-images-modal-nav">
                    {viewDetail.imageBase64s.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="sales-images-modal-nav-btn"
                          onClick={(e) => { e.stopPropagation(); setViewImageIndex((i) => Math.max(0, i - 1)); }}
                          disabled={viewImageIndex <= 0}
                          aria-label="Previous image"
                        >
                          ‹
                        </button>
                        <span className="sales-images-modal-nav-label">
                          {viewImageIndex + 1} / {viewDetail.imageBase64s.length}
                        </span>
                        <button
                          type="button"
                          className="sales-images-modal-nav-btn"
                          onClick={(e) => { e.stopPropagation(); setViewImageIndex((i) => Math.min(viewDetail.imageBase64s.length - 1, i + 1)); }}
                          disabled={viewImageIndex >= viewDetail.imageBase64s.length - 1}
                          aria-label="Next image"
                        >
                          ›
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="sales-images-modal-download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const src = viewDetail.imageBase64s[viewImageIndex];
                        if (src) handleDownloadImage(src, viewImageIndex);
                      }}
                      aria-label="Download image"
                      title="Download image"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>
                  </div>
                  {viewDetail.imageBase64s.length > 1 && (
                    <div className="sales-images-modal-thumbs">
                      {viewDetail.imageBase64s.map((src, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`sales-images-modal-thumb ${viewImageIndex === idx ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setViewImageIndex(idx); }}
                          aria-label={`View image ${idx + 1}`}
                        >
                          <img src={src.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="sales-images-modal-no-img">No images</div>
              )}
            </div>
            <aside className="sales-images-modal-sidebar">
              <div className="sales-images-sidebar-header">
                <h3 className="sales-images-sidebar-title">{viewDetail.title}</h3>
                <span className="sales-images-sidebar-date">
                  {new Date(viewDetail.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {isAdmin && <span className="sales-images-sidebar-badge">{viewDetail.branchName}</span>}
              </div>
              {(viewDetail.description != null && viewDetail.description !== '') && (
                <p className="sales-images-sidebar-desc">{viewDetail.description}</p>
              )}
              <div className="sales-images-sidebar-stats">
                <div className="sales-images-sidebar-stat">
                  <span className="sales-images-sidebar-count">{viewDetail.salesCount}</span>
                  <span className="sales-images-sidebar-count-label">sales {viewDetail.manualSalesCount != null ? '(manual)' : ''}</span>
                </div>
                {(viewDetail.salesAmount != null && viewDetail.salesAmount > 0) && (
                  <div className="sales-images-sidebar-stat">
                    <span className="sales-images-sidebar-count">{formatCurrency(viewDetail.salesAmount)}</span>
                    <span className="sales-images-sidebar-count-label">sales amount</span>
                  </div>
                )}
              </div>
              <div className="sales-images-sidebar-edit">
                <label htmlFor="sales-images-manual-count" className="sales-images-sidebar-label">
                  Sales count (manual)
                </label>
                <p className="sales-images-sidebar-hint">Record how many sales for this day locally. Leave empty to use system count.</p>
                <input
                  id="sales-images-manual-count"
                  type="number"
                  min={0}
                  step={1}
                  value={manualCountInput}
                  onChange={(e) => setManualCountInput(e.target.value)}
                  placeholder="e.g. 12"
                  className="sales-images-sidebar-input"
                />
                {countError && <div className="alert alert-error sales-images-sidebar-error">{countError}</div>}
                <button
                  type="button"
                  className="btn-primary sales-images-sidebar-save"
                  onClick={handleSaveManualCount}
                  disabled={savingCount}
                >
                  {savingCount ? <span className="sales-images-loading-spinner" /> : 'Save count'}
                </button>
              </div>
            </aside>
            <button type="button" className="sales-images-modal-close" onClick={closeModal} aria-label="Close">
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
