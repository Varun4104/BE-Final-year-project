"use client"

import { DashboardView } from "@/components/views/dashboard-view"
import { UploadView } from "@/components/views/upload-view"
import { SearchView } from "@/components/views/search-view"
import { LibraryView } from "@/components/views/library-view"
import { RecommendationsView } from "@/components/views/recommendations-view"
import { PlagiarismView } from "@/components/views/plagiarism-view"
import { MultilingualView } from "@/components/views/multilingual-view"
import { VoiceSearchView } from "@/components/views/voice-search-view"
import { CollaborateView } from "@/components/views/collaborate-view"

interface MainContentProps {
  activeView:
    | "dashboard"
    | "upload"
    | "search"
    | "library"
    | "recommendations"
    | "plagiarism"
    | "multilingual"
    | "voice-search"
    | "collaborate"
}

export function MainContent({ activeView }: MainContentProps) {
  return (
    <main className="flex-1 overflow-auto">
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "upload" && <UploadView />}
      {activeView === "search" && <SearchView />}
      {activeView === "library" && <LibraryView />}
      {activeView === "recommendations" && <RecommendationsView />}
      {activeView === "plagiarism" && <PlagiarismView />}
      {activeView === "multilingual" && <MultilingualView />}
      {activeView === "voice-search" && <VoiceSearchView />}
      {activeView === "collaborate" && <CollaborateView />}
    </main>
  )
}
