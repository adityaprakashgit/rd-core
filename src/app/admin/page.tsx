"use client";

import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { Card } from "@/components/Card";
import { ConfigurationPageTemplate, MobileActionRail } from "@/components/enterprise/PageTemplates";

export default function AdminPage() {
  const router = useRouter();

  return (
    <ControlTowerLayout>
      <Stack spacing={6}>
        <HStack justify="end" spacing={3} display={{ base: "none", md: "flex" }}>
          <Button onClick={() => router.push("/master")}>Open Reference Data</Button>
          <Button variant="outline" onClick={() => router.push("/settings")}>Open Workspace Configuration</Button>
        </HStack>

        <ConfigurationPageTemplate
          sections={[
            {
              id: "access",
              title: "Access Governance",
              description: "Role-driven module and action visibility for enterprise-grade least privilege.",
              content: (
                <Card>
                  <Box>
                    <Text fontSize="sm" color="text.secondary">Access Model</Text>
                    <Text fontSize="2xl" fontWeight="bold">Role-Governed</Text>
                  </Box>
                </Card>
              ),
            },
            {
              id: "security",
              title: "Security Enforcement",
              description: "Validation at both UI and API boundaries for resilient enterprise operations.",
              content: (
                <Card>
                  <Box>
                    <Text fontSize="sm" color="text.secondary">Security Posture</Text>
                    <Text fontSize="2xl" fontWeight="bold">Backend-Enforced</Text>
                  </Box>
                </Card>
              ),
            },
            {
              id: "quick-access",
              title: "Operational Shortcuts",
              description: "Direct links to high-frequency governance and execution destinations.",
              content: (
                <HStack mt={1} spacing={3} flexWrap="wrap">
                  <Button onClick={() => router.push("/userinsp")}>Open Control Center</Button>
                  <Button onClick={() => router.push("/operations")}>Open Execution</Button>
                  <Button onClick={() => router.push("/userrd")}>Open Lab & Analysis</Button>
                  <Button onClick={() => router.push("/reports")}>Open Documents & Reports</Button>
                </HStack>
              ),
            },
          ]}
        />

        <MobileActionRail>
          <Button flex="1" onClick={() => router.push("/master")}>
            Reference Data
          </Button>
          <Button flex="1" variant="outline" onClick={() => router.push("/settings")}>
            Workspace Config
          </Button>
        </MobileActionRail>
      </Stack>
    </ControlTowerLayout>
  );
}
