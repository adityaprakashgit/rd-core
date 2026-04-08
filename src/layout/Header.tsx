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
  VStack,
} from "@chakra-ui/react";
import { ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchPayload, setSearchPayload] = useState<{
    groups: {
      lots: Array<{ id: string; label: string; subLabel: string; href: string }>;
      jobs: Array<{ id: string; label: string; subLabel: string; href: string }>;
      samples: Array<{ id: string; label: string; subLabel: string; href: string }>;
      packets: Array<{ id: string; label: string; subLabel: string; href: string }>;
      dispatches: Array<{ id: string; label: string; subLabel: string; href: string }>;
      certificates: Array<{ id: string; label: string; subLabel: string; href: string }>;
    };
  } | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!searchRef.current) {
        return;
      }
      if (!searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2) {
      setSearchPayload(null);
      setLoadingSearch(false);
      return;
    }

    let active = true;
    setLoadingSearch(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error("Search request failed.");
        }
        const payload = (await response.json()) as {
          groups: {
            lots: Array<{ id: string; label: string; subLabel: string; href: string }>;
            jobs: Array<{ id: string; label: string; subLabel: string; href: string }>;
            samples: Array<{ id: string; label: string; subLabel: string; href: string }>;
            packets: Array<{ id: string; label: string; subLabel: string; href: string }>;
            dispatches: Array<{ id: string; label: string; subLabel: string; href: string }>;
            certificates: Array<{ id: string; label: string; subLabel: string; href: string }>;
          };
        };
        if (active) {
          setSearchPayload(payload);
        }
      } catch {
        if (active) {
          setSearchPayload(null);
        }
      } finally {
        if (active) {
          setLoadingSearch(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchText]);

  const groupedResults = useMemo(
    () =>
      searchPayload
        ? [
            { title: "Lots", items: searchPayload.groups.lots },
            { title: "Jobs", items: searchPayload.groups.jobs },
            { title: "Samples", items: searchPayload.groups.samples },
            { title: "Packets", items: searchPayload.groups.packets },
            { title: "Dispatches", items: searchPayload.groups.dispatches },
            { title: "Certificates", items: searchPayload.groups.certificates },
          ].filter((group) => group.items.length > 0)
        : [],
    [searchPayload]
  );

  const firstResultHref = groupedResults[0]?.items?.[0]?.href ?? null;

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
        <Box position="relative" ref={searchRef} display={{ base: "none", xl: "block" }}>
          <Input
            size="md"
            placeholder={searchPlaceholder ?? `Search in ${companyName}`}
            minW={{ base: "full", lg: "320px" }}
            maxW={{ base: "full", xl: "420px" }}
            aria-label="Global search"
            bg="bg.surface"
            value={searchText}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setSearchText(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && firstResultHref) {
                event.preventDefault();
                router.push(firstResultHref);
                setSearchOpen(false);
              }
              if (event.key === "Escape") {
                setSearchOpen(false);
              }
            }}
          />
          {searchOpen ? (
            <Box
              position="absolute"
              top="calc(100% + 8px)"
              left={0}
              right={0}
              bg="bg.surface"
              borderWidth="1px"
              borderColor="border.default"
              borderRadius="xl"
              shadow="lg"
              maxH="420px"
              overflowY="auto"
              zIndex={50}
              p={3}
            >
              {loadingSearch ? (
                <Text fontSize="sm" color="text.secondary">Searching...</Text>
              ) : groupedResults.length === 0 ? (
                <Text fontSize="sm" color="text.secondary">No matching records.</Text>
              ) : (
                <VStack align="stretch" spacing={3}>
                  {groupedResults.map((group) => (
                    <Box key={group.title}>
                      <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold" mb={1}>
                        {group.title}
                      </Text>
                      <VStack align="stretch" spacing={1}>
                        {group.items.map((item) => (
                          <Button
                            key={item.id}
                            size="sm"
                            variant="ghost"
                            justifyContent="space-between"
                            onClick={() => {
                              router.push(item.href);
                              setSearchOpen(false);
                            }}
                            aria-label={`${group.title}: ${item.label}`}
                          >
                            <Text noOfLines={1}>{item.label}</Text>
                            <Text noOfLines={1} fontSize="xs" color="text.secondary">
                              {item.subLabel}
                            </Text>
                          </Button>
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          ) : null}
        </Box>

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
