"use client";

import React from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Input,
  SimpleGrid,
  Select,
  Switch,
  HStack,
  Button,
  Divider,
  Icon,
  Badge,
} from "@chakra-ui/react";
import {
  Building2,
  Cpu,
  ShieldCheck,
  Palette,
  Save,
} from "lucide-react";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

export default function SettingsPage() {
  return (
    <ControlTowerLayout>
      <VStack align="stretch" spacing={8}>
        <Box>
           <Heading size="lg" color="gray.800">System Configuration</Heading>
           <Text color="gray.500">Configure global ERP parameters and organizational metadata.</Text>
        </Box>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={8}>
           <Box gridColumn={{ lg: "span 2" }}>
             <VStack align="stretch" spacing={6}>
                {/* Company Info */}
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                   <CardBody>
                      <HStack mb={6}>
                         <Icon as={Building2} color="purple.500" fontSize="20" />
                         <Heading size="sm">Organizational Identity</Heading>
                      </HStack>
                      <VStack spacing={4}>
                         <SimpleGrid columns={2} spacing={4} w="full">
                           <FormControl>
                             <FormLabel fontSize="xs" fontWeight="bold">Company Legal Name</FormLabel>
                             <Input defaultValue="Global Inspection Services Ltd." />
                           </FormControl>
                           <FormControl>
                             <FormLabel fontSize="xs" fontWeight="bold">GSTIN / Tax ID</FormLabel>
                             <Input defaultValue="27AABCU1234F1Z5" />
                           </FormControl>
                         </SimpleGrid>
                         <FormControl>
                           <FormLabel fontSize="xs" fontWeight="bold">Registered Office Address</FormLabel>
                           <Input defaultValue="Tech Park West, Level 12, London, UK" />
                         </FormControl>
                      </VStack>
                   </CardBody>
                </Card>

                {/* Workflow Config */}
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                   <CardBody>
                      <HStack mb={6}>
                         <Icon as={Cpu} color="purple.500" fontSize="20" />
                         <Heading size="sm">Workflow Modules</Heading>
                      </HStack>
                      <VStack align="stretch" spacing={4}>
                         <HStack justify="space-between">
                            <Box>
                               <Text fontWeight="bold" fontSize="sm">Sampling Discipline</Text>
                               <Text fontSize="xs" color="gray.500">Enable physical sample audit trails and media capture</Text>
                            </Box>
                            <Switch colorScheme="purple" defaultChecked />
                         </HStack>
                         <Divider />
                         <HStack justify="space-between">
                            <Box>
                               <Text fontWeight="bold" fontSize="sm">QA Governance</Text>
                               <Text fontSize="xs" color="gray.500">Enable multi-stage approval and operational lockdown</Text>
                            </Box>
                            <Switch colorScheme="purple" defaultChecked />
                         </HStack>
                         <Divider />
                         <HStack justify="space-between">
                            <Box>
                               <Text fontWeight="bold" fontSize="sm">Blockchain Audit</Text>
                               <Text fontSize="xs" color="gray.500">Automated hashing for immutable record keeping</Text>
                            </Box>
                            <Switch colorScheme="purple" />
                         </HStack>
                      </VStack>
                   </CardBody>
                </Card>

                {/* Roles */}
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                   <CardBody>
                      <HStack mb={6}>
                         <Icon as={ShieldCheck} color="purple.500" fontSize="20" />
                         <Heading size="sm">Access & Roles</Heading>
                      </HStack>
                      <SimpleGrid columns={3} spacing={4}>
                         <VStack p={4} border="1px solid" borderColor="gray.100" borderRadius="xl" align="center">
                            <Badge colorScheme="purple">INSPECTOR</Badge>
                            <Text fontSize="10px" color="gray.500" textAlign="center">Field data entry & media sync</Text>
                         </VStack>
                         <VStack p={4} border="1px solid" borderColor="gray.100" borderRadius="xl" align="center">
                            <Badge colorScheme="blue">R&D</Badge>
                            <Text fontSize="10px" color="gray.500" textAlign="center">Lab assay management</Text>
                         </VStack>
                         <VStack p={4} border="1px solid" borderColor="gray.200" bg="gray.50" borderRadius="xl" align="center">
                            <Badge colorScheme="green">ADMIN</Badge>
                            <Text fontSize="10px" color="gray.500" textAlign="center">Full system orchestration</Text>
                         </VStack>
                      </SimpleGrid>
                   </CardBody>
                </Card>
             </VStack>
           </Box>

           <Box>
             <VStack align="stretch" spacing={6}>
                <Card variant="outline" bg="white" shadow="sm" borderRadius="xl">
                   <CardBody>
                      <HStack mb={6}>
                         <Icon as={Palette} color="purple.500" fontSize="20" />
                         <Heading size="sm">System Branding</Heading>
                      </HStack>
                      <VStack spacing={4} align="stretch">
                         <FormControl>
                            <FormLabel fontSize="xs" fontWeight="bold">Primary Interface Color</FormLabel>
                            <Select defaultValue="PURPLE">
                               <option value="PURPLE">Enterprise Purple</option>
                               <option value="BLUE">Trust Blue</option>
                               <option value="GREEN">Eco Green</option>
                            </Select>
                         </FormControl>
                         <Box p={8} border="1px dashed" borderColor="gray.300" borderRadius="xl" textAlign="center">
                            <Text fontSize="xs" color="gray.400">Drag and drop company logo</Text>
                            <Button size="xs" variant="outline" mt={2}>Upload</Button>
                         </Box>
                      </VStack>
                   </CardBody>
                </Card>

                <Button size="lg" colorScheme="purple" leftIcon={<Save size={18} />} w="full">
                   Commit Changes
                </Button>
             </VStack>
           </Box>
        </SimpleGrid>
      </VStack>
    </ControlTowerLayout>
  );
}
