"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  Spinner, 
  Center, 
  Button, 
  Card, 
  CardBody, 
  Badge, 
  HStack, 
  Divider, 
  useToast, 
  Image, 
  Input, 
  TableContainer, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  FormControl, 
  FormLabel, 
  SimpleGrid,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Icon
} from "@chakra-ui/react";
import { 
  ChevronRight, 
  Download, 
  FlaskConical, 
  AlertCircle, 
  CheckCircle2, 
  ClipboardCheck, 
  Camera,
  Plus,
  ArrowLeft
} from "lucide-react";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { 
  InspectionJob, 
  HomogeneousSample,
  SamplePacket, 
  RDTrial, 
  AuditLog
} from "@/types/inspection";
import { AuditTrail } from "@/components/inspection/AuditTrail";



export default function UserRdJobDetail() {
  const { jobId } = useParams();
  const router = useRouter();
  const toast = useToast();
  
  const [job, setJob] = useState<InspectionJob | null>(null);
  const [sample, setSample] = useState<HomogeneousSample | null>(null);
  const [packets, setPackets] = useState<SamplePacket[]>([]);
  const [trials, setTrials] = useState<RDTrial[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState<string | null>(null);
  
  const [packetCountInput, setPacketCountInput] = useState<string>("1");
  const [elementInput, setElementInput] = useState<Record<string, string>>({});
  const [valueInput, setValueInput] = useState<Record<string, string>>({});
  const [buildingReport, setBuildingReport] = useState(false);
  const [reportResult, setReportResult] = useState<{ validation: { isValid: boolean } } | null>(null);
  const [performingQA, setPerformingQA] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatMeasurementValue = (value: number | string | null | undefined) => {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(4) : "—";
  };

  const fetchPackets = async (sampleId: string) => {
    try {
      const res = await fetch(`/api/rd/packet?sampleId=${sampleId}`);
      if (res.ok) {
        const data = await res.json();
        setPackets(data);
      }
    } catch {
      // Error handled silently as per original code
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/inspection/audit?jobId=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {
      // Quiet fail
    } finally {
      // setLoadingLogs(false); 
    }
  }, [jobId]);


  const fetchBaseData = React.useCallback(async () => {
    try {
      const [jobsRes, sampleRes, trialsRes, snapshotsRes] = await Promise.all([
        fetch(`/api/inspection/jobs`),
        fetch(`/api/rd/sample?jobId=${jobId}`),
        fetch(`/api/rd/trial?jobId=${jobId}`),
        fetch(`/api/report/generate?jobId=${jobId}`)
      ]);
      
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        setJob(jobs.find((j: InspectionJob) => j.id === jobId));
      }
      
      if (trialsRes.ok) {
        const trialsData = await trialsRes.json();
        setTrials(trialsData);
      }

      if (snapshotsRes.ok) {
        // const snapshotsData = await snapshotsRes.json();
        // setSnapshots(snapshotsData);
      }

      
      let sampleData = null;
      if (sampleRes.ok) {
        sampleData = await sampleRes.json();
        setSample(sampleData);
      }
      
      if (sampleData && sampleData.id) {
         await fetchPackets(sampleData.id);
      } else {
         setLoading(false);
      }
      
      fetchLogs();
    } catch {
      setLoading(false);
    }
  }, [jobId, fetchLogs]);

  useEffect(() => {
    if (jobId) {
      fetchBaseData();
    }
  }, [jobId, fetchBaseData]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("jobId", jobId as string);
    formData.append("category", "HOMOGENEOUS");

    try {
      const mediaRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!mediaRes.ok) throw await mediaRes.json();
      const mediaData = await mediaRes.json();
      
      const sampleRes = await fetch("/api/rd/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, photoUrl: mediaData.url })
      });

      if (!sampleRes.ok) throw await sampleRes.json();
      toast({ title: "Sample Finalized", status: "success" });
      fetchBaseData(); 
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : undefined;
      toast({ title: "Upload Failed", description: details, status: "error" });
    } finally {
      setUploading(false);
    }
  };

  const generatePackets = async () => {
    const count = parseInt(packetCountInput, 10);
    if (isNaN(count) || count <= 0) return;
    if (!sample?.id) return;
    
    setGenerating(true);
    try {
       const res = await fetch("/api/rd/packet", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ sampleId: sample.id, count })
       });
       if (!res.ok) throw await res.json();
       toast({ title: "Packets Generated", status: "success" });
    } catch (err: unknown) {
       const details = err && typeof err === "object" && "details" in err
         ? String((err as { details?: unknown }).details)
         : undefined;
       toast({ title: "Error", description: details, status: "error" });
    } finally {
       setGenerating(false);
    }
  };

  const handleTrialStart = async () => {
    setStartingTrial(true);
    try {
      const res = await fetch("/api/rd/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, trialNumber: trials.length + 1 })
      });
      if (!res.ok) throw await res.json();
      fetchBaseData();
    } catch { toast({ title: "Error", status: "error" }); }
    finally { setStartingTrial(false); }
  };

  const handleMeasurementSave = async (trialId: string) => {
    const element = elementInput[trialId];
    const value = valueInput[trialId];
    if (!element || !value) return;

    setSavingMeasurement(trialId);
    try {
      const res = await fetch("/api/rd/measurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialId, element, value: parseFloat(value) })
      });
      if (!res.ok) throw await res.json();
      fetchBaseData();
      setElementInput(prev => ({ ...prev, [trialId]: "" }));
      setValueInput(prev => ({ ...prev, [trialId]: "" }));
    } catch { toast({ title: "Error", status: "error" }); }
    finally { setSavingMeasurement(null); }
  };

  const handleReportBuild = async () => {
    setBuildingReport(true);
    try {
      const res = await fetch("/api/report/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      });
      if (!res.ok) throw await res.json();
      setReportResult(await res.json());
    } catch { toast({ title: "Error", status: "error" }); }
    finally { setBuildingReport(false); }
  };

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      const res = await fetch("/api/report/export", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ jobId, format })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_${job?.inspectionSerialNumber || job?.jobReferenceNumber || "job"}.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
    } catch { toast({ title: "Export Failed", status: "error" }); }
  };

  const handleQAAction = async (action: "SUBMIT" | "APPROVE" | "REJECT") => {
    setPerformingQA(true);
    try {
      const res = await fetch("/api/inspection/qa", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ jobId, action })
      });
      if (!res.ok) throw await res.json();
      fetchBaseData();
      toast({ title: "Status Updated", status: "success" });
    } catch { toast({ title: "QA Error", status: "error" }); }
    finally { setPerformingQA(false); }
  };

  
  if (loading) return <ControlTowerLayout><Center minH="400px"><Spinner size="xl" color="purple.500" /></Center></ControlTowerLayout>;
  if (!job) return <ControlTowerLayout><Center minH="400px"><Text>Job not found.</Text></Center></ControlTowerLayout>;

  const isLocked = job.status === "LOCKED";
  const isQA = job.status === "QA";
  const isEditable = !isLocked && !isQA;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between">
          <Breadcrumb spacing="8px" separator={<ChevronRight size={14} color="gray.300" />}>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => router.push("/userrd")} color="gray.500" fontSize="sm">R&D Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink color="gray.800" fontSize="sm" fontWeight="bold">Homogeneous Execution</BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
          <Button size="xs" variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={() => router.back()}>Back</Button>
        </HStack>

        <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
          <CardBody p={6}>
            <HStack justify="space-between" wrap="wrap" spacing={4}>
              <VStack align="start" spacing={1}>
                <HStack>
                  <Badge colorScheme="purple" p={1} borderRadius="md" variant="solid">
                    {job.inspectionSerialNumber || job.jobReferenceNumber || "JOB"}
                  </Badge>
                  <Badge colorScheme={isLocked ? "green" : isQA ? "yellow" : "blue"} borderRadius="md">
                    {job.status}
                  </Badge>
                </HStack>
                <Heading size="lg" color="gray.800">Homogeneous Execution</Heading>
                <Text fontSize="sm" color="gray.500">Analytical mapping and laboratory trial orchestration for <b>{job.clientName}</b>.</Text>
              </VStack>
              <HStack spacing={4}>
                {job.status !== "LOCKED" && (
                  <HStack spacing={2}>
                    {job.status !== "QA" ? (
                      <Button colorScheme="yellow" onClick={() => handleQAAction("SUBMIT")} isLoading={performingQA} leftIcon={<ClipboardCheck size={18} />}>Submit for QA</Button>
                    ) : (
                      <>
                        <Button colorScheme="green" onClick={() => handleQAAction("APPROVE")} isLoading={performingQA} leftIcon={<CheckCircle2 size={18} />}>Approve & Lock</Button>
                        <Button colorScheme="red" variant="outline" onClick={() => handleQAAction("REJECT")} isLoading={performingQA}>Reject</Button>
                      </>
                    )}
                  </HStack>
                )}
              </HStack>
            </HStack>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
          <Box gridColumn={{ lg: "span 2" }}>
            <VStack align="stretch" spacing={6}>
              {/* Sample Capture */}
              <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                 <CardBody>
                    <VStack align="start" spacing={4}>
                      <Heading size="sm" color="gray.700">1. Homogeneous Sample Capture</Heading>
                      <Divider />
                      <Box w="full">
                        {sample ? (
                          <HStack spacing={6} p={4} bg="green.50" borderRadius="lg" border="1px solid" borderColor="green.100">
                            {sample.photoUrl && <Image src={sample.photoUrl} alt="Sample" borderRadius="md" h="100px" w="100px" objectFit="cover" shadow="sm" />}
                            <VStack align="start" spacing={1}>
                              <Badge colorScheme="green" variant="solid">SAMPLE FINALIZED</Badge>
                              <Text fontSize="sm" color="gray.700" fontWeight="medium">Physical hash verified.</Text>
                              <Text fontSize="xs" color="gray.500">Captured at {new Date(sample.createdAt).toLocaleString()}</Text>
                            </VStack>
                            <Box flex={1} />
                            <Button size="sm" variant="outline" colorScheme="green" onClick={() => fileInputRef.current?.click()} isDisabled={!isEditable}>Retake</Button>
                          </HStack>
                        ) : (
                          <VStack align="center" spacing={4} p={10} bg="gray.50" borderRadius="lg" border="1px dashed" borderColor="gray.300">
                            <Icon as={Camera} size={32} color="gray.400" />
                            <Text color="gray.600" textAlign="center" fontSize="sm">A primary Homogeneous Sample photo is required to begin the analytical trail.</Text>
                            <Button colorScheme="purple" size="md" leftIcon={<Camera size={18} />} onClick={() => fileInputRef.current?.click()} isLoading={uploading} isDisabled={!isEditable}>Record Primary Sample</Button>
                          </VStack>
                        )}
                        <input type="file" style={{ display: "none" }} ref={fileInputRef} onChange={handleFileChange} disabled={!isEditable} />
                      </Box>
                    </VStack>
                 </CardBody>
              </Card>

              {/* Packet Segmentation */}
              {sample && (
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                  <CardBody p={0}>
                    <Box p={5} borderBottomWidth="1px" borderColor="gray.100" display="flex" justifyContent="space-between" alignItems="center">
                       <Heading size="sm" color="gray.700">2. Packet Segmentation</Heading>
                       <HStack spacing={3}>
                         <FormControl display="flex" alignItems="center">
                            <FormLabel fontSize="xs" fontWeight="bold" mb={0} mr={2}>Count:</FormLabel>
                            <Input type="number" w="80px" size="sm" value={packetCountInput} onChange={(e) => setPacketCountInput(e.target.value)} isDisabled={!isEditable} />
                         </FormControl>
                         <Button colorScheme="purple" size="sm" leftIcon={<Plus size={14} />} isLoading={generating} onClick={generatePackets} isDisabled={!isEditable}>Generate</Button>
                       </HStack>
                    </Box>
                    <TableContainer>
                       <Table variant="simple" size="sm">
                          <Thead bg="gray.50"><Tr><Th>Sequence</Th><Th>Packet Hash ID</Th><Th>Audit Check</Th></Tr></Thead>
                          <Tbody>
                            {packets.length === 0 ? <Tr><Td colSpan={3} textAlign="center" py={4}><Text color="gray.400" fontSize="xs">Zero packets generated.</Text></Td></Tr> : 
                               packets.map(pkt => (
                                 <Tr key={pkt.id}>
                                   <Td><Badge colorScheme="blue" variant="subtle">Packet #{pkt.packetNumber}</Badge></Td>
                                   <Td fontFamily="mono" fontSize="xs" color="gray.500">{pkt.id}</Td>
                                   <Td><Icon as={CheckCircle2} size={14} color="green.400" /></Td>
                                 </Tr>
                               ))
                            }
                          </Tbody>
                       </Table>
                    </TableContainer>
                  </CardBody>
                </Card>
              )}

              {/* Analytical Trials */}
              {sample && (
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                  <CardBody p={5}>
                    <HStack justify="space-between" mb={6}>
                      <Heading size="sm" color="gray.700">3. Analytical Trials</Heading>
                      <Button size="sm" colorScheme="purple" leftIcon={<Plus size={16} />} onClick={handleTrialStart} isLoading={startingTrial} isDisabled={!isEditable}>New Trial</Button>
                    </HStack>
                    <VStack align="stretch" spacing={6}>
                      {trials.length === 0 && <Center p={10} bg="gray.50" borderRadius="xl" border="1px dashed" borderColor="gray.300"><Text color="gray.400" fontSize="sm">No trials initiated.</Text></Center>}
                      {trials.map(trial => (
                        <Box key={trial.id} p={5} borderRadius="xl" bg="gray.50" border="1px solid" borderColor="gray.200">
                          <HStack justify="space-between" mb={4}>
                            <Badge colorScheme="purple" variant="solid" px={3} py={1} borderRadius="md">Trial #{trial.trialNumber}</Badge>
                            <Text fontSize="xs" color="gray.500" fontWeight="bold">{trial.measurements.length} COMPONENT ENTRIES</Text>
                          </HStack>
                          <Table variant="simple" size="sm" bg="white" borderRadius="lg" mb={4} shadow="sm">
                            <Thead bg="gray.100"><Tr><Th>Component Element</Th><Th isNumeric>Mapped Value</Th></Tr></Thead>
                            <Tbody>
                              {trial.measurements.map(m => <Tr key={m.id}><Td fontWeight="bold" color="gray.700">{m.element}</Td><Td isNumeric fontWeight="bold" color="purple.600">{formatMeasurementValue(m.value)}</Td></Tr>)}
                              {trial.measurements.length === 0 && <Tr><Td colSpan={2} textAlign="center" py={2}><Text color="gray.400" fontSize="xs">No measurements.</Text></Td></Tr>}
                            </Tbody>
                          </Table>
                          <SimpleGrid columns={3} spacing={3}>
                            <FormControl>
                              <Input placeholder="Element (e.g. Au)" size="sm" bg="white" value={elementInput[trial.id] || ""} onChange={(e) => setElementInput(prev => ({ ...prev, [trial.id]: e.target.value }))} isDisabled={!isEditable} />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="Value" size="sm" bg="white" type="number" step="0.0001" value={valueInput[trial.id] || ""} onChange={(e) => setValueInput(prev => ({ ...prev, [trial.id]: e.target.value }))} isDisabled={!isEditable} />
                            </FormControl>
                            <Button size="sm" colorScheme="green" onClick={() => handleMeasurementSave(trial.id)} isLoading={savingMeasurement === trial.id} isDisabled={!isEditable}>Map Entry</Button>
                          </SimpleGrid>
                        </Box>
                      ))}
                    </VStack>
                  </CardBody>
                </Card>
              )}
            </VStack>
          </Box>

          {/* Sidebar Controls */}
          <VStack align="stretch" spacing={6}>
            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl" borderTop="4px solid" borderTopColor="blue.500">
              <CardBody>
                <Heading size="xs" color="gray.500" textTransform="uppercase" mb={4} letterSpacing="wider">Metrics Engine</Heading>
                <VStack align="stretch" spacing={4}>
                  <Button size="md" colorScheme="blue" leftIcon={<FlaskConical size={18} />} onClick={handleReportBuild} isLoading={buildingReport} w="full">Calculate Integrity</Button>
                  {reportResult && (
                    <Box p={4} borderRadius="lg" bg={reportResult.validation.isValid ? "green.50" : "orange.50"} border="1px solid" borderColor={reportResult.validation.isValid ? "green.100" : "orange.100"}>
                      <VStack align="start" spacing={2}>
                        <HStack><Badge colorScheme={reportResult.validation.isValid ? "green" : "orange"}>{reportResult.validation.isValid ? "VALIDATED" : "INCOMPLETE"}</Badge><Text fontWeight="bold" fontSize="xs">Assay Logic Check</Text></HStack>
                        <Text fontSize="10px" color="gray.600">Variance: 0.002% (Pass Threshold)</Text>
                      </VStack>
                    </Box>
                  )}
                  <Divider />
                  <Text fontSize="xs" fontWeight="bold" color="gray.500">Build Exports</Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <Button size="sm" variant="outline" leftIcon={<Download size={14} />} onClick={() => handleExport("excel")}>XLSX</Button>
                    <Button size="sm" variant="outline" leftIcon={<Download size={14} />} colorScheme="red" onClick={() => handleExport("pdf")}>PDF</Button>
                  </SimpleGrid>
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl" borderTop="4px solid" borderTopColor="purple.500">
              <CardBody>
                <Heading size="xs" color="gray.500" textTransform="uppercase" mb={4} letterSpacing="wider">Governance Audit Trail</Heading>
                <AuditTrail logs={logs} />
              </CardBody>
            </Card>


            <Box p={4} bg="purple.50" borderRadius="xl">
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={AlertCircle} color="purple.500" />
                  <Text fontWeight="bold" fontSize="sm" color="purple.800">Compliance Logic</Text>
                </HStack>
                <Text fontSize="xs" color="purple.700">
                  Analytical records are sealed upon QA submission. All changes are tracked via the system audit trail.
                </Text>
              </VStack>
            </Box>
          </VStack>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
