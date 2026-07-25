export type GlobalSearchResultType =
  | "customer"
  | "job"
  | "lead"
  | "task"
  | "appointment"
  | "employee"
  | "file";

export type GlobalSearchResult = {
  type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  keywords: string;
};

export type GlobalSearchResponse = {
  query: string;
  results: GlobalSearchResult[];
};
