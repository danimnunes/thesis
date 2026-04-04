import type { PaginatedList } from "@ebsiint-api/shared";
import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { paginate } from "@ebsiint-api/shared";

import type {
  SubjectLink,
  SubjectPolicies,
  SubjectPolicyLink,
} from "./subjects.interface.ts";

export function formatPolicies(
  policies: SubjectPolicies,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<SubjectPolicyLink> {
  const total = policies.total;

  // Reshape items
  const items = policies.items.map((policyName) => {
    return {
      href: `${baseUrl}/${policyName}`,
      policyName,
    };
  });

  return paginate<SubjectPolicyLink>(items, baseUrl, total, page, pageSize);
}

export function formatSubjects(
  subjects: Awaited<ReturnType<PolicyRegistry["getUsers"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<SubjectLink> {
  const total = Number(subjects.total);

  // Reshape items
  const items = subjects.items.map((subject) => {
    return {
      href: `${baseUrl}/${subject}`,
      subject,
    };
  });

  return paginate<SubjectLink>(items, baseUrl, total, page, pageSize);
}
