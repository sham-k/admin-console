import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/hooks'

/** Stand-in for nav sections outside the scope of this exercise. */
export function PlaceholderPage({ title }: { title: string }) {
  useDocumentTitle(title)
  return (
    <div className="page">
      <header className="page-header">
        <h1 tabIndex={-1}>{title}</h1>
      </header>
      <div className="state">
        <h2 className="state__title">Coming soon</h2>
        <p className="state__body">This section is a placeholder for the exercise.</p>
        <Link to="/users" className="button button--secondary">
          Go to Users
        </Link>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="page">
      <header className="page-header">
        <h1 tabIndex={-1}>Page not found</h1>
      </header>
      <div className="state">
        <p className="state__body">There’s nothing at this address.</p>
        <Link to="/users" className="button button--secondary">
          Go to Users
        </Link>
      </div>
    </div>
  )
}

/** Last-resort boundary so a render error shows a recoverable page, not a blank screen. */
export function RouteError() {
  useDocumentTitle('Something went wrong')
  return (
    <main className="main">
      <div className="state state--error" role="alert">
        <h1 className="state__title">Something went wrong</h1>
        <p className="state__body">An unexpected error occurred while showing this page.</p>
        <a href="/users" className="button button--secondary">
          Reload Users
        </a>
      </div>
    </main>
  )
}
