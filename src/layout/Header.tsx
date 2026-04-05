"use client";

import {
  Avatar,
  Box,
  Button,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LogOut, Menu as MenuIcon } from "lucide-react";

import { normalizeRole } from "@/lib/role";

export type HeaderProps = {
  role: string | null | undefined;
  displayName: string;
  companyName: string;
  onOpenNav: () => void;
  onLogout: () => void;
  viewMode: "my" | "all";
  onViewModeChange: (mode: "my" | "all") => void;
};

export function Header({
  role,
  displayName,
  companyName,
  onOpenNav,
  onLogout,
  viewMode,
  onViewModeChange,
}: HeaderProps) {
  const normalizedRole = normalizeRole(role);
  const isAdmin = normalizedRole === "ADMIN";

  return (
    <Stack
      as="header"
      direction={{ base: "column", md: "row" }}
      justify="space-between"
      align={{ base: "stretch", md: "center" }}
      gap={3}
      px={{ base: 4, md: 6 }}
      py={3}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <HStack spacing={3}>
        <IconButton aria-label="Open navigation" variant="outline" icon={<MenuIcon size={16} />} onClick={onOpenNav} display={{ base: "inline-flex", md: "none" }} />
        <Box minW={0}>
          <Text fontSize="sm" fontWeight="semibold" color="text.primary" noOfLines={1}>
            Inspection ERP
          </Text>
          <Text fontSize="xs" color="text.secondary" noOfLines={1}>
            {companyName}
          </Text>
        </Box>
      </HStack>

      <HStack spacing={2} flexWrap="wrap" justify={{ base: "flex-start", md: "flex-end" }}>
        {isAdmin ? (
          <Select
            size="sm"
            maxW={{ base: "full", sm: "44" }}
            value={viewMode}
            onChange={(event) => onViewModeChange(event.target.value === "all" ? "all" : "my")}
            aria-label="Workspace view"
            bg="bg.surface"
          >
            <option value="my">My Tasks</option>
            <option value="all">Company View</option>
          </Select>
        ) : null}

        <Menu>
          <MenuButton as={Button} variant="outline" leftIcon={<Avatar size="2xs" name={displayName} />}>
            {displayName}
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
