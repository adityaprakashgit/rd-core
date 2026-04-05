"use client";

import {
  Avatar,
  Box,
  Divider,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import {
  FlaskConical,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { normalizeRole, type NormalizedRole } from "@/lib/role";

type ModuleItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: NormalizedRole[];
  activeMatch?: RegExp;
};

const modules: ModuleItem[] = [
  { label: "Dashboard", href: "/userinsp", icon: LayoutDashboard, roles: ["ADMIN", "OPERATIONS", "VIEWER"] },
  { label: "Operations", href: "/userinsp", icon: Shield, roles: ["ADMIN", "OPERATIONS", "VIEWER"], activeMatch: /^\/userinsp/ },
  { label: "R&D", href: "/userrd", icon: FlaskConical, roles: ["ADMIN", "RND", "VIEWER"], activeMatch: /^\/userrd/ },
  { label: "Reports", href: "/reports", icon: ReceiptText, roles: ["ADMIN", "OPERATIONS", "RND", "VIEWER"], activeMatch: /^\/reports/ },
  { label: "Admin", href: "/admin", icon: User, roles: ["ADMIN"], activeMatch: /^\/admin/ },
  { label: "Masters", href: "/master", icon: User, roles: ["ADMIN", "OPERATIONS"], activeMatch: /^\/master/ },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] , activeMatch: /^\/settings/},
];

export type SidebarProps = {
  role: string | null | undefined;
  companyName: string;
  displayName: string;
  onLogout: () => void;
};

export function Sidebar({ role, companyName, displayName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const normalizedRole = normalizeRole(role);
  const visibleModules = modules.filter((item) => (normalizedRole ? item.roles.includes(normalizedRole) : false));

  return (
    <Box bg="bg.surface" borderRightWidth="1px" borderColor="border.default" w={{ base: "full", md: 72 }} h="full" px={4} py={4}>
      <VStack align="stretch" spacing={6} h="full">
        <VStack align="start" spacing={0} px={1}>
          <Text fontSize="sm" fontWeight="bold" color="text.primary">
            Inspection ERP
          </Text>
          <Text fontSize="xs" color="text.secondary" noOfLines={1}>
            {companyName}
          </Text>
        </VStack>

        <Divider borderColor="border.default" />

        <VStack align="stretch" spacing={1.5} flex={1}>
          {visibleModules.map((item) => {
            const active = item.activeMatch ? item.activeMatch.test(pathname) : pathname === item.href;
            return (
              <Box
                key={item.label}
                role="button"
                tabIndex={0}
                onClick={() => router.push(item.href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(item.href);
                  }
                }}
                px={3}
                py={2.5}
                borderRadius="lg"
                bg={active ? "brand.50" : "transparent"}
                borderWidth="1px"
                borderColor={active ? "brand.200" : "transparent"}
                color={active ? "brand.700" : "text.primary"}
                _hover={{ bg: active ? "brand.50" : "neutral.100" }}
              >
                <HStack spacing={3}>
                  <Icon as={item.icon} boxSize={4} />
                  <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"}>
                    {item.label}
                  </Text>
                </HStack>
              </Box>
            );
          })}
        </VStack>

        <Box p={3} borderWidth="1px" borderColor="border.default" borderRadius="lg" bg="neutral.50">
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
      </VStack>
    </Box>
  );
}
