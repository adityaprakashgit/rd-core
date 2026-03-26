"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Container, Heading, Text, HStack, VStack, Spinner, Center, Button,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Card, CardBody, useToast, Input, Image
} from "@chakra-ui/react";

type Lot = {
  id: string;
  jobId: string;
  lotNumber: string;
  totalBags: number;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  createdAt: string;
};

type Sampling = {
  id: string;
  lotId: string;
  beforePhotoUrl: string | null;
  duringPhotoUrl: string | null;
  afterPhotoUrl: string | null;
  createdAt: string;
};

type BagRecord = {
  id?: string;
  bagNumber: number;
  grossWeight: number | "";
  netWeight: number | "";
  isNew?: boolean;
};

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const jobId = params.jobId as string;
  const lotId = params.lotId as string;

  const [lot, setLot] = useState<Lot | null>(null);
  const [sampling, setSampling] = useState<Sampling | null>(null);
  const [bags, setBags] = useState<BagRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{error: string, details?: string} | null>(null);
  const [samplingLoading, setSamplingLoading] = useState(false);
  const [savingBags, setSavingBags] = useState(false);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  const fetchLotData = async () => {
    try {
      const [lotsRes, samplingRes, bagsRes] = await Promise.all([
        fetch(`/api/inspection/lots?jobId=${jobId}`),
        fetch(`/api/inspection/sampling?lotId=${lotId}`),
        fetch(`/api/inspection/bags?lotId=${lotId}`)
      ]);

      if (!lotsRes.ok) throw await lotsRes.json();
      
      const lotsData: Lot[] = await lotsRes.json();
      const foundLot = lotsData.find((l) => l.id === lotId);
      
      if (!foundLot) {
        throw { error: "Not Found", details: "Lot not found for this job ID." };
      }
      
      setLot(foundLot);

      if (samplingRes.ok) {
         setSampling(await samplingRes.json());
      }
      if (bagsRes.ok) {
         const bagsData = await bagsRes.json();
         setBags(bagsData.map((b: any) => ({
           id: b.id,
           bagNumber: b.bagNumber,
           grossWeight: b.grossWeight === null ? "" : b.grossWeight,
           netWeight: b.netWeight === null ? "" : b.netWeight,
           isNew: false
         })));
      }

    } catch (err: any) {
      setError(err.error ? err : { error: "Failed to load lot data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotData();
  }, [jobId, lotId]);

  const handleTakeSample = async () => {
    setSamplingLoading(true);
    try {
      const res = await fetch(`/api/inspection/sampling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          // Removed dummy base parameters per strictly enforcing ERP media rules properly mapping physical files
          beforePhotoUrl: null,
          duringPhotoUrl: null,
          afterPhotoUrl: null
        })
      });
      if (!res.ok) throw await res.json();
      
      fetchLotData();
      toast({ title: "Sample Process Started", status: "success", duration: 3000, position: "top" });
    } catch(err: any) {
       toast({
         title: err.error || "System Error",
         description: err.details || "Could not record sample.",
         status: "error",
         duration: 5000,
         isClosable: true,
         position: "top"
       });
    } finally {
       setSamplingLoading(false);
    }
  };

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const uploadFileTrigger = (category: string) => {
    setUploadingCategory(category);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadingCategory) return;

    try {
      const base64 = await toBase64(file);
      
      const res = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({
           category: uploadingCategory,
           base64,
           fileName: file.name,
           lotId,
           jobId
        })
      });

      if (!res.ok) throw await res.json();
      
      toast({ title: "Photo Uploaded Successfully", status: "success", duration: 3000, position: "top" });
      fetchLotData();
    } catch(err: any) {
      toast({
        title: err.error || "System Error",
        description: err.details || "Could not upload photo natively.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top"
      });
    } finally {
      setUploadingCategory(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddBagRow = () => {
    const nextBagNumber = bags.length > 0 ? Math.max(...bags.map(b => b.bagNumber)) + 1 : 1;
    setBags(prev => [...prev, { bagNumber: nextBagNumber, grossWeight: "", netWeight: "", isNew: true }]);
  };

  const updateBagRow = (idx: number, field: "grossWeight" | "netWeight", value: string) => {
    const updated = [...bags];
    updated[idx][field] = value === "" ? "" : Number(value);
    setBags(updated);
  };

  const handleSaveBags = async () => {
    const newBags = bags.filter(b => b.isNew);
    if (newBags.length === 0) return;
    
    setSavingBags(true);
    try {
      const res = await fetch(`/api/inspection/bags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId,
          bags: newBags.map(b => ({
            grossWeight: b.grossWeight === "" ? undefined : b.grossWeight,
            netWeight: b.netWeight === "" ? undefined : b.netWeight,
          }))
        })
      });
      
      if (!res.ok) throw await res.json();
      
      toast({ title: "Bags saved successfully!", status: "success", duration: 3000, position: "top" });
      fetchLotData(); 
    } catch(err: any) {
      toast({
        title: err.error || "Failed to save bags",
        description: err.details || "A system error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top"
      });
    } finally {
      setSavingBags(false);
    }
  };


  if (loading) return <Center minH="100vh" bg="gray.50"><Spinner size="xl" color="blue.500" /></Center>;
  if (error || !lot) return (
    <Box p={8} bg="red.50" minH="100vh">
      <Heading size="md" color="red.600">{error?.error || "Error"}</Heading>
      <Text color="red.500" mt={2}>{error?.details || "Unknown error occurred"}</Text>
    </Box>
  );

  const canSample = !sampling;
  const unsavedBags = bags.filter(b => b.isNew);

  return (
    <Box bg="gray.50" minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack align="stretch" spacing={6}>
          {/* File input uniquely isolated preventing dom layout shifts */}
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: "none" }} 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />

          <HStack justify="space-between" bg="white" p={6} borderRadius="xl" shadow="sm">
            <Box>
              <Text fontSize="sm" color="blue.500" cursor="pointer" onClick={() => router.push(`/operations/job/${jobId}`)} mb={1}>
                ← Back to Job Detail
              </Text>
              <HStack spacing={4}>
                 <Heading size="lg" color="gray.800">Lot Detail</Heading>
                 <Badge colorScheme="purple" fontSize="md" px={3} py={1} borderRadius="md">
                   {lot.lotNumber}
                 </Badge>
              </HStack>
            </Box>
            
            {canSample ? (
               <Button colorScheme="orange" onClick={handleTakeSample} isLoading={samplingLoading}>
                 Start Sampling
               </Button>
            ) : (
               <Badge colorScheme="green" variant="outline" px={3} py={2} borderRadius="md" display="flex" alignItems="center" gap={2}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                     <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Sampling Active
               </Badge>
            )}
          </HStack>

          <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
            <CardBody p={0}>
              <TableContainer>
                <Table variant="simple" size="md">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th color="gray.500" py={4}>Specification</Th>
                      <Th color="gray.500" py={4}>Value</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Lot ID</Td>
                      <Td fontFamily="mono" fontSize="sm">{lot.id}</Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Lot Number</Td>
                      <Td fontWeight="bold" color="gray.800">{lot.lotNumber}</Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Total Bags</Td>
                      <Td>{lot.totalBags}</Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Gross Weight</Td>
                      <Td>{lot.grossWeightKg ? `${lot.grossWeightKg} kg` : "Pending"}</Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Net Weight</Td>
                      <Td>{lot.netWeightKg ? `${lot.netWeightKg} kg` : "Pending"}</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>

          {/* Sampling Table View */}
          <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
            <CardBody p={0}>
              <TableContainer>
                <Table variant="simple" size="md">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th color="gray.500" py={4} w="30%">Sampling Workflow</Th>
                      <Th color="gray.500" py={4}>Media</Th>
                      <Th color="gray.500" py={4} w="20%">Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">Before Photo</Td>
                      <Td>
                        {sampling?.beforePhotoUrl ? (
                          <Image src={sampling.beforePhotoUrl} alt="Before" maxH="60px" borderRadius="md" fallbackSrc="https://via.placeholder.com/60" />
                        ) : (
                          <Badge colorScheme="gray">Pending Media</Badge>
                        )}
                      </Td>
                      <Td>
                        <Button 
                           size="sm" 
                           colorScheme="blue" 
                           variant="outline" 
                           isDisabled={canSample || !!sampling?.beforePhotoUrl}
                           isLoading={uploadingCategory === "BEFORE"}
                           onClick={() => uploadFileTrigger("BEFORE")}
                        >
                           Upload Photo
                        </Button>
                      </Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">During Photo</Td>
                      <Td>
                        {sampling?.duringPhotoUrl ? (
                          <Image src={sampling.duringPhotoUrl} alt="During" maxH="60px" borderRadius="md" fallbackSrc="https://via.placeholder.com/60" />
                        ) : (
                          <Badge colorScheme="gray">Pending Media</Badge>
                        )}
                      </Td>
                      <Td>
                        <Button 
                           size="sm" 
                           colorScheme="blue" 
                           variant="outline" 
                           isDisabled={canSample || !!sampling?.duringPhotoUrl}
                           isLoading={uploadingCategory === "DURING"}
                           onClick={() => uploadFileTrigger("DURING")}
                        >
                           Upload Photo
                        </Button>
                      </Td>
                    </Tr>
                    <Tr>
                      <Td fontWeight="medium" color="gray.600">After Photo</Td>
                      <Td>
                        {sampling?.afterPhotoUrl ? (
                          <Image src={sampling.afterPhotoUrl} alt="After" maxH="60px" borderRadius="md" fallbackSrc="https://via.placeholder.com/60" />
                        ) : (
                          <Badge colorScheme="gray">Pending Media</Badge>
                        )}
                      </Td>
                      <Td>
                        <Button 
                           size="sm" 
                           colorScheme="blue" 
                           variant="outline" 
                           isDisabled={canSample || !!sampling?.afterPhotoUrl}
                           isLoading={uploadingCategory === "AFTER"}
                           onClick={() => uploadFileTrigger("AFTER")}
                        >
                           Upload Photo
                        </Button>
                      </Td>
                    </Tr>
                  </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>

          {/* BAG CAPTURE TABLE */}
          <Card variant="outline" bg="white" shadow="sm" borderRadius="xl" mt={4}>
            <CardBody p={0}>
              <Box p={5} borderBottomWidth="1px" borderColor="gray.100" display="flex" justifyContent="space-between" alignItems="center">
                 <Heading size="md" color="gray.700">Bag & Weight Capture</Heading>
                 <HStack spacing={3}>
                   <Button variant="outline" colorScheme="blue" size="sm" onClick={handleAddBagRow}>
                     + Add Bag
                   </Button>
                   <Button colorScheme="blue" size="sm" isDisabled={unsavedBags.length === 0} isLoading={savingBags} onClick={handleSaveBags}>
                     Save Bags ({unsavedBags.length})
                   </Button>
                 </HStack>
              </Box>
              <TableContainer>
                <Table variant="simple" size="md">
                   <Thead bg="gray.50">
                     <Tr>
                       <Th w="20%">Bag Number</Th>
                       <Th w="40%">Gross Weight (kg)</Th>
                       <Th w="40%">Net Weight (kg)</Th>
                     </Tr>
                   </Thead>
                   <Tbody>
                     {bags.length === 0 ? (
                       <Tr>
                         <Td colSpan={3} textAlign="center" py={8}>
                           <Text color="gray.400">No bags recorded for this lot yet.</Text>
                         </Td>
                       </Tr>
                     ) : (
                       bags.map((bag, index) => (
                         <Tr key={bag.id || `new-${index}`} bg={bag.isNew ? "blue.50" : "transparent"}>
                           <Td fontWeight="bold">#{bag.bagNumber}</Td>
                           <Td>
                             <Input 
                               type="number" 
                               value={bag.grossWeight} 
                               onChange={(e) => updateBagRow(index, "grossWeight", e.target.value)} 
                               isDisabled={!bag.isNew && savingBags}
                               isReadOnly={!bag.isNew}
                               bg={!bag.isNew ? "gray.50" : "white"}
                               placeholder="e.g. 50.5"
                               size="sm"
                               borderRadius="md"
                             />
                           </Td>
                           <Td>
                             <Input 
                               type="number" 
                               value={bag.netWeight} 
                               onChange={(e) => updateBagRow(index, "netWeight", e.target.value)} 
                               isDisabled={!bag.isNew && savingBags}
                               isReadOnly={!bag.isNew}
                               bg={!bag.isNew ? "gray.50" : "white"}
                               placeholder="e.g. 48.0"
                               size="sm"
                               borderRadius="md"
                             />
                           </Td>
                         </Tr>
                       ))
                     )}
                   </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>

        </VStack>
      </Container>
    </Box>
  );
}
