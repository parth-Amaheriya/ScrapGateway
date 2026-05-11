import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  projectsApi,
  computeMetrics,
  type ProjectConfigPatch,
  type Project,
} from "@/api/projects";
import { AdminGate } from "@/components/AdminGate";
import { AllowedDomainsField } from "@/components/AllowedDomainsField";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Loader } from "@/components/Loader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/utils/format";

export const Route = createFileRoute("/projects/$id")({
  component: ProjectDetailsPage,
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

type ConfigForm = Pick<
  Project,
  | "pool_size"
  | "cost_per_request"
  | "recovery_per_second"
  | "penalty_increase"
  | "total_quota"
  | "average_latency"
  | "failure_rate"
  | "safety_margin"
  | "allowed_domains"
>;

type ConfigField = keyof ConfigForm;
type DirtyFields = Partial<Record<ConfigField, true>>;

function toForm(p: Project): ConfigForm {
  return {
    pool_size: p.pool_size,
    cost_per_request: p.cost_per_request,
    recovery_per_second: p.recovery_per_second,
    penalty_increase: p.penalty_increase,
    total_quota: p.total_quota,
    average_latency: p.average_latency,
    failure_rate: p.failure_rate,
    safety_margin: p.safety_margin,
    allowed_domains: p.allowed_domains,
  };
}

function isConfigValueEqual(field: ConfigField, left: ConfigForm[ConfigField], right: ConfigForm[ConfigField]) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((domain, index) => domain === right[index]);
  }

  return left === right;
}

function buildPatch(form: ConfigForm, dirtyFields: DirtyFields): ProjectConfigPatch {
  const patch: ProjectConfigPatch = {};

  for (const field of Object.keys(dirtyFields) as ConfigField[]) {
    if (!dirtyFields[field]) {
      continue;
    }

    switch (field) {
      case "pool_size":
        patch.pool_size = form.pool_size;
        break;
      case "cost_per_request":
        patch.cost_per_request = form.cost_per_request;
        break;
      case "recovery_per_second":
        patch.recovery_per_second = form.recovery_per_second;
        break;
      case "penalty_increase":
        patch.penalty_increase = form.penalty_increase;
        break;
      case "total_quota":
        patch.total_quota = form.total_quota;
        break;
      case "average_latency":
        patch.average_latency = form.average_latency;
        break;
      case "failure_rate":
        patch.failure_rate = form.failure_rate;
        break;
      case "safety_margin":
        patch.safety_margin = form.safety_margin;
        break;
      case "allowed_domains":
        patch.allowed_domains = form.allowed_domains;
        break;
    }
  }

  return patch;
}

function ProjectDetailsPage() {
  return (
    <AdminGate>
      <ProjectDetailsPageContent />
    </AdminGate>
  );
}

