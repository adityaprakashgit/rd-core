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
import {
  getVisibleModules,
  isModuleActive,
  resolveModuleHref,
} from "@/lib/ui-navigation";

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
  const visibleModules = getVisibleModules(normalizedRole as NormalizedRole | null);

  const collapsedWidth = 20;
  const expandedWidth = 60;

  return (
    <Box
      bg="bg.surface"
      borderRightWidth="1px"
      borderColor="border.default"
      w={{ base: "full", lg: collapsed ? collapsedWidth : expandedWidth }}
      transition="width 180ms ease"
      h="full"
      px={collapsed ? 1.5 : 2.5}
      py={3}
      overflow="hidden"
    >
      <VStack align="stretch" spacing={4} h="full">
        {collapsed ? (
          <VStack align="stretch" spacing={2} px={0.5}>
            {onToggleCollapse ? (
              <Tooltip label="Expand sidebar" placement="right">
                <IconButton
                  aria-label="Expand sidebar"
                  size="sm"
                  variant="outline"
                  icon={<ChevronRight size={16} />}
                  onClick={onToggleCollapse}
                  display={{ base: "none", md: "inline-flex" }}
                  w="full"
                />
              </Tooltip>
            ) : null}
            <Tooltip label={companyName} placement="right">
              <Avatar size="xs" name={companyName} bg="brand.500" alignSelf="center" />
            </Tooltip>
          </VStack>
        ) : (
          <HStack justify="space-between" px={1}>
            <VStack align="start" spacing={0} minW={0}>
              <Text fontSize="sm" fontWeight="bold" color="text.primary" noOfLines={1}>
                {companyName}
              </Text>
              <Text fontSize="xs" color="text.secondary" noOfLines={1}>
                {displayName}
              </Text>
            </VStack>
            {onToggleCollapse ? (
              <IconButton
                aria-label="Collapse sidebar"
                size="xs"
                variant="ghost"
                icon={<ChevronLeft size={14} />}
                onClick={onToggleCollapse}
                display={{ base: "none", md: "inline-flex" }}
              />
            ) : null}
          </HStack>
        )}

        <Divider borderColor="border.default" />

        <VStack align="stretch" spacing={1} flex={1}>
          {visibleModules.map((item) => {
            const active = isModuleActive(item, pathname, normalizedRole as NormalizedRole | null);
            const destination = resolveModuleHref(item, normalizedRole as NormalizedRole | null);
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
                onClick={() => router.push(destination)}
                px={collapsed ? 0 : 2.5}
                py={collapsed ? 0 : 1.5}
                borderRadius={collapsed ? "xl" : "lg"}
                w="full"
                h={collapsed ? 12 : "auto"}
                minH={collapsed ? 12 : undefined}
                justifyContent={collapsed ? "center" : "flex-start"}
                bg={active ? "brand.100" : "transparent"}
                borderWidth="1px"
                borderColor={active ? "brand.300" : "transparent"}
                color={active ? "brand.700" : "text.primary"}
                _hover={{ bg: active ? "brand.50" : "neutral.100" }}
                variant="ghost"
                aria-current={active ? "page" : undefined}
              >
                {collapsed ? (
                  <Tooltip label={item.label} placement="right">
                    <Box display="inline-flex" alignItems="center" justifyContent="center" w="full">
                      {content}
                    </Box>
                  </Tooltip>
                ) : (
                  content
                )}
              </Button>
            );
          })}
        </VStack>

        {collapsed ? (
          <Box p={1} borderWidth="1px" borderColor="border.default" borderRadius="md" bg="neutral.25" overflow="hidden">
            <HStack justify="space-between" spacing={1}>
              <Tooltip label={displayName} placement="right">
                <Avatar size="sm" name={displayName} bg="brand.500" />
              </Tooltip>
              <Tooltip label="Logout" placement="right">
                <IconButton aria-label="Logout" variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onLogout} />
              </Tooltip>
            </HStack>
          </Box>
        ) : (
          <Box p={2.5} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="neutral.25">
            <HStack spacing={3}>
              <Avatar size="sm" name={displayName} bg="brand.500" />
              <VStack align="start" spacing={0} flex={1} minW={0}>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary" noOfLines={1}>
                  {displayName}
                </Text>
                <Text fontSize="xs" color="text.secondary" textTransform="uppercase">
                  {normalizedRole ?? "VIEWER"}
                </Text>
              </VStack>
              <Tooltip label="Logout" placement="top">
                <IconButton aria-label="Logout" variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onLogout} />
              </Tooltip>
            </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
