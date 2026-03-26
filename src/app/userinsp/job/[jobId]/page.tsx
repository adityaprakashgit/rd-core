"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  HStack,
  Badge,
  Button,
  Card,
  CardBody,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Progress,
  useToast,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
} from "@chakra-ui/react";
import {
  ChevronRight,
  Plus,
  Calendar,
  Layers,
  Clipboard,
  Camera,
} from "lucide-react";


import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useRouter, useParams } from "next/navigation";
import { InspectionJob, InspectionLot, AuditLog } from "@/types/inspection";
import { AuditTrail } from "@/components/inspection/AuditTrail";




export default function JobDetailPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<InspectionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newLotNumber, setNewLotNumber] = useState("");
  const [newTotalBags, setNewTotalBags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  
  const router = useRouter();
  const toast = useToast();

  const fetchJob = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/inspection/jobs/${jobId}`);
      const data = await res.json();
      setJob(data);
    } catch {
      toast({ title: "Fetch Error", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [jobId, toast]);

  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/inspection/audit?jobId=${jobId}`);
      const data = await res.json();
      setLogs(data);
    } catch {
      // Quiet fail
    } finally {
      // setLoadingLogs(false); // Removed as per instruction
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchJob();
      fetchLogs();
    }
  }, [jobId, fetchJob, fetchLogs]);



  const handleAddLot = async () => {
    setSubmitting(true);
    try {
       const res = await fetch("/api/inspection/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             jobId,
             lotNumber: newLotNumber,
             totalBags: parseInt(newTotalBags)
          })
       });
       if (!res.ok) throw await res.json();
       toast({ title: "Lot Registered", status: "success" });
       onClose();
       fetchJob();
    } catch (err: unknown) {
       const error = err as Error;
       toast({ title: "Registration Failed", description: error.message, status: "error" });
    } finally {
       setSubmitting(false);
    }
  };


  if (loading) return <ControlTowerLayout><Text>Initializing Control Interface...</Text></ControlTowerLayout>;
  if (!job) return <ControlTowerLayout><Text>Job not found.</Text></ControlTowerLayout>;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        {/* Breadcrumbs */}
        <Breadcrumb spacing="8px" separator={<ChevronRight size={14} color="gray.300" />}>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push("/userinsp")} color="gray.500" fontSize="sm">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink color="gray.800" fontSize="sm" fontWeight="bold">Job Control Panel</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header Section */}
        <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
          <CardBody>
            <HStack justify="space-between" wrap="wrap" spacing={4}>
              <VStack align="start" spacing={1}>
                <HStack>
                   <Badge colorScheme="purple" p={1} borderRadius="md" variant="solid">
                     {job.id.slice(-8).toUpperCase()}
                   </Badge>
                   <Badge colorScheme={job.status === "LOCKED" ? "green" : "blue"} borderRadius="md">
                     {job.status}
                   </Badge>
                </HStack>
                <Heading size="lg" color="gray.800">{job.clientName}</Heading>
                <HStack color="gray.500" fontSize="sm" spacing={4}>
                  <HStack><Icon as={Layers} size={14} /><Text>{job.commodity}</Text></HStack>
                  <HStack><Icon as={Calendar} size={14} /><Text>{new Date(job.createdAt).toLocaleDateString()}</Text></HStack>
                </HStack>
              </VStack>
              <HStack spacing={3}>
                <Button variant="outline" leftIcon={<Clipboard size={18} />}>Log Audit</Button>
                <Button colorScheme="purple" leftIcon={<Plus size={18} />} onClick={onOpen}>Add Lot</Button>
              </HStack>
            </HStack>
          </CardBody>
        </Card>

        {/* Main Interface Grid */}
        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
          <Box gridColumn={{ lg: "span 2" }}>
            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
              <CardBody p={0}>
                <Box p={5} borderBottomWidth="1px" borderColor="gray.100">
                  <Heading size="sm" color="gray.700">Lot Registry & Inventory</Heading>
                </Box>
                <TableContainer>
                  <Table variant="simple">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th fontSize="xs">Lot Number</Th>
                        <Th fontSize="xs">Bags</Th>
                        <Th fontSize="xs">Sampling Status</Th>
                        <Th fontSize="xs">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {job.lots?.map((lot: InspectionLot) => (
                        <Tr key={lot.id} _hover={{ bg: "gray.50" }} transition="0.2s">
                          <Td>
                            <Text fontWeight="bold" color="gray.700">{lot.lotNumber}</Text>
                          </Td>
                          <Td>{lot.totalBags}</Td>
                          <Td>
                             <Badge colorScheme={lot.sampling ? "green" : "gray"} borderRadius="md" variant="subtle">
                               {lot.sampling ? "COMPLETED" : "PENDING"}
                             </Badge>
                          </Td>
                          <Td>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              colorScheme="purple" 
                              rightIcon={<ChevronRight size={14} />}
                              onClick={() => router.push(`/userinsp/job/${jobId}/lot/${lot.id}`)}
                            >
                              Manage
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                      {(job.lots?.length || 0) === 0 && (
                        <Tr>
                          <Td colSpan={4} textAlign="center" py={10}>
                            <Text color="gray.400">No lots identified in current duty cycle.</Text>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </Box>

          <VStack align="stretch" spacing={6}>
            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
               <CardBody>
                 <Heading size="xs" color="gray.500" textTransform="uppercase" mb={4}>Live Sampling Status</Heading>
                 <VStack align="stretch" spacing={4}>
                    <Box>
                       <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" fontWeight="bold">Progress Curve</Text>
                          <Text fontSize="xs" fontWeight="bold">
                            {job.lots?.filter((l: InspectionLot) => l.sampling).length || 0} / {job.lots?.length || 0}
                          </Text>
                       </HStack>
                       <Progress 
                         value={(job.lots?.length || 0) > 0 ? ((job.lots?.filter((l: InspectionLot) => l.sampling).length || 0) / (job.lots?.length || 1)) * 100 : 0} 
                         size="sm" 
                         colorScheme="purple" 
                         borderRadius="full" 
                        />

                    </Box>
                    <Divider />
                     <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Pending Lots</Text>
                        <Badge colorScheme="orange">{job.lots?.filter((l: InspectionLot) => !l.sampling).length || 0}</Badge>
                     </HStack>
                     <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Verified Units</Text>
                        <Badge colorScheme="green">{job.lots?.filter((l: InspectionLot) => l.sampling).length || 0}</Badge>
                     </HStack>

                    <Button mt={4} colorScheme="purple" size="sm" leftIcon={<Camera size={16} />} variant="outline">
                       Bulk Media Sync
                    </Button>
                 </VStack>
               </CardBody>
            </Card>

            <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
               <CardBody>
                 <Heading size="xs" color="gray.500" textTransform="uppercase" mb={4}>Governance Audit Trail</Heading>
                 <AuditTrail logs={logs} />
               </CardBody>
            </Card>
          </VStack>

        </SimpleGrid>
      </VStack>


      {/* Add Lot Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(5px)" />
        <ModalContent borderRadius="xl">
          <ModalHeader>Register New Inventory Lot</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
             <VStack spacing={4}>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold">Lot Reference Number</FormLabel>
                  <Input 
                    placeholder="e.g. LOT-A1" 
                    value={newLotNumber} 
                    onChange={(e) => setNewLotNumber(e.target.value)} 
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold">Total Expected Bags</FormLabel>
                  <Input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={newTotalBags} 
                    onChange={(e) => setNewTotalBags(e.target.value)} 
                  />
                </FormControl>
             </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="purple" onClick={handleAddLot} isLoading={submitting}>Register Lot</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ControlTowerLayout>
  );
}
