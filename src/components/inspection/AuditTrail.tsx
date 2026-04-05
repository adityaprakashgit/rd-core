import React from "react";
import {
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Circle,
} from "@chakra-ui/react";
import { AuditLog } from "@/types/inspection";
import { format } from "date-fns";

interface AuditTrailProps {
  logs: AuditLog[];
}

function actorName(log: AuditLog): string {
  return log.user?.profile?.displayName ?? "System";
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500" fontSize="sm">No records.</Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={0} position="relative">
      {logs.map((log, index) => (
        <HStack key={log.id} align="start" spacing={4} pb={4} position="relative">
          {/* Timeline Line */}
          {index < logs.length - 1 && (
            <Box
              position="absolute"
              left="11px"
              top="24px"
              bottom="0"
              width="2px"
              bg="gray.100"
              zIndex={0}
            />
          )}

          <Circle size="24px" bg="purple.50" border="2px solid" borderColor="purple.500" zIndex={1} />
          
          <VStack align="start" spacing={1} flex={1}>
            <HStack justify="space-between" w="full">
              <Text fontWeight="bold" fontSize="sm" color="gray.700">
                {log.entity ? `${log.entity} · ${log.action}` : log.action}
              </Text>
              <Text fontSize="xs" color="gray.400">
                {format(new Date(log.createdAt), "MMM d, HH:mm")}
              </Text>
            </HStack>
            
            <HStack spacing={2}>
              {log.from && (
                <Badge variant="outline" fontSize="2xs" colorScheme="gray">
                  {log.from}
                </Badge>
              )}
              {log.from && log.to && <Text fontSize="xs" color="gray.400">→</Text>}
              {log.to && (
                <Badge variant="solid" fontSize="2xs" colorScheme="purple">
                  {log.to}
                </Badge>
              )}
            </HStack>

            <Text fontSize="xs" color="gray.500 italic">
              {log.notes || "System trace entry"}
            </Text>
            <HStack spacing={2} mt={1} flexWrap="wrap">
              <Badge variant="subtle" colorScheme="purple" fontSize="2xs">
                {actorName(log)}
              </Badge>
              {log.metadata && (
                <Badge variant="outline" colorScheme="gray" fontSize="2xs">
                  Metadata recorded
                </Badge>
              )}
            </HStack>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
};
