export async function createJobViaApi(ctx, overrides = {}) {
  const suffix = Date.now().toString();
  const payload = {
    sourceName: `Regression Source ${suffix}`,
    materialCategory: `Regression Material ${suffix}`,
    materialType: "INHOUSE",
    sourceLocation: `WH-${suffix.slice(-4)}`,
    ...overrides,
  };

  const response = await ctx.apiRequest("/api/jobs", { method: "POST", body: payload });
  if (!response.ok || !response.json?.id) {
    throw new Error(response.json?.details || response.text || "Failed to create job via API.");
  }
  return response.json;
}

export async function createLotViaApi(ctx, jobId, overrides = {}) {
  const suffix = Date.now().toString().slice(-6);
  const payload = {
    jobId,
    lotNumber: `LOT-${suffix}`,
    materialName: `Lot Material ${suffix}`,
    materialCategory: "Regression",
    quantityMode: "SINGLE_PIECE",
    totalBags: 1,
    bagCount: 1,
    grossWeight: 10,
    tareWeight: 1,
    netWeight: 9,
    weightUnit: "KG",
    ...overrides,
  };

  const response = await ctx.apiRequest("/api/inspection/lots", { method: "POST", body: payload });
  if (!response.ok || !response.json?.id) {
    throw new Error(response.json?.details || response.text || "Failed to create lot via API.");
  }
  return response.json;
}

export async function getWorkflow(ctx, jobId, lotId) {
  const query = lotId ? `?lotId=${encodeURIComponent(lotId)}` : "";
  const response = await ctx.apiRequest(`/api/jobs/${jobId}/workflow${query}`);
  if (!response.ok || !response.json?.job) {
    throw new Error(response.json?.details || response.text || "Failed to load workflow payload.");
  }
  return response.json;
}

export async function uploadInspectionProof(ctx, { lotId, inspectionId, category }) {
  const tinyPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8m0AAAAASUVORK5CYII=";

  const response = await ctx.apiRequest("/api/media/upload", {
    method: "POST",
    body: {
      lotId,
      inspectionId,
      category,
      base64: tinyPngBase64,
      fileName: `${category.toLowerCase()}.png`,
      mimeType: "image/png",
    },
  });

  if (!response.ok) {
    throw new Error(response.json?.details || response.text || `Failed upload for category ${category}.`);
  }

  return response.json;
}

export async function ensureInspectionDecisionReadyForSampling(ctx, { lotId, requiredImageLabels }) {
  const inspectionInit = await ctx.apiRequest("/api/inspection/execution", {
    method: "POST",
    body: { lotId },
  });
  if (!inspectionInit.ok || !inspectionInit.json?.inspection?.id) {
    throw new Error(inspectionInit.json?.details || inspectionInit.text || "Inspection init failed.");
  }

  const inspectionId = inspectionInit.json.inspection.id;
  const uploadCategories = Array.from(
    new Set((requiredImageLabels || []).map((label) => ctx.toCategoryKey(label)).filter(Boolean)),
  );

  for (const category of uploadCategories) {
    await uploadInspectionProof(ctx, { lotId, inspectionId, category });
  }

  const passResponse = await ctx.apiRequest("/api/inspection/execution", {
    method: "PATCH",
    body: {
      lotId,
      decisionStatus: "READY_FOR_SAMPLING",
      overallRemark: "Approved for sampling by regression harness.",
      responses: [],
      issues: [],
    },
  });

  if (!passResponse.ok) {
    throw new Error(passResponse.json?.details || passResponse.text || "Decision pass failed.");
  }

  return passResponse.json;
}

export async function initializeInspectionWithRequiredProof(ctx, { lotId, requiredImageLabels }) {
  const inspectionInit = await ctx.apiRequest("/api/inspection/execution", {
    method: "POST",
    body: { lotId },
  });
  if (!inspectionInit.ok || !inspectionInit.json?.inspection?.id) {
    throw new Error(inspectionInit.json?.details || inspectionInit.text || "Inspection init failed.");
  }

  const inspectionId = inspectionInit.json.inspection.id;
  const uploadCategories = Array.from(
    new Set((requiredImageLabels || []).map((label) => ctx.toCategoryKey(label)).filter(Boolean)),
  );

  for (const category of uploadCategories) {
    await uploadInspectionProof(ctx, { lotId, inspectionId, category });
  }

  return { inspectionId };
}

export async function prepareSampleAndPacketFixture(ctx) {
  const job = await createJobViaApi(ctx);
  const lot = await createLotViaApi(ctx, job.id);
  const workflowBefore = await getWorkflow(ctx, job.id, lot.id);

  await ensureInspectionDecisionReadyForSampling(ctx, {
    lotId: lot.id,
    requiredImageLabels: workflowBefore.settings?.images?.requiredImageCategories ?? [],
  });

  const startSampling = await ctx.apiRequest("/api/inspection/sample-management", {
    method: "POST",
    body: { lotId: lot.id },
  });
  if (!startSampling.ok) {
    throw new Error(startSampling.json?.details || startSampling.text || "Start sampling failed.");
  }

  const samplingPatch = await ctx.apiRequest("/api/inspection/sample-management", {
    method: "PATCH",
    body: {
      lotId: lot.id,
      sampleType: "Composite",
      samplingMethod: "Manual",
      sampleQuantity: 5,
      sampleUnit: "KG",
      containerType: "Bag",
      remarks: "Regression sampling setup",
      sealNo: "1234567890123456",
      labelText: "Regression Label",
      markSealed: true,
      markLabeled: true,
      markHomogenized: true,
    },
  });

  if (!samplingPatch.ok) {
    throw new Error(samplingPatch.json?.details || samplingPatch.text || "Sample readiness patch failed.");
  }

  const workflowAfter = await getWorkflow(ctx, job.id, lot.id);
  const sampleId = workflowAfter.sample?.id || workflowAfter.job?.lots?.find((entry) => entry.id === lot.id)?.sample?.id;
  if (!sampleId) {
    throw new Error("Sample ID missing after readiness setup.");
  }

  const packetCreate = await ctx.apiRequest("/api/rd/packet", {
    method: "POST",
    body: {
      sampleId,
      count: 1,
      packets: [
        {
          packetNo: 1,
          packetWeight: 1,
          packetUnit: "KG",
          packetType: "TESTING",
          notes: "Regression packet",
        },
      ],
    },
  });

  if (!packetCreate.ok) {
    throw new Error(packetCreate.json?.details || packetCreate.text || "Packet creation failed.");
  }

  return { jobId: job.id, lotId: lot.id, sampleId };
}

export async function prepareDecisionFixture(ctx) {
  const job = await createJobViaApi(ctx);
  const lot = await createLotViaApi(ctx, job.id);
  const workflow = await getWorkflow(ctx, job.id, lot.id);
  await initializeInspectionWithRequiredProof(ctx, {
    lotId: lot.id,
    requiredImageLabels: workflow.settings?.images?.requiredImageCategories ?? [],
  });
  return { jobId: job.id, lotId: lot.id };
}

export async function listJobs(ctx, view = "all") {
  const response = await ctx.apiRequest(`/api/jobs?view=${view}`);
  if (!response.ok || !Array.isArray(response.json)) {
    throw new Error(response.json?.details || response.text || "Unable to list jobs.");
  }
  return response.json;
}

export async function findJobWithLots(ctx) {
  const jobs = await listJobs(ctx, "all");
  for (const job of jobs.slice(0, 20)) {
    const workflow = await getWorkflow(ctx, job.id).catch(() => null);
    if (!workflow?.job?.lots?.length) continue;
    return { job, workflow };
  }
  return null;
}
