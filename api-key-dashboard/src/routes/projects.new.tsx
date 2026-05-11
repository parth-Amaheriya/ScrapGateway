import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  projectsApi,
  computeMetrics,
  normalizeAllowedDomains,
  type Project,
  type ProjectInput,
} from "@/api/projects";
import { AdminGate } from "@/components/AdminGate";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AllowedDomainsField } from "@/components/AllowedDomainsField";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/utils/format";

export const Route = createFileRoute("/projects/new")({
  component: NewProjectPage,
});

const fields: {
  name: keyof ProjectInput;
  label: string;
  type: "text" | "number";
  step?: string;
  placeholder?: string;
  hint?: string;
}[] = [
  { name: "project_id", label: "Project ID", type: "text", placeholder: "my-project" },
  { name: "pool_size", label: "Pool Size", type: "number", placeholder: "50" },
  { name: "cost_per_request", label: "Cost Per Request", type: "number", step: "0.01", placeholder: "1" },
  { name: "recovery_per_second", label: "Recovery Per Second", type: "number", step: "0.1", placeholder: "5" },
  { name: "penalty_increase", label: "Penalty Increase", type: "number", step: "0.1", placeholder: "2" },
  { name: "total_quota", label: "Total Quota", type: "number", placeholder: "100000" },
  { name: "average_latency", label: "Average Latency (s)", type: "number", step: "1.0", placeholder: "4.0" },
  { name: "failure_rate", label: "Failure Rate (0-1)", type: "number", step: "0.01", placeholder: "0.05" },
  { name: "safety_margin", label: "Safety Margin (0-1)", type: "number", step: "0.01", placeholder: "0.2" },
];

function NewProjectPage() {
  return (
    <AdminGate>
      <NewProjectPageContent />
    </AdminGate>
  );
}

function NewProjectPageContent() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [created, setCreated] = useState<Project | null>(null);
  const [createdMetrics, setCreatedMetrics] = useState<ReturnType<typeof computeMetrics> | null>(null);
  const [copied, setCopied] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: (input: ProjectInput) => projectsApi.create(input),
    onSuccess: (p, input) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setCreated(p);
      setCreatedMetrics(computeMetrics(input));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const domains = normalizeAllowedDomains(allowedDomains);
    const input: ProjectInput = {
      project_id: String(fd.get("project_id") || "").trim(),
      pool_size: Number(fd.get("pool_size")),
      cost_per_request: Number(fd.get("cost_per_request")),
      recovery_per_second: Number(fd.get("recovery_per_second")),
      penalty_increase: Number(fd.get("penalty_increase")),
      total_quota: Number(fd.get("total_quota")),
      average_latency: Number(fd.get("average_latency")),
      failure_rate: Number(fd.get("failure_rate")),
      safety_margin: Number(fd.get("safety_margin")),
      allowed_domains: domains,
    };
    if (!input.project_id) {
      toast.error("Project ID is required");
      return;
    }
    createMut.mutate(input);
  };

  if (created) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-success/15 p-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Project created</CardTitle>
                  <CardDescription>
                    Save your API key — it will be masked after this screen.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">API KEY</Label>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
                  <span className="flex-1 truncate">{created.api_key}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(created.api_key);
                      setCopied(true);
                      toast.success("API key copied");
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Metric label="max_concurrency" value={formatNumber(createdMetrics?.max_concurrency ?? 0)} />
                <Metric label="max_rps" value={String(createdMetrics?.max_rps ?? 0)} />
                <Metric label="etc_minutes" value={String(createdMetrics?.etc_minutes ?? 0)} />
                <Metric label="hits_per_proxy" value={String(createdMetrics?.hits_per_proxy ?? 0)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" asChild>
                  <Link to="/projects">Back to projects</Link>
                </Button>
                <Button
                  onClick={() =>
                    navigate({ to: "/projects/$id", params: { id: created.id } })
                  }
                >
                  View details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>
              Configure pool, quota, and rate limits. We'll generate the API key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name}>{f.label}</Label>
                    <Input
                      id={f.name}
                      name={f.name}
                      type={f.type}
                      step={f.step}
                      placeholder={f.placeholder}
                      required
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <AllowedDomainsField
                    label="Allowed Domains"
                    value={allowedDomains}
                    editing
                    onChange={setAllowedDomains}
                    onInvalid={(message) => toast.error(message)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" asChild>
                  <Link to="/projects">Cancel</Link>
                </Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
