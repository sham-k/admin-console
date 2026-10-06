import { useId, useState } from 'react'
import { formatNumber } from '../lib/format'
import { PAGE_SIZES } from '../lib/useListParams'
import { Icon } from './Icon'

interface PaginationProps {
  page: number
  pageCount: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange: (size: number) => void
  disabled?: boolean
}

/**
 * With 20,000 pages, numbered page links don't scale; a "jump to page" field
 * plus first/prev/next/last covers both browsing and direct access.
 */
export function Pagination({ page, pageCount, size, onPageChange, onSizeChange, disabled }: PaginationProps) {
  const sizeId = useId()
  const pageId = useId()
  const [draft, setDraft] = useState(String(page))
  const [shownPage, setShownPage] = useState(page)
  if (shownPage !== page) {
    setShownPage(page)
    setDraft(String(page))
  }

  const go = (target: number) => {
    const clamped = Math.min(Math.max(1, Math.round(target)), Math.max(pageCount, 1))
    setDraft(String(clamped))
    if (clamped !== page) onPageChange(clamped)
  }

  const atStart = page <= 1
  const atEnd = page >= pageCount

  return (
    <nav className="pagination" aria-label="Pagination">
      {/* Segmented radio buttons instead of a <select>: every option is visible
          and tappable in place, rather than a tiny native popup over the list. */}
      <div className="pagination__size" role="radiogroup" aria-labelledby={sizeId}>
        <span id={sizeId}>Rows per page</span>
        <div className="segmented">
          {PAGE_SIZES.map((option) => (
            <label key={option} className="segmented__option">
              <input
                type="radio"
                name={sizeId}
                value={option}
                checked={size === option}
                onChange={() => onSizeChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pagination__controls">
        <button
          type="button"
          className="icon-button"
          onClick={() => go(1)}
          disabled={disabled || atStart}
          aria-label="First page"
        >
          <Icon name="chevronsLeft" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => go(page - 1)}
          disabled={disabled || atStart}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" />
        </button>

        <form
          className="pagination__jump"
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(draft)
            if (Number.isFinite(value)) go(value)
            else setDraft(String(page))
          }}
        >
          <label htmlFor={pageId}>Page</label>
          <input
            id={pageId}
            className="input input--sm pagination__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setDraft(String(page))}
            aria-describedby={`${pageId}-of`}
            disabled={disabled}
          />
          <span id={`${pageId}-of`}>of {formatNumber(Math.max(pageCount, 1))}</span>
        </form>

        <button
          type="button"
          className="icon-button"
          onClick={() => go(page + 1)}
          disabled={disabled || atEnd}
          aria-label="Next page"
        >
          <Icon name="chevronRight" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => go(pageCount)}
          disabled={disabled || atEnd}
          aria-label="Last page"
        >
          <Icon name="chevronsRight" />
        </button>
      </div>
    </nav>
  )
}
