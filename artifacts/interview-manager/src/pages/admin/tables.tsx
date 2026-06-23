import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListTables, useCreateTable, useUpdateTable, useDeleteTable } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, MonitorSpeaker, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function Tables() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [newInterviewer, setNewInterviewer] = useState("");
  const [newDepartment, setNewDepartment] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: tables, isLoading } = useListTables({
    query: { refetchInterval: 5000 }
  });

  const createMutation = useCreateTable();
  const updateMutation = useUpdateTable();
  const deleteMutation = useDeleteTable();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        tableNo: parseInt(newTableNo),
        interviewerName: newInterviewer,
        department: newDepartment,
        status: "AVAILABLE"
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setIsAddOpen(false);
        setNewTableNo("");
        setNewInterviewer("");
        setNewDepartment("");
      }
    });
  };

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({
      id,
      data: { status }
    }, {
      onSuccess: () => queryClient.invalidateQueries()
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to delete this table?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries()
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'BUSY': return 'bg-primary/10 text-primary border-primary/20';
      case 'BREAK': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'OFFLINE': return 'bg-zinc-100 text-zinc-500 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
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
            <h1 className="font-semibold text-lg">Table Management</h1>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Interview Table</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Table Number</Label>
                  <Input type="number" required value={newTableNo} onChange={e => setNewTableNo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Interviewer Name</Label>
                  <Input required value={newInterviewer} onChange={e => setNewInterviewer(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Department/Role</Label>
                  <Input required value={newDepartment} onChange={e => setNewDepartment(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Table
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tables?.map((table) => (
              <Card key={table.id} className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden relative group">
                <div className={`h-2 w-full ${getStatusColor(table.status).split(' ')[0]}`} />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">Table {table.tableNo}</div>
                      <CardTitle className="text-xl">{table.interviewerName || 'Unassigned'}</CardTitle>
                      <p className="text-sm text-zinc-500 mt-1">{table.department || 'General'}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(table.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Select value={table.status} onValueChange={(val) => handleStatusChange(table.id, val)}>
                      <SelectTrigger className={`h-8 text-xs font-semibold ${getStatusColor(table.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                        <SelectItem value="BUSY">BUSY</SelectItem>
                        <SelectItem value="BREAK">BREAK</SelectItem>
                        <SelectItem value="OFFLINE">OFFLINE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {table.status === 'BUSY' && table.currentCandidateName && (
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex items-center gap-3">
                      <div className="bg-white w-10 h-10 rounded border flex items-center justify-center font-mono font-bold text-primary text-sm shadow-sm">
                        {table.currentTokenNo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-500 uppercase font-semibold">Current</div>
                        <div className="text-sm font-medium text-zinc-900 truncate">{table.currentCandidateName}</div>
                      </div>
                    </div>
                  )}
                  {table.status === 'AVAILABLE' && (
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex items-center justify-center h-[66px]">
                      <span className="text-sm font-medium text-emerald-600">Waiting for candidate</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
