"use client";

import type { ReactNode } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Card,
  CardBody,
  type BoxProps,
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
  SimpleGrid,
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

export const enterpriseModalContentProps = {
  borderWidth: "1px",
  borderColor: "border.default",
  borderRadius: "lg" as const,
  overflow: "hidden" as const,
  maxH: "calc(100dvh - 2rem)",
  display: "flex" as const,
  flexDirection: "column" as const,
};

export const enterpriseModalHeaderProps = {
  pb: 3,
};

export const enterpriseModalBodyProps = {
  py: 4,
  overflowY: "auto" as const,
};

export const enterpriseModalFooterProps = {
  borderTopWidth: "1px",
  borderColor: "border.default",
  pt: 3,
};

export const enterpriseDrawerContentProps = {
  borderWidth: "1px",
  borderColor: "border.default",
  borderRadius: "lg" as const,
  overflow: "hidden" as const,
  maxH: "calc(100dvh - 2rem)",
  display: "flex" as const,
  flexDirection: "column" as const,
};

export const enterpriseDrawerHeaderProps = {
  pt: 4,
  pb: 3,
  borderBottomWidth: "1px",
  borderColor: "border.default",
};

export const enterpriseDrawerBodyProps = {
  pb: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
  overflowY: "auto" as const,
};

export const enterpriseDrawerFooterProps = {
  borderTopWidth: "1px",
  borderColor: "border.default",
  pt: 3,
};

