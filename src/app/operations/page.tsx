"use client";

import { Box, Container, Heading, SimpleGrid, Card, CardBody, Text, Badge, HStack, VStack, Spinner, Center } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Define the Job type from schema
type Job = {
  id: string;
  clientName: string;
  commodity: string;
  status: string;
  inspectionSerialNumber: string;
  createdAt: string;
};

const STAGE_COLORS: Record<string, string> = {
  CREATED: "gray",
  LOTS_READY: "cyan",
  SAMPLING: "orange",
  LAB: "purple",
  QA: "blue",
  LOCKED: "red",
  DISPATCHED: "green",
};

export default function OperationsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{error: string, details?: string} | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/inspection/jobs", { cache: "force-cache", next: { revalidate: 30 } });
        if (!res.ok) {
          const errData = await res.json();
          throw errData;
        }
        const data = await res.json();
        setJobs(data);
      } catch (err: any) {
        setError(err.error ? err : { error: "Failed to load jobs" });
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <Center minH="100vh" bg="gray.50">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  if (error) {
    return (
      <Box p={8} bg="red.50" minH="100vh">
        <Heading size="md" color="red.600">{error.error}</Heading>
        {error.details && <Text color="red.500" mt={2}>{error.details}</Text>}
      </Box>
    );
  }

  return (
    <Box bg="gray.50" minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack align="stretch" spacing={6}>
          <Box bg="white" p={6} borderRadius="xl" shadow="sm">
            <Heading size="lg" color="gray.800">Operations Control</Heading>
            <Text color="gray.500" mt={1}>Select a job to manage its lots and samplings.</Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {jobs.map((job) => (
              <Card
                key={job.id}
                variant="outline"
                borderRadius="xl"
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ shadow: "md", borderColor: "blue.300", transform: "translateY(-2px)" }}
                onClick={() => router.push(`/operations/job/${job.id}`)}
              >
                <CardBody p={5}>
                  <HStack justify="space-between" align="start" mb={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.400" fontWeight="bold" letterSpacing="wider">
                        {job.inspectionSerialNumber || `JOB-${job.id.substring(0, 6).toUpperCase()}`}
                      </Text>
                      <Heading size="md" color="gray.800" mt={1}>{job.clientName}</Heading>
                    </Box>
                    <Badge colorScheme={STAGE_COLORS[job.status] || "gray"} borderRadius="full" px={2} py={0.5}>
                      {job.status.replace("_", " ")}
                    </Badge>
                  </HStack>
                  <HStack justify="space-between" mt={4} pt={4} borderTopWidth="1px" borderColor="gray.100">
                    <Text fontSize="sm" color="gray.600">
                      Commodity: <Text as="span" fontWeight="semibold" color="gray.800">{job.commodity}</Text>
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </Text>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}
