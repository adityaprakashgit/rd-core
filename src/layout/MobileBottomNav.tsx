"use client";

import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Icon,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { LogOut, User2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { normalizeRole } from "@/lib/role";
import {
  MOBILE_NAV_BOTTOM_OFFSET,
  mobileBottomInteractiveSx,
  mobileBottomSurfaceStyle,
} from "@/lib/mobile-bottom-ui";
import {
  getMobileMoreModules,
  getMobileTabDefinitions,
} from "@/lib/ui-navigation";

type MobileBottomNavProps = {
  role: string | null | undefined;
  displayName: string;
  companyName: string;
  pathname: string;
  onLogout: () => void;
};

export function MobileBottomNav({
  role,
  displayName,
  companyName,
  pathname,
  onLogout,
}: MobileBottomNavProps) {
  const router = useRouter();
  const normalizedRole = normalizeRole(role);
  const tabs = getMobileTabDefinitions(normalizedRole);
  const moreModules = getMobileMoreModules(normalizedRole);
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Box
        as="nav"
        aria-label="Primary mobile navigation"
        display={{ base: "block", md: "none" }}
        position="fixed"
        left={3}
        right={3}
        bottom={MOBILE_NAV_BOTTOM_OFFSET}
        zIndex={40}
        {...mobileBottomSurfaceStyle}
      >
        <HStack justify="space-between" px={1.5} py={1.5} sx={mobileBottomInteractiveSx}>
          {tabs.map((tab) => {
            const isActive = tab.activeMatch.test(pathname);
            const isHighlighted = isActive || (tab.isMore && isOpen);

            return (
              <Button
                key={tab.id}
                onClick={() => (tab.isMore ? onOpen() : tab.href && router.push(tab.href))}
                variant={isHighlighted ? "solid" : "ghost"}
                colorScheme={isHighlighted ? "brand" : undefined}
                flex="1"
                minW={0}
                h="56px"
                px={1}
                borderRadius="xl"
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                _hover={isHighlighted ? undefined : { bg: "neutral.100", color: "text.primary" }}
                _active={isHighlighted ? undefined : { bg: "neutral.150", color: "text.primary" }}
                _focusVisible={{ boxShadow: "0 0 0 2px var(--chakra-colors-brand-200)" }}
                sx={
                  isHighlighted
                    ? {
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.24)",
                        "& svg, & p": { color: "white" },
                      }
                    : {
                        color: "text.secondary",
                        "& svg": { color: "text.secondary" },
                      }
                }
              >
                <Stack spacing={0.5} align="center" minW={0}>
                  <Icon as={tab.icon} boxSize="18px" strokeWidth={2.25} />
                  <Text fontSize="2xs" fontWeight="semibold" noOfLines={1}>
                    {tab.label}
                  </Text>
                </Stack>
              </Button>
            );
          })}
        </HStack>
      </Box>

      <Drawer isOpen={isOpen} placement="bottom" onClose={onClose}>
        <DrawerOverlay bg="blackAlpha.500" />
        <DrawerContent borderTopRadius="3xl">
          <DrawerHeader borderBottomWidth="1px" borderColor="border.default" pt={5}>
            <Stack spacing={0.5}>
              <Text fontSize="lg" fontWeight="bold">
                Workspace menu
              </Text>
              <Text fontSize="sm" color="text.secondary">
                Secondary modules, profile details, and session actions.
              </Text>
            </Stack>
          </DrawerHeader>
          <DrawerBody pb="calc(env(safe-area-inset-bottom, 0px) + 24px)">
            <Stack spacing={5} py={4}>
              <Box borderWidth="1px" borderColor="border.default" borderRadius="2xl" bg="bg.surface" p={4}>
                <HStack align="start" spacing={3}>
                  <Box
                    w={11}
                    h={11}
                    borderRadius="2xl"
                    bg="brand.50"
                    color="brand.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <User2 size={18} />
                  </Box>
                  <Stack spacing={0.5}>
                    <Text fontWeight="bold">{displayName}</Text>
                    <Text fontSize="sm" color="text.secondary">
                      {companyName}
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      {normalizedRole ?? "VIEWER"}
                    </Text>
                  </Stack>
                </HStack>
              </Box>

              <Stack spacing={3}>
                {moreModules.map((module) => {
                  const isActive = module.activeMatch.test(pathname);

                  return (
                    <Button
                      key={module.id}
                      onClick={() => {
                        onClose();
                        router.push(module.href);
                      }}
                      justifyContent="space-between"
                      variant={isActive ? "solid" : "outline"}
                      h="56px"
                      leftIcon={<module.icon size={18} />}
                    >
                      {module.label}
                    </Button>
                  );
                })}
              </Stack>

              <Button
                variant="outline"
                colorScheme="red"
                h="56px"
                leftIcon={<LogOut size={18} />}
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                Logout
              </Button>
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
