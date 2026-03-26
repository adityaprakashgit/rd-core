"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  SimpleGrid,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  Badge,
  Icon,
  Spinner,
  useToast,
  Progress,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Center,
  Divider,
} from "@chakra-ui/react";

import {
  MoreVertical,
  Download,
  FileText,
  ExternalLink,
  ClipboardCheck,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useRouter } from "next/navigation";
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
            Workflow Logic Density
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

export default function UserInspDashboard() {
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const toast = useToast();

  const fetchJobs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/inspection/jobs");
      const data = await res.json();
      setJobs(data);
    } catch {
      toast({ title: "Fetch Error", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LOCKED": return "green";
      case "QA": return "yellow";
      case "IN_PROGRESS": return "blue";
      default: return "purple";
    }
  };

  // Derived Metrics
  const totalJobs = jobs.length;
  const pendingQA = jobs.filter(j => j.status === "QA").length;
  const locked = jobs.filter(j => j.status === "LOCKED").length;
  const sampling = 0; // Placeholder for demo
  
  const statusCounts = jobs.reduce((acc: Record<string, number>, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});


  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        {/* KPI Row */}
        <SimpleGrid columns={{ base: 1, md: 5 }} spacing={4}>
          <KPICard title="Total Jobs" value={totalJobs} icon={ClipboardCheck} color="purple" trend="+12%" />
          <KPICard title="Sampling Progress" value={sampling} icon={Clock} color="orange" />
          <KPICard title="Pending QA" value={pendingQA} icon={AlertCircle} color="yellow" />
          <KPICard title="Locked / Final" value={locked} icon={CheckCircle2} color="green" />
          <KPICard title="Reports Ready" value={locked} icon={TrendingUp} color="blue" />
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} alignSelf="stretch">
          <Box gridColumn={{ lg: "span 2" }}>
            {/* Workflow Strip */}
            <WorkflowStrip counts={statusCounts} />

            {/* Job List */}
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Heading size="md" color="gray.700">Active Duty Register</Heading>
                <Button variant="ghost" size="sm" colorScheme="purple">View All Logs</Button>
              </HStack>
              
              {jobs.map((job) => (
                <Card 
                  key={job.id} 
                  variant="outline" 
                  bg="white" 
                  shadow="sm" 
                  borderRadius="xl" 
                  _hover={{ shadow: "md", transform: "translateY(-2px)" }}
                  transition="all 0.2s"
                >
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} alignItems="center">
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs" fontWeight="bold" color="purple.500" mb={1}>
                          {job.id.slice(-8).toUpperCase()}
                        </Text>
                        <Heading size="sm" color="gray.800" noOfLines={1}>{job.clientName}</Heading>
                        <Text fontSize="xs" color="gray.500">{job.commodity}</Text>
                      </VStack>

                      <VStack align="start" spacing={1}>
                         <Badge colorScheme={getStatusColor(job.status)} variant="subtle" borderRadius="md">
                           {job.status}
                         </Badge>
                         <Text fontSize="10px" color="gray.400">Updated {new Date(job.updatedAt).toLocaleDateString()}</Text>
                      </VStack>

                      <VStack align="stretch" spacing={1} flex={1}>
                        <HStack justify="space-between">
                           <Text fontSize="xs" color="gray.600">Sampling Density</Text>
                           <Text fontSize="xs" fontWeight="bold">0%</Text>
                        </HStack>
                        <Progress value={0} size="xs" borderRadius="full" colorScheme="purple" />
                      </VStack>

                      <HStack justify="end">
                         <Button 
                           size="sm" 
                           colorScheme="purple" 
                           rightIcon={<ExternalLink size={14} />}
                           onClick={() => router.push(`/userinsp/job/${job.id}`)}
                         >
                           Control
                         </Button>
                         <Menu>
                           <MenuButton as={IconButton} icon={<MoreVertical size={18} />} size="sm" variant="ghost" />
                           <MenuList>
                             <MenuItem icon={<Download size={14} />}>Export Metadata</MenuItem>
                             <MenuItem icon={<FileText size={14} />}>Quick PDF</MenuItem>
                           </MenuList>
                         </Menu>
                      </HStack>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              ))}

              {jobs.length === 0 && !loading && (
                <Center p={10} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                  <VStack spacing={2}>
                    <Icon as={Package} fontSize="32" color="gray.300" />
                    <Text color="gray.500">Zero active duty jobs found in the registry.</Text>
                  </VStack>
                </Center>
              )}
            </VStack>
          </Box>

          <Box>
            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
              <CardBody>
                <Heading size="xs" textTransform="uppercase" color="gray.500" mb={4} letterSpacing="wider">
                  Module Readiness
                </Heading>
                <VStack align="stretch" spacing={2}>
                  <ReadinessItem 
                    title="Job & Lot Intake" 
                    description="Internal registry for raw samples" 
                    badgeLabel="READY" 
                    color="green" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Sampling Discipline" 
                    description="Physical sample audit & media" 
                    badgeLabel="CONTROLLED" 
                    color="blue" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Assay Management" 
                    description="R&D laboratory integrations" 
                    badgeLabel="READY" 
                    color="green" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Report Generation" 
                    description="PDF/Excel automated builders" 
                    badgeLabel="READY" 
                    color="green" 
                  />
                  <Divider />
                  <ReadinessItem 
                    title="Dispatch Docs" 
                    description="Supply chain audit trail" 
                    badgeLabel="LOCKED" 
                    color="gray" 
                  />
                </VStack>

                <Box mt={8} p={4} bg="purple.50" borderRadius="xl">
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={AlertCircle} color="purple.500" />
                      <Text fontWeight="bold" fontSize="sm" color="purple.800">System Note</Text>
                    </HStack>
                    <Text fontSize="xs" color="purple.700">
                      You are operating in High Compliance mode. All actions are logged to the blockchain-ready audit trail.
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
