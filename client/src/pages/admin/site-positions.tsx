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
  Loader2, Plus, Trash2, Pencil, Check, X, MapPin, Briefcase, Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

const DEPARTMENTS = ["Solar O&M", "Wind BoP O&M", "R&D"];

const DEPT_STYLE: Record<string, { badge: string; bar: string; dot: string }> = {
  "Solar O&M":    { badge: "bg-yellow-100 text-yellow-800 border-yellow-300", bar: "bg-yellow-400", dot: "bg-yellow-400" },
  "Wind BoP O&M": { badge: "bg-sky-100 text-sky-800 border-sky-300",         bar: "bg-sky-400",    dot: "bg-sky-400"    },
  "R&D":          { badge: "bg-violet-100 text-violet-800 border-violet-300", bar: "bg-violet-400", dot: "bg-violet-400" },
};

function deptStyle(dept: string) {
  return DEPT_STYLE[dept] ?? { badge: "bg-zinc-100 text-zinc-700 border-zinc-200", bar: "bg-zinc-400", dot: "bg-zinc-400" };
}

type EditState = { id: number; openings: number } | null;

export default function SitePositionsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDept, setNewDept] = useState(DEPARTMENTS[0]);
  const [newSite, setNewSite] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newOpenings, setNewOpenings] = useState("1");
  const [formError, setFormError] = useState("");
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

  // Sites available under the selected dept (for autocomplete)
  const sitesInDept = [...new Set((sitePositions || [])
    .filter(sp => sp.department === newDept)
    .map(sp => sp.site)
  )].sort();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const site = newSite.trim();
    const position = newPosition.trim();
    if (!site) { setFormError("Site name is required."); return; }
    if (!position) { setFormError("Position is required."); return; }

    const duplicate = (sitePositions || []).find(
      sp => sp.department === newDept &&
            sp.site.toLowerCase() === site.toLowerCase() &&
            sp.position.toLowerCase() === position.toLowerCase()
    );
    if (duplicate) {
      setFormError(`"${position}" already exists under ${newDept} → ${site}.`);
      return;
    }

    setFormError("");
    createMutation.mutate(
      { data: { department: newDept, site, position, openings: parseInt(newOpenings) || 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setIsAddOpen(false);
          setNewSite("");
          setNewPosition("");
          setNewOpenings("1");
          setFormError("");
        },
      }
    );
  };

  const handleSaveOpenings = (id: number) => {
    if (!editState || editState.id !== id) return;
    updateMutation.mutate(
      { id, data: { openings: editState.openings } as any },
      { onSuccess: () => { queryClient.invalidateQueries(); setEditState(null); } }
    );
  };

  const handleDelete = (id: number, label: string) => {
    if (!confirm(`Delete "${label}"?`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries() });
  };

  const totalOpenings = (sitePositions || []).reduce((s, sp) => s + sp.openings, 0);
  const totalEntries = (sitePositions || []).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="px-2 -ml-2">&larr; Back</Button>
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="font-semibold text-lg leading-none">Site &amp; Position Management</h1>
              <p className="text-xs text-zinc-400 mt-0.5">{totalEntries} positions · {totalOpenings} total openings</p>
            </div>
          </div>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setFormError(""); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Add Position</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add Opening</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 py-2">

                {/* Department — fixed 3 */}
                <div className="space-y-2">
                  <Label className="font-semibold">Department <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-1 gap-2">
                    {DEPARTMENTS.map(dept => {
                      const s = deptStyle(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => { setNewDept(dept); setNewSite(""); setFormError(""); }}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                            newDept === dept ? `${s.badge} ring-2 ring-offset-1 ring-current` : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${newDept === dept ? s.dot : "bg-zinc-300"}`} />
                          {dept}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Site name with autocomplete */}
                <div className="space-y-2">
                  <Label className="font-semibold">
                    Site Name <span className="text-destructive">*</span>
                    <span className="text-zinc-400 font-normal ml-1 text-xs">e.g. Mahuva, Rajkot</span>
                  </Label>
                  <Input
                    list="site-datalist"
                    required
                    value={newSite}
                    onChange={e => { setNewSite(e.target.value); setFormError(""); }}
                    placeholder="Type site name..."
                    autoComplete="off"
                    className={formError && !newSite ? "border-destructive" : ""}
                  />
                  <datalist id="site-datalist">
                    {sitesInDept.map(s => <option key={s} value={s} />)}
                  </datalist>
                  {sitesInDept.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-zinc-400">Existing in {newDept}:</span>
                      {sitesInDept.map(s => (
                        <button key={s} type="button" onClick={() => setNewSite(s)}
                          className="text-xs px-2 py-0.5 bg-zinc-100 hover:bg-primary/10 border border-zinc-200 hover:border-primary/30 rounded-full text-zinc-700 hover:text-primary transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <Label className="font-semibold">Position / Role <span className="text-destructive">*</span></Label>
                  <Input
                    required
                    value={newPosition}
                    onChange={e => { setNewPosition(e.target.value); setFormError(""); }}
                    placeholder="e.g. Manager, Technician, Engineer"
                  />
                </div>

                {/* Openings */}
                <div className="space-y-2">
                  <Label className="font-semibold">Number of Openings</Label>
                  <Input type="number" min="1" max="999" required value={newOpenings}
                    onChange={e => setNewOpenings(e.target.value)} />
                </div>

                {formError && (
                  <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">{formError}</p>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full h-11">
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
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-10">
            {DEPARTMENTS.map(dept => {
              const deptEntries = (sitePositions || []).filter(sp => sp.department === dept);
              const deptOpenings = deptEntries.reduce((s, e) => s + e.openings, 0);
              const siteNames = [...new Set(deptEntries.map(e => e.site))].sort();
              const s = deptStyle(dept);

              return (
                <div key={dept}>
                  {/* Department header */}
                  <div className={`flex items-center gap-3 mb-5 pb-3 border-b-2 ${s.bar.replace("bg-", "border-")}`}>
                    <div className={`w-1 h-7 rounded-full ${s.bar}`} />
                    <h2 className="font-bold text-xl text-zinc-900">{dept}</h2>
                    <Badge variant="outline" className={`text-xs font-semibold ${s.badge}`}>
                      {siteNames.length} site{siteNames.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-200">
                      {deptOpenings} opening{deptOpenings !== 1 ? "s" : ""}
                    </Badge>
                    <button
                      onClick={() => { setNewDept(dept); setNewSite(""); setIsAddOpen(true); }}
                      className="ml-auto text-xs text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add position
                    </button>
                  </div>

                  {siteNames.length === 0 ? (
                    <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center text-zinc-400 text-sm">
                      No positions yet for {dept}.{" "}
                      <button onClick={() => { setNewDept(dept); setIsAddOpen(true); }}
                        className="text-primary hover:underline font-medium">Add one →</button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {siteNames.map(site => {
                        const siteEntries = deptEntries.filter(e => e.site === site);
                        const siteOpenings = siteEntries.reduce((sum, e) => sum + e.openings, 0);
                        return (
                          <div key={site}>
                            {/* Site sub-header */}
                            <div className="flex items-center gap-2 mb-3">
                              <MapPin className={`w-4 h-4 ${s.badge.split(' ')[1]}`} />
                              <span className="font-semibold text-zinc-800">{site}</span>
                              <span className="text-xs text-zinc-400">{siteOpenings} opening{siteOpenings !== 1 ? "s" : ""}</span>
                              <button
                                onClick={() => { setNewDept(dept); setNewSite(site); setIsAddOpen(true); }}
                                className="text-xs text-zinc-400 hover:text-primary ml-2 flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" /> role
                              </button>
                            </div>

                            {/* Position cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
                              {siteEntries.map(sp => (
                                <Card key={sp.id} className="border-zinc-200 bg-white shadow-sm group">
                                  <CardContent className="pt-4 pb-4">
                                    <div className="flex items-start gap-2">
                                      <Briefcase className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                                      <span className="font-semibold text-sm text-zinc-900 flex-1">{sp.position}</span>
                                      <button
                                        onClick={() => handleDelete(sp.id, sp.position)}
                                        className="text-zinc-200 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
                                          <Input type="number" min="1" value={editState.openings}
                                            onChange={e => setEditState({ id: sp.id, openings: parseInt(e.target.value) || 1 })}
                                            className="h-7 w-16 text-sm text-center px-1" />
                                          <button onClick={() => handleSaveOpenings(sp.id)} className="text-emerald-600 hover:text-emerald-700">
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setEditState(null)} className="text-zinc-400 hover:text-zinc-600">
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setEditState({ id: sp.id, openings: sp.openings })}
                                          className="flex items-center gap-1.5 group/edit">
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
