"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { InlineErrorState, PageSkeleton } from "@/components/enterprise/AsyncState";
import { DetailTabsLayout, LinkedRecordsPanel, PageActionBar, PageIdentityBar } from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { nextActionForStatus } from "@/lib/rnd-workflow";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

const RND_JOB_SECTIONS = [
  "overview",
  "source",
  "setup",
  "readings",
  "attachments",
  "review",
  "report",
  "history",
] as const;

type RndJobSectionId = (typeof RND_JOB_SECTIONS)[number];

function normalizeRndJobSection(value: string | null | undefined): RndJobSectionId {
  if (!value) return "overview";
  const normalized = value.trim().toLowerCase();
  return (RND_JOB_SECTIONS as readonly string[]).includes(normalized)
    ? (normalized as RndJobSectionId)
    : "overview";
}

type DetailPayload = {
  job: Record<string, unknown>;
  currentStep: string;
  nextAction: string;
  blockers: string[];
  pickerOptions?: {
    assignees: Array<{ id: string; displayName: string; email?: string | null; role: string }>;
    approvers: Array<{ id: string; displayName: string; email?: string | null; role: string }>;
    suggestedAssigneeId?: string | null;
  };
  ledger?: {
    balance?: {
      available: number;
      reserved: number;
      consumed: number;
      retained: number;
      backup: number;
      reference: number;
      clientRetest: number;
      additionalAnalysis: number;
    };
  };
  reportLinkage?: {
    activeResult?: { id: string; rndJobNumber: string; status: string } | null;
    supersededResults?: Array<{ id: string; rndJobNumber: string; status: string }>;
    activeReport?: {
      id: string;
      reportSnapshotId: string;
      precedence: "ACTIVE" | "SUPERSEDED";
      rndJob: { id: string; rndJobNumber: string; status: string };
    } | null;
    previousReports?: Array<{
      id: string;
      reportSnapshotId: string;
      precedence: "ACTIVE" | "SUPERSEDED";
      rndJob: { id: string; rndJobNumber: string; status: string };
    }>;
    defaultReportUrl?: string | null;
    defaultCoaUrl?: string | null;
  };
};