const enterpriseStateSurfaceProps = {
  borderWidth: "1px",
  borderColor: "border.default",
  borderRadius: "lg" as const,
  bg: "bg.surface",
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
    <Stack direction={{ base: "column", xl: "row" }} justify="space-between" spacing={3}>
      <VStack align="stretch" spacing={1.5}>
        {breadcrumbs.length > 0 ? (
          <Breadcrumb fontSize={{ base: "xs", md: "sm" }} color="text.secondary">
            {breadcrumbs.map((crumb) => (
              <BreadcrumbItem key={`${crumb.label}-${crumb.href ?? "current"}`}>
                {crumb.href ? <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink> : <Text>{crumb.label}</Text>}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        ) : null}
        <VStack align="stretch" spacing={0.5}>
          <Heading fontSize={{ base: "lg", md: "xl", xl: "2xl" }} lineHeight="short" color="text.primary">
            {title}
          </Heading>
          {subtitle ? (
            <Text color="text.secondary" fontSize={{ base: "xs", md: "sm" }}>
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
      spacing={2}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      bg="bg.surface"
      px={3}
      py={2}
    >
      <HStack spacing={1.5} flexWrap="wrap">
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
      spacing={2}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      bg="bg.surface"
      px={3}
      py={2}
      align={{ base: "stretch", lg: "center" }}
      justify="space-between"
    >
      <HStack spacing={1.5} flexWrap="wrap" flex="1">
        {filters}
      </HStack>
      <HStack spacing={1.5} flexWrap="wrap">
        {search}
        {actions}
      </HStack>
    </Stack>
  );
}

export function EnterpriseStickyTable({ children, ...props }: BoxProps & { children: ReactNode }) {
  return (
    <Box
      {...props}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      overflowX="auto"
      overflowY="hidden"
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

export function EnterpriseSummaryStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    tone?: "default" | "success" | "warning" | "danger";
  }>;
}) {
  return (
    <SimpleGrid columns={{ base: 1, sm: Math.min(items.length, 2), xl: Math.min(items.length, 4) }} spacing={2.5}>
      {items.map((item) => {
        const toneColor =
          item.tone === "success"
            ? "green"
            : item.tone === "warning"
              ? "orange"
              : item.tone === "danger"
                ? "red"
                : "gray";
        return (
          <Box key={item.label} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface" px={3} py={2.5}>
            <Text fontSize={{ base: "2xs", md: "xs" }} textTransform="uppercase" letterSpacing="wide" color="text.muted" fontWeight="bold">
              {item.label}
            </Text>
            <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color={`${toneColor}.700`}>
              {item.value}
            </Text>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

export function EnterpriseRailPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outline" borderRadius="lg">
      <CardBody p={4}>
        <Stack spacing={2.5}>
          <Box>
            <Text fontSize={{ base: "2xs", md: "xs" }} textTransform="uppercase" letterSpacing="wide" color="text.secondary" fontWeight="bold">
              {title}
            </Text>
            {description ? (
              <Text fontSize={{ base: "sm", md: "md" }} color="text.secondary" mt={1}>
                {description}
              </Text>
            ) : null}
          </Box>
          {children}
        </Stack>
      </CardBody>
    </Card>
  );
}

export function DetailTabsLayout({
  tabs,
  rightRail,
  defaultTab = 0,
  activeTabIndex,
  onTabChange,
}: {
  tabs: DetailTab[];
  rightRail?: ReactNode;
  defaultTab?: number;
  activeTabIndex?: number;
  onTabChange?: (index: number) => void;
}) {
  const isControlled = typeof activeTabIndex === "number";

  return (
    <Stack direction={{ base: "column", xl: "row" }} spacing={5} align="start">
      <Box flex="1" minW={0}>
        <Tabs
          variant="line-enterprise"
          isLazy
          defaultIndex={defaultTab}
          index={isControlled ? activeTabIndex : undefined}
          onChange={onTabChange}
        >
          <TabList overflowX="auto" overflowY="hidden">
            {tabs.map((tab) => (
              <Tab key={tab.id} whiteSpace="nowrap" fontSize={{ base: "sm", md: "md" }}>
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
  isSaveDisabled,
  saveLabel = "Save",
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
  saveLabel?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size={size}>
      <DrawerOverlay />
      <DrawerContent {...enterpriseDrawerContentProps}>
        <DrawerCloseButton />
        <DrawerHeader {...enterpriseDrawerHeaderProps}>{title}</DrawerHeader>
        <DrawerBody {...enterpriseDrawerBodyProps}>{children}</DrawerBody>
        <DrawerFooter {...enterpriseDrawerFooterProps}>
          <HStack spacing={2}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {onSave ? (
              <Button onClick={onSave} isLoading={isSaving} isDisabled={isSaveDisabled}>
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
    <Alert status={status} borderRadius="lg" variant="left-accent">
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
    <EnterpriseRailPanel title="Linked Records">
      <VStack align="stretch" spacing={2}>
        {items.length === 0 ? (
          <Text color="text.secondary" fontSize="sm">
            No linked records available.
          </Text>
        ) : (
          items.map((item) => (
            <HStack key={`${item.label}-${item.value}`} justify="space-between" spacing={2.5}>
              <Text color="text.secondary" fontSize="xs">
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
    </EnterpriseRailPanel>
  );
}

export function HistoryTimeline({
  events,
  showPanel = true,
}: {
  events: Array<{ id: string; title: string; subtitle?: string; at?: string }>;
  showPanel?: boolean;
}) {
  const content = (
    <VStack align="stretch" spacing={2}>
      {events.length === 0 ? (
        <EnterpriseEmptyState title="No history yet" description="History entries will appear as actions are completed." />
      ) : (
        events.map((event) => (
          <Box key={event.id} borderLeftWidth="2px" borderColor="border.default" pl={2.5} py={0.5}>
            <HStack justify="space-between" align="start">
              <Text fontWeight="semibold" fontSize={{ base: "sm", md: "md" }} color="text.primary">
                {event.title}
              </Text>
              {event.at ? (
                <Text fontSize={{ base: "2xs", md: "xs" }} color="text.secondary">
                  {event.at}
                </Text>
              ) : null}
            </HStack>
            {event.subtitle ? (
              <Text fontSize={{ base: "2xs", md: "xs" }} color="text.secondary">
                {event.subtitle}
              </Text>
            ) : null}
          </Box>
        ))
      )}
    </VStack>
  );

  if (!showPanel) {
    return content;
  }

  return (
    <EnterpriseRailPanel title="History">
      {content}
    </EnterpriseRailPanel>
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
    <Box {...enterpriseStateSurfaceProps} p={4}>
      <VStack align="start" spacing={2}>
        <Heading fontSize={{ base: "md", md: "lg" }} lineHeight="short">
          {title}
        </Heading>
        <Text color="text.secondary" fontSize={{ base: "sm", md: "md" }}>
          {description}
        </Text>
        {action ? <Box pt={2}>{action}</Box> : null}
      </VStack>
    </Box>
  );
}

export function SettingsSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="bg.surface">
      <Stack
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        align={{ base: "stretch", md: "start" }}
        spacing={3}
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="border.default"
      >
        <VStack align="start" spacing={0.5}>
          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
            {title}
          </Text>
          {description ? (
            <Text fontSize="xs" color="text.secondary">
              {description}
            </Text>
          ) : null}
        </VStack>
        {actions ? <HStack spacing={2}>{actions}</HStack> : null}
      </Stack>
      <Box px={4} py={3}>
        {children}
      </Box>
    </Box>
  );
}
