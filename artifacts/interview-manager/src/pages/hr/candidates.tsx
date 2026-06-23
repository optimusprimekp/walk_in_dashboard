import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListCandidates, useUpdateCandidate } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Upload, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Candidates() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: candidates, isLoading } = useListCandidates({
    query: {
      refetchInterval: 10000,
    }
  });

  const updateMutation = useUpdateCandidate();

  const filteredCandidates = candidates?.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.tokenNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.mobile.includes(searchTerm);
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'WAITING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'IN_INTERVIEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED': return 'bg-zinc-100 text-zinc-800 border-zinc-200';
      case 'SELECTED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-destructive/10 text-destructive border-destructive/20';
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
            <h1 className="font-semibold text-lg">Candidate Roster</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* TODO: Excel Import */}
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Import Excel
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search by name, token, or mobile..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="WAITING">Waiting</SelectItem>
                <SelectItem value="IN_INTERVIEW">In Interview</SelectItem>
                <SelectItem value="SELECTED">Selected</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-white border-zinc-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50 border-b border-zinc-200">
                  <TableRow>
                    <TableHead className="w-24 font-semibold">Token</TableHead>
                    <TableHead className="font-semibold">Candidate</TableHead>
                    <TableHead className="font-semibold">Position</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                        No candidates found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates?.map((candidate) => (
                      <TableRow key={candidate.id} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell className="font-mono font-medium text-primary">
                          {candidate.tokenNo || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-zinc-900">{candidate.name}</div>
                          <div className="text-xs text-zinc-500">{candidate.experience || 'Fresher'}</div>
                        </TableCell>
                        <TableCell className="text-zinc-600">{candidate.position}</TableCell>
                        <TableCell>
                          <div className="text-sm text-zinc-900">{candidate.mobile}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[150px]">{candidate.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-semibold tracking-wide border px-2 py-0.5 ${getStatusColor(candidate.status)}`}>
                            {candidate.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900">
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
