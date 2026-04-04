export interface PaginatedList<T> {
  items: T[];
  links?: {
    first: string;
    last: string;
    next: string;
    prev: string;
  };
  pageSize?: number;
  self?: string;
  total: number;
}
