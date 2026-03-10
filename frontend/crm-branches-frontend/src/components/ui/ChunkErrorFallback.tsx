/**
 * Shown when a lazy-loaded chunk fails to load (e.g. 504 Outdated Optimize Dep).
 * Offers a refresh so the user can retry after Vite re-optimizes.
 */
export function ChunkErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <div className="content-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Page failed to load</h2>
        <p className="text-muted" style={{ margin: '0 0 1.25rem' }}>
          This can happen when the dev server updates. Refreshing the page usually fixes it.
        </p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}
