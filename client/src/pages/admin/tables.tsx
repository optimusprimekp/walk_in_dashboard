import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useListTables,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  useListSitePositions,
} from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const FIXED_DEPARTMENTS = ["Solar O&M", "Wind BoP O&M", "R&D"];

const DEPT_COLORS: Record<string, string> = {
  "Solar O&M": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Wind BoP O&M": "bg-sky-100 text-sky-800 border-sky-300",
  "R&D": "bg-violet-100 text-violet-800 border-violet-300",
};

function getDeptColor(dept: string) {
  return DEPT_COLORS[dept] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function parseDepts(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try { return JSON.parse(raw) as string[]; } catch { /* fall through */ }
  }
  return raw.split(",").map(d => d.trim()).filter(Boolean);
}

function parsePositions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function DepartmentMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (dept: string) => {
    onChange(value.includes(dept) ? value.filter(d => d !== dept) : [...value, dept]);
  };
  return (
    <div className="space-y-2">
      {FIXED_DEPARTMENTS.map((dept) => (
        <label
          key={dept}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value.includes(dept)
              ? getDeptColor(dept) + " ring-1 ring-current"
              : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          }`}
        >
          <Checkbox
            checked={value.includes(dept)}
            onCheckedChange={() => toggle(dept)}
            className="pointer-events-none"
          />
          <span className="text-sm font-medium">{dept}</span>
          {value.includes(dept) && <Check className="w-4 h-4 ml-auto" />}
        </label>
      ))}
    </div>
  );
}

function PositionMultiSelect({
  allPositions,
  value,
  onChange,
}: {
  allPositions: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (pos: string) => {
    onChange(value.includes(pos) ? value.filter(p => p !== pos) : [...value, pos]);
  };

  if (allPositions.length === 0) {
    return (
      <div className="text-sm text-zinc-400 p-3 border border-dashed border-zinc-200 rounded-lg text-center">
        No positions configured yet.{" "}
        <a href="/admin/site-positions" className="text-primary hover:underline">
          Add positions first →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {allPositions.map((pos) => (
        <label
          key={pos}
          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
            value.includes(pos)
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          }`}
        >
          <Checkbox
            checked={value.includes(pos)}
            onCheckedChange={() => toggle(pos)}
            className="pointer-events-none"
          />
          <span className="text-sm font-medium">{pos}</span>
          {value.includes(pos) && <Check className="w-4 h-4 ml-auto" />}
        </label>
      ))}
      <p className="text-xs text-zinc-400 pt-1">Leave all unchecked to accept every position.</p>
    </div>
  );
}

export default function Tables() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [newInterviewer, setNewInterviewer] = useState("");
  const [newDepartments, setNewDepartments] = useState<string[]>([]);
  const [newPositions, setNewPositions] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: tables, isLoading } = useListTables({
    query: { refetchInterval: 5000 } as any,
  });

  const { data: sitePositions } = useListSitePositions({
    query: { refetchInterval: 30000 } as any,
  });

  const allPositions = [...new Set((sitePositions || []).map(sp => sp.position))].sort();

  const createMutation = useCreateTable();
  const updateMutation = useUpdateTable();
  const deleteMutation = useDeleteTable();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDepartments.length === 0) {
      alert("Please select at least one department.");
      return;
    }
    createMutation.mutate(
      {
        data: {
          tableNo: parseInt(newTableNo),
          interviewerName: newInterviewer,
          department: JSON.stringify(newDepartments),
          positions: newPositions.length > 0 ? JSON.stringify(newPositions) : undefined,
          status: "AVAILABLE",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setIsAddOpen(false);
          setNewTableNo("");
          setNewInterviewer("");
          setNewDepartments([]);
          setNewPositions([]);
        },
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => queryClient.invalidateQueries(),
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this table?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries(),
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "BUSY":      return "bg-primary/10 text-primary border-primary/20";
      case "BREAK":     return "bg-amber-100 text-amber-800 border-amber-200";
      case "OFFLINE":   return "bg-zinc-100 text-zinc-500 border-zinc-200";
      default:          return "bg-zinc-100 text-zinc-600 border-zinc-200";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "AVAILABLE": return "bg-emerald-500";
      case "BUSY":      return "bg-primary";
      case "BREAK":     return "bg-amber-500";
      default:          return "bg-zinc-300";
    }
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
            <h1 className="font-semibold text-lg">Table Management</h1>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Table
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Interview Table</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Table Number</Label>
                    <Input
                      type="number"
                      required
                      value={newTableNo}
                      onChange={e => setNewTableNo(e.target.value)}
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Interviewer Name</Label>
                    <Input
                      required
                      value={newInterviewer}
                      onChange={e => setNewInterviewer(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">
                    Departments <span className="text-destructive">*</span>
                    <span className="text-zinc-400 font-normal ml-1">(select all that apply)</span>
                  </Label>
                  <DepartmentMultiSelect value={newDepartments} onChange={setNewDepartments} />
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">
                    Candidate Positions
                    <span className="text-zinc-400 font-normal ml-1">(filter which roles this table handles)</span>
                  </Label>
                  <PositionMultiSelect
                    allPositions={allPositions}
                    value={newPositions}
                    onChange={setNewPositions}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full h-11">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Table
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tables?.map((table) => {
              const depts = parseDepts(table.department);
              const positions = parsePositions(table.positions);
              return (
                <Card
                  key={table.id}
                  className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden relative group"
                >
                  <div className={`h-1.5 w-full ${getStatusDot(table.status)}`} />
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                          Table {table.tableNo}
                        </div>
                        <CardTitle className="text-lg leading-tight truncate">
                          {table.interviewerName || "Unassigned"}
                        </CardTitle>
                      </div>
                      <button
                        onClick={() => handleDelete(table.id)}
                        className="text-zinc-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Departments */}
                    {depts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {depts.map(d => (
                          <Badge key={d} variant="outline" className={`text-xs font-medium ${getDeptColor(d)}`}>
                            {d}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3 pb-4">
                    <Select value={table.status} onValueChange={(val) => handleStatusChange(table.id, val)}>
                      <SelectTrigger className={`h-8 text-xs font-semibold border ${getStatusColor(table.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                        <SelectItem value="BUSY">BUSY</SelectItem>
                        <SelectItem value="BREAK">BREAK</SelectItem>
                        <SelectItem value="OFFLINE">OFFLINE</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Positions filter */}
                    {positions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {positions.map(p => (
                          <Badge key={p} variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary font-medium">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Current candidate */}
                    {table.status === "BUSY" && table.currentCandidateName && (
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex items-center gap-3">
                        <div className="bg-white w-10 h-10 rounded border flex items-center justify-center font-mono font-bold text-primary text-sm shadow-sm">
                          {table.currentTokenNo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-500 uppercase font-semibold">Now with</div>
                          <div className="text-sm font-medium text-zinc-900 truncate">{table.currentCandidateName}</div>
                        </div>
                      </div>
                    )}
                    {table.status === "AVAILABLE" && (
                      <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex items-center justify-center h-[54px]">
                        <span className="text-sm font-medium text-emerald-600">Ready for candidate</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
