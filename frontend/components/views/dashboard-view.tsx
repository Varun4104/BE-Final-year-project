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
} from "lucide-react";
import { API_URL } from "@/lib/config";

export function DashboardView() {
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
        const statsRes = await fetch(
          `${API_URL}/stats`,
        );
        const statsData = await statsRes.json();
        setStats(statsData);

        const papersRes = await fetch(
          `${API_URL}/all_pdfs`,
        );
        const papersData = await papersRes.json();
        setRecentPapers(
          papersData.pdfs.slice(0, 3).map((p: any) => ({
            title: p.title,
            authors: p.author,
            year: p.year,
            status: p.status,
            summary: "No summary available",
          })),
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };
    fetchData();
  }, []);

  const quickActions = [
    {
      icon: Upload,
      label: "Upload New Paper",
      description: "Add papers to your library",
    },
    {
      icon: Search,
      label: "Smart Search",
      description: "Find papers with AI assistance",
    },
    {
      icon: Lightbulb,
      label: "Get Recommendations",
      description: "Discover relevant papers",
    },
    {
      icon: FileText,
      label: "Generate Summary",
      description: "AI-powered paper summaries",
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
              <Progress
                value={(stats.readPapers / stats.totalPapers) * 100}
                className="h-2"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((stats.readPapers / stats.totalPapers) * 100)}%
              completion rate
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
            {recentPapers.map((paper, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
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
                  <p className="text-sm text-pretty">{paper.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    2 days ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
