// =============================================================================
// Global search — typed shapes (admin Screen 35 + the client in-account
// equivalent). Operators search across every client; a client searches their
// own account only. Same component surface, role-scoped result sets.
//
// Vision §7: search is operator-intent data. Each result is a typed entity
// (`kind` + a real `href` into its detail page) and the query is a captured
// string — "searched X, opened result Y" is a clean two-event capture.
// =============================================================================

export type SearchResultKind =
  | 'lead'
  | 'booking'
  | 'review'
  | 'conversation'
  | 'customer'
  | 'client';

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  /** 1–2 char tile content — initials for people, a glyph otherwise. */
  avatar: string;
  /** Display title; the matched query term is highlighted at render time. */
  title: string;
  /** Secondary meta line. */
  meta: string;
  /** Link into the entity's detail surface. */
  href: string;
};

export type SearchResultGroup = {
  kind: SearchResultKind;
  /** Plural group label, e.g. 'Leads'. */
  label: string;
  results: SearchResult[];
};

export type SearchResults = {
  /** The query these results answer — the fallback display query. */
  query: string;
  /** Human label of the search scope, e.g. 'leads, bookings, reviews…'. */
  scopeLabel: string;
  groups: SearchResultGroup[];
};
