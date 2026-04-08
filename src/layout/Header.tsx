"use client";

import {
  Avatar,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Box,
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { normalizeRole } from "@/lib/role";
import type { BreadcrumbDefinition, PageDefinition } from "@/lib/ui-navigation";

export type HeaderProps = {
  role: string | null | undefined;
  displayName: string;
  companyName: string;
  onLogout: () => void;
  viewMode: "my" | "all";
  onViewModeChange: (mode: "my" | "all") => void;
  page: PageDefinition;
  breadcrumbs: BreadcrumbDefinition[];
  searchPlaceholder?: string;
};

export function Header({
  role,
  displayName,
  companyName,
  onLogout,
  viewMode,
  onViewModeChange,
  page,
  breadcrumbs,
  searchPlaceholder,
}: HeaderProps) {
  const router = useRouter();
  const normalizedRole = normalizeRole(role);
  const isAdmin = normalizedRole === "ADMIN";

  return (
    <Stack
      as="header"
      direction="row"
      justify="space-between"
      align="center"
      gap={{ base: 2, md: 3 }}
      px={{ base: 3, md: 4, lg: 6 }}
      py={{ base: 1.5, md: 2, lg: 3 }}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      position="sticky"
      top={0}
      zIndex={30}
      shadow="xs"
      backdropFilter="blur(18px)"
    >
      <HStack spacing={2} align="start" minW={0} flex={1}>
        <Box minW={0} pr={1}>
          <Text fontSize={{ base: "lg", md: "lg" }} fontWeight="bold" color="text.primary" noOfLines={1}>
            {page.title}
          </Text>
          <Breadcrumb
            mt={1.5}
            spacing={1}
            separator={<ChevronRight size={14} color="var(--chakra-colors-gray-400)" />}
            fontSize="xs"
            color="text.secondary"
            display={{ base: "none", lg: "flex" }}
          >
            {breadcrumbs.map((crumb, index) => (
              <BreadcrumbItem key={`${crumb.label}-${index}`} isCurrentPage={!crumb.href}>
                {crumb.href ? (
                  <BreadcrumbLink onClick={() => router.push(crumb.href ?? "/")} color="text.secondary">
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <Text as="span" color="text.primary" fontWeight="semibold">
                    {crumb.label}
                  </Text>
                )}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        </Box>
      </HStack>

      <HStack spacing={1.5} flexWrap="nowrap" justify="flex-end" align="center">
        <Input
          size="md"
          placeholder={searchPlaceholder ?? `Search in ${companyName}`}
          minW={{ base: "full", lg: "320px" }}
          maxW={{ base: "full", xl: "420px" }}
          aria-label="Global search"
          bg="bg.surface"
          display={{ base: "none", xl: "block" }}
        />

        {isAdmin ? (
          <Select
            size="sm"
            maxW={{ base: "full", sm: "44" }}
            value={viewMode}
            onChange={(event) => onViewModeChange(event.target.value === "all" ? "all" : "my")}
            aria-label="Workspace view"
            bg="bg.surface"
            display={{ base: "none", lg: "block" }}
          >
            <option value="my">My Tasks</option>
            <option value="all">Company View</option>
          </Select>
        ) : null}

        <Menu>
          <MenuButton
            as={Button}
            size="sm"
            variant="outline"
            leftIcon={<Avatar size="2xs" name={displayName} />}
            px={{ base: 2, md: 2.5 }}
            minW={{ base: "40px", md: "44px" }}
            maxW={{ base: "40px", md: "44px", lg: "220px" }}
          >
            <Text noOfLines={1} display={{ base: "none", lg: "inline" }}>
              {displayName}
            </Text>
          </MenuButton>
          <MenuList>
            <Box px={3} py={2}>
              <Text fontSize="sm" fontWeight="semibold">{displayName}</Text>
              <Text fontSize="xs" color="text.secondary">{normalizedRole ?? "VIEWER"}</Text>
            </Box>
            <MenuItem icon={<LogOut size={14} />} onClick={onLogout}>
              Logout
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Stack>
  );
}
