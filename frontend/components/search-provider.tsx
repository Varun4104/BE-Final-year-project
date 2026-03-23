"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type ViewType =
  | "dashboard"
  | "upload"
  | "search"
  | "library"
  | "recommendations"
  | "plagiarism"
  | "multilingual"
  | "voice-search"
  | "collaborate"
  | "chat"
  | "orcid"

interface SearchContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: any[]
  setSearchResults: (results: any[]) => void
  isSearching: boolean
  setIsSearching: (searching: boolean) => void
  navigate: (view: ViewType) => void
  setNavigate: (fn: (view: ViewType) => void) => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [navigateFn, setNavigateFn] = useState<(view: ViewType) => void>(() => () => {})

  const setNavigate = (fn: (view: ViewType) => void) => {
    setNavigateFn(() => fn)
  }

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        setIsSearching,
        navigate: navigateFn,
        setNavigate,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}

export type { ViewType }
