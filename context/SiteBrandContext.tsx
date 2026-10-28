'use client'

// context/SiteBrandContext.tsx
//
// Makes settings-driven, server-loaded values available to CLIENT components
// (Navbar, Contact, etc.) without each one fetching them itself. The server
// layout already loads them and passes them down once via <SiteBrandProvider>.
//
//   siteName  — site_settings.siteName for this siteKey.
//   navItems  — the admin-managed navbar tree. Passing it through here means
//               the Navbar renders the REAL menu during SSR instead of its
//               hardcoded fallback, so the correct internal links are in the
//               HTML that crawlers read (see lib/nav.ts for the full story).

import { createContext, useContext } from 'react'

type Brand = { siteName: string; navItems: any[] }

const SiteBrandContext = createContext<Brand>({ siteName: 'InkDrop', navItems: [] })

export function SiteBrandProvider({
  siteName,
  navItems,
  children,
}: {
  siteName: string
  /** Optional so other sites/layouts can keep using the provider unchanged. */
  navItems?: any[]
  children: React.ReactNode
}) {
  return (
    <SiteBrandContext.Provider
      value={{ siteName: siteName || 'InkDrop', navItems: navItems ?? [] }}
    >
      {children}
    </SiteBrandContext.Provider>
  )
}

export function useSiteBrand(): Brand {
  return useContext(SiteBrandContext)
}
