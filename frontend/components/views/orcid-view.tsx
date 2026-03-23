"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Search,
  BookOpen,
  Building,
  GraduationCap,
  ExternalLink,
  Loader,
  BadgeCheck,
  Award,
  Globe,
} from "lucide-react"
import { API_URL } from "@/lib/config"

interface Work {
  title: string
  year: string | null
  journal: string
  type: string
}

interface Employment {
  organization: string
  role: string
  start_year: string | null
}

interface Education {
  institution: string
  degree: string
}

interface OrcidProfile {
  orcid_id: string
  name: string
  biography: string
  keywords: string[]
  external_ids: { type: string; value: string }[]
  works_count: number
  recent_works: Work[]
  employment: Employment[]
  education: Education[]
  profile_url: string
}

const EXAMPLE_ORCIDS = [
  { id: "0000-0002-1825-0097", label: "Josiah Carberry (demo)" },
  { id: "0000-0001-5109-3700", label: "Example Researcher" },
  { id: "0000-0003-1419-2405", label: "Example Researcher 2" },
]

export function OrcidView() {
  const [orcidInput, setOrcidInput] = useState("")
  const [profile, setProfile] = useState<OrcidProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async (id?: string) => {
    const targetId = (id || orcidInput).trim()
    if (!targetId) return
    setIsLoading(true)
    setError(null)
    setProfile(null)

    try {
      const resp = await fetch(`${API_URL}/orcid/${targetId}`)
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || "Profile not found")
      }
      const data = await resp.json()
      setProfile(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ORCID profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchProfile()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Researcher Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Look up researcher profiles, publications, and metrics via ORCID
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Globe className="h-3 w-3" />
          ORCID Integration
        </Badge>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Search by ORCID ID
          </CardTitle>
          <CardDescription>
            Enter a researcher's ORCID identifier (format: XXXX-XXXX-XXXX-XXXX)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={orcidInput}
              onChange={(e) => setOrcidInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 0000-0002-1825-0097"
              className="flex-1 font-mono"
            />
            <Button onClick={() => fetchProfile()} disabled={isLoading || !orcidInput.trim()} className="gap-2">
              {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Fetch Profile
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_ORCIDS.map((ex) => (
                <Button
                  key={ex.id}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setOrcidInput(ex.id)
                    fetchProfile(ex.id)
                  }}
                >
                  <span className="font-mono">{ex.id}</span>
                  <span className="ml-1.5 text-muted-foreground font-sans">— {ex.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile Display */}
      {profile && (
        <div className="space-y-4">
          {/* Profile Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{profile.name || "Unknown Researcher"}</h2>
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono">{profile.orcid_id}</span>
                    <a
                      href={profile.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on ORCID
                    </a>
                  </div>
                  {profile.biography && (
                    <p className="text-sm text-muted-foreground mt-2">{profile.biography}</p>
                  )}
                  {profile.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile.keywords.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-lg shrink-0">
                  <div className="text-3xl font-bold text-primary">{profile.works_count}</div>
                  <div className="text-xs text-muted-foreground mt-1">Publications</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employment */}
            {profile.employment.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Employment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.employment.map((emp, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{emp.organization}</p>
                        {emp.role && <p className="text-xs text-muted-foreground">{emp.role}</p>}
                        {emp.start_year && (
                          <p className="text-xs text-muted-foreground">Since {emp.start_year}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {profile.education.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.education.map((edu, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{edu.institution}</p>
                        {edu.degree && <p className="text-xs text-muted-foreground">{edu.degree}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Works */}
          {profile.recent_works.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Recent Publications
                  <Badge variant="secondary">{profile.works_count} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.recent_works.map((work, i) => (
                    <div key={i}>
                      {i > 0 && <Separator className="mb-3" />}
                      <div className="flex items-start gap-3">
                        <Award className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{work.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {work.journal && (
                              <span className="text-xs text-muted-foreground">{work.journal}</span>
                            )}
                            {work.year && (
                              <Badge variant="outline" className="text-xs h-4">
                                {work.year}
                              </Badge>
                            )}
                            {work.type && (
                              <Badge variant="secondary" className="text-xs h-4 capitalize">
                                {work.type.toLowerCase().replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
