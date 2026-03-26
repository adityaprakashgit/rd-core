"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Heading, 
  Text, 
  SimpleGrid, 
  Card, 
  CardBody, 
  Badge, 
  HStack, 
  VStack, 
  Spinner, 
  Center,
  Stat,
  StatLabel,
  StatNumber,
  Icon,
  Button,
  Progress,
  Divider,
} from "@chakra-ui/react";
import { 
  FlaskConical, 
  ClipboardCheck, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Package
} from "lucide-react";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { InspectionJob } from "@/types/inspection";

// --- UI Components ---

const KPICard = ({ title, value, icon, color, trend }: { title: string, value: string | number, icon: React.ElementType, color: string, trend?: string }) => (
  <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
    <CardBody>
      <HStack justify="space-between" mb={2}>
        <Box p={2} bg={`${color}.50`} borderRadius="lg">
          <Icon as={icon} color={`${color}.500`} fontSize="20" />
        </Box>
        {trend && (
          <Badge colorScheme="green" variant="subtle" borderRadius="full">
            {trend}
          </Badge>
        )}
      </HStack>
      <Stat>
        <StatLabel color="gray.500" fontSize="xs" fontWeight="bold" textTransform="uppercase">
          {title}
        </StatLabel>
        <StatNumber fontSize="2xl" fontWeight="bold">
          {value}
        </StatNumber>
      </Stat>
    </CardBody>
  </Card>
);

const WorkflowStrip = ({ counts }: { counts: Record<string, number> }) => {
  const stages = [
    { label: "CREATED", color: "gray" },
    { label: "LOTS_READY", color: "blue" },
    { label: "SAMPLING", color: "orange" },
    { label: "LAB", color: "purple" },
    { label: "QA", color: "yellow" },
    { label: "LOCKED", color: "green" },
  ];

  return (
    <Card variant="outline" bg="white" shadow="sm" borderRadius="xl" mb={6}>
      <CardBody>
        <VStack align="stretch" spacing={4}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
            Analytical Workflow Density
          </Text>
          <HStack spacing={0} w="full" bg="gray.100" borderRadius="lg" overflow="hidden" h="8px">
            {stages.map((s) => {
              const weight = counts[s.label] || 0;
              const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
              return (
                <Box 
                  key={s.label} 
                  h="full" 
                  bg={`${s.color}.400`} 
                  w={`${(weight / total) * 100}%`} 
                  transition="width 0.5s"
                />
              );
            })}
          </HStack>
          <SimpleGrid columns={{ base: 3, md: 6 }} spacing={4}>
            {stages.map((s) => (
              <VStack key={s.label} align="start" spacing={0}>
                <Text fontSize="10px" color="gray.500" fontWeight="bold">
                  {s.label}
                </Text>
                <HStack>
                  <Box w="2" h="2" borderRadius="full" bg={`${s.color}.400`} />
                  <Text fontSize="sm" fontWeight="bold">
                    {counts[s.label] || 0}
                  </Text>
                </HStack>
              </VStack>
            ))}
          </SimpleGrid>
        </VStack>
      </CardBody>
    </Card>
  );
};

const ReadinessItem = ({ title, description, badgeLabel, color }: { title: string, description: string, badgeLabel: string, color: string }) => (
  <HStack spacing={4} align="start" p={3} _hover={{ bg: "gray.50" }} borderRadius="lg" transition="0.2s">
    <VStack align="start" spacing={0} flex={1}>
      <Text fontSize="sm" fontWeight="bold" color="gray.700">{title}</Text>
      <Text fontSize="xs" color="gray.500">{description}</Text>
    </VStack>
    <Badge colorScheme={color} variant="subtle" fontSize="10px" px={2} borderRadius="md">
      {badgeLabel}
    </Badge>
  </HStack>
);

// --- Page Logic ---

