import type { CurrentUser } from "@/lib/session";

export type RbacAction =
  | "VIEW_MY_JOBS"
  | "VIEW_COMPANY_JOBS"
  | "ARCHIVE_JOB"
  | "ASSIGN_JOB"
  | "ASSIGN_LOT"
  | "ASSIGN_SAMPLING"
  | "CREATE_JOB"
  | "OVERRIDE_DUPLICATE_JOB"
  | "MANAGE_WORKFLOW_ESCALATIONS"
  | "CREATE_LOT"
  | "MUTATE_SAMPLING"
  | "MUTATE_RND"
  | "READ_ONLY";

export class AuthorizationError extends Error {
  status = 403;
  code = "FORBIDDEN";

  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

const ACTION_MATRIX: Record<RbacAction, CurrentUser["role"][]> = {
  VIEW_MY_JOBS: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
  VIEW_COMPANY_JOBS: ["ADMIN"],
  ARCHIVE_JOB: ["ADMIN", "OPERATIONS"],
  ASSIGN_JOB: ["ADMIN", "OPERATIONS"],
  ASSIGN_LOT: ["ADMIN", "OPERATIONS"],
  ASSIGN_SAMPLING: ["ADMIN", "OPERATIONS"],
  CREATE_JOB: ["ADMIN", "OPERATIONS"],
  OVERRIDE_DUPLICATE_JOB: ["ADMIN"],
  MANAGE_WORKFLOW_ESCALATIONS: ["ADMIN"],
  CREATE_LOT: ["ADMIN", "OPERATIONS"],
  MUTATE_SAMPLING: ["ADMIN", "OPERATIONS"],
  MUTATE_RND: ["ADMIN", "RND"],
  READ_ONLY: ["ADMIN", "OPERATIONS", "RND", "VIEWER"],
};

export function authorize(user: CurrentUser, action: RbacAction): void {
  if (!ACTION_MATRIX[action].includes(user.role)) {
    throw new AuthorizationError(`Role ${user.role} is not allowed to perform ${action}.`);
  }
}

export function assertCompanyScope(currentCompanyId: string, targetCompanyId: string): void {
  if (currentCompanyId !== targetCompanyId) {
    throw new AuthorizationError("Cross-company access is not allowed.");
  }
}