export default function RndJobDetailPage() {
  const params = useParams<{ rndJobId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const rndJobId = params?.rndJobId;
  const requestedSection = searchParams.get("section");
  const requestedTab = searchParams.get("tab");

  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingDetail, setIsRefreshingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupDirty, setSetupDirty] = useState(false);
  const setupDirtyRef = useRef(false);
  const [activeSection, setActiveSection] = useState<RndJobSectionId>(
    normalizeRndJobSection(requestedSection ?? requestedTab),
  );

  const [setupForm, setSetupForm] = useState({
    packetUse: "",
    testType: "",
    testMethod: "",
    assignedToId: "",
    approverUserId: "",
    deadline: "",
    priority: "MEDIUM",
    remarks: "",
  });

  const [readingForm, setReadingForm] = useState({ parameter: "", value: "", unit: "", remarks: "" });
  const [attachmentForm, setAttachmentForm] = useState({ fileName: "", fileUrl: "", notes: "" });
  const [reviewNotes, setReviewNotes] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [approverSearch, setApproverSearch] = useState("");
  const [assigneeOptions, setAssigneeOptions] = useState<Array<{ id: string; displayName: string; email?: string | null; role: string }>>([]);
  const [approverOptions, setApproverOptions] = useState<Array<{ id: string; displayName: string; email?: string | null; role: string }>>([]);
  const [retestForm, setRetestForm] = useState({
    packetId: "",
    requestedQty: "",
    useType: "TESTING",
    reason: "",
  });

  useEffect(() => {
    setupDirtyRef.current = setupDirty;
  }, [setupDirty]);

  const fetchDetail = useCallback(async (options?: { initial?: boolean; syncSetupForm?: boolean }) => {
    if (!rndJobId) return;
    const isInitial = options?.initial ?? false;
    const syncSetupForm = options?.syncSetupForm ?? false;
    if (isInitial) {
      setLoading(true);
    } else {
      setIsRefreshingDetail(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/rnd/jobs/${rndJobId}`);
      if (!response.ok) throw new Error("R&D job could not be loaded.");
      const data = (await response.json()) as DetailPayload;
      setPayload(data);
      const job = data.job as {
        packetId?: string | null;
        packetUse?: string | null;
        testType?: string | null;
        testMethod?: string | null;
        assignedToId?: string | null;
        approverUserId?: string | null;
        deadline?: string | null;
        priority?: string | null;
        remarks?: string | null;
      };
      const nextSetupForm = {
        packetUse: job.packetUse ?? "",
        testType: job.testType ?? "",
        testMethod: job.testMethod ?? "",
        assignedToId: job.assignedToId ?? "",
        approverUserId: job.approverUserId ?? "",
        deadline: job.deadline ? String(job.deadline).slice(0, 10) : "",
        priority: job.priority ?? "MEDIUM",
        remarks: job.remarks ?? "",
      };
      if (isInitial || syncSetupForm || !setupDirtyRef.current) {
        setSetupForm(nextSetupForm);
        if (isInitial || syncSetupForm) {
          setSetupDirty(false);
        }
      }
      setAssigneeOptions(data.pickerOptions?.assignees ?? []);
      setApproverOptions(data.pickerOptions?.approvers ?? []);
      setRetestForm((previous) => ({
        ...previous,
        packetId: previous.packetId || String(job.packetId ?? ""),
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "R&D job could not be loaded.");
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsRefreshingDetail(false);
      }
    }
  }, [rndJobId]);

  useEffect(() => {
    void fetchDetail({ initial: true, syncSetupForm: true });
  }, [fetchDetail]);

  useEffect(() => {
    const nextSection = normalizeRndJobSection(requestedSection ?? requestedTab);
    setActiveSection(nextSection);

    if (!requestedSection && requestedTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (nextSection === "overview") {
        params.delete("section");
      } else {
        params.set("section", nextSection);
      }
      const query = params.toString();
      router.replace(query ? `/rnd/jobs/${rndJobId}?${query}` : `/rnd/jobs/${rndJobId}`, { scroll: false });
    }
  }, [requestedSection, requestedTab, rndJobId, router, searchParams]);

  const job = payload?.job as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!payload?.pickerOptions?.suggestedAssigneeId) return;
    if (setupForm.assignedToId) return;
    setSetupForm((previous) => ({ ...previous, assignedToId: payload.pickerOptions?.suggestedAssigneeId ?? "" }));
  }, [payload?.pickerOptions?.suggestedAssigneeId, setupForm.assignedToId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/rnd/users?roleScope=ASSIGNEE&q=${encodeURIComponent(assigneeSearch)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { options?: Array<{ id: string; displayName: string; email?: string | null; role: string }> };
        setAssigneeOptions(data.options ?? []);
      } catch {
        // keep existing options when search fails
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [assigneeSearch]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/rnd/users?roleScope=APPROVER&q=${encodeURIComponent(approverSearch)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { options?: Array<{ id: string; displayName: string; email?: string | null; role: string }> };
        setApproverOptions(data.options ?? []);
      } catch {
        // keep existing options when search fails
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [approverSearch]);

  const activeTabIndex = useMemo(() => {
    const index = RND_JOB_SECTIONS.indexOf(activeSection);
    return index >= 0 ? index : 0;
  }, [activeSection]);

  const handleSectionChange = useCallback(
    (nextSection: RndJobSectionId) => {
      if (!rndJobId) return;
      setActiveSection(nextSection);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (nextSection === "overview") {
        params.delete("section");
      } else {
        params.set("section", nextSection);
      }
      const query = params.toString();
      router.push(query ? `/rnd/jobs/${rndJobId}?${query}` : `/rnd/jobs/${rndJobId}`, { scroll: false });
    },
    [rndJobId, router, searchParams],
  );

  const handleTransition = useCallback(
    async (toStatus: string) => {
      if (!rndJobId) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/rnd/jobs/${rndJobId}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toStatus }),
        });
        if (!response.ok) {
          const p = (await response.json().catch(() => null)) as { details?: string } | null;
          throw new Error(p?.details || "Transition failed.");
        }
        await fetchDetail({ initial: false, syncSetupForm: false });
      } catch (transitionError) {
        toast({ title: "Action failed", description: transitionError instanceof Error ? transitionError.message : "Action failed.", status: "error" });
      } finally {
        setBusy(false);
      }
    },
    [fetchDetail, rndJobId, toast],
  );

  const onSaveSetup = useCallback(async () => {
    if (!rndJobId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/rnd/jobs/${rndJobId}/setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...setupForm,
          assignedToId: setupForm.assignedToId || null,
          approverUserId: setupForm.approverUserId || null,
          deadline: setupForm.deadline || null,
        }),
      });
      if (!response.ok) {
        const p = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(p?.details || "Setup update failed.");
      }
      setSetupDirty(false);
      await fetchDetail({ initial: false, syncSetupForm: true });
      toast({ title: "Setup saved", status: "success" });
    } catch (saveError) {
      toast({ title: "Save failed", description: saveError instanceof Error ? saveError.message : "Save failed.", status: "error" });
    } finally {
      setBusy(false);
    }
  }, [fetchDetail, rndJobId, setupForm, toast]);

  const onAddReading = useCallback(async () => {
    if (!rndJobId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/rnd/jobs/${rndJobId}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readingForm),
      });
      if (!response.ok) {
        const p = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(p?.details || "Add reading failed.");
      }
      setReadingForm({ parameter: "", value: "", unit: "", remarks: "" });
      await fetchDetail({ initial: false, syncSetupForm: false });
    } catch (readingError) {
      toast({ title: "Reading failed", description: readingError instanceof Error ? readingError.message : "Reading failed.", status: "error" });
    } finally {
      setBusy(false);
    }
  }, [fetchDetail, readingForm, rndJobId, toast]);

  const onAddAttachment = useCallback(async () => {
    if (!rndJobId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/rnd/jobs/${rndJobId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attachmentForm),
      });
      if (!response.ok) {
        const p = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(p?.details || "Attachment upload failed.");
      }
      setAttachmentForm({ fileName: "", fileUrl: "", notes: "" });
      await fetchDetail({ initial: false, syncSetupForm: false });
    } catch (attachmentError) {
      toast({ title: "Attachment failed", description: attachmentError instanceof Error ? attachmentError.message : "Attachment failed.", status: "error" });
    } finally {
      setBusy(false);
    }
  }, [attachmentForm, fetchDetail, rndJobId, toast]);

  const onReview = useCallback(
    async (action: "APPROVE" | "REJECT" | "REWORK") => {
      if (!rndJobId) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/rnd/jobs/${rndJobId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes: reviewNotes }),
        });
        if (!response.ok) {
          const p = (await response.json().catch(() => null)) as { details?: string } | null;
          throw new Error(p?.details || "Review action failed.");
        }
        setReviewNotes("");
        await fetchDetail({ initial: false, syncSetupForm: false });
      } catch (reviewError) {
        toast({ title: "Review failed", description: reviewError instanceof Error ? reviewError.message : "Review failed.", status: "error" });
      } finally {
        setBusy(false);
      }
    },
    [fetchDetail, reviewNotes, rndJobId, toast],
  );

  const onCreateRetest = useCallback(async () => {
    if (!rndJobId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/rnd/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceRndJobId: rndJobId,
          packetId: retestForm.packetId || String(job?.packetId ?? ""),
          requestedQty: Number(retestForm.requestedQty),
          useType: retestForm.useType,
          reason: retestForm.reason,
        }),
      });
      if (!response.ok) {
        const p = (await response.json().catch(() => null)) as { details?: string } | null;
        throw new Error(p?.details || "Retest creation failed.");
      }
      const created = (await response.json()) as { id: string };
      router.push(`/rnd/jobs/${created.id}`);
    } catch (retestError) {
      toast({ title: "Retest failed", description: retestError instanceof Error ? retestError.message : "Retest failed.", status: "error" });
    } finally {
      setBusy(false);
    }
  }, [job?.packetId, rndJobId, retestForm.packetId, retestForm.reason, retestForm.requestedQty, retestForm.useType, router, toast]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <PageSkeleton cards={3} rows={3} />
      </ControlTowerLayout>
    );
  }

  if (error || !payload || !job) {
    return (
      <ControlTowerLayout>
        <InlineErrorState title="R&D job unavailable" description={error ?? "R&D job unavailable"} onRetry={() => void fetchDetail({ initial: true, syncSetupForm: true })} />
      </ControlTowerLayout>
    );
  }

  const status = String(job.status ?? "CREATED");

  const primaryStickyAction = (() => {
    if (status === "CREATED") return <Button isLoading={busy} onClick={() => void handleTransition("READY_FOR_TEST_SETUP")}>Accept Job</Button>;
    if (status === "READY_FOR_TEST_SETUP") return <Button isLoading={busy} onClick={() => void handleTransition("READY_FOR_TESTING")}>Start Setup</Button>;
    if (status === "READY_FOR_TESTING") return <Button isLoading={busy} onClick={() => void handleTransition("IN_TESTING")}>Start Testing</Button>;
    if (status === "IN_TESTING") return <Button isLoading={busy} onClick={() => void handleTransition("AWAITING_REVIEW")}>Submit Results</Button>;
    if (status === "AWAITING_REVIEW") return <Button isLoading={busy} onClick={() => void onReview("APPROVE")}>Approve Result</Button>;
    if (status === "APPROVED") return <Button isLoading={busy} onClick={() => void handleTransition("COMPLETED")}>Finalize Output</Button>;
    return <Button variant="outline" onClick={() => router.push("/rnd/history")}>View History</Button>;
  })();

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" flexWrap="wrap">
            <Text fontWeight="semibold">Quick Summary</Text>
            <WorkflowBadge status={status} />
          </HStack>
          <SimpleInfo label="Parent Job Number" value={String((job.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-")} />
          <SimpleInfo label="Sample ID" value={String((job.sample as { sampleCode?: string } | null)?.sampleCode ?? "-")} />
          <SimpleInfo label="Packet ID" value={String((job.packet as { packetCode?: string } | null)?.packetCode ?? "-")} />
          <SimpleInfo label="Packet Weight" value={(() => {
            const packet = job.packet as { packetWeight?: number | null; packetUnit?: string | null } | null;
            return packet?.packetWeight ? `${packet.packetWeight} ${packet.packetUnit ?? ""}`.trim() : "-";
          })()} />
          <SimpleInfo label="Job Type" value={String(job.jobType ?? "-")} />
          <SimpleInfo label="Assigned User" value={String((job.assignedTo as { profile?: { displayName?: string } } | null)?.profile?.displayName ?? "Unassigned")} />
          <SimpleInfo label="Deadline" value={formatDate(String(job.deadline ?? ""))} />
          <SimpleInfo label="Remarks" value={String(job.remarks ?? "-")} />
        </VStack>
      ),
    },
    {
      id: "source",
      label: "Source Packet",
      content: (
        <VStack align="stretch" spacing={3}>
          <SimpleInfo label="Linked Parent Job" value={String((job.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-")} />
          <SimpleInfo label="Linked Sample" value={String((job.sample as { sampleCode?: string } | null)?.sampleCode ?? "-")} />
          <SimpleInfo label="Linked Packet" value={String((job.packet as { packetCode?: string } | null)?.packetCode ?? "-")} />
          <SimpleInfo label="Packet Purpose" value={String(job.packetUse ?? "-")} />
          <SimpleInfo label="Previous R&D Job" value={String((job.previousRndJob as { rndJobNumber?: string } | null)?.rndJobNumber ?? "-")} />
          <HStack spacing={2}>
            <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${String(job.parentJobId ?? "")}/workflow`)}>
              Open Parent Workflow
            </Button>
          </HStack>
        </VStack>
      ),
    },
    {
      id: "setup",
      label: "Test Setup",
      content: (
        <VStack align="stretch" spacing={3}>
          <FormControl>
            <FormLabel>Packet Use</FormLabel>
            <Select
              value={setupForm.packetUse}
              onChange={(event) => {
                setSetupDirty(true);
                setSetupForm((p) => ({ ...p, packetUse: event.target.value }));
              }}
            >
              <option value="">Select packet use</option>
              <option value="TESTING">Testing</option>
              <option value="RETAIN">Retain</option>
              <option value="BACKUP">Backup</option>
              <option value="REFERENCE">Reference</option>
              <option value="CLIENT_RETEST">Client Retest</option>
              <option value="ADDITIONAL_ANALYSIS">Additional Analysis</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Test Type</FormLabel>
            <Input
              value={setupForm.testType}
              onChange={(event) => {
                setSetupDirty(true);
                setSetupForm((p) => ({ ...p, testType: event.target.value }));
              }}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Test Method / Protocol</FormLabel>
            <Input
              value={setupForm.testMethod}
              onChange={(event) => {
                setSetupDirty(true);
                setSetupForm((p) => ({ ...p, testMethod: event.target.value }));
              }}
            />
          </FormControl>
          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <VStack align="stretch" spacing={2} flex="1">
              <FormControl>
                <FormLabel>Assigned User</FormLabel>
                <Input placeholder="Search R&D user" value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} />
              </FormControl>
              <Select
                value={setupForm.assignedToId}
                onChange={(event) => {
                  setSetupDirty(true);
                  setSetupForm((p) => ({ ...p, assignedToId: event.target.value }));
                }}
              >
                <option value="">Select assignee</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName} {option.email ? `(${option.email})` : ""}
                  </option>
                ))}
              </Select>
            </VStack>
            <VStack align="stretch" spacing={2} flex="1">
              <FormControl>
                <FormLabel>Approver</FormLabel>
                <Input placeholder="Search approver" value={approverSearch} onChange={(event) => setApproverSearch(event.target.value)} />
              </FormControl>
              <Select
                value={setupForm.approverUserId}
                onChange={(event) => {
                  setSetupDirty(true);
                  setSetupForm((p) => ({ ...p, approverUserId: event.target.value }));
                }}
              >
                <option value="">Select approver</option>
                {approverOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName} {option.email ? `(${option.email})` : ""} [{option.role}]
                  </option>
                ))}
              </Select>
            </VStack>
          </Stack>
          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl>
              <FormLabel>Deadline</FormLabel>
              <Input
                type="date"
                value={setupForm.deadline}
                onChange={(event) => {
                  setSetupDirty(true);
                  setSetupForm((p) => ({ ...p, deadline: event.target.value }));
                }}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Priority</FormLabel>
              <Select
                value={setupForm.priority}
                onChange={(event) => {
                  setSetupDirty(true);
                  setSetupForm((p) => ({ ...p, priority: event.target.value }));
                }}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </FormControl>
          </Stack>
          <FormControl>
            <FormLabel>Notes</FormLabel>
            <Input
              value={setupForm.remarks}
              onChange={(event) => {
                setSetupDirty(true);
                setSetupForm((p) => ({ ...p, remarks: event.target.value }));
              }}
            />
          </FormControl>
          <HStack>
            <Button onClick={() => void onSaveSetup()} isLoading={busy}>Save Setup</Button>
            <Button variant="outline" onClick={() => void handleTransition("READY_FOR_TESTING")} isLoading={busy}>Complete Setup</Button>
          </HStack>
        </VStack>
      ),
    },
    {
      id: "readings",
      label: "Readings / Values",
      content: (
        <VStack align="stretch" spacing={3}>
          <TableContainer borderWidth="1px" borderColor="border.default" borderRadius="lg">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Parameter</Th>
                  <Th>Observed Value</Th>
                  <Th>Unit</Th>
                  <Th>Remarks</Th>
                </Tr>
              </Thead>
              <Tbody>
                {((job.readings as Array<Record<string, unknown>> | undefined) ?? []).map((reading) => (
                  <Tr key={String(reading.id)}>
                    <Td>{String(reading.parameter ?? "-")}</Td>
                    <Td>{String(reading.value ?? "-")}</Td>
                    <Td>{String(reading.unit ?? "-")}</Td>
                    <Td>{String(reading.remarks ?? "-")}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <Input placeholder="parameter" value={readingForm.parameter} onChange={(event) => setReadingForm((p) => ({ ...p, parameter: event.target.value }))} />
            <Input placeholder="value" type="number" value={readingForm.value} onChange={(event) => setReadingForm((p) => ({ ...p, value: event.target.value }))} />
            <Input placeholder="unit" value={readingForm.unit} onChange={(event) => setReadingForm((p) => ({ ...p, unit: event.target.value }))} />
            <Input placeholder="remarks" value={readingForm.remarks} onChange={(event) => setReadingForm((p) => ({ ...p, remarks: event.target.value }))} />
          </Stack>
          <HStack>
            <Button onClick={() => void onAddReading()} isLoading={busy}>Save Draft</Button>
            <Button variant="outline" onClick={() => void handleTransition("AWAITING_REVIEW")} isLoading={busy}>Submit Results</Button>
          </HStack>
        </VStack>
      ),
    },
    {
      id: "attachments",
      label: "Attachments",
      content: (
        <VStack align="stretch" spacing={3}>
          <TableContainer borderWidth="1px" borderColor="border.default" borderRadius="lg">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>File</Th>
                  <Th>Uploaded At</Th>
                  <Th>Uploader</Th>
                </Tr>
              </Thead>
              <Tbody>
                {((job.attachments as Array<Record<string, unknown>> | undefined) ?? []).map((file) => (
                  <Tr key={String(file.id)}>
                    <Td>{String(file.fileName ?? "-")}</Td>
                    <Td>{formatDate(String(file.createdAt ?? ""))}</Td>
                    <Td>{String(((file.uploadedBy as { profile?: { displayName?: string } } | null)?.profile?.displayName) ?? "-")}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <Input placeholder="file name" value={attachmentForm.fileName} onChange={(event) => setAttachmentForm((p) => ({ ...p, fileName: event.target.value }))} />
            <Input placeholder="file url" value={attachmentForm.fileUrl} onChange={(event) => setAttachmentForm((p) => ({ ...p, fileUrl: event.target.value }))} />
            <Input placeholder="notes" value={attachmentForm.notes} onChange={(event) => setAttachmentForm((p) => ({ ...p, notes: event.target.value }))} />
          </Stack>
          <Button onClick={() => void onAddAttachment()} isLoading={busy}>Upload Attachment</Button>
        </VStack>
      ),
    },
    {
      id: "review",
      label: "Review",
      content: (
        <VStack align="stretch" spacing={3}>
          <SimpleInfo label="Result Entered By" value={String((job.assignedTo as { profile?: { displayName?: string } } | null)?.profile?.displayName ?? "-")} />
          <SimpleInfo label="Submitted At" value={formatDate(String(job.resultsSubmittedAt ?? ""))} />
          <SimpleInfo label="Approval Status" value={status} />
          <Input placeholder="Review notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
          <HStack>
            <Button onClick={() => void onReview("APPROVE")} isLoading={busy}>Approve</Button>
            <Button colorScheme="red" variant="outline" onClick={() => void onReview("REJECT")} isLoading={busy}>Reject</Button>
            <Button colorScheme="orange" variant="outline" onClick={() => void onReview("REWORK")} isLoading={busy}>Send for Rework</Button>
          </HStack>
        </VStack>
      ),
    },
    {
      id: "report",
      label: "Report Linkage",
      content: (
        <VStack align="stretch" spacing={3}>
          <SimpleInfo label="Report Status" value={payload.reportLinkage?.activeReport ? "Active Report Available" : "Pending"} />
          <SimpleInfo label="COA Status" value={payload.reportLinkage?.defaultCoaUrl ? "Ready" : "Pending"} />
          <SimpleInfo
            label="Active Result"
            value={payload.reportLinkage?.activeResult?.rndJobNumber ?? (status === "APPROVED" || status === "COMPLETED" ? String(job.rndJobNumber ?? "-") : "-")}
          />
          <SimpleInfo
            label="Previous Results"
            value={String(payload.reportLinkage?.supersededResults?.length ?? 0)}
          />
          <SimpleInfo
            label="Active Report"
            value={payload.reportLinkage?.activeReport?.reportSnapshotId ? `Snapshot ${payload.reportLinkage.activeReport.reportSnapshotId.slice(0, 8)}` : "-"}
          />
          <SimpleInfo
            label="Previous Reports"
            value={String(payload.reportLinkage?.previousReports?.length ?? 0)}
          />
          <SimpleInfo label="Default COA" value={payload.reportLinkage?.defaultCoaUrl ? "Active Report" : "-"} />
          <HStack>
            <Button
              as="a"
              href={payload.reportLinkage?.defaultReportUrl ?? "/reports"}
              target={payload.reportLinkage?.defaultReportUrl ? "_blank" : undefined}
              variant="outline"
              isDisabled={!payload.reportLinkage?.defaultReportUrl}
            >
              View PDF
            </Button>
            <Button
              as="a"
              href={payload.reportLinkage?.defaultReportUrl ?? "/reports"}
              target={payload.reportLinkage?.defaultReportUrl ? "_blank" : undefined}
              variant="outline"
              isDisabled={!payload.reportLinkage?.defaultReportUrl}
            >
              Download Report PDF
            </Button>
            <Button
              as="a"
              href={payload.reportLinkage?.defaultCoaUrl ?? "/documents"}
              target={payload.reportLinkage?.defaultCoaUrl ? "_blank" : undefined}
              variant="outline"
              isDisabled={!payload.reportLinkage?.defaultCoaUrl}
            >
              View COA
            </Button>
            <Button
              as="a"
              href={payload.reportLinkage?.defaultCoaUrl ?? "/documents"}
              target={payload.reportLinkage?.defaultCoaUrl ? "_blank" : undefined}
              variant="outline"
              isDisabled={!payload.reportLinkage?.defaultCoaUrl}
            >
              Download COA PDF
            </Button>
          </HStack>
        </VStack>
      ),
    },
    {
      id: "history",
      label: "History",
      content: (
        <VStack align="stretch" spacing={3}>
          <SimpleInfo label="Received from Operations" value={formatDate(String(job.receivedAt ?? ""))} />
          <SimpleInfo label="Testing Started" value={formatDate(String(job.testingStartedAt ?? ""))} />
          <SimpleInfo label="Results Submitted" value={formatDate(String(job.resultsSubmittedAt ?? ""))} />
          <SimpleInfo label="Reviewed" value={formatDate(String(job.reviewedAt ?? ""))} />
          <SimpleInfo label="Completed" value={formatDate(String(job.completedAt ?? ""))} />
          <SimpleInfo label="Linked Previous R&D Job" value={String((job.previousRndJob as { rndJobNumber?: string } | null)?.rndJobNumber ?? "-")} />
          <SimpleInfo label="Linked Retests" value={String(((job.nextRetestJobs as Array<unknown> | undefined)?.length ?? 0))} />
          <SimpleInfo label="Ledger Available Qty" value={String(payload.ledger?.balance?.available ?? 0)} />
          <SimpleInfo label="Ledger Reserved Qty" value={String(payload.ledger?.balance?.reserved ?? 0)} />
          <FormControl>
            <FormLabel>Retest Packet</FormLabel>
            <Input value={retestForm.packetId} onChange={(event) => setRetestForm((previous) => ({ ...previous, packetId: event.target.value }))} placeholder="Packet ID" />
          </FormControl>
          <Stack direction={{ base: "column", md: "row" }} spacing={3}>
            <FormControl>
              <FormLabel>Requested Qty</FormLabel>
              <Input
                type="number"
                value={retestForm.requestedQty}
                onChange={(event) => setRetestForm((previous) => ({ ...previous, requestedQty: event.target.value }))}
                placeholder="0"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Use Type</FormLabel>
              <Select value={retestForm.useType} onChange={(event) => setRetestForm((previous) => ({ ...previous, useType: event.target.value }))}>
                <option value="TESTING">Testing</option>
                <option value="RETAIN">Retain</option>
                <option value="BACKUP">Backup</option>
                <option value="REFERENCE">Reference</option>
                <option value="CLIENT_RETEST">Client Retest</option>
                <option value="ADDITIONAL_ANALYSIS">Additional Analysis</option>
              </Select>
            </FormControl>
          </Stack>
          <FormControl>
            <FormLabel>Retest Reason</FormLabel>
            <Input
              value={retestForm.reason}
              onChange={(event) => setRetestForm((previous) => ({ ...previous, reason: event.target.value }))}
              placeholder="Reason for retest"
            />
          </FormControl>
          <Button
            variant="outline"
            onClick={() => void onCreateRetest()}
            isLoading={busy}
            isDisabled={
              !["APPROVED", "COMPLETED"].includes(status) ||
              !retestForm.packetId ||
              !retestForm.requestedQty ||
              Number(retestForm.requestedQty) <= 0 ||
              !retestForm.reason.trim()
            }
          >
            Create Retest Job
          </Button>
        </VStack>
      ),
    },
  ];

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={4}>
        <PageIdentityBar
          title={String(job.rndJobNumber ?? "R&D Job")}
          subtitle="One testing cycle with clear current step, next action, and lineage."
          breadcrumbs={[
            { label: "R&D", href: "/rnd" },
            { label: String(job.rndJobNumber ?? "R&D Job") },
          ]}
          status={
            <HStack spacing={2}>
              <WorkflowBadge status={status} />
              <WorkflowStateChip status={payload.currentStep} />
            </HStack>
          }
        />

        <Box position="sticky" top={{ base: "76px", md: "84px" }} zIndex={2}>
          <PageActionBar
            primaryAction={primaryStickyAction}
            secondaryActions={
              <HStack spacing={4} flexWrap="wrap">
                <Text fontSize="sm" color="text.secondary">Current Step: {payload.currentStep}</Text>
                <Text fontSize="sm" color="text.secondary">Next Action: {payload.nextAction || nextActionForStatus(status as never)}</Text>
                {isRefreshingDetail ? (
                  <HStack spacing={1}>
                    <Spinner size="xs" color="text.secondary" />
                    <Text fontSize="sm" color="text.secondary">Updating...</Text>
                  </HStack>
                ) : null}
                {payload.blockers.length > 0 ? (
                  <Text fontSize="sm" color="red.600">{payload.blockers.join(" | ")}</Text>
                ) : null}
              </HStack>
            }
          />
        </Box>

        <DetailTabsLayout
          tabs={tabs}
          activeTabIndex={activeTabIndex}
          onTabChange={(index) => {
            const next = RND_JOB_SECTIONS[index];
            if (next) {
              handleSectionChange(next);
            }
          }}
          rightRail={
            <VStack align="stretch" spacing={3}>
              <LinkedRecordsPanel
                items={[
                  { label: "Parent Job", value: String((job.parentJob as { inspectionSerialNumber?: string } | null)?.inspectionSerialNumber ?? "-"), href: `/jobs/${String(job.parentJobId ?? "")}/workflow` },
                  { label: "Sample", value: String((job.sample as { sampleCode?: string } | null)?.sampleCode ?? "-") },
                  { label: "Packet", value: String((job.packet as { packetCode?: string } | null)?.packetCode ?? "-") },
                ]}
              />
              <SimpleInfo label="Assigned To" value={String((job.assignedTo as { profile?: { displayName?: string } } | null)?.profile?.displayName ?? "Unassigned")} />
              <SimpleInfo label="Due Date" value={formatDate(String(job.deadline ?? ""))} />
              <SimpleInfo label="Priority" value={String(job.priority ?? "MEDIUM")} />
              <SimpleInfo label="Current Status" value={status} />
              <SimpleInfo label="Next Action" value={payload.nextAction} />
            </VStack>
          }
        />
      </VStack>
    </ControlTowerLayout>
  );
}

function SimpleInfo({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between" borderWidth="1px" borderColor="border.default" borderRadius="md" px={3} py={2}>
      <Text fontSize="sm" color="text.secondary">{label}</Text>
      <Text fontSize="sm" fontWeight="medium">{value || "-"}</Text>
    </HStack>
  );
}

function WorkflowBadge({ status }: { status: string }) {
  return <WorkflowStateChip status={status} />;
}
