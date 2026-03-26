"use client";

import React, { useCallback, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { ArrowLeft, Building2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

export default function RdPage() {
  const router = useRouter();
  const toast = useToast();
  const [clientName, setClientName] = useState("");
  const [commodity, setCommodity] = useState("");
  const [creating, setCreating] = useState(false);

  const createJob = useCallback(async () => {
    if (!clientName.trim() || !commodity.trim()) {
      toast({
        title: "Missing fields",
        description: "Client name and commodity are required.",
        status: "warning",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          commodity: commodity.trim(),
        }),
      });

      if (!res.ok) {
        throw await res.json();
      }

      const job = await res.json();
      toast({
        title: "Job created",
        description: job.inspectionSerialNumber || job.jobReferenceNumber || "Job created",
        status: "success",
      });
      router.push(`/userinsp/job/${job.id}?view=my`);
    } catch (err: unknown) {
      const details = err && typeof err === "object" && "details" in err
        ? String((err as { details?: unknown }).details)
        : "Unable to create job";
      toast({ title: "Create job failed", description: details, status: "error" });
    } finally {
      setCreating(false);
    }
  }, [clientName, commodity, router, toast]);

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={4}>
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
                JOB INTAKE
              </Badge>
              <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
                CONTROLLED
              </Badge>
            </HStack>
            <Heading size="lg" color="gray.900">
              Create Inspection Job
            </Heading>
            <Text color="gray.600" maxW="4xl">
              Canonical entry point for inspection intake. Create the job here and continue directly into the control tower workflow.
            </Text>
          </VStack>

          <HStack spacing={3} wrap="wrap">
            <Button leftIcon={<ArrowLeft size={16} />} variant="ghost" onClick={() => router.push("/userinsp")}>
              Back to Dashboard
            </Button>
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={3} py={1}>
              ENTRY READY
            </Badge>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
          <Box gridColumn={{ lg: "span 2" }}>
            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={6}>
                <HStack mb={5} align="start" spacing={3}>
                  <Box p={2.5} bg="teal.50" color="teal.600" borderRadius="xl">
                    <Plus size={18} />
                  </Box>
                  <Box>
                    <Heading size="md" color="gray.900">
                      New Inspection Reference
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Job creation is lightweight and immediately opens the inspection workflow after save.
                    </Text>
                  </Box>
                </HStack>

                <VStack align="stretch" spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Client Name</FormLabel>
                    <Input
                      placeholder="e.g. Acme Corp"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Commodity</FormLabel>
                    <Input
                      placeholder="e.g. Wheat, Iron Ore"
                      value={commodity}
                      onChange={(e) => setCommodity(e.target.value)}
                    />
                  </FormControl>

                  <Divider />

                  <HStack justify="end" spacing={3}>
                    <Button variant="ghost" onClick={() => { setClientName(""); setCommodity(""); }}>
                      Clear
                    </Button>
                    <Button colorScheme="teal" onClick={createJob} isLoading={creating}>
                      Create Job
                    </Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </Box>

          <VStack align="stretch" spacing={6}>
            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <HStack justify="space-between" align="start" mb={3}>
                  <Box>
                    <Heading size="sm" color="gray.900">
                      Workflow Entry
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      The created job continues into lot intake, sampling, and QA gating.
                    </Text>
                  </Box>
                  <Box p={2.5} bg="blue.50" color="blue.600" borderRadius="xl">
                    <Sparkles size={18} />
                  </Box>
                </HStack>

                <VStack align="stretch" spacing={3}>
                  {[
                    { title: "Job created", desc: "Inspection reference and metadata registered." },
                    { title: "Lot intake", desc: "Move into structured lot capture." },
                    { title: "Sampling", desc: "Open the lot control panel and capture evidence." },
                    { title: "QA / Lock", desc: "Governance status is applied downstream." },
                  ].map((item, index) => (
                    <HStack key={item.title} align="start" spacing={3}>
                      <Box
                        w="6"
                        h="6"
                        borderRadius="full"
                        bg={index === 0 ? "teal.500" : "gray.200"}
                        color="white"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="xs"
                        fontWeight="bold"
                        flexShrink={0}
                      >
                        {index + 1}
                      </Box>
                      <Box>
                        <Text fontWeight="semibold" color="gray.900">
                          {item.title}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {item.desc}
                        </Text>
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </CardBody>
            </Card>

            <Card variant="outline" borderRadius="2xl" bg="white" shadow="sm">
              <CardBody p={5}>
                <HStack align="start" spacing={3}>
                  <Box p={2.5} bg="purple.50" color="purple.600" borderRadius="xl">
                    <Building2 size={18} />
                  </Box>
                  <Box>
                    <Heading size="sm" color="gray.900">
                      Operational Defaults
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Company and user values are resolved by the current session context.
                    </Text>
                  </Box>
                </HStack>
                <Divider my={4} />
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.600">
                    Company
                  </Text>
                  <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
                    Workspace
                  </Badge>
                </HStack>
                <HStack justify="space-between" mt={3}>
                  <Text fontSize="sm" color="gray.600">
                    User
                  </Text>
                  <Badge colorScheme="gray" variant="subtle" borderRadius="full" px={2.5} py={1}>
                    Current session
                  </Badge>
                </HStack>
                <HStack justify="space-between" mt={3}>
                  <Text fontSize="sm" color="gray.600">
                    Flow target
                  </Text>
                  <Badge colorScheme="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
                    /userinsp/job/[jobId]
                  </Badge>
                </HStack>
              </CardBody>
            </Card>
          </VStack>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
