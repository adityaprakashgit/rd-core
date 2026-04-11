import type { InspectionJob, InspectionLot, SampleRecord, Sampling } from "@/types/inspection";
import type { WorkflowStep } from "@/components/enterprise/WorkflowStepTracker";
import { isLotDetailCaptured, isLotReadyForNextStage } from "@/lib/intake-workflow";
import { deriveSampleStatus } from "@/lib/sample-management";
import { getStatusPresentation } from "@/lib/status-presentation";

export type CanonicalWorkflowStage =
  | "intake"
  | "lot_capture"
  | "sampling"
  | "lab"
  | "reporting"
  | "complete"
  | "blocked";

export type WorkflowStatusTone = "gray" | "orange" | "blue" | "purple" | "teal" | "green" | "red" | "yellow";

export type WorkflowPresentation = {
  stage: CanonicalWorkflowStage;
  status: string;
  label: string;
  tone: WorkflowStatusTone;
  summary: string;
  nextAction: string;
};

function buildWorkflowPresentation(input: {
  stage: CanonicalWorkflowStage;
  status: string;
  summary: string;
  nextAction: string;
}): WorkflowPresentation {
  const presentation = getStatusPresentation(input.status);
  return {
    stage: input.stage,
    status: input.status,
    label: presentation.label,
    tone: presentation.tone,
    summary: input.summary,
    nextAction: input.nextAction,
  };
}

export function getSamplingRecord(lot: InspectionLot | null | undefined): Sampling | null {
  const samplingValue = lot?.sampling as Sampling | Sampling[] | null | undefined;
  if (!samplingValue) {
    return null;
  }
  return Array.isArray(samplingValue) ? samplingValue[0] ?? null : samplingValue;
}

export function getSampleRecord(lot: InspectionLot | null | undefined): SampleRecord | null {
  return lot?.sample ?? null;
}

export function isSamplingComplete(lot: InspectionLot | null | undefined): boolean {
  const sample = getSampleRecord(lot);
  if (sample && deriveSampleStatus(sample) === "READY_FOR_PACKETING") {
    return true;
  }
  const sampling = getSamplingRecord(lot);
  return (
    lot?.status === "COMPLETED" ||
    isLotReadyForNextStage(lot) ||
    Boolean(sampling?.beforePhotoUrl && sampling?.duringPhotoUrl && sampling?.afterPhotoUrl)
  );
}

function hasInspectionStarted(lot: InspectionLot | null | undefined): boolean {
  if (!lot) {
    return false;
  }

  if (["INSPECTION_IN_PROGRESS", "READY_FOR_SAMPLING", "ON_HOLD", "REJECTED", "COMPLETED"].includes(lot.status ?? "")) {
    return true;
  }

  return isLotDetailCaptured(lot) || Boolean(getSamplingRecord(lot)) || Boolean(getSampleRecord(lot));
}

