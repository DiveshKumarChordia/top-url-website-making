import { Link, Outlet, useLocation } from 'react-router-dom'
import { getConfig } from '../lib/contentstackDelivery.js'
import { dispatchDigestReload } from '../lib/siteEvents.js'

export function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const { environment: envUid } = getConfig()

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand site-header__brand--link">
            <span className="site-header__logo" aria-hidden="true" />
            <div>
              <p className="site-header__title">Contentstack</p>
              <p className="site-header__subtitle">Stack digest</p>
            </div>
          </Link>
          <div className="site-header__actions">
            {isHome ? (
              <button
                type="button"
                className="site-header__refresh"
                onClick={() => dispatchDigestReload()}
                aria-label="Reload entries from Contentstack"
              >
                Refresh
              </button>
            ) : null}
            {envUid ? (
              <span className="env-badge" title="VITE_CONTENTSTACK_ENVIRONMENT">
                {envUid}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="site-footer">
        <p>Read-only preview · Contentstack Delivery API</p>
      </footer>
    </>
  )
}
