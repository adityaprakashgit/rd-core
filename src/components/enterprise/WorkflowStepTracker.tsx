"use client";

import { Box, HStack, Icon, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react";
import { CheckCircle2, CircleDot, Clock3, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type WorkflowStepState = "completed" | "current" | "next" | "upcoming" | "blocked";

export type WorkflowStep = {
  id: string;
  label: string;
  state: WorkflowStepState;
  timestamp?: string | null;
  onClick?: () => void;
};

const STEP_THEME: Record<
  WorkflowStepState,
  { icon: LucideIcon; color: string; bg: string; border: string; badge: string }
> = {
  completed: {
    icon: CheckCircle2,
    color: "green.700",
    bg: "green.50",
    border: "green.200",
    badge: "Done",
  },
  current: {
    icon: CircleDot,
    color: "brand.700",
    bg: "brand.50",
    border: "brand.200",
    badge: "Current",
  },
  next: {
    icon: ArrowRight,
    color: "orange.700",
    bg: "orange.50",
    border: "orange.200",
    badge: "Next",
  },
  upcoming: {
    icon: Clock3,
    color: "gray.600",
    bg: "bg.surface",
    border: "border.default",
    badge: "Later",
  },
  blocked: {
    icon: Clock3,
    color: "red.700",
    bg: "red.50",
    border: "red.200",
    badge: "Blocked",
  },
};

export function WorkflowStepTracker({
  steps,
  title = "Workflow",
  compact = false,
}: {
  steps: WorkflowStep[];
  title?: string;
  compact?: boolean;
}) {
  return (
    <VStack align="stretch" spacing={compact ? 3 : 4}>
      <HStack justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="semibold" color="text.primary">
          {title}
        </Text>
        <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
          {steps.find((step) => step.state === "current")?.label ?? "Ready"}
        </Text>
      </HStack>

      <SimpleGrid
        minChildWidth={compact ? { base: "100%", md: "11rem", xl: "10rem" } : { base: "100%", md: "14rem" }}
        spacing={3}
      >
        {steps.map((step) => {
          const theme = STEP_THEME[step.state];
          const interactive = typeof step.onClick === "function";
          return (
            <Box
              key={step.id}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={step.onClick}
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        step.onClick?.();
                      }
                    }
                  : undefined
              }
              borderWidth="1px"
              borderColor={theme.border}
              bg={theme.bg}
              borderRadius="xl"
              px={4}
              py={3}
              minW={0}
              h="full"
              w="full"
              textAlign="left"
              cursor={interactive ? "pointer" : "default"}
              transition="transform 0.15s ease, box-shadow 0.15s ease"
              _hover={interactive ? { transform: "translateY(-1px)", boxShadow: "sm" } : undefined}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ base: "column", sm: compact ? "column" : "row" }}
                  justify="space-between"
                  align={{ base: "stretch", sm: compact ? "stretch" : "start" }}
                  spacing={compact ? 1.5 : 2}
                >
                  <HStack spacing={2} align="start" minW={0} flex="1">
                    <Icon as={theme.icon} boxSize={4.5} color={theme.color} />
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color="text.primary"
                      lineHeight="1.35"
                      whiteSpace="normal"
                      overflowWrap="anywhere"
                    >
                      {step.label}
                    </Text>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color={theme.color}
                    fontWeight="bold"
                    textTransform="uppercase"
                    whiteSpace="normal"
                    overflowWrap="anywhere"
                    textAlign={{ base: "left", sm: compact ? "left" : "right" }}
                  >
                    {theme.badge}
                  </Text>
                </Stack>
                {step.timestamp ? (
                  <Text fontSize="xs" color="text.secondary">
                    {step.timestamp}
                  </Text>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
