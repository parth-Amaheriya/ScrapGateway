import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, PlusCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { issueApi, type IssueImagePayload, type IssueSummary } from "@/api/issues";
import { AdminGate } from "@/components/AdminGate";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/issues")({
  component: IssuesAdminPage,
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.invalidate()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  },
});

function IssuesAdminPage() {
  return (
    <AdminGate>
      <IssuesAdminPageContent />
    </AdminGate>
  );
}

function IssuesAdminPageContent() {
  const [query, setQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const qc = useQueryClient();

  const {
    data: issues,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["issues"],
    queryFn: issueApi.list,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!selectedIssueId && issues?.length) {
      setSelectedIssueId(issues[0].issue_id);
    }
  }, [issues, selectedIssueId]);

  const filteredIssues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return issues ?? [];

    return (issues ?? []).filter((issue) => {
      return [
        issue.issue_id,
        issue.domain,
        issue.email,
        issue.api_key,
        issue.status,
        issue.description_preview,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [issues, query]);

  const selectedIssue = filteredIssues.find((issue) => issue.issue_id === selectedIssueId) ?? filteredIssues[0] ?? null;

  const detailQuery = useQuery({
    queryKey: ["issues", selectedIssue?.issue_id],
    queryFn: () => issueApi.get(selectedIssue!.issue_id),
    enabled: Boolean(selectedIssue?.issue_id),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { issueId: string; status: "open" | "closed" }) =>
      issueApi.updateStatus(vars.issueId, vars.status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.setQueryData(["issues", updated.issue_id], updated);
      toast.success(`Issue ${updated.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: (input: { domain: string; api_key: string; email: string; description: string; images: IssueImagePayload[] }) =>
      issueApi.create({ ...input, source: "admin" }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      setSelectedIssueId(created.issue_id);
      setCreateOpen(false);
      toast.success("Issue created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loader label="Loading issues..." />
      </DashboardLayout>
    );
  }

  if (isError || !issues) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message ?? "Issues not found"}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Issue Inbox
              </CardTitle>
              <CardDescription>
                Review issue reports stored in MongoDB.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                Create Issue
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Metric label="Total issues" value={String(issues.length)} />
            <Metric label="Filtered issues" value={String(filteredIssues.length)} />
            <Metric label="Open selected" value={selectedIssue?.status ?? "-"} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>All Issues</CardTitle>
              <CardDescription>Search by domain, email, API key, or description.</CardDescription>
              <div className="pt-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issues..."
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Issue</th>
                      <th className="px-3 py-2">Domain</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue) => {
                      const active = issue.issue_id === selectedIssue?.issue_id;
                      return (
                        <tr
                          key={issue.issue_id}
                          onClick={() => setSelectedIssueId(issue.issue_id)}
                          className={`cursor-pointer border-t border-border transition-colors ${
                            active ? "bg-muted/70" : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="px-3 py-3 font-mono text-xs text-foreground">
                            {issue.issue_id}
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {issue.description_preview || "No description preview"}
                            </div>
                          </td>
                          <td className="px-3 py-3">{issue.domain}</td>
                          <td className="px-3 py-3">{issue.email}</td>
                          <td className="px-3 py-3">{issue.status}</td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {new Date(issue.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                          No issues match your search.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issue Details</CardTitle>
              <CardDescription>
                {selectedIssue ? selectedIssue.issue_id : "Select an issue to inspect it."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!selectedIssue ? (
                <p className="text-muted-foreground">No issue selected.</p>
              ) : detailQuery.isLoading ? (
                <Loader label="Loading issue details..." />
              ) : detailQuery.isError || !detailQuery.data ? (
                <p className="text-destructive">
                  {(detailQuery.error as Error)?.message ?? "Failed to load issue details"}
                </p>
              ) : (
                <>
                  <Field label="Domain" value={detailQuery.data.domain} />
                  <Field label="Email" value={detailQuery.data.email} />
                  <Field label="API Key" value={detailQuery.data.api_key} copyable />
                  <Field label="Status" value={detailQuery.data.status} />
                  <Field label="Created" value={new Date(detailQuery.data.created_at).toLocaleString()} />
                  <Field label="Updated" value={new Date(detailQuery.data.updated_at).toLocaleString()} />
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                    <div className="rounded-md border border-border bg-muted/30 p-3 leading-6 text-foreground">
                      {detailQuery.data.description}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {detailQuery.data.status === "closed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => statusMut.mutate({ issueId: detailQuery.data.issue_id, status: "open" })}
                        disabled={statusMut.isPending}
                      >
                        Reopen Issue
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => statusMut.mutate({ issueId: detailQuery.data.issue_id, status: "closed" })}
                        disabled={statusMut.isPending}
                      >
                        Close Issue
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Images ({detailQuery.data.images.length})
                    </div>
                    {detailQuery.data.images.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {detailQuery.data.images.map((image) => (
                          <button
                            key={`${image.name}-${image.data}`}
                            type="button"
                            onClick={() => setPreviewImage({ src: image.data, name: image.name })}
                            className="overflow-hidden rounded-md border border-border bg-muted/30 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
                          >
                            <img src={image.data} alt={image.name} className="h-28 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No images attached.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {createOpen ? (
          <CreateIssueModal
            onClose={() => setCreateOpen(false)}
            onSubmit={(input) => createMut.mutate(input)}
            submitting={createMut.isPending}
          />
        ) : null}

        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
              <DialogDescription>{previewImage?.name ?? "Selected image"}</DialogDescription>
            </DialogHeader>
            {previewImage ? (
              <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                <img
                  src={previewImage.src}
                  alt={previewImage.name}
                  className="max-h-[75vh] w-full object-contain"
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground">
        <span className="flex-1 break-all">{value}</span>
        {copyable ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              toast.success(`${label} copied`);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CreateIssueModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (input: { domain: string; api_key: string; email: string; description: string; images: IssueImagePayload[] }) => void;
  submitting: boolean;
}) {
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const addFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...imgs]);
  };

  const validate = () => {
    if (!domain.trim() || !apiKey.trim() || !email.trim() || !description.trim()) {
      toast.error("All fields except images are required");
      return false;
    }
    return true;
  };

  const fileToPayload = (file: File): Promise<IssueImagePayload> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, type: file.type, data: String(reader.result ?? "") });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      const imagePayload = await Promise.all(images.map((file) => fileToPayload(file)));
      onSubmit({
        domain: domain.trim(),
        api_key: apiKey.trim(),
        email: email.trim(),
        description: description.trim(),
        images: imagePayload,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare issue");
    }
  };

  const inputCls =
    "w-full rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-2 font-mono text-[13px] text-[var(--docs-fg)] placeholder:text-[var(--docs-muted)] focus:outline-none focus:border-[var(--docs-amber)] focus:ring-1 focus:ring-[var(--docs-amber)]/40 transition-colors";
  const labelCls =
    "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--docs-border)] bg-[var(--docs-bg)] shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--docs-border)] px-5 py-3">
          <h3 className="text-base font-semibold text-[var(--docs-fg)]">Create Issue</h3>
          <button type="button" onClick={onClose} className="rounded p-1 font-mono text-sm text-[var(--docs-muted)] hover:text-[var(--docs-fg)]">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className={labelCls}>Domain</label>
            <input className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
          </div>
          <div>
            <label className={labelCls}>API Key</label>
            <input className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-y leading-6`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the issue..." />
          </div>
          <div>
            <label className={labelCls}>Images (Optional)</label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
                dragOver ? "border-[var(--docs-amber)] bg-[var(--docs-surface-2)]" : "border-[var(--docs-border)] bg-[var(--docs-surface)] hover:bg-[var(--docs-surface-2)]"
              }`}
            >
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
              <div className="font-mono text-xs text-[var(--docs-fg-soft)]">Drag &amp; drop images here, or click to select</div>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--docs-border)] pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Issue"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
