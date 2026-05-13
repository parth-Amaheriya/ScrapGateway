import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { projectsApi, type Project, type ProjectConfigPatch } from "@/api/projects";
import { AdminGate } from "@/components/AdminGate";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Loader } from "@/components/Loader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, maskKey } from "@/utils/format";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <AdminGate>
      <ProjectsPageContent />
    </AdminGate>
  );
}

function ProjectsPageContent() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const [editing, setEditing] = useState<Project | null>(null);

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; patch: ProjectConfigPatch }) =>
      projectsApi.update(vars.id, vars.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // const copyKey = (key: string) => {
  //   navigator.clipboard?.writeText(key);
  //   toast.success("API key copied");
  // };
  const copyKey = async (key: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(key);
    } else {
      // fallback for insecure origins / unsupported browsers
      const textArea = document.createElement("textarea");
      textArea.value = key;

      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      document.execCommand("copy");

      document.body.removeChild(textArea);
    }

    toast.success("API key copied");
  } catch (err) {
    console.error(err);
    toast.error("Failed to copy API key");
  }
};

  return (
    <DashboardLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Manage API keys and quotas</CardDescription>
          </div>
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4" /> New Project
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader />
          ) : !projects?.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project ID</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Quota Limit</TableHead>
                    <TableHead>Concurrency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.project_id}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyKey(p.api_key)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          {maskKey(p.api_key)}
                          <Copy className="h-3 w-3" />
                        </button>
                      </TableCell>
                      <TableCell>
                        {formatNumber(p.quota_limit)}
                      </TableCell>
                      <TableCell>{p.max_concurrency}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link to="/projects/$id" params={{ id: p.id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>{editing?.project_id}</DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMut.mutate({
                  id: editing.id,
                  patch: {
                    quota_limit: Number(fd.get("quota_limit")),
                    max_concurrency: Number(fd.get("max_concurrency")),
                  },
                });
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quota_limit">Quota Limit</Label>
                  <Input
                    id="quota_limit"
                    name="quota_limit"
                    type="number"
                    defaultValue={editing.quota_limit}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_concurrency">Max Concurrency</Label>
                  <Input
                    id="max_concurrency"
                    name="max_concurrency"
                    type="number"
                    defaultValue={editing.max_concurrency}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMut.isPending}>
                  {updateMut.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
