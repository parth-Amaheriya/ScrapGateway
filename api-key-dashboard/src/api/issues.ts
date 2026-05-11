import { apiClient } from "./client";

export interface IssueImagePayload {
  name: string;
  type: string;
  data: string;
}

export interface IssueInput {
  domain: string;
  api_key: string;
  email: string;
  description: string;
  images: IssueImagePayload[];
  source?: string;
}

export interface IssueSummary {
  issue_id: string;
  domain: string;
  api_key: string;
  email: string;
  description_preview: string;
  image_count: number;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface IssueRecord extends IssueSummary {
  description: string;
  images: IssueImagePayload[];
}

export type IssueStatus = "open" | "closed";

export const issueApi = {
  list: async () => {
    const { data } = await apiClient.get<IssueSummary[]>("/issues");
    return data;
  },
  get: async (issueId: string) => {
    const { data } = await apiClient.get<IssueRecord>(`/issues/${issueId}`);
    return data;
  },
  create: async (input: IssueInput) => {
    const { data } = await apiClient.post<IssueRecord>("/issues", input);
    return data;
  },
  updateStatus: async (issueId: string, status: IssueStatus) => {
    const { data } = await apiClient.patch<IssueRecord>(`/issues/${issueId}`, { status });
    return data;
  },
};
