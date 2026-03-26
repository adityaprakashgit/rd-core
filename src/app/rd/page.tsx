"use client";

import { useState } from "react";
import { 
  Box, 
  Heading, 
  Button, 
  VStack, 
  Input, 
  FormControl, 
  FormLabel,
  Container,
  Text,
  useToast,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  HStack
} from "@chakra-ui/react";

export default function RdPage() {
  const [clientName, setClientName] = useState("");
  const [commodity, setCommodity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const createJob = async () => {
    if (!clientName || !commodity) {
      toast({
        title: "Missing Fields",
        description: "Please fill out all required fields.",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inspection/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: "test",
          userId: "user1",
          clientName,
          commodity,
        }),
      });

      const data = await res.json();
      
      toast({
        title: "Job Created Successfully",
        description: `Reference Number: ${data.jobReferenceNumber || 'N/A'}`,
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
      
      setClientName("");
      setCommodity("");
    } catch (error) {
      toast({
        title: "Error Creating Job",
        description: "There was a problem communicating with the server.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" py={12}>
      <Container maxW="lg">
        <VStack spacing={8} align="stretch">
          
          <Box textAlign="center">
            <Box display="inline-block" p={3} bg="purple.50" color="purple.600" borderRadius="xl" mb={4}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </Box>
            <Heading size="xl" color="gray.800" fontWeight="bold" letterSpacing="tight">
              RD Dashboard
            </Heading>
            <Text color="gray.500" mt={2} fontSize="md">
              Manage inspection requests and dispatch workflows
            </Text>
          </Box>

          <Card variant="outline" borderRadius="xl" shadow="sm" bg="white">
            <CardHeader pb={0}>
              <Heading size="md" color="gray.700">Create Inspection Job</Heading>
              <Text fontSize="sm" color="gray.500" mt={1}>Enter client details to initiate a new job</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={5} mt={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.700">Client Name</FormLabel>
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    size="lg"
                    borderRadius="lg"
                    bg="gray.50"
                    _focus={{ bg: "white", borderColor: "purple.400", boxShadow: "0 0 0 1px var(--chakra-colors-purple-400)" }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.700">Commodity</FormLabel>
                  <Input
                    placeholder="e.g. Wheat, Iron Ore"
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    size="lg"
                    borderRadius="lg"
                    bg="gray.50"
                    _focus={{ bg: "white", borderColor: "purple.400", boxShadow: "0 0 0 1px var(--chakra-colors-purple-400)" }}
                  />
                </FormControl>
              </VStack>
            </CardBody>
            <Divider color="gray.100" />
            <CardFooter bg="gray.50" borderBottomRadius="xl" justifyContent="flex-end">
              <HStack spacing={3}>
                <Button 
                  variant="ghost" 
                  colorScheme="gray" 
                  onClick={() => { setClientName(""); setCommodity(""); }}
                  isDisabled={isSubmitting}
                >
                  Clear
                </Button>
                <Button 
                  colorScheme="purple" 
                  size="md" 
                  px={6} 
                  onClick={createJob}
                  isLoading={isSubmitting}
                  loadingText="Creating..."
                  borderRadius="lg"
                  shadow="sm"
                >
                  Create Job
                </Button>
              </HStack>
            </CardFooter>
          </Card>

        </VStack>
      </Container>
    </Box>
  );
}
