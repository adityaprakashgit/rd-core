"use client";

import type { ReactNode } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Heading,
  HStack,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";

type Crumb = {
  label: string;
  href?: string;
};

export function PageIdentityBar({
  title,
  subtitle,
  breadcrumbs = [],
  status,
  right,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  status?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Stack direction={{ base: "column", xl: "row" }} justify="space-between" spacing={4}>
      <VStack align="stretch" spacing={2}>
        {breadcrumbs.length > 0 ? (
          <Breadcrumb fontSize="sm" color="text.secondary">
            {breadcrumbs.map((crumb) => (
              <BreadcrumbItem key={`${crumb.label}-${crumb.href ?? "current"}`}>
                {crumb.href ? <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink> : <Text>{crumb.label}</Text>}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        ) : null}
        <VStack align="stretch" spacing={1}>
          <Heading size="lg" color="text.primary">
            {title}
          </Heading>
          {subtitle ? (
            <Text color="text.secondary" fontSize="sm">
              {subtitle}
            </Text>
          ) : null}
        </VStack>
      </VStack>
      <VStack align={{ base: "stretch", xl: "end" }} spacing={2}>
        {status ? <Box>{status}</Box> : null}
        {right ? <HStack spacing={2} flexWrap="wrap" justify={{ base: "stretch", xl: "end" }}>{right}</HStack> : null}
      </VStack>
    </Stack>
  );
}

export function PageActionBar({
  primaryAction,
  secondaryActions,
}: {
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ base: "column", md: "row" }}
      align={{ base: "stretch", md: "center" }}
      justify="space-between"
      spacing={3}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="xl"
      bg="bg.surface"
      px={4}
      py={3}
    >
      <HStack spacing={2} flexWrap="wrap">
        {secondaryActions}
      </HStack>
      {primaryAction ? <Box>{primaryAction}</Box> : null}
    </Stack>
  );
}

export function FilterSearchStrip({
  search,
  filters,
  actions,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ base: "column", lg: "row" }}
      spacing={3}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="xl"
      bg="bg.surface"
      px={4}
      py={3}
      align={{ base: "stretch", lg: "center" }}
      justify="space-between"
    >
      <HStack spacing={2} flexWrap="wrap" flex="1">
        {filters}
      </HStack>
      <HStack spacing={2} flexWrap="wrap">
        {search}
        {actions}
      </HStack>
    </Stack>
  );
}

export function EnterpriseStickyTable({ children }: { children: ReactNode }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="xl"
      overflow="hidden"
      bg="bg.surface"
      sx={{
        "& table": { fontSize: "sm" },
        "& thead th": {
          position: "sticky",
          top: 0,
          zIndex: 1,
          bg: "bg.surface",
          borderBottomWidth: "1px",
          borderColor: "border.default",
        },
      }}
    >
      {children}
    </Box>
  );
}

type DetailTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export function DetailTabsLayout({
  tabs,
  rightRail,
  defaultTab = 0,
}: {
  tabs: DetailTab[];
  rightRail?: ReactNode;
  defaultTab?: number;
}) {
  return (
    <Stack direction={{ base: "column", xl: "row" }} spacing={5} align="start">
      <Box flex="1" minW={0}>
        <Tabs variant="enclosed" isLazy defaultIndex={defaultTab}>
          <TabList overflowX="auto" overflowY="hidden">
            {tabs.map((tab) => (
              <Tab key={tab.id} whiteSpace="nowrap">
                {tab.label}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {tabs.map((tab) => (
              <TabPanel key={tab.id} px={0} pt={4}>
                {tab.content}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Box>
      {rightRail ? (
        <Box w={{ base: "full", xl: "320px" }} position={{ xl: "sticky" }} top={{ xl: "96px" }}>
          {rightRail}
        </Box>
      ) : null}
    </Stack>
  );
}

export function QuickEditDrawer({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  isSaving,
  saveLabel = "Save",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
}) {
  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>{title}</DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
        <DrawerFooter>
          <HStack spacing={2}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {onSave ? (
              <Button onClick={onSave} isLoading={isSaving}>
                {saveLabel}
              </Button>
            ) : null}
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function ExceptionBanner({
  title,
  description,
  status = "warning",
}: {
  title: string;
  description: string;
  status?: "warning" | "error" | "info" | "success";
}) {
  return (
    <Alert status={status} borderRadius="xl" variant="left-accent">
      <AlertIcon />
      <Box>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Box>
    </Alert>
  );
}

export function LinkedRecordsPanel({
  items,
}: {
  items: Array<{ label: string; value: string; href?: string; tone?: string }>;
}) {
  return (
    <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface" p={4}>
      <VStack align="stretch" spacing={3}>
        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
          Linked Records
        </Text>
        {items.length === 0 ? (
          <Text color="text.secondary" fontSize="sm">
            No linked records available.
          </Text>
        ) : (
          items.map((item) => (
            <HStack key={`${item.label}-${item.value}`} justify="space-between" spacing={3}>
              <Text color="text.secondary" fontSize="sm">
                {item.label}
              </Text>
              {item.href ? (
                <Button as="a" href={item.href} variant="ghost" size="sm">
                  {item.value}
                </Button>
              ) : (
                <Badge colorScheme={(item.tone as string) || "gray"} variant="subtle">
                  {item.value}
                </Badge>
              )}
            </HStack>
          ))
        )}
      </VStack>
    </Box>
  );
}

export function HistoryTimeline({
  events,
}: {
  events: Array<{ id: string; title: string; subtitle?: string; at?: string }>;
}) {
  return (
    <VStack align="stretch" spacing={3}>
      {events.length === 0 ? (
        <EnterpriseEmptyState title="No history yet" description="History entries will appear as actions are completed." />
      ) : (
        events.map((event) => (
          <Box key={event.id} borderLeftWidth="2px" borderColor="border.default" pl={3} py={1}>
            <HStack justify="space-between" align="start">
              <Text fontWeight="semibold" color="text.primary">
                {event.title}
              </Text>
              {event.at ? (
                <Text fontSize="xs" color="text.secondary">
                  {event.at}
                </Text>
              ) : null}
            </HStack>
            {event.subtitle ? (
              <Text fontSize="sm" color="text.secondary">
                {event.subtitle}
              </Text>
            ) : null}
          </Box>
        ))
      )}
    </VStack>
  );
}

export function EnterpriseEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface" p={6}>
      <VStack align="start" spacing={2}>
        <Heading size="sm">{title}</Heading>
        <Text color="text.secondary" fontSize="sm">
          {description}
        </Text>
        {action ? <Box pt={2}>{action}</Box> : null}
      </VStack>
    </Box>
  );
}
