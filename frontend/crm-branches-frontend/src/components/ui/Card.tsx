import type { HTMLAttributes } from 'react';

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`content-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
