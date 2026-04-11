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
  { icon: LucideIcon; color: string; bg: string; border: string; badge: string; accent: string }
> = {
  completed: {
    icon: CheckCircle2,
    color: "green.700",
    bg: "bg.surface",
    border: "border.default",
    badge: "Done",
    accent: "green.500",
  },
  current: {
    icon: CircleDot,
    color: "brand.700",
    bg: "bg.surface",
    border: "brand.300",
    badge: "Current",
    accent: "brand.500",
  },
  next: {
    icon: ArrowRight,
    color: "orange.700",
    bg: "bg.surface",
    border: "border.default",
    badge: "Next",
    accent: "orange.400",
  },
  upcoming: {
    icon: Clock3,
    color: "text.secondary",
    bg: "bg.surface",
    border: "border.default",
    badge: "Later",
    accent: "neutral.300",
  },
  blocked: {
    icon: Clock3,
    color: "red.700",
    bg: "bg.surface",
    border: "red.200",
    badge: "Blocked",
    accent: "red.500",
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
    <VStack align="stretch" spacing={compact ? 2.5 : 3}>
      <HStack justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="semibold" color="text.primary">
          {title}
        </Text>
        <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
          {steps.find((step) => step.state === "current")?.label ?? "Ready"}
        </Text>
      </HStack>

      <SimpleGrid minChildWidth={compact ? { base: "100%", md: "11rem", xl: "10rem" } : { base: "100%", md: "14rem" }} spacing={2}>
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
              borderRadius="md"
              px={3}
              py={2}
              minW={0}
              h="full"
              w="full"
              textAlign="left"
              cursor={interactive ? "pointer" : "default"}
              transition="background-color 0.15s ease, border-color 0.15s ease"
              boxShadow="none"
              _hover={interactive ? { bg: "bg.surfaceElevated", borderColor: "border.strong" } : undefined}
              position="relative"
              _before={{
                content: '""',
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "2px",
                bg: theme.accent,
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ base: "column", sm: compact ? "column" : "row" }}
                  justify="space-between"
                  align={{ base: "stretch", sm: compact ? "stretch" : "start" }}
                  spacing={compact ? 1 : 1.5}
                >
                  <HStack spacing={2} align="start" minW={0} flex="1">
                    <Icon as={theme.icon} boxSize={4} color={theme.color} />
                    <Text
                      fontSize="xs"
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
                    fontWeight="semibold"
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