function ProjectDetailsPageContent() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: p, isLoading, isError, error } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.get(id),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [editBaseline, setEditBaseline] = useState<ConfigForm | null>(null);
  const [dirtyFields, setDirtyFields] = useState<DirtyFields>({});

  useEffect(() => {
    if (p && !editMode) {
      const nextForm = toForm(p);
      setForm(nextForm);
      setEditBaseline(nextForm);
      setDirtyFields({});
    }
  }, [p, editMode]);

  const updateMut = useMutation({
    mutationFn: (patch: ProjectConfigPatch) => projectsApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", id] });
      toast.success("Configuration saved");
      setEditMode(false);
      setDirtyFields({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loader label="Loading project..." />
      </DashboardLayout>
    );
  }

  if (isError || !p || !form) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message ?? "Project not found"}
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/projects">Back to projects</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const computed = computeMetrics({ ...form, project_id: p.project_id });

  const startEditing = () => {
    const nextForm = toForm(p);
    setForm(nextForm);
    setEditBaseline(nextForm);
    setDirtyFields({});
    setEditMode(true);
  };

  const setField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current, [key]: value };
      const baseline = editBaseline ?? toForm(p);

      setDirtyFields((currentDirty) => {
        const nextDirty = { ...currentDirty };
        if (isConfigValueEqual(key, next[key], baseline[key])) {
          delete nextDirty[key];
        } else {
          nextDirty[key] = true;
        }

        return nextDirty;
      });

      return next;
    });

  const handleSave = () => {
    if (Object.keys(dirtyFields).length === 0) {
      setEditMode(false);
      return;
    }

    const patch = buildPatch(form, dirtyFields);
    updateMut.mutate(patch);
  };

  const handleCancel = () => {
    const nextForm = editBaseline ?? toForm(p);
    setForm(nextForm);
    setDirtyFields({});
    setEditMode(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <StatusBadge status={p.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{p.project_id}</CardTitle>
            <CardDescription>API key and contract limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">API KEY</span>
              <code className="flex-1 break-all font-mono text-sm">{p.api_key}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(p.api_key);
                  toast.success("API key copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Quota Limit" value={formatNumber(p.quota_limit)} />
              <Stat label="Max Concurrency" value={formatNumber(computed.max_concurrency)} />
              <Stat label="Max RPS" value={formatNumber(computed.max_rps)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>{editMode ? "Editing project inputs and domains" : "Project inputs"}</CardDescription>
              </div>
              {editMode ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMut.isPending || Object.keys(dirtyFields).length === 0}
                  >
                    <Save className="h-4 w-4" />
                    {updateMut.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={startEditing}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField
                label="Pool size"
                value={form.pool_size}
                editing={editMode}
                onChange={(v) => setField("pool_size", v)}
                step={1}
              />
              <NumberField
                label="Recovery per second"
                value={form.recovery_per_second}
                editing={editMode}
                onChange={(v) => setField("recovery_per_second", v)}
                step={0.1}
              />
              <NumberField
                label="Cost per request"
                value={form.cost_per_request}
                editing={editMode}
                onChange={(v) => setField("cost_per_request", v)}
                step={0.01}
              />
              <NumberField
                label="Penalty increase"
                value={form.penalty_increase}
                editing={editMode}
                onChange={(v) => setField("penalty_increase", v)}
                step={0.1}
              />
              <NumberField
                label="Total quota"
                value={form.total_quota}
                editing={editMode}
                onChange={(v) => setField("total_quota", v)}
                step={1000}
              />
              <NumberField
                label="Average latency (s)"
                value={form.average_latency}
                editing={editMode}
                onChange={(v) => setField("average_latency", v)}
                step={0.01}
              />
              <NumberField
                label="Failure rate (0-1)"
                value={form.failure_rate}
                editing={editMode}
                onChange={(v) => setField("failure_rate", v)}
                step={0.01}
              />
              <NumberField
                label="Safety margin (0-1)"
                value={form.safety_margin}
                editing={editMode}
                onChange={(v) => setField("safety_margin", v)}
                step={0.01}
              />
              <div className="sm:col-span-2">
                <AllowedDomainsField
                  label="Allowed domains"
                  value={form.allowed_domains}
                  editing={editMode}
                  onChange={(domains) => setField("allowed_domains", domains)}
                  onInvalid={(message) => toast.error(message)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Computed Metrics</CardTitle>
              <CardDescription>
                {editMode ? "Live preview" : "Current values"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="max_concurrency" value={computed.max_concurrency} mono />
              <Row label="max_rps" value={computed.max_rps} mono />
              <Row label="etc_minutes" value={computed.etc_minutes} mono />
              <Row label="hits_per_proxy" value={computed.hits_per_proxy} mono />
              <Row label="expected_latency" value={p.expected_latency} mono />
              <Row label="failure_rate_assumption" value={p.failure_rate_assumption} mono />
              <Row label="safety_level" value={p.safety_level} mono />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Raw JSON</CardTitle>
            <CardDescription>Full project record</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
              {JSON.stringify(p, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting a project permanently revokes its API key and removes all
              associated configuration. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Permanently delete{" "}
              <span className="font-medium text-foreground">{p.project_id}</span>.
            </p>
            <Button variant="destructive" onClick={() => deleteMut.mutate()}>
              <Trash2 className="h-4 w-4" /> {deleteMut.isPending ? "Deleting..." : "Delete project"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function NumberField({
  label,
  value,
  editing,
  onChange,
  step,
}: {
  label: string;
  value: number;
  editing: boolean;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <Label className="text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 max-w-[160px] text-right"
        />
      ) : (
        <span className="text-foreground">{value}</span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <span className={mono ? "font-mono text-muted-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
