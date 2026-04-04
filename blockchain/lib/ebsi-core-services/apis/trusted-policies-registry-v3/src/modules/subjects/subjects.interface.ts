export interface SubjectLink {
  href: string;
  subject: string;
}

export interface SubjectPolicies {
  items: string[];
  total: number;
}

export interface SubjectPolicy {
  policyName: string;
  subject: string;
}

export interface SubjectPolicyLink {
  href: string;
  policyName: string;
}

export interface SubjectResponseObject {
  subject: string;
}
