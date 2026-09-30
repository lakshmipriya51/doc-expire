import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import documentService from '../services/documentService';
import DocumentTable from '../components/DocumentTable';
import DocumentCard from '../components/DocumentCard';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { DOCUMENT_TYPES, SORT_OPTIONS, STATUS_FILTERS } from '../utils/constants';

const DEFAULT_FILTERS = { search: '', status: 'all', type: '', sort: 'expiry-asc' };

/** Reads the filter state from the URL so views can be shared and bookmarked. */
function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || 'all',
      type: searchParams.get('type') || '',
      sort: searchParams.get('sort') || 'expiry-asc',
      page: Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (next) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      const params = {};
      Object.entries(merged).forEach(([key, value]) => {
        if (value && !(key === 'page' && value === 1) && !(key === 'status' && value === 'all')) {
          params[key] = String(value);
        }
      });
      setSearchParams(params, { replace: true });
    },
    [filters, setSearchParams],
  );

  return { filters, setFilters };
}

export default function Documents() {
  const { filters, setFilters } = useFilters();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft !== filters.search) setFilters({ search: searchDraft });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search, setFilters]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(
        await documentService.list({
          search: filters.search,
          status: filters.status,
          type: filters.type,
          sort: filters.sort,
          page: filters.page,
          limit: 12,
        }),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters.search, filters.status, filters.type, filters.sort, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  const documents = data?.documents || [];
  const hasActiveFilters =
    Boolean(filters.search) || filters.status !== 'all' || Boolean(filters.type);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Documents</h1>
          <p className="page__subtitle">Search, filter and manage everything you have stored.</p>
        </div>
        <Link className="btn btn--primary" to="/documents/new">
          Add Document
        </Link>
      </header>

      <section className="filters" aria-label="Search and filter documents">
        <div className="filters__search">
          <label className="sr-only" htmlFor="document-search">
            Search documents
          </label>
          <input
            id="document-search"
            type="search"
            className="field__input"
            placeholder="Search by name, number or type..."
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </div>

        <div className="filters__controls">
          <div className="filters__group" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip${filters.status === option.value ? ' chip--active' : ''}`}
                onClick={() => setFilters({ status: option.value })}
                aria-pressed={filters.status === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="filters__selects">
            <div className="field field--inline">
              <label className="field__label" htmlFor="type-filter">
                Type
              </label>
              <select
                id="type-filter"
                className="field__input"
                value={filters.type}
                onChange={(event) => setFilters({ type: event.target.value })}
              >
                <option value="">All types</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field--inline">
              <label className="field__label" htmlFor="sort-order">
                Sort
              </label>
              <select
                id="sort-order"
                className="field__input"
                value={filters.sort}
                onChange={(event) => setFilters({ sort: event.target.value })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <Alert tone="error" title="Could not load your documents">
          {error}
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            Try again
          </button>
        </Alert>
      ) : null}

      {isLoading ? <Spinner label="Loading documents..." /> : null}

      {!isLoading && !error ? (
        documents.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
            description={
              hasActiveFilters
                ? 'Try a different search term or clear the filters.'
                : 'Add your first document to start tracking expiry dates.'
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setFilters({ search: '', status: 'all', type: '' })}
                >
                  Clear filters
                </button>
              ) : (
                <Link className="btn btn--primary" to="/documents/new">
                  Add Document
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="documents-table">
              <DocumentTable documents={documents} />
            </div>
            <div className="documents-cards">
              {documents.map((document) => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page })} />
          </>
        )
      ) : null}
    </div>
  );
}
