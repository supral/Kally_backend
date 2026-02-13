import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], pageSize: number = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const paginatedItems = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize]
  );

  return {
    page,
    setPage,
    totalPages,
    paginatedItems,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
