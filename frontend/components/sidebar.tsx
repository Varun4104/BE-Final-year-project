"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Upload, Search, BookOpen, Lightbulb, Settings, User, Shield, Globe, Mic, Users } from "lucide-react"

interface SidebarProps {
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
  onViewChange: (
    view:
      | "dashboard"
      | "upload"
      | "search"
      | "library"
      | "recommendations"
      | "plagiarism"
      | "multilingual"
      | "voice-search"
      | "collaborate",
  ) => void
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "upload" as const, label: "Upload Papers", icon: Upload },
    { id: "search" as const, label: "Smart Search", icon: Search },
    { id: "library" as const, label: "My Library", icon: BookOpen },
    { id: "recommendations" as const, label: "Recommendations", icon: Lightbulb },
    { id: "plagiarism" as const, label: "Plagiarism Check", icon: Shield },
    { id: "multilingual" as const, label: "Multilingual", icon: Globe },
    { id: "voice-search" as const, label: "Voice Search", icon: Mic },
    { id: "collaborate" as const, label: "Collaborate", icon: Users },
  ]

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">Research Assistant</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-Powered Paper Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              variant={activeView === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-11",
                activeView === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <User className="h-5 w-5" />
          Profile
        </Button>
      </div>
    </div>
  )
}
