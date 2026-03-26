"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  Bell,
  Building2,
  LayoutDashboard,
  Menu as MenuIcon,
  Plus,
  Puzzle,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  FlaskConical,
  LogOut,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { normalizeRole } from "@/lib/role";
import { useWorkspaceView } from "@/context/WorkspaceViewContext";

type NavItemProps = {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
};

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/userinsp" },
  { icon: Building2, label: "Inspection", href: "/userinsp", activeMatch: /^\/userinsp/ },
  { icon: FlaskConical, label: "R&D", href: "/userrd", activeMatch: /^\/userrd/ },
  { icon: Puzzle, label: "Playground", href: "/playground", activeMatch: /^\/playground/ },
  { icon: ReceiptText, label: "Packing List", href: "/reports", activeMatch: /^\/reports/ },
  { icon: User, label: "Master", href: "/master", activeMatch: /^\/master(\/|$)/ },
  { icon: Settings, label: "Settings", href: "/settings", activeMatch: /^\/settings/ },
  { icon: SlidersHorizontal, label: "Master Playground", href: "/masterplayground", activeMatch: /^\/masterplayground/ },
];

function NavItem({ icon, label, href, active }: NavItemProps) {
  const router = useRouter();

  return (
    <Link
      onClick={() => router.push(href)}
      w="full"
      _hover={{ textDecoration: "none" }}
    >
      <HStack
        px={3}
        py={2.5}
        borderRadius="xl"
        spacing={3}
        cursor="pointer"
        bg={active ? "teal.600" : "transparent"}
        color={active ? "white" : "gray.700"}
        _hover={{ bg: active ? "teal.600" : "gray.100" }}
        transition="all 0.15s ease"
      >
        <Icon as={icon} fontSize="18" />
        <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"}>
          {label}
        </Text>
      </HStack>
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <Box
      bg="white"
      borderRightWidth="1px"
      borderColor="gray.200"
      w={{ base: "full", md: 72 }}
      h="full"
      px={4}
      py={4}
    >
      <VStack align="stretch" spacing={6} h="full">
        <HStack px={1} spacing={3}>
          <Box
            w="10"
            h="10"
            borderRadius="xl"
            bg="teal.600"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxShadow="sm"
          >
            <Sparkles size={20} />
          </Box>
          <VStack align="start" spacing={0}>
            <Text fontSize="sm" fontWeight="bold" color="gray.900">
              Aditya Test
            </Text>
            <Text fontSize="xs" color="gray.500">
              Inspection Control Tower
            </Text>
          </VStack>
        </HStack>

        <Divider />

        <VStack align="stretch" spacing={2} flex={1}>
          <Text px={1} fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="widest">
            Navigation
          </Text>
          {navItems.map((item) => {
            const active = item.activeMatch ? item.activeMatch.test(pathname) : pathname === item.href;
            return (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={active}
              />
            );
          })}
        </VStack>

        <Box
          p={3}
          borderRadius="2xl"
          bg="gray.50"
          borderWidth="1px"
          borderColor="gray.200"
        >
          <HStack spacing={3}>
            <Avatar size="sm" name="Aditya Prakash" bg="teal.500" />
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                Aditya Prakash
              </Text>
              <Text fontSize="xs" color="gray.500">
                Control Tower Admin
              </Text>
            </VStack>
            <Tooltip label="Sign out" placement="top">
              <IconButton
                aria-label="sign out"
                variant="ghost"
                size="sm"
                icon={<LogOut size={16} />}
              />
            </Tooltip>
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
}

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();
  const { viewMode, setViewMode } = useWorkspaceView();
  const [session, setSession] = useState<{
    role: string;
    profile: {
      displayName: string;
      companyName: string | null;
      jobTitle: string | null;
      avatarUrl: string | null;
    } | null;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/session/me");
        if (!res.ok) {
          return;
        }

        const data: {
          role: string;
          profile: {
            displayName: string;
            companyName: string | null;
            jobTitle: string | null;
            avatarUrl: string | null;
          } | null;
        } = await res.json();

        if (active) {
          setSession(data);
        }
      } catch {
        if (active) {
          setSession(null);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const view = new URL(window.location.href).searchParams.get("view") === "all" ? "all" : "my";
    setViewMode(view);
  }, [pathname, setViewMode]);

  const isAdmin = normalizeRole(session?.role) === "ADMIN";
  const isWorkspacePage = pathname.startsWith("/userinsp");
  const displayName = session?.profile?.displayName ?? "Current User";
  const companyName = session?.profile?.companyName ?? "Company Workspace";

  const onViewChange = useMemo(
    () => (nextView: "my" | "all") => {
      if (!isAdmin) {
        return;
      }

      setViewMode(nextView);
      router.push(nextView === "all" ? `${pathname}?view=all` : pathname);
    },
    [isAdmin, pathname, router, setViewMode]
  );

  return (
    <Box minH="100vh" bg="gray.50">
      <Box display={{ base: "none", md: "block" }} position="fixed" insetY={0} left={0} zIndex={20}>
        <Sidebar />
      </Box>

        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <Sidebar />
        </DrawerContent>
      </Drawer>

      <Box ml={{ base: 0, md: 72 }} minH="100vh">
        <Flex
          as="header"
          position="sticky"
          top={0}
          zIndex={10}
          minH="16"
          align="center"
          justify="space-between"
          gap={3}
          flexWrap={{ base: "wrap", md: "nowrap" }}
          py={{ base: 2, md: 0 }}
          px={{ base: 4, md: 6 }}
          bg="white"
          borderBottomWidth="1px"
          borderColor="gray.200"
        >
          <HStack spacing={3} minW={0} flex={1}>
            <IconButton
              display={{ base: "inline-flex", md: "none" }}
              aria-label="open navigation"
              icon={<MenuIcon />}
              variant="ghost"
              onClick={onOpen}
            />
            <VStack align="start" spacing={0} minW={0}>
              <Text fontSize="xs" color="gray.500" display={{ base: "none", sm: "block" }}>
                Enterprise Inspection Infrastructure
              </Text>
              <Text fontSize={{ base: "xs", sm: "sm" }} fontWeight="semibold" color="gray.900" noOfLines={1}>
                Control Tower
              </Text>
            </VStack>
          </HStack>

          <HStack spacing={{ base: 2, md: 3 }} flexWrap="wrap" justify="flex-end">
            <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={1} display={{ base: "none", sm: "inline-flex" }}>
              LIVE CONTROL
            </Badge>
            {isAdmin && isWorkspacePage ? (
              <Select
                size="sm"
                maxW="40"
                w={{ base: "full", sm: "40" }}
                value={viewMode}
                onChange={(event) => onViewChange(event.target.value === "all" ? "all" : "my")}
                borderRadius="xl"
                bg="white"
                aria-label="workspace view"
              >
                <option value="my">My Tasks</option>
                <option value="all">Company View</option>
              </Select>
            ) : null}
            <Button
              leftIcon={<Plus size={16} />}
              colorScheme="teal"
              size="sm"
              borderRadius="xl"
              px={{ base: 3, sm: 4 }}
              onClick={() => router.push("/rd")}
            >
              <Text display={{ base: "none", sm: "inline" }}>Create Job</Text>
              <Text display={{ base: "inline", sm: "none" }}>Create</Text>
            </Button>
            <Tooltip label="Notifications">
              <IconButton
                aria-label="notifications"
                variant="ghost"
                icon={<Bell size={18} />}
              />
            </Tooltip>
            <Menu>
              <MenuButton>
                <HStack
                  pl={{ base: 1.5, sm: 2 }}
                  pr={{ base: 1.5, sm: 3 }}
                  py={1.5}
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="full"
                  spacing={2}
                  bg="white"
                >
                  <Avatar size="xs" name={displayName} />
                  <Text fontSize="sm" color="gray.700" fontWeight="medium" display={{ base: "none", sm: "block" }}>
                    {displayName}
                  </Text>
                </HStack>
              </MenuButton>
              <MenuList>
                <Box px={3} py={2}>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                    {displayName}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {companyName}
                  </Text>
                </Box>
                <MenuItem icon={<User size={14} />}>Profile</MenuItem>
                <MenuItem icon={<User size={14} />}>Master</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Box px={{ base: 4, md: 6 }} py={6} maxW="7xl" mx="auto">
          {children}
        </Box>
      </Box>
    </Box>
  );
}
