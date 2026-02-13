/**
 * Full-page loading fallback for Suspense (lazy-loaded routes).
 * Keeps layout shell visible and shows a centered spinner in the content area.
 */
export function PageLoader() {
  return (
    <div className="dashboard-content page-loader-wrap" aria-busy="true" aria-label="Loading">
      <div className="vendors-loading">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
