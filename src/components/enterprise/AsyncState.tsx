"use client";

import { Button, Center, HStack, SimpleGrid, Skeleton, Stack, Text, VStack } from "@chakra-ui/react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Card } from "@/components/Card";

const stateCardProps = {
  borderWidth: "1px",
  borderColor: "border.default",
  borderRadius: "lg" as const,
  bg: "bg.surface",
};

export function PageSkeleton({
  cards = 4,
  rows = 2,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <VStack align="stretch" spacing={5}>
      <SimpleGrid columns={{ base: 1, md: Math.min(cards, 4) }} spacing={4}>
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index}>
            <Stack spacing={3}>
              <Skeleton h="3" w="32" />
              <Skeleton h="8" w="16" />
              <Skeleton h="3" w="24" />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <Stack spacing={3}>
            <Skeleton h="5" w="40" />
            <Skeleton h="4" />
            <Skeleton h="4" />
            <Skeleton h="4" w="80%" />
          </Stack>
        </Card>
      ))}
    </VStack>
  );
}

export function InlineErrorState({
  title = "Unable to load this page",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <Card {...stateCardProps}>
      <Center py={8}>
        <VStack spacing={3} maxW="lg" textAlign="center">
          <AlertTriangle size={22} />
          <Text fontWeight="bold" color="text.primary">
            {title}
          </Text>
          <Text fontSize="sm" color="text.secondary">
            {description}
          </Text>
          {onRetry ? (
            <Button leftIcon={<RefreshCw size={14} />} onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </VStack>
      </Center>
    </Card>
  );
}

export function TopErrorBanner({
  title = "Action blocked",
  description,
  onDismiss,
}: {
  title?: string;
  description: string;
  onDismiss?: () => void;
}) {
  return (
    <Card {...stateCardProps} bg="red.50" borderColor="red.200">
      <HStack justify="space-between" align="start" spacing={4} px={4} py={3}>
        <HStack align="start" spacing={3}>
          <AlertTriangle size={18} color="#C53030" />
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold" color="red.800">
              {title}
            </Text>
            <Text fontSize="sm" color="red.700">
              {description}
            </Text>
          </VStack>
        </HStack>
        {onDismiss ? (
          <Button size="sm" variant="ghost" colorScheme="red" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </HStack>
    </Card>
  );
}

export function EmptyWorkState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card {...stateCardProps}>
      <Center py={10}>
        <VStack spacing={3} maxW="md" textAlign="center">
          <Text fontWeight="bold" color="text.primary">
            {title}
          </Text>
          <Text fontSize="sm" color="text.secondary">
            {description}
          </Text>
          {action}
        </VStack>
      </Center>
    </Card>
  );
}

export function SectionHint({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <HStack justify="space-between" spacing={4}>
      <Text fontSize="sm" color="text.secondary">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color="text.primary">
        {value}
      </Text>
    </HStack>
  );
}
