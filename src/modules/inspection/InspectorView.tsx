"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  Button,
  Input,
  HStack,
  Card,
  CardHeader,
  CardBody,
  Badge,
  FormControl,
  FormLabel,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Collapse,
  Container
} from "@chakra-ui/react";
import { InspectionJob, InspectionLot, Sampling } from "@/types/inspection";


const WORKFLOW_STAGES = [
  "CREATED",
  "LOTS_READY",
  "SAMPLING",
  "LAB",
  "QA",
  "LOCKED",
  "DISPATCHED",
];

const STAGE_COLORS: Record<string, string> = {
  CREATED: "gray",
  LOTS_READY: "cyan",
  SAMPLING: "orange",
  LAB: "purple",
  QA: "blue",
  LOCKED: "red",
  DISPATCHED: "green",
};

function WorkflowStrip({ jobs }: { jobs: Job[] }) {
  const counts = WORKFLOW_STAGES.map((stage) => ({
    stage,
    count: jobs.filter((j) => j.status === stage).length,
  }));

  return (
    <Card variant="outline" shadow="sm" borderRadius="xl">
      <CardBody>
        <Text fontWeight="bold" fontSize="lg" color="gray.800" mb={4}>
          Workflow Engine
        </Text>

        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 7 }} spacing={4}>
          {counts.map((item) => (
            <Box
              key={item.stage}
              p={4}
              borderWidth="1px"
              borderRadius="xl"
              textAlign="center"
              bg={item.count ? `${STAGE_COLORS[item.stage] || 'gray'}.50` : "white"}
              borderColor={item.count ? `${STAGE_COLORS[item.stage] || 'gray'}.200` : "gray.100"}
              transition="all 0.2s"
              _hover={{ transform: "translateY(-2px)", shadow: "sm" }}
            >
              <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
                {item.stage.replace("_", " ")}
              </Text>
              <Text fontSize="2xl" fontWeight="black" color={item.count ? `${STAGE_COLORS[item.stage] || 'gray'}.600` : "gray.300"}>
                {item.count}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </CardBody>
    </Card>
  );
}

type Job = {
  id: string;
  clientName: string;
  commodity: string;
  status: string;
};

export default function InspectorView() {
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [clientName, setClientName] = useState("");
  const [commodity, setCommodity] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [lotsMap, setLotsMap] = useState<Record<string, InspectionLot[]>>({});
  const [samplingMap, setSamplingMap] = useState<Record<string, Sampling>>({});
  
  // Modal state for adding lot
  const [isAddLotOpen, setIsAddLotOpen] = useState(false);
  const [addLotJobId, setAddLotJobId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [totalBags, setTotalBags] = useState("");
  const [isAddingLot, setIsAddingLot] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  
  const toast = useToast();

  async function fetchJobs() {
    try {
      const res = await fetch("/api/jobs?view=all");
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setJobs([]);
    }
  }

  async function createJob() {
    if (!clientName || !commodity) {
      toast({ title: "Please fill all fields", status: "warning", duration: 3000, position: "top" });
      return;
    }
    
    setIsCreatingJob(true);
    try {
      await fetch("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          clientName,
          commodity,
        }),
        headers: { "Content-Type": "application/json" },
      });

      toast({ title: "Job Created successfully!", status: "success", duration: 3000, position: "top" });
      setClientName("");
      setCommodity("");
      fetchJobs();
    } catch {
      toast({ title: "Error creating job", status: "error", duration: 3000, position: "top" });
    } finally {
      setIsCreatingJob(false);
    }
  }

  async function fetchLots(jobId: string) {
    try {
      const res = await fetch(`/api/inspection/lots?jobId=${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setLotsMap((prev) => ({
        ...prev,
        [jobId]: Array.isArray(data) ? data : [],
      }));

      // Setup initial fetch for samplings
      if (Array.isArray(data)) {
        data.forEach((lot: InspectionLot) => fetchSampling(lot.id));
      }
    } catch(e) {
      console.error(e);
    }
  }

  async function fetchSampling(lotId: string) {
    try {
      const res = await fetch(`/api/inspection/sampling?lotId=${lotId}`);
      if(!res.ok) return;
      const data = await res.json();

      setSamplingMap((prev) => ({
        ...prev,
        [lotId]: data,
      }));
    } catch(e) {
      console.error(e);
    }
  }

  async function createSampling(lotId: string) {
    try {
      await fetch(`/api/inspection/sampling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          beforePhotoUrl: "before.jpg",
          duringPhotoUrl: "during.jpg",
          afterPhotoUrl: "after.jpg",
        }),
      });
      toast({ title: "Sample taken!", status: "success", duration: 2000, position: "top" });
      fetchSampling(lotId);
    } catch {
      toast({ title: "Error taking sample", status: "error", duration: 2000, position: "top" });
    }
  }

  const handleOpenAddLotModal = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddLotJobId(jobId);
    setLotNumber("");
    setTotalBags("1");
    setIsAddLotOpen(true);
  };

  const submitAddLot = async () => {
    if (!lotNumber || !totalBags) return;
    setIsAddingLot(true);
    try {
      await fetch(`/api/inspection/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: addLotJobId,
          lotNumber,
          totalBags: Number(totalBags || 1),
        }),
      });
      toast({ title: "Lot added", status: "success", duration: 2000, position: "top" });
      setIsAddLotOpen(false);
      fetchLots(addLotJobId);
    } catch {
      toast({ title: "Error adding lot", status: "error", duration: 2000, position: "top" });
    } finally {
      setIsAddingLot(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <Box bg="gray.50" minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack align="stretch" spacing={8}>
          
          {/* HEADER */}
          <HStack justify="space-between" align="center" bg="white" p={6} borderRadius="xl" shadow="sm">
            <Box>
              <HStack spacing={3} mb={1}>
                <Box p={2} bg="blue.50" borderRadius="lg" color="blue.500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                </Box>
                <Heading size="lg" color="gray.800">Inspection Control Tower</Heading>
              </HStack>
              <Text color="gray.500">Manage inspection workflow, sampling, and dispatch lifecycle</Text>
            </Box>
          </HStack>

          {/* KPI & WORKFLOW */}
          <WorkflowStrip jobs={jobs} />
          
          <SimpleGrid columns={{ base: 2, md: 3, lg: 5 }} spacing={4}>
            <KpiCard title="Total Jobs" value={jobs.length} color="blue" />
            <KpiCard title="Sampling" value={jobs.filter(j => j.status === 'SAMPLING').length} color="orange" />
            <KpiCard title="Pending QA" value={jobs.filter(j => j.status === 'QA').length} color="teal" />
            <KpiCard title="Dispatch" value={jobs.filter(j => j.status === 'DISPATCHED').length} color="green" />
            <KpiCard title="Reports" value={0} color="purple" />
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={8} alignItems="start">
            
            {/* CREATE JOB PANEL */}
            <Box gridColumn={{ lg: "1 / 2" }}>
              <Card variant="outline" borderRadius="xl" shadow="sm" pos="sticky" top="24px">
                <CardHeader bg="gray.50" borderTopRadius="xl" borderBottomWidth="1px" borderColor="gray.100">
                  <Heading size="md" color="gray.700">New Inspection Job</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" color="gray.600">Client Name</FormLabel>
                      <Input
                        placeholder="E.g. Global Exports Ltd"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        bg="white"
                        focusBorderColor="blue.400"
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" color="gray.600">Commodity</FormLabel>
                      <Input
                        placeholder="E.g. Grade A Wheat"
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                        bg="white"
                        focusBorderColor="blue.400"
                      />
                    </FormControl>
                    
                    <Button 
                      w="full" 
                      colorScheme="blue" 
                      size="lg" 
                      mt={2}
                      onClick={createJob}
                      isLoading={isCreatingJob}
                      loadingText="Creating..."
                    >
                      Create Job
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </Box>

            {/* JOB LIST */}
            <Box gridColumn={{ lg: "2 / 4" }}>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" mb={2}>
                  <Heading size="md" color="gray.700">Active Jobs ({jobs.length})</Heading>
                </HStack>
                
                {jobs.length === 0 ? (
                  <Box p={8} textAlign="center" bg="white" borderRadius="xl" borderWidth="1px" borderStyle="dashed">
                    <Text color="gray.400">No jobs found. Create one to get started.</Text>
                  </Box>
                ) : (
                  jobs.map((job) => {
                    const isExpanded = expandedJobId === job.id;
                    const lots = lotsMap[job.id] || [];
                    
                    return (
                      <Card 
                        key={job.id} 
                        variant="outline" 
                        borderRadius="xl"
                        shadow={isExpanded ? "md" : "sm"}
                        borderColor={isExpanded ? "blue.200" : "gray.200"}
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{ borderColor: "blue.300", shadow: "md" }}
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedJobId(null);
                          } else {
                            setExpandedJobId(job.id);
                            if (!lotsMap[job.id]) fetchLots(job.id);
                          }
                        }}
                      >
                        <CardBody p={5}>
                          <HStack justify="space-between" align="start">
                            <Box>
                              <HStack mb={1}>
                                <Heading size="sm" color="gray.800">{job.clientName}</Heading>
                                <Badge variant="subtle" colorScheme={STAGE_COLORS[job.status] || "gray"} borderRadius="full" px={2}>
                                  {job.status.replace("_", " ")}
                                </Badge>
                              </HStack>
                              <Text color="gray.500" fontSize="sm">Commodity: <Text as="span" fontWeight="medium">{job.commodity}</Text></Text>
                            </Box>
                            
                            <Box color="gray.400" transform={isExpanded ? "rotate(180deg)" : "none"} transition="transform 0.2s">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </Box>
                          </HStack>

                          <Collapse in={isExpanded} animateOpacity>
                            <Box mt={4} pt={4} borderTopWidth="1px" borderColor="gray.100" onClick={e => e.stopPropagation()}>
                              <HStack justify="space-between" mb={3}>
                                <Text fontWeight="semibold" fontSize="sm" color="gray.700">Lots & Sampling</Text>
                                <Button size="xs" colorScheme="blue" variant="ghost" onClick={(e) => handleOpenAddLotModal(job.id, e)}>
                                  + Add Lot
                                </Button>
                              </HStack>

                              <VStack align="stretch" spacing={3}>
                                {lots.length === 0 ? (
                                  <Text fontSize="sm" color="gray.400" fontStyle="italic">No lots added yet.</Text>
                                ) : (
                                  lots.map((lot) => {
                                    const sampling = samplingMap[lot.id];
                                    return (
                                      <Box key={lot.id} p={3} bg="gray.50" borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                                        <HStack justify="space-between" mb={sampling ? 2 : 0}>
                                          <HStack>
                                            <Badge colorScheme="purple" variant="solid" borderRadius="md">{lot.lotNumber}</Badge>
                                            <Text fontSize="sm" color="gray.600">{lot.totalBags} bags</Text>
                                          </HStack>

                                          {!sampling ? (
                                            <Button size="xs" colorScheme="orange" onClick={() => createSampling(lot.id)}>
                                              Take Sample
                                            </Button>
                                          ) : (
                                            <HStack color="green.500" spacing={1}>
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                                <polyline points="22 4 12 14.01 9 11.01"/>
                                              </svg>
                                              <Text fontSize="xs" fontWeight="bold">Sampled</Text>
                                            </HStack>
                                          )}
                                        </HStack>

                                        {sampling && (
                                          <HStack spacing={3} mt={2} pt={2} borderTopWidth="1px" borderColor="gray.200">
                                            <Badge variant="outline" colorScheme="gray" fontSize="xs">📷 Before</Badge>
                                            <Badge variant="outline" colorScheme="gray" fontSize="xs">📷 During</Badge>
                                            <Badge variant="outline" colorScheme="gray" fontSize="xs">📷 After</Badge>
                                          </HStack>
                                        )}
                                      </Box>
                                    );
                                  })
                                )}
                              </VStack>
                            </Box>
                          </Collapse>
                        </CardBody>
                      </Card>
                    );
                  })
                )}
              </VStack>
            </Box>
          </SimpleGrid>
        </VStack>
      </Container>

      {/* ADD LOT MODAL */}
      <Modal isOpen={isAddLotOpen} onClose={() => setIsAddLotOpen(false)} isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl">
          <ModalHeader>Add New Lot</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Lot Number</FormLabel>
                <Input 
                  placeholder="e.g. LOT-A12" 
                  value={lotNumber} 
                  onChange={e => setLotNumber(e.target.value)} 
                  focusBorderColor="blue.400"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Total Bags</FormLabel>
                <Input 
                  type="number" 
                  placeholder="e.g. 500" 
                  value={totalBags} 
                  onChange={e => setTotalBags(e.target.value)} 
                  focusBorderColor="blue.400"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsAddLotOpen(false)}>Cancel</Button>
            <Button colorScheme="blue" onClick={submitAddLot} isLoading={isAddingLot}>Add Lot</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card variant="outline" borderRadius="xl" shadow="sm" transition="all 0.2s" _hover={{ shadow: "md", transform: "translateY(-2px)" }}>
      <CardBody p={5}>
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="gray.500">{title}</Text>
          <Box w={8} h={8} borderRadius="full" bg={`${color}.50`} color={`${color}.500`} display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="xs" fontWeight="bold">{value}</Text>
          </Box>
        </HStack>
        <Text fontSize="3xl" fontWeight="black" color="gray.800" mt={2} lineHeight="1">
          {value}
        </Text>
      </CardBody>
    </Card>
  );
}
