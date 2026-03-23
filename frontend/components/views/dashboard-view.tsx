"use client"

import { useState, useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Upload,
  Search,
  Lightbulb,
  TrendingUp,
  Clock,
  Star,
  FileText,
  MessageSquare,
} from "lucide-react";
import { API_URL } from "@/lib/config";
import { useSearch } from "@/components/search-provider";

export function DashboardView() {
  const { navigate } = useSearch();
  const [stats, setStats] = useState({
    totalPapers: 0,
    readPapers: 0,
    savedSearches: 0,
    recommendations: 0,
  });
  const [recentPapers, setRecentPapers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch(`${API_URL}/stats`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const papersRes = await fetch(`${API_URL}/all_pdfs`);
        const papersData = await papersRes.json();
        setRecentPapers(
          papersData.pdfs.slice(0, 5).map((p: any) => ({
            title: p.title || "Untitled",
            authors: p.author || "Unknown Author",
            year: p.year,
            status: p.status,
            abstract: p.abstract || (p.keywords?.length > 0 ? `Keywords: ${p.keywords.join(", ")}` : "No abstract available"),
            file_id: p.file_id,
          })),
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };
    fetchData();
  }, []);

  const readPercent = stats.totalPapers > 0
    ? Math.round((stats.readPapers / stats.totalPapers) * 100)
    : 0;

  const quickActions = [
    {
      icon: Upload,
      label: "Upload New Paper",
      description: "Add papers to your library",
      view: "upload" as const,
    },
    {
      icon: Search,
      label: "Smart Search",
      description: "Find papers with AI assistance",
      view: "search" as const,
    },
    {
      icon: Lightbulb,
      label: "Get Recommendations",
      description: "Discover relevant papers",
      view: "recommendations" as const,
    },
    {
      icon: MessageSquare,
      label: "Chat with Paper",
      description: "Ask questions with AI",
      view: "chat" as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-balance">
          Welcome back to your Research Assistant
        </h1>
        <p className="text-muted-foreground text-pretty">
          Manage your research papers efficiently with AI-powered tools and
          insights.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Papers</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPapers}</div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Papers Read</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.readPapers}</div>
            <div className="mt-2">
              <Progress value={readPercent} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {readPercent}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saved Searches
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.savedSearches}</div>
            <p className="text-xs text-muted-foreground">
              Active search queries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              New Recommendations
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recommendations}</div>
            <p className="text-xs text-muted-foreground">
              Based on your interests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Get started with common research tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-accent hover:text-accent-foreground bg-transparent"
                  onClick={() => navigate(action.view)}
                >
                  <Icon className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Papers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Papers</CardTitle>
            <CardDescription>
              Your latest additions and reading progress
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentPapers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No papers yet. <button className="text-primary hover:underline" onClick={() => navigate("upload")}>Upload your first paper</button></p>
              </div>
            ) : (
              recentPapers.map((paper, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-balance">{paper.title}</h3>
                      <Badge
                        variant={
                          paper.status === "read"
                            ? "default"
                            : paper.status === "reading"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {paper.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {paper.authors} • {paper.year}
                    </p>
                    <p className="text-sm text-pretty text-muted-foreground line-clamp-2">{paper.abstract}</p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => navigate("chat")}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Chat
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate("library")}>
                        <BookOpen className="h-3 w-3 mr-1" />
                        Library
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
