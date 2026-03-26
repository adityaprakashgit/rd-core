"use client";

import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  VStack, 
  Icon,
  SimpleGrid
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Search, FlaskConical } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <Box 
      minH="100vh" 
      bgGradient="linear(to-br, #1A1B23, #2D3748)" 
      display="flex" 
      alignItems="center" 
      justifyContent="center"
      p={6}
    >
      <Container maxW="3xl">
        <VStack spacing={8} textAlign="center" bg="whiteAlpha.100" backdropFilter="blur(20px)" p={12} borderRadius="3xl" shadow="2xl" borderWidth="1px" borderColor="whiteAlpha.200">
          <VStack spacing={4}>
            <Box p={4} bg="purple.500" borderRadius="2xl" color="white" shadow="lg" transform="rotate(-10deg)">
               <Icon as={LayoutDashboard} fontSize="32" />
            </Box>
            <Heading size="2xl" color="white" fontWeight="extrabold" letterSpacing="tight">
              CONTROL TOWER
            </Heading>
            <Text fontSize="lg" color="gray.400" maxW="lg">
              Enterprise Resource Planning & Inspection Infrastructure
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={6} w="full" pt={4}>
            <RoleCard 
              title="Operations" 
              desc="Field Inspection & Sampling" 
              onClick={() => router.push("/userinsp")} 
              colorScheme="purple"
              icon={Search}
            />
            <RoleCard 
              title="Laboratory" 
              desc="R&D Assay & Analytics" 
              onClick={() => router.push("/userrd")} 
              colorScheme="blue"
              icon={FlaskConical}
            />
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

function RoleCard({ title, desc, onClick, colorScheme, icon }: any) {
  return (
    <Box 
      as="button"
      onClick={onClick}
      p={8} 
      bg="whiteAlpha.50" 
      borderRadius="2xl" 
      borderWidth="1px" 
      borderColor="whiteAlpha.100"
      shadow="sm"
      transition="all 0.3s"
      _hover={{ transform: "translateY(-8px)", shadow: "dark-lg", borderColor: `${colorScheme}.400`, bg: "whiteAlpha.100" }}
      textAlign="left"
      w="full"
      display="flex"
      flexDirection="column"
      gap={4}
      color="white"
    >
      <Box w={12} h={12} borderRadius="xl" bg={`${colorScheme}.500`} color="white" display="flex" alignItems="center" justifyContent="center" shadow="md">
        <Icon as={icon} fontSize="24" />
      </Box>
      <Box>
        <Heading size="md" mb={1}>{title}</Heading>
        <Text fontSize="sm" color="gray.500">{desc}</Text>
      </Box>
    </Box>
  );
}
