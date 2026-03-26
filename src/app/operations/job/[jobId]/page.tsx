"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Box, Container, Heading, SimpleGrid, Card, CardBody, Text, 
  Badge, HStack, VStack, Spinner, Center, Button, Modal, 
  ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  ModalCloseButton, FormControl, FormLabel, Input, useToast, Icon
} from "@chakra-ui/react";

type Lot = {
  id: string;
  jobId: string;
  lotNumber: string;
  totalBags: number;
  createdAt: string;
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const toast = useToast();

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{error: string, details?: string} | null>(null);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [lotNumber, setLotNumber] = useState("");
  const [totalBags, setTotalBags] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLots = async () => {
    try {
      const res = await fetch(`/api/inspection/lots?jobId=${jobId}`);
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setLots(data);
    } catch (err: any) {
      setError(err.error ? err : { error: "Failed to load lots" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, [jobId]);

  const handleAddLot = async () => {
    if (!lotNumber || !totalBags) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/inspection/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          lotNumber,
          totalBags: parseInt(totalBags) || 1
        })
      });

      if (!res.ok) throw await res.json();
      
      toast({ title: "Lot created successfully", status: "success", duration: 3000 });
      setIsOpen(false);
      setLotNumber("");
      setTotalBags("1");
      
      // Refresh lots
      fetchLots();
    } catch (err: any) {
      toast({
        title: err.error || "Failed to add lot",
        description: err.details,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <Center minH="100vh" bg="gray.50"><Spinner size="xl" color="blue.500" /></Center>;

  if (error) return (
    <Box p={8} bg="red.50" minH="100vh">
      <Heading size="md" color="red.600">{error.error}</Heading>
      <Text color="red.500" mt={2}>{error.details}</Text>
    </Box>
  );

  return (
    <Box bg="gray.50" minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack align="stretch" spacing={6}>
          <HStack justify="space-between" bg="white" p={6} borderRadius="xl" shadow="sm">
            <Box>
              <Text fontSize="sm" color="blue.500" cursor="pointer" onClick={() => router.push('/operations')} mb={1}>
                ← Back to Jobs
              </Text>
              <Heading size="lg" color="gray.800">Job Detail: {jobId.substring(0,8)}</Heading>
            </Box>
            <Button colorScheme="blue" onClick={() => setIsOpen(true)}>
              + New Lot
            </Button>
          </HStack>

          {lots.length === 0 ? (
            <Box p={12} bg="white" borderRadius="xl" shadow="sm" textAlign="center" borderStyle="dashed" borderWidth="1px">
              <Text color="gray.500" mb={4}>No lots have been created for this job yet.</Text>
              <Button colorScheme="blue" variant="outline" onClick={() => setIsOpen(true)}>Create First Lot</Button>
            </Box>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
              {lots.map(lot => (
                <Card 
                  key={lot.id} 
                  variant="outline" 
                  borderRadius="xl"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ shadow: "md", borderColor: "blue.300", transform: "translateY(-2px)" }}
                  onClick={() => router.push(`/operations/job/${jobId}/lot/${lot.id}`)}
                >
                  <CardBody p={5}>
                    <HStack justify="space-between" mb={4}>
                      <Badge colorScheme="purple" fontSize="sm" px={2} py={1} borderRadius="md">
                        {lot.lotNumber}
                      </Badge>
                      <Text fontSize="xs" color="gray.400">{new Date(lot.createdAt).toLocaleDateString()}</Text>
                    </HStack>
                    <HStack borderTopWidth="1px" borderColor="gray.100" pt={3} justify="space-between">
                      <Text fontSize="sm" color="gray.600">Total Bags</Text>
                      <Text fontWeight="bold" color="gray.800">{lot.totalBags}</Text>
                    </HStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </VStack>

        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} isCentered>
          <ModalOverlay backdropFilter="blur(4px)" />
          <ModalContent borderRadius="xl">
            <ModalHeader>Create New Lot</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Lot Number</FormLabel>
                  <Input 
                    placeholder="e.g. LOT-A01" 
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    focusBorderColor="blue.400"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Total Bags</FormLabel>
                  <Input 
                    type="number"
                    placeholder="e.g. 100" 
                    value={totalBags}
                    onChange={(e) => setTotalBags(e.target.value)}
                    focusBorderColor="blue.400"
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button colorScheme="blue" onClick={handleAddLot} isLoading={isSubmitting}>
                Create Lot
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
}
