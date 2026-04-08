"use client";

import {
  Avatar,
  Box,
  Button,
  Divider,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { normalizeRole, type NormalizedRole } from "@/lib/role";
import { MODULE_DEFINITIONS } from "@/lib/ui-navigation";

export type SidebarProps = {
  role: string | null | undefined;
  companyName: string;
  displayName: string;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function Sidebar({
  role,
  companyName,
  displayName,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const normalizedRole = normalizeRole(role);
  const visibleModules = MODULE_DEFINITIONS.filter((item) =>
    normalizedRole ? item.roles.includes(normalizedRole as NormalizedRole) : false
  );

  return (
    <Box
      bg="bg.surface"
      borderRightWidth="1px"
      borderColor="border.default"
      w={{ base: "full", lg: collapsed ? 20 : 64 }}
      transition="width 180ms ease"
      h="full"
      px={collapsed ? 2 : 3}
      py={4}
    >
      <VStack align="stretch" spacing={6} h="full">
        <HStack justify="space-between" px={1}>
          <VStack align="start" spacing={0} minW={0}>
            <Text fontSize={collapsed ? "xs" : "sm"} fontWeight="bold" color="text.primary" noOfLines={1}>
              Enterprise Ops
            </Text>
            {!collapsed ? (
              <Text fontSize="xs" color="text.secondary" noOfLines={1}>
                {companyName}
              </Text>
            ) : null}
          </VStack>
          {onToggleCollapse ? (
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              size="xs"
              variant="ghost"
              icon={collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              onClick={onToggleCollapse}
              display={{ base: "none", md: "inline-flex" }}
            />
          ) : null}
        </HStack>

        <Divider borderColor="border.default" />

        <VStack align="stretch" spacing={1.5} flex={1}>
          {visibleModules.map((item) => {
            const active = item.activeMatch.test(pathname);
            const content = (
              <HStack spacing={3} justify={collapsed ? "center" : "start"}>
                <Icon as={item.icon} boxSize={4} />
                {!collapsed ? (
                  <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"}>
                    {item.label}
                  </Text>
                ) : null}
              </HStack>
            );
            return (
              <Button
                key={item.label}
                onClick={() => router.push(item.href)}
                px={3}
                py={2}
                borderRadius="lg"
                w="full"
                h="auto"
                justifyContent={collapsed ? "center" : "flex-start"}
                bg={active ? "brand.50" : "transparent"}
                borderWidth="1px"
                borderColor={active ? "brand.200" : "transparent"}
                color={active ? "brand.700" : "text.primary"}
                _hover={{ bg: active ? "brand.50" : "neutral.100" }}
                variant="ghost"
                aria-current={active ? "page" : undefined}
              >
                {collapsed ? (
                  <Tooltip label={item.label} placement="right">
                    <Box>{content}</Box>
                  </Tooltip>
                ) : (
                  content
                )}
              </Button>
            );
          })}
        </VStack>

        <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="neutral.50">
          <HStack spacing={3}>
            <Avatar size="sm" name={displayName} bg="brand.500" />
            {!collapsed ? (
              <VStack align="start" spacing={0} flex={1} minW={0}>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary" noOfLines={1}>
                  {displayName}
                </Text>
                <Text fontSize="xs" color="text.secondary" textTransform="uppercase">
                  {normalizedRole ?? "VIEWER"}
                </Text>
              </VStack>
            ) : null}
            <Tooltip label="Logout" placement="top">
              <IconButton aria-label="Logout" variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onLogout} />
            </Tooltip>
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
}
