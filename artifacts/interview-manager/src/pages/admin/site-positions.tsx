import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useListSitePositions,
  useCreateSitePosition,
  useUpdateSitePosition,
  useDeleteSitePosition,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Trash2, Pencil, Check, X, MapPin, Briefcase, Users, AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

type EditState = { id: number; openings: number } | null;

export default function SitePositionsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newOpenings, setNewOpenings] = useState("1");
  const [siteError, setSiteError] = useState("");
  const [editState, setEditState] = useState<EditState>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: sitePositions, isLoading } = useListSitePositions({
    query: { refetchInterval: 10000 } as any,
  });

  const createMutation = useCreateSitePosition();
  const updateMutation = useUpdateSitePosition();
  const deleteMutation = useDeleteSitePosition();

  // Unique site names from the DB
  const existingSiteNames = [...new Set((sitePositions || []).map(sp => sp.site))].sort();

  // Group by site name
  const grouped = existingSiteNames.reduce<Record<string, typeof sitePositions>>((acc, site) => {
    acc[site] = (sitePositions || []).filter(sp => sp.site === site);
    return acc;
  }, {});

  const totalOpenings = (sitePositions || []).reduce((s, sp) => s + sp.openings, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSite = newSite.trim();
    const trimmedPos = newPosition.trim();
    if (!trimmedSite) { setSiteError("Site name is required."); return; }

    // Warn if this site+position combo already exists
    const duplicate = (sitePositions || []).find(
      sp => sp.site.toLowerCase() === trimmedSite.toLowerCase() && sp.position.toLowerCase() === trimmedPos.toLowerCase()
    );
    if (duplicate) {
      setSiteError(`"${trimmedPos}" already exists under "${trimmedSite}".`);
      return;
    }

    setSiteError("");
    createMutation.mutate(
      { data: { site: trimmedSite, position: trimmedPos, openings: parseInt(newOpenings) || 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setIsAddOpen(false);
          setNewSite("");
          setNewPosition("");
          setNewOpenings("1");
          setSiteError("");
        },
      }
    );
  };

  const handleSaveOpenings = (id: number) => {
    if (!editState || editState.id !== id) return;
    updateMutation.mutate(
      { id, data: { openings: editState.openings } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setEditState(null);
        },
      }
    );
  };

  const handleDelete = (id: number, position: string) => {
    if (!confirm(`Delete "${position}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries() });
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="px-2 -ml-2">
              &larr; Back
            </Button>
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="font-semibold text-lg leading-none">Site &amp; Position Management</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {existingSiteNames.length} site{existingSiteNames.length !== 1 ? "s" : ""} · {totalOpenings} total openings
              </p>
            </div>
          </div>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); setSiteError(""); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Position
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Opening</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 py-2">

                {/* Site Name input with datalist for existing names */}
                <div className="space-y-2">
                  <Label className="font-semibold">
                    Site Name <span className="text-destructive">*</span>
                    <span className="text-zinc-400 font-normal ml-1 text-xs">(unique per site)</span>
                  </Label>
                  <Input
                    list="site-names-list"
                    required
                    value={newSite}
                    onChange={e => { setNewSite(e.target.value); setSiteError(""); }}
                    placeholder="e.g. Kutch Wind Farm, Jaisalmer Solar Phase 1"
                    className={siteError ? "border-destructive" : ""}
                    autoComplete="off"
                  />
                  {/* datalist provides autocomplete from existing site names */}
                  <datalist id="site-names-list">
                    {existingSiteNames.map(s => <option key={s} value={s} />)}
                  </datalist>
                  {siteError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {siteError}
                    </p>
                  )}
                  {existingSiteNames.length > 0 && !newSite && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-zinc-400">Existing:</span>
                      {existingSiteNames.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewSite(s)}
                          className="text-xs px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-full text-zinc-700 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <Label className="font-semibold">Position / Role Title <span className="text-destructive">*</span></Label>
                  <Input
                    required
                    value={newPosition}
                    onChange={e => { setNewPosition(e.target.value); setSiteError(""); }}
                    placeholder="e.g. Site Engineer, O&M Technician"
                  />
                </div>

                {/* Openings */}
                <div className="space-y-2">
                  <Label className="font-semibold">Number of Openings</Label>
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={newOpenings}
                    onChange={e => setNewOpenings(e.target.value)}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Opening
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : existingSiteNames.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-zinc-200 rounded-2xl">
            <MapPin className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-zinc-900 mb-1">No sites yet</h3>
            <p className="text-zinc-500 text-sm mb-6">Add your first site and position to get started.</p>
            <Button onClick={() => setIsAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add First Position
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {existingSiteNames.map((site, idx) => {
              const entries = grouped[site] || [];
              const siteOpenings = entries.reduce((s, e) => s + e.openings, 0);
              // Cycle through some subtle colors for different sites
              const colorSets = [
                "bg-blue-50 border-blue-200 text-blue-700",
                "bg-emerald-50 border-emerald-200 text-emerald-700",
                "bg-violet-50 border-violet-200 text-violet-700",
                "bg-amber-50 border-amber-200 text-amber-700",
                "bg-rose-50 border-rose-200 text-rose-700",
                "bg-cyan-50 border-cyan-200 text-cyan-700",
              ];
              const colorSet = colorSets[idx % colorSets.length];

              return (
                <div key={site}>
                  {/* Site header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-semibold text-sm ${colorSet}`}>
                      <MapPin className="w-3.5 h-3.5" />
                      {site}
                    </div>
                    <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-200">
                      {entries.length} role{entries.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-200">
                      {siteOpenings} opening{siteOpenings !== 1 ? "s" : ""}
                    </Badge>
                    <button
                      onClick={() => { setNewSite(site); setIsAddOpen(true); }}
                      className="ml-auto text-xs text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add role
                    </button>
                  </div>

                  {/* Position cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {entries.map((sp) => (
                      <Card key={sp.id} className="border-zinc-200 bg-white shadow-sm group">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-2">
                            <Briefcase className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                            <span className="font-semibold text-sm text-zinc-900 flex-1">{sp.position}</span>
                            <button
                              onClick={() => handleDelete(sp.id, sp.position)}
                              className="text-zinc-200 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-zinc-400 flex items-center gap-1">
                              <Users className="w-3 h-3" /> Openings
                            </span>
                            {editState?.id === sp.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="1"
                                  value={editState.openings}
                                  onChange={e =>
                                    setEditState({ id: sp.id, openings: parseInt(e.target.value) || 1 })
                                  }
                                  className="h-7 w-16 text-sm text-center px-1"
                                />
                                <button onClick={() => handleSaveOpenings(sp.id)} className="text-emerald-600 hover:text-emerald-700">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditState(null)} className="text-zinc-400 hover:text-zinc-600">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditState({ id: sp.id, openings: sp.openings })}
                                className="flex items-center gap-1.5 group/edit"
                              >
                                <span className="text-2xl font-bold text-zinc-900">{sp.openings}</span>
                                <Pencil className="w-3.5 h-3.5 text-zinc-300 group-hover/edit:text-zinc-500" />
                              </button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
