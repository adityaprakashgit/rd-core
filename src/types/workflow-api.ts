import type { InspectionDecisionStatus } from "@/types/inspection";

export type WorkflowCaller =
  | "UnifiedJobWorkflow"
  | "LotInspectionWorkspace"
  | "SampleManagementWorkspace";

export type DecisionUpdateRequest = {
  jobId: string;
  decisionStatus: InspectionDecisionStatus;
  overallRemark?: string | null;
  caller: WorkflowCaller;
  lotId?: string;
};

export type SampleStartRequest = {
  jobId: string;
  sampleCode?: string;
  caller: WorkflowCaller;
  lotId?: string;
};

export type SampleUpdateRequest = {
  jobId: string;
  caller: WorkflowCaller;
  lotId?: string;
  sampleCode?: string;
  sampleType?: string;
  samplingMethod?: string;
  sampleQuantity?: string | number;
  sampleUnit?: string;
  containerType?: string;
  remarks?: string;
  markHomogenized?: boolean;
  markReadyForPacketing?: boolean;
  markSealed?: boolean;
  sealNo?: string;
  sealAuto?: boolean;
  mediaEntries?: Array<{
    mediaType: string;
    fileUrl: string;
    remarks?: string;
  }>;
};