export function getJobWorkflowPresentation(job: InspectionJob): WorkflowPresentation {
  const lots = job.lots ?? [];
  const totalLots = lots.length;
  const completedLots = lots.filter((lot) => isSamplingComplete(lot)).length;
  const startedLots = lots.filter((lot) => hasInspectionStarted(lot)).length;

  switch (job.status) {
    case "COMPLETED":
    case "DISPATCHED":
      return buildWorkflowPresentation({
        stage: "complete",
        status: "COMPLETED",
        summary: "Workflow closed and ready for downstream reference.",
        nextAction: "View documents",
      });
    case "REPORT_READY":
      return buildWorkflowPresentation({
        stage: "reporting",
        status: "REPORT_READY",
        summary: "Operational work is finished and reporting is the active step.",
        nextAction: "Open reports",
      });
    case "RND_RUNNING":
      return buildWorkflowPresentation({
        stage: "lab",
        status: "RND_RUNNING",
        summary: "Sampling is complete and lab analysis is the active stage.",
        nextAction: "Continue lab review",
      });
    case "QA":
    case "LOCKED":
      return buildWorkflowPresentation({
        stage: job.status === "LOCKED" ? "reporting" : "lab",
        status: job.status === "LOCKED" ? "LOCKED" : "QA",
        summary: job.status === "LOCKED"
          ? "Job is sealed and waiting for reporting or release."
          : "Evidence capture is complete and QA review is active.",
        nextAction: job.status === "LOCKED" ? "Open reports" : "Review QA",
      });
    case "SAMPLING_PENDING":
      return buildWorkflowPresentation({
        stage: "sampling",
        status: "SAMPLING_PENDING",
        summary: "A lot is not yet approved for sampling and blocks lab progression.",
        nextAction: "Finish sampling",
      });
    case "IN_PROGRESS":
      return buildWorkflowPresentation({
        stage: completedLots === totalLots && totalLots > 0 ? "lab" : startedLots > 0 ? "sampling" : "lot_capture",
        status: completedLots === totalLots && totalLots > 0 ? "READY_FOR_PACKETING" : startedLots > 0 ? "INSPECTION_IN_PROGRESS" : "LOT_CAPTURE",
        summary: completedLots === totalLots && totalLots > 0
          ? "Sampling evidence is complete and the job can move into analysis."
          : startedLots > 0
            ? "Inspection, exception capture, or evidence review is underway."
            : "Job is active but lot intake is still the primary task.",
        nextAction: completedLots === totalLots && totalLots > 0 ? "Open lab workspace" : "Continue inspection",
      });
    default:
      if (totalLots === 0) {
        return buildWorkflowPresentation({
          stage: "intake",
          status: "INTAKE",
          summary: "Job exists but no lots have been registered yet.",
          nextAction: "Add first lot",
        });
      }

      if (completedLots === totalLots) {
        return buildWorkflowPresentation({
          stage: "lab",
          status: "READY_FOR_PACKETING",
          summary: "All lots have complete evidence and can move to lab review.",
          nextAction: "Open lab workspace",
        });
      }

      if (startedLots > 0) {
        return buildWorkflowPresentation({
          stage: "sampling",
          status: "INSPECTION_IN_PROGRESS",
          summary: "At least one lot has started inspection or evidence capture.",
          nextAction: "Continue inspection",
        });
      }

      return buildWorkflowPresentation({
        stage: "lot_capture",
        status: "LOT_CAPTURE",
        summary: "Lots are registered, but inspection work has not started.",
        nextAction: "Open next lot",
      });
  }
}

export function buildWorkflowSteps(job: InspectionJob): WorkflowStep[] {
  const presentation = getJobWorkflowPresentation(job);
  const ordered: Array<{ id: CanonicalWorkflowStage; label: string }> = [
    { id: "intake", label: "Job Intake" },
    { id: "lot_capture", label: "Lot Intake" },
    { id: "sampling", label: "Sampling" },
    { id: "lab", label: "Lab Review" },
    { id: "reporting", label: "Reporting" },
    { id: "complete", label: "Complete" },
  ];

  const currentIndex = ordered.findIndex((item) => item.id === presentation.stage);

  return ordered.map((item, index) => {
    let state: WorkflowStep["state"] = "upcoming";
    if (item.id === "complete" && presentation.stage === "complete") {
      state = "completed";
    } else if (index < currentIndex) {
      state = "completed";
    } else if (index === currentIndex) {
      state = presentation.stage === "complete" ? "completed" : "current";
    } else if (index === currentIndex + 1) {
      state = "next";
    }

    return {
      id: item.id,
      label: item.label,
      state,
    };
  });
}

export function getWorkflowStepRoute(jobId: string, stepId: string) {
  switch (stepId) {
    case "lab":
      return "/rnd";
    case "reporting":
    case "complete":
      return "/reports";
    case "intake":
    case "lot_capture":
    case "sampling":
    default:
      return `/operations/job/${jobId}`;
  }
}

export function summarizeLotProgress(job: InspectionJob) {
  const lots = job.lots ?? [];
  const completed = lots.filter((lot) => isSamplingComplete(lot)).length;
  const started = lots.filter((lot) => hasInspectionStarted(lot)).length;
  return {
    total: lots.length,
    completed,
    inProgress: Math.max(started - completed, 0),
    notStarted: Math.max(lots.length - started, 0),
  };
}
