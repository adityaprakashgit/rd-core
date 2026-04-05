"use client";

import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export default function AdminPage() {
  const router = useRouter();

  return (
    <ControlTowerLayout>
      <Stack spacing={6}>
        <PageHeader
          title="Admin"
          subtitle="Company-level governance and controls."
          actions={
            <HStack>
              <Button onClick={() => router.push("/master")}>Open Masters</Button>
              <Button variant="outline" onClick={() => router.push("/settings")}>Open Settings</Button>
            </HStack>
          }
        />

        <Stack direction={{ base: "column", md: "row" }} spacing={4}>
          <Card flex={1}>
            <Text fontSize="sm" color="text.secondary">Access</Text>
            <Text fontSize="2xl" fontWeight="bold">Role-Governed</Text>
            <Text fontSize="sm" color="text.secondary">Modules are filtered by role in navigation and actions.</Text>
          </Card>
          <Card flex={1}>
            <Text fontSize="sm" color="text.secondary">Security</Text>
            <Text fontSize="2xl" fontWeight="bold">Backend-Enforced</Text>
            <Text fontSize="sm" color="text.secondary">Data access is still validated by API authorization rules.</Text>
          </Card>
        </Stack>

        <Card>
          <Box>
            <Text fontSize="sm" color="text.secondary">Quick Access</Text>
            <HStack mt={3} spacing={3} flexWrap="wrap">
              <Button onClick={() => router.push("/userinsp")}>Operations</Button>
              <Button onClick={() => router.push("/userrd")}>R&D</Button>
              <Button onClick={() => router.push("/reports")}>Reports</Button>
            </HStack>
          </Box>
        </Card>
      </Stack>
    </ControlTowerLayout>
  );
}
