import { apiClient } from "./client";

export type ProjectStatus = "active" | "paused" | "revoked";

export interface ProjectInput {
  project_id: string;
  pool_size: number;
  cost_per_request: number;
  recovery_per_second: number;
  penalty_increase: number;
  total_quota: number;
  average_latency: number;
  failure_rate: number;
  safety_margin: number;
  allowed_domains: string[];
}

export type ProjectConfigPatch = Partial<
  Pick<
    Project,
    | "quota_limit"
    | "max_concurrency"
    | "pool_size"
    | "cost_per_request"
    | "recovery_per_second"
    | "penalty_increase"
    | "total_quota"
    | "average_latency"
    | "failure_rate"
    | "safety_margin"
    | "allowed_domains"
  >
>;

export interface ComputedMetrics {
  max_concurrency: number;
  max_rps: number;
  etc_minutes: number;
  hits_per_proxy: number;
}

export interface Project extends ComputedMetrics {
  id: string;
  project_id: string;
  api_key: string;
  allowed_domains: string[];
  pool_size: number;
  cost_per_request: number;
  recovery_per_second: number;
  penalty_increase: number;
  total_quota: number;
  average_latency: number;
  failure_rate: number;
  safety_margin: number;
  quota_limit: number;
  status: ProjectStatus;
  expected_latency: number;
  failure_rate_assumption: number;
  safety_level: number;
  created_at: string;
  last_edit_at: string;
}

export interface AllowedDomainsParseResult {
  domains: string[];
  invalid: string[];
}

function genKey() {
  const arr = new Uint8Array(24);
  if (typeof crypto !== "undefined") crypto.getRandomValues(arr);
  return (
    "rk_" +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function splitAllowedDomains(input: string[] | string | undefined): string[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "string") {
    return input.split(",");
  }

  return [];
}

export function parseAllowedDomains(
  input: string[] | string | undefined,
): AllowedDomainsParseResult {
  const entries = [...splitAllowedDomains(input)];
  const domains: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const domain = entry.trim().toLowerCase();
    if (!domain) {
      continue;
    }

    const isValid =
      domain === "localhost" ||
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i.test(
        domain,
      );

    if (!isValid) {
      invalid.push(domain);
      continue;
    }

    if (seen.has(domain)) {
      continue;
    }

    seen.add(domain);
    domains.push(domain);
  }

  return { domains, invalid };
}

export function normalizeAllowedDomains(
  input: string[] | string | undefined,
): string[] {
  return parseAllowedDomains(input).domains;
}

export function computeMetrics(input: ProjectInput): ComputedMetrics {
  const blended_cost = ((1 - input.failure_rate) * input.cost_per_request) + (input.failure_rate * 100);
  const penalty_drag = (1 - input.failure_rate) + (input.failure_rate / (1 + input.penalty_increase));
  const total_recovery = input.pool_size * input.recovery_per_second * penalty_drag;

  const optimal_s = (total_recovery * input.average_latency * input.safety_margin) / blended_cost;
  const max_concurrency = Math.floor(optimal_s);
  const max_rps = Math.round((optimal_s / input.average_latency) * 100) / 100;
  const etc_minutes = max_rps > 0 ? Math.round((input.total_quota / max_rps / 60) * 100) / 100 : 0;
  const hits_per_proxy = input.pool_size > 0 ? Math.round((input.total_quota / input.pool_size) * 100) / 100 : 0;
  return { max_concurrency, max_rps, etc_minutes, hits_per_proxy };
}

type ProjectResponse = Partial<Project> & {
  project_id?: string;
  allowed_domains?: string[] | string;
};

function normalizeProject(project: ProjectResponse): Project {
  const allowedDomains = parseAllowedDomains(project.allowed_domains).domains;

  return {
    ...project,
    id: project.id ?? project.project_id ?? "",
    project_id: project.project_id ?? project.id ?? "",
    api_key: project.api_key ?? "",
    allowed_domains: allowedDomains,
    pool_size: Number(project.pool_size ?? 0),
    cost_per_request: Number(project.cost_per_request ?? 0),
    recovery_per_second: Number(project.recovery_per_second ?? 0),
    penalty_increase: Number(project.penalty_increase ?? 0),
    total_quota: Number(project.total_quota ?? 0),
    average_latency: Number(project.average_latency ?? 0),
    failure_rate: Number(project.failure_rate ?? 0),
    safety_margin: Number(project.safety_margin ?? 0),
    status: project.status ?? "active",
    max_concurrency: Number(project.max_concurrency ?? 0),
    max_rps: Number(project.max_rps ?? 0),
    etc_minutes: Number(project.etc_minutes ?? 0),
    hits_per_proxy: Number(project.hits_per_proxy ?? 0),
    quota_limit: Number(project.quota_limit ?? 0),
    expected_latency: Number(project.expected_latency ?? 0),
    failure_rate_assumption: Number(project.failure_rate_assumption ?? 0),
    safety_level: Number(project.safety_level ?? 0),
    created_at: project.created_at ?? "",
    last_edit_at: project.last_edit_at ?? "",
  };
}

export const projectsApi = {
  list: async () => {
    const { data } = await apiClient.get<Project[]>("/projects");
    return data.map(normalizeProject);
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return normalizeProject(data);
  },
  create: async (input: ProjectInput) => {
    const { domains: allowed_domains, invalid } = parseAllowedDomains(input.allowed_domains);
    if (invalid.length > 0) {
      throw new Error(`Invalid allowed domain: ${invalid[0]}`);
    }
    const payload = {
      ...input,
      allowed_domains,
    };
    const { data } = await apiClient.post<Project>("/projects", payload);
    return normalizeProject(data);
  },
  update: async (id: string, patch: ProjectConfigPatch) => {
    const { data } = await apiClient.patch<Project>(`/projects/${id}`, patch);
    return normalizeProject(data);
  },
  remove: async (id: string) => {
    await apiClient.delete(`/projects/${id}`);
    return true;
  },
};
