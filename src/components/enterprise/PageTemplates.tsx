"use client";

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Card,
  CardBody,
  Grid,
  GridItem,
  HStack,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  MOBILE_ACTION_RAIL_BOTTOM_OFFSET,
  mobileBottomInteractiveSx,
  mobileBottomSurfaceStyle,
} from "@/lib/mobile-bottom-ui";

export function RegistryPageTemplate({
  summary,
  filters,
  content,
}: {
  summary?: ReactNode;
  filters?: ReactNode;
  content: ReactNode;
}) {
  return (
    <VStack align="stretch" spacing={4}>
      {summary ? <Card variant="outline"><CardBody>{summary}</CardBody></Card> : null}
      {filters ? <Card variant="outline"><CardBody>{filters}</CardBody></Card> : null}
      <Card variant="outline"><CardBody>{content}</CardBody></Card>
    </VStack>
  );
}

export function WorkbenchPageTemplate({
  left,
  right,
  rightLabel = "Evidence & Governance",
}: {
  left: ReactNode;
  right: ReactNode;
  rightLabel?: string;
}) {
  return (
    <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 2fr) minmax(320px, 1fr)" }} gap={4}>
      <GridItem>{left}</GridItem>
      <GridItem display={{ base: "none", xl: "block" }}>
        <Card variant="outline" position="sticky" top="96px">
          <CardBody>
            <Stack spacing={2.5}>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                {rightLabel}
              </Text>
              {right}
            </Stack>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem display={{ base: "block", xl: "none" }}>
        <Card variant="outline">
          <CardBody p={0}>
            <Accordion allowToggle defaultIndex={[0]}>
              <AccordionItem border="none">
                <AccordionButton px={3} py={3} borderRadius="lg" minH="48px">
                  <Box flex="1" textAlign="left">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                      {rightLabel}
                    </Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={3} pb={3}>
                  {right}
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </CardBody>
        </Card>
      </GridItem>
    </Grid>
  );
}

export function ConfigurationPageTemplate({
  sections,
}: {
  sections: Array<{ id: string; title: string; description?: string; content: ReactNode }>;
}) {
  return (
    <VStack align="stretch" spacing={3}>
      {sections.map((section) => (
        <Card key={section.id} variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="md" fontWeight="bold" color="text.primary">
                  {section.title}
                </Text>
              </Box>
              {section.content}
            </VStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
}

export function DocumentPageTemplate({
  controls,
  preview,
}: {
  controls: ReactNode;
  preview: ReactNode;
}) {
  return (
    <Grid templateColumns={{ base: "1fr", xl: "360px 1fr" }} gap={4}>
      <GridItem>
        <Card variant="outline">
          <CardBody>{controls}</CardBody>
        </Card>
      </GridItem>
      <GridItem>
        <Card variant="outline">
          <CardBody>{preview}</CardBody>
        </Card>
      </GridItem>
    </Grid>
  );
}

export function FilterRail({ children }: { children: ReactNode }) {
  return (
    <HStack
      spacing={2}
      px={3}
      py={2}
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.rail"
      borderRadius="lg"
      flexWrap="wrap"
    >
      {children}
    </HStack>
  );
}

export function MobileActionRail({ children }: { children: ReactNode }) {
  return (
    <Box
      display={{ base: "block", lg: "none" }}
      position={{ base: "fixed", lg: "static" }}
      left={{ base: 3 }}
      right={{ base: 3 }}
      transform={{ base: "none", lg: "none" }}
      w={{ base: "calc(100% - 24px)", lg: "full" }}
      bottom={{ base: MOBILE_ACTION_RAIL_BOTTOM_OFFSET, lg: "auto" }}
      zIndex={{ base: 30, lg: "auto" }}
      pointerEvents={{ base: "none", lg: "auto" }}
    >
      <Stack
        direction={{ base: "column", sm: "row" }}
        spacing={2}
        px={2}
        py={2}
        align="stretch"
        flexWrap="wrap"
        w="full"
        {...mobileBottomSurfaceStyle}
        pointerEvents="auto"
        sx={{
          ...mobileBottomInteractiveSx,
          "& .chakra-button, & .chakra-icon-button": {
            width: "100%",
            minH: "44px",
            whiteSpace: "normal",
            textAlign: "center",
            lineHeight: "1.2",
          },
          "@media (min-width: 30em)": {
            "& .chakra-button, & .chakra-icon-button": {
              width: "auto",
              flex: "1 1 calc(50% - 12px)",
            },
          },
        }}
      >
        {children}
      </Stack>
    </Box>
  );
}

export function ProcessFlowLayout({
  header,
  tracker,
  activeStep,
  context,
  contextLabel = "Context",
  mobileActions,
}: {
  header?: ReactNode;
  tracker: ReactNode;
  activeStep: ReactNode;
  context: ReactNode;
  contextLabel?: string;
  mobileActions?: ReactNode;
}) {
  return (
    <VStack align="stretch" spacing={4}>
      {header ?? null}
      <Card variant="outline">
        <CardBody>{tracker}</CardBody>
      </Card>
      <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 2fr) minmax(320px, 1fr)" }} gap={4}>
        <GridItem>{activeStep}</GridItem>
        <GridItem display={{ base: "none", xl: "block" }}>
          <Card variant="outline" position="sticky" top="96px">
            <CardBody>
              <Stack spacing={2.5}>
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                  {contextLabel}
                </Text>
                {context}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem display={{ base: "block", xl: "none" }}>
          <Card variant="outline">
            <CardBody p={0}>
              <Accordion allowToggle>
                <AccordionItem border="none">
                  <AccordionButton px={3} py={3} borderRadius="lg" minH="48px">
                    <Box flex="1" textAlign="left">
                      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
                        {contextLabel}
                      </Text>
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel px={3} pb={3}>
                    {context}
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
      {mobileActions ? <MobileActionRail>{mobileActions}</MobileActionRail> : null}
    </VStack>
  );
}
