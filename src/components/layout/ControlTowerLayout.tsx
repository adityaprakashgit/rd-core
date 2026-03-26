import React from "react";
import {
  Box,
  Flex,
  Icon,
  Text,
  VStack,
  HStack,
  Divider,
  IconButton,
  Tooltip,
  useDisclosure,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  Link,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
} from "@chakra-ui/react";
import {
  LayoutDashboard,
  Search,
  FlaskConical,
  BarChart3,
  Settings,
  Menu as MenuIcon,
  Plus,
  Bell,
  LogOut,
  User,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const NavItem = ({ icon, label, href, active }: NavItemProps) => {
  const router = useRouter();
  
  return (
    <Link
      onClick={() => router.push(href)}
      style={{ textDecoration: "none" }}
      _focus={{ boxShadow: "none" }}
      w="full"
    >
      <HStack
        bg={active ? "purple.600" : "transparent"}
        color={active ? "white" : "gray.300"}
        p={3}
        borderRadius="lg"
        spacing={4}
        cursor="pointer"
        _hover={{
          bg: active ? "purple.600" : "whiteAlpha.100",
          color: "white",
        }}
        transition="all 0.2s"
      >
        <Icon as={icon} fontSize="20" />
        <Text fontWeight="medium" fontSize="sm">{label}</Text>
      </HStack>
    </Link>
  );
};

const Sidebar = ({ ...rest }: { onClose?: () => void } & any) => {
  const pathname = usePathname();


  return (
    <Box
      bg="#1A1B23"
      w={{ base: "full", md: 64 }}
      pos="fixed"
      h="full"
      p={4}
      {...rest}
    >
      <VStack h="full" align="stretch" spacing={8}>
        <Flex px={2} h="20" align="center" justify="start">
          <Icon as={LayoutDashboard} color="purple.500" fontSize="32" mr={3} />
          <VStack align="start" spacing={0}>
            <Text fontSize="xl" fontWeight="bold" color="white" letterSpacing="tight">
              CORE ERP
            </Text>
            <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase">
              Control Tower
            </Text>
          </VStack>
        </Flex>

        <VStack align="stretch" spacing={2} flex={1}>
          <Text px={2} fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase" mb={2}>
            Main Menu
          </Text>
          <NavItem icon={LayoutDashboard} label="Control Tower" href="/userinsp" active={pathname === "/userinsp"} />
          <NavItem icon={Search} label="Operations Audit" href="/operations" active={pathname.startsWith("/operations")} />
          <NavItem icon={FlaskConical} label="R&D Analytics" href="/userrd" active={pathname.startsWith("/userrd")} />
          <NavItem icon={BarChart3} label="Audit Reports" href="/reports" active={pathname.startsWith("/reports")} />
          
          <Divider borderColor="whiteAlpha.100" my={4} />
          
          <Text px={2} fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase" mb={2}>
            System
          </Text>
          <NavItem icon={Settings} label="Settings" href="/settings" active={pathname === "/settings"} />
        </VStack>

        <Box p={2}>
          <HStack
            p={3}
            bg="whiteAlpha.50"
            borderRadius="xl"
            spacing={3}
            cursor="pointer"
            _hover={{ bg: "whiteAlpha.100" }}
          >
            <Avatar size="sm" name="Admin User" bg="purple.500" />
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="xs" color="white" fontWeight="bold">Admin User</Text>
              <Text fontSize="10px" color="gray.500">System Administrator</Text>
            </VStack>
            <Icon as={LogOut} color="gray.500" fontSize="xs" />
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();

  return (
    <Box minH="100vh" bg="#F7F9FC">
      <Sidebar onClose={() => onClose} display={{ base: "none", md: "block" }} />
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent>
          <Sidebar onClose={onClose} />
        </DrawerContent>
      </Drawer>

      <Box ml={{ base: 0, md: 64 }} transition="0.3s ease">
        {/* Header */}
        <Flex
          h="16"
          align="center"
          px={{ base: 4, md: 8 }}
          bg="white"
          borderBottomWidth="1px"
          borderColor="gray.200"
          justify="space-between"
          pos="sticky"
          top={0}
          zIndex={10}
        >
          <IconButton
            display={{ base: "flex", md: "none" }}
            onClick={onOpen}
            variant="outline"
            aria-label="open menu"
            icon={<MenuIcon />}
          />

          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.400" display={{ base: "none", md: "block" }}>
              Enterprise Inspection Infrastructure &copy; 2026
            </Text>
          </HStack>

          <HStack spacing={{ base: 2, md: 4 }}>
            <Button
              leftIcon={<Plus size={18} />}
              colorScheme="purple"
              size="sm"
              borderRadius="lg"
              onClick={() => router.push("/operations")}
              display={{ base: "none", sm: "flex" }}
            >
              New Job
            </Button>
            <IconButton size="sm" variant="ghost" icon={<Bell size={20} />} aria-label="Notifications" />
            <Menu>
              <MenuButton>
                <Avatar size="sm" name="Admin" bg="purple.500" />
              </MenuButton>
              <MenuList>
                <MenuItem icon={<User size={16} />}>Profile</MenuItem>
                <MenuItem icon={<Settings size={16} />}>Config</MenuItem>
                <Divider />
                <MenuItem icon={<LogOut size={16} />} color="red.500">Sign Out</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        {/* Content Area */}
        <Box p={{ base: 4, md: 8 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