export default function UserRdDashboard() {
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function getJobs() {
      try {
        const res = await fetch("/api/inspection/jobs");
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        }
      } catch {
        console.error("Failed to load RD jobs");
      } finally {
        setLoading(false);
      }
    }
    getJobs();
  }, []);

  if (loading) return (
    <ControlTowerLayout>
      <Center minH="400px">
        <Spinner size="xl" color="purple.500" />
      </Center>
    </ControlTowerLayout>
  );

  const statusCounts = jobs.reduce((acc: Record<string, number>, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});


  const totalJobs = jobs.length;
  const inLab = statusCounts["LAB"] || 0;
  const pendingQA = statusCounts["QA"] || 0;
  const finalized = statusCounts["LOCKED"] || 0;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <Box mb={4}>
          <Heading size="lg" color="gray.800">R&D Analytics Dashboard</Heading>
          <Text color="gray.500">Monitor inspection results and execute laboratory assay trials.</Text>
        </Box>

        {/* KPI Row */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <KPICard title="Assigned Jobs" value={totalJobs} icon={ClipboardCheck} color="purple" />
          <KPICard title="In Laboratory" value={inLab} icon={FlaskConical} color="orange" />
          <KPICard title="Pending Review" value={pendingQA} icon={AlertCircle} color="yellow" />
          <KPICard title="Finalized" value={finalized} icon={CheckCircle2} color="green" />
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
          <Box gridColumn={{ lg: "span 2" }}>
            {/* Workflow Strip */}
            <WorkflowStrip counts={statusCounts} />

            {/* Job List */}
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Heading size="md" color="gray.700">R&D Execution Register</Heading>
              </HStack>
              
              {jobs.map((job) => (
                <Card 
                  key={job.id} 
                  variant="outline" 
                  bg="white" 
                  shadow="sm" 
                  borderRadius="xl" 
                  _hover={{ shadow: "md", transform: "translateY(-2px)", cursor: "pointer" }}
                  transition="all 0.2s"
                  onClick={() => router.push(`/userrd/job/${job.id}`)}
                >
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} alignItems="center">
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs" fontWeight="bold" color="purple.500" mb={1}>
                          {job.jobReferenceNumber || job.id.slice(-8).toUpperCase()}
                        </Text>
                        <Heading size="sm" color="gray.800" noOfLines={1}>{job.clientName}</Heading>
                        <Text fontSize="xs" color="gray.500">{job.commodity}</Text>
                      </VStack>

                      <VStack align="start" spacing={1}>
                         <Badge colorScheme={job.status === "LOCKED" ? "green" : job.status === "QA" ? "yellow" : "purple"} variant="subtle" borderRadius="md">
                           {job.status || "PENDING"}
                         </Badge>
                         <Text fontSize="10px" color="gray.400">Captured {new Date(job.createdAt).toLocaleDateString()}</Text>
                      </VStack>

                      <VStack align="stretch" spacing={1} flex={1}>
                        <HStack justify="space-between">
                           <Text fontSize="xs" color="gray.600">Assay Integrity</Text>
                           <Text fontSize="xs" fontWeight="bold">{job.status === "LOCKED" ? "100%" : "0%"}</Text>
                        </HStack>
                        <Progress value={job.status === "LOCKED" ? 100 : 0} size="xs" borderRadius="full" colorScheme="purple" />
                      </VStack>

                      <HStack justify="end">
                         <Button 
                           size="sm" 
                           colorScheme="purple" 
                           variant="ghost"
                           rightIcon={<ExternalLink size={14} />}
                         >
                           Analyze
                         </Button>
                      </HStack>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              ))}

              {jobs.length === 0 && (
                <Center p={10} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                  <VStack spacing={2}>
                    <Icon as={Package} fontSize="32" color="gray.300" />
                    <Text color="gray.500">Zero R&D jobs found in the registry.</Text>
                  </VStack>
                </Center>
              )}
            </VStack>
          </Box>

          <Box>
            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
              <CardBody>
                <Heading size="xs" textTransform="uppercase" color="gray.500" mb={4} letterSpacing="wider">
                  R&D Readiness
                </Heading>
                <VStack align="stretch" spacing={2}>
                  <ReadinessItem 
                    title="Sample Capture" 
                    description="Physical sample verification" 
                    badgeLabel="ACTIVE" 
                    color="green" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Analytical Trials" 
                    description="Laboratory orchestration" 
                    badgeLabel="READY" 
                    color="blue" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Metrics Engine" 
                    description="Real-time assay calculation" 
                    badgeLabel="CONTROLLED" 
                    color="green" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Audit Snapshot" 
                    description="Immutable state capture" 
                    badgeLabel="READY" 
                    color="purple" 
                  />
                </VStack>

                <Box mt={8} p={4} bg="orange.50" borderRadius="xl">
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={AlertCircle} color="orange.500" />
                      <Text fontWeight="bold" fontSize="sm" color="orange.800">RD Notice</Text>
                    </HStack>
                    <Text fontSize="xs" color="orange.700">
                      Analytical results must meet the 0.05% variance threshold before QA submission is permitted.
                    </Text>
                  </VStack>
                </Box>
              </CardBody>
            </Card>
          </Box>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}

