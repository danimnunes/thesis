import type { PaginatedList } from "../interfaces/index.ts";

interface PaginationLinks {
  firstPage: number;
  lastPage: number;
  nextPage: number;
  prevPage: number;
}

export function compute1BasedPaginationLinks(
  total: number,
  currentPage: number,
  pageSize: number,
): PaginationLinks {
  const firstPage = 1;
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const prevPage = Math.max(Math.min(currentPage - 1, lastPage), firstPage);
  const nextPage = Math.max(Math.min(currentPage + 1, lastPage), firstPage);

  return { firstPage, lastPage, nextPage, prevPage };
}

export function paginate<T>(
  items: T[],
  baseUrl: string,
  total: number,
  page: number,
  pageSize: number,
  extraQuery = "",
): PaginatedList<T> {
  const { firstPage, lastPage, nextPage, prevPage } =
    compute1BasedPaginationLinks(total, page, pageSize);

  return {
    items,
    links: {
      first: `${baseUrl}?page[after]=${firstPage}&page[size]=${pageSize}${extraQuery}`,
      last: `${baseUrl}?page[after]=${lastPage}&page[size]=${pageSize}${extraQuery}`,
      next: `${baseUrl}?page[after]=${nextPage}&page[size]=${pageSize}${extraQuery}`,
      prev: `${baseUrl}?page[after]=${prevPage}&page[size]=${pageSize}${extraQuery}`,
    },
    pageSize,
    self: `${baseUrl}?page[after]=${page}&page[size]=${pageSize}${extraQuery}`,
    total,
  };
}
