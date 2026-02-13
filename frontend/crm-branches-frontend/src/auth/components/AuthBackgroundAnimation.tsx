/**
 * Animated background for login/register: floating bubbles and falling stars.
 * Renders behind the form card, above the blurred background.
 */
export function AuthBackgroundAnimation() {
  return (
    <div className="auth-bg-animation" aria-hidden="true">
      {/* Bubbles - varying sizes and animation delays */}
      {[...Array(14)].map((_, i) => (
        <div
          key={`bubble-${i}`}
          className="auth-bg-bubble"
          style={{
            left: `${8 + (i * 7) % 85}%`,
            width: `${12 + (i % 5) * 4}px`,
            height: `${12 + (i % 5) * 4}px`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${14 + (i % 6)}s`,
          }}
        />
      ))}
      {/* Falling stars */}
      {[...Array(12)].map((_, i) => (
        <div
          key={`star-${i}`}
          className="auth-bg-star"
          style={{
            left: `${5 + (i * 8.5) % 90}%`,
            animationDelay: `${i * 1.2}s`,
            animationDuration: `${8 + (i % 5)}s`,
          }}
        />
      ))}
    </div>
  );
}
