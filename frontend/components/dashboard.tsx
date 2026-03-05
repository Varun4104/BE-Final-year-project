"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { MainContent } from "@/components/main-content"
import { SearchProvider } from "@/components/search-provider"

export function Dashboard() {
  const [activeView, setActiveView] = useState<
    "dashboard" | "upload" | "search" | "library" | "recommendations" | "plagiarism" | "multilingual" | "voice-search" | "collaborate"
  >("dashboard")

  return (
    <SearchProvider>
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <MainContent activeView={activeView} />
      </div>
    </SearchProvider>
  )
}
