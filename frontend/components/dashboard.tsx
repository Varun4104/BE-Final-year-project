"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { MainContent } from "@/components/main-content"
import { SearchProvider, useSearch, type ViewType } from "@/components/search-provider"

function DashboardInner() {
  const [activeView, setActiveView] = useState<ViewType>("dashboard")
  const { setNavigate } = useSearch()

  useEffect(() => {
    setNavigate(setActiveView)
  }, [setNavigate])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <MainContent activeView={activeView} />
    </div>
  )
}

export function Dashboard() {
  return (
    <SearchProvider>
      <DashboardInner />
    </SearchProvider>
  )
}
