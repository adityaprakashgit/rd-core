"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
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
  IconButton,
  useToast,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Divider,
  SimpleGrid,
  Image,
  Input,
  Center,
} from "@chakra-ui/react";
import {
  ChevronRight,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Trash2,
  Save,
  Plus,
} from "lucide-react";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { useRouter, useParams } from "next/navigation";
import { InspectionJob, InspectionLot, InspectionBag, Sampling } from "@/types/inspection";

export default function LotDetailPage() {
  const { jobId, lotId } = useParams();
  const [lot, setLot] = useState<InspectionLot | null>(null);
  const [bags, setBags] = useState<InspectionBag[]>([]);
  const [sampling, setSampling] = useState<Sampling | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newBagsCount, setNewBagsCount] = useState("1");
  const [recording, setRecording] = useState(false);
  
  const router = useRouter();
  const toast = useToast();


  const fetchLotData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/inspection/lots?jobId=${jobId}`);
      const data = await res.json();
      const currentLot = data.find((l: InspectionLot) => l.id === lotId);
      setLot(currentLot);
    } catch { toast({ title: "Fetch Error", status: "error" }); }
  }, [jobId, lotId, toast]);

  const fetchBags = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/inspection/bags?lotId=${lotId}`);
      const data = await res.json();
      setBags(data);
    } catch { }
  }, [lotId]);

  const fetchSampling = React.useCallback(async () => {
     try {
        const res = await fetch(`/api/inspection/sampling?lotId=${lotId}`);
        const data = await res.json();
        setSampling(data);
     } catch { }
     finally { setLoading(false); }
  }, [lotId]);

  useEffect(() => {
    if (lotId) {
      fetchLotData();
      fetchBags();
      fetchSampling();
    }
  }, [lotId, fetchLotData, fetchBags, fetchSampling]);


  const handleWeightReg = async () => {
    setRecording(true);
    try {
      const count = parseInt(newBagsCount);
      const bagsToInsert = Array.from({ length: count }, () => ({ grossWeight: 0, netWeight: 0 }));
      const res = await fetch("/api/inspection/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId, bags: bagsToInsert })
      });
      if (!res.ok) throw await res.json();
      toast({ title: `Registered ${count} Units`, status: "success" });
      fetchBags();
    } catch (err: any) {
      toast({ title: "Registry Error", description: err.details, status: "error" });
    } finally {
      setRecording(false);
    }
  };

  const handlePhotoUpload = async (category: "before" | "during" | "after") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploading(category);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lotId", lotId as string);
      formData.append("category", category.toUpperCase());

      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (!res.ok) throw await res.json();
        toast({ title: `${category.toUpperCase()} Sample Captured`, status: "success" });
        fetchSampling();
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.details, status: "error" });
      } finally {
        setUploading(null);
      }
    };
    input.click();
  };

  if (loading) return <ControlTowerLayout><Text>Loading Terminal...</Text></ControlTowerLayout>;
  if (!lot) return <ControlTowerLayout><Text>Lot ID Mismatch.</Text></ControlTowerLayout>;

  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={6}>
        {/* Breadcrumbs */}
        <Breadcrumb spacing="8px" separator={<ChevronRight size={14} color="gray.300" />}>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push("/userinsp")} color="gray.500" fontSize="sm">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push(`/userinsp/job/${jobId}`)} color="gray.500" fontSize="sm">Job Control</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink color="gray.800" fontSize="sm" fontWeight="bold">Unit Audit: {lot.lotNumber}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header Section */}
        <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
          <CardBody>
            <HStack justify="space-between">
              <VStack align="start" spacing={1}>
                <HStack>
                   <IconButton 
                     aria-label="back" 
                     icon={<ArrowLeft size={18} />} 
                     size="sm" 
                     variant="ghost" 
                     onClick={() => router.push(`/userinsp/job/${jobId}`)}
                   />
                   <Heading size="md" color="gray.800">Lot Strategy Center</Heading>
                </HStack>
                <Text fontSize="sm" color="gray.500" ml={10}>Registry of individual inventory units and media evidence.</Text>
              </VStack>
              <HStack spacing={4}>
                 <Box textAlign="right">
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">TOTAL BATCH SIZE</Text>
                    <Text fontSize="xl" fontWeight="bold" color="purple.600">{lot.totalBags} Units</Text>
                 </Box>
                 <Divider orientation="vertical" h="40px" />
                 <Box textAlign="right">
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">WEIGHT CAPTURED</Text>
                    <Text fontSize="xl" fontWeight="bold" color="purple.600">{bags.length} Units</Text>
                 </Box>
              </HStack>
            </HStack>
          </CardBody>
        </Card>

        {/* Sampling Workflow Strip */}
        <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
           <CardBody>
              <Heading size="xs" color="gray.500" textTransform="uppercase" mb={6}>Physical Sampling Evidence</Heading>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
                 {["before", "during", "after"].map((cat) => {
                    const urlKey = `${cat}PhotoUrl` as keyof Sampling;
                    const url = sampling ? (sampling[urlKey] as string) : null;

                    return (
                       <VStack key={cat} align="stretch" spacing={3}>

                          <HStack justify="space-between">
                             <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase">{cat}</Text>
                             {url && <Icon as={CheckCircle2} color="green.500" />}
                          </HStack>
                          <Box 
                            h="200px" 
                            bg="gray.50" 
                            borderRadius="lg" 
                            border="2px dashed" 
                            borderColor={url ? "green.100" : "gray.200"}
                            overflow="hidden"
                            pos="relative"
                          >
                             {url ? (
                                <Image src={url} alt={cat} objectFit="cover" w="full" h="full" />
                             ) : (
                                <Center h="full">
                                   <VStack spacing={2}>
                                      <Icon as={Camera} color="gray.300" fontSize="32" />
                                      <Button 
                                        size="xs" 
                                        colorScheme="purple" 
                                        variant="ghost" 
                                        isLoading={uploading === cat}
                                        onClick={() => handlePhotoUpload(cat as any)}
                                      >
                                        Initiate Capture
                                      </Button>
                                   </VStack>
                                </Center>
                             )}
                          </Box>
                          {url && (
                             <Button size="xs" variant="outline" onClick={() => handlePhotoUpload(cat as any)} isLoading={uploading === cat}>
                                Update Evidence
                             </Button>
                          )}
                       </VStack>
                    );
                 })}
              </SimpleGrid>
           </CardBody>
        </Card>

        {/* Bag Table Section */}
        <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
          <CardBody p={0}>
             <Box p={5} borderBottomWidth="1px" borderColor="gray.100" display="flex" justifyContent="space-between" alignItems="center">
                <Heading size="sm" color="gray.700">Individual Unit Registry</Heading>
                <HStack>
                   <Input 
                     type="number" 
                     value={newBagsCount} 
                     onChange={(e) => setNewBagsCount(e.target.value)} 
                     w="80px" 
                     size="sm" 
                     borderRadius="md"
                    />
                   <Button size="sm" colorScheme="purple" leftIcon={<Plus size={16} />} onClick={handleWeightReg} isLoading={recording}>
                     Register Units
                   </Button>
                </HStack>
             </Box>
             <TableContainer>
                <Table variant="simple" size="sm">
                   <Thead bg="gray.50">
                      <Tr>
                        <Th py={4}>Unit #</Th>
                        <Th py={4}>Gross Weight (kg)</Th>
                        <Th py={4}>Net Weight (kg)</Th>
                        <Th py={4}>Status</Th>
                      </Tr>
                   </Thead>
                   <Tbody>
                      {bags.map(bag => (
                         <Tr key={bag.id}>
                            <Td fontWeight="bold">#{bag.bagNumber}</Td>
                            <Td>{bag.grossWeight || "-"}</Td>
                            <Td>{bag.netWeight || "-"}</Td>
                            <Td>
                               <Badge colorScheme="green" variant="subtle">STABLE</Badge>
                            </Td>
                         </Tr>
                      ))}
                      {bags.length === 0 && (
                         <Tr>
                            <Td colSpan={4} textAlign="center" py={10}>
                               <Text color="gray.400">Unit registry is currently empty.</Text>
                            </Td>
                         </Tr>
                      )}
                   </Tbody>
                </Table>
             </TableContainer>
          </CardBody>
        </Card>
      </VStack>
    </ControlTowerLayout>
  );
}
