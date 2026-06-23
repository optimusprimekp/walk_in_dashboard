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
import { Loader2, Plus, Trash2, Pencil, Check, X, MapPin, Briefcase, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const SITE_COLORS: Record<string, string> = {
  "Solar O&M": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Wind BoP O&M": "bg-sky-100 text-sky-800 border-sky-300",
  "R&D": "bg-violet-100 text-violet-800 border-violet-300",
};

function getSiteColor(site: string) {
  return SITE_COLORS[site] ?? "bg-zinc-100 text-zinc-700 border-zinc-300";
}

type EditState = { id: number; openings: number } | null;

export default function SitePositionsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSite, setNewSite] = useState("Solar O&M");
  const [newPosition, setNewPosition] = useState("");
  const [newOpenings, setNewOpenings] = useState("1");
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

  const SITES = ["Solar O&M", "Wind BoP O&M", "R&D"];

  const grouped = SITES.reduce<Record<string, typeof sitePositions>>((acc, site) => {
    acc[site] = (sitePositions || []).filter(sp => sp.site === site);
    return acc;
  }, {});

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const openings = parseInt(newOpenings) || 1;
    createMutation.mutate(
      { data: { site: newSite, position: newPosition.trim(), openings } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setIsAddOpen(false);
          setNewPosition("");
          setNewOpenings("1");
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
    deleteMutation.mutate(
      { id },
      { onSuccess: () => queryClient.invalidateQueries() }
    );
  };

  const totalOpenings = (sitePositions || []).reduce((s, sp) => s + sp.openings, 0);
  const totalFilled = 0;

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
              <h1 className="font-semibold text-lg leading-none">Site & Position Management</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Configure hiring targets by site and role</p>
            </div>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Position
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add New Opening</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Site / Department</Label>
                  <div className="flex flex-wrap gap-2">
                    {SITES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewSite(s)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          newSite === s
                            ? getSiteColor(s) + " ring-2 ring-offset-1 ring-current"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Position / Role Title</Label>
                  <Input
                    required
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    placeholder="e.g. Site Engineer, O&M Technician"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Openings</Label>
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={newOpenings}
                    onChange={(e) => setNewOpenings(e.target.value)}
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
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {SITES.map((site) => {
            const entries = grouped[site] || [];
            const siteOpenings = entries.reduce((s, e) => s + e.openings, 0);
            return (
              <Card key={site} className={`border ${getSiteColor(site).split(' ')[2]} bg-white`}>
                <CardContent className="pt-4 pb-4">
                  <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${getSiteColor(site).split(' ')[1]}`}>
                    {site}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-bold text-zinc-900">{entries.length}</div>
                      <div className="text-xs text-zinc-400">role{entries.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-zinc-700">{siteOpenings}</div>
                      <div className="text-xs text-zinc-400">openings</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {SITES.map((site) => {
              const entries = grouped[site] || [];
              return (
                <div key={site}>
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className={`w-4 h-4 ${getSiteColor(site).split(' ')[1]}`} />
                    <h2 className="font-bold text-lg text-zinc-900">{site}</h2>
                    <Badge variant="outline" className={`text-xs ${getSiteColor(site)}`}>
                      {entries.length} role{entries.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {entries.length === 0 ? (
                    <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center text-zinc-400 text-sm">
                      No positions added yet for {site}.{" "}
                      <button
                        onClick={() => { setNewSite(site); setIsAddOpen(true); }}
                        className="text-primary hover:underline font-medium"
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {entries.map((sp) => (
                        <Card key={sp.id} className="border-zinc-200 bg-white shadow-sm group">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Briefcase className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                                <span className="font-semibold text-sm text-zinc-900 truncate">{sp.position}</span>
                              </div>
                              <button
                                onClick={() => handleDelete(sp.id, sp.position)}
                                className="text-zinc-300 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
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
                                    onChange={(e) =>
                                      setEditState({ id: sp.id, openings: parseInt(e.target.value) || 1 })
                                    }
                                    className="h-7 w-16 text-sm text-center px-1"
                                  />
                                  <button
                                    onClick={() => handleSaveOpenings(sp.id)}
                                    className="text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditState(null)}
                                    className="text-zinc-400 hover:text-zinc-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditState({ id: sp.id, openings: sp.openings })}
                                  className="flex items-center gap-1.5 group/edit"
                                >
                                  <span className="text-xl font-bold text-zinc-900">{sp.openings}</span>
                                  <Pencil className="w-3.5 h-3.5 text-zinc-300 group-hover/edit:text-zinc-500" />
                                </button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
