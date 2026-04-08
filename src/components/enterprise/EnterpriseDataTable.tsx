"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { FilterDefinition, RowActionDefinition, TableColumn } from "@/types/ui-table";

export type RecordCardDefinition<RowType> = {
  title: (row: RowType) => ReactNode;
  subtitle?: (row: RowType) => ReactNode;
  fields?: Array<{
    id: string;
    label: string;
    render: (row: RowType) => ReactNode;
  }>;
};

type EnterpriseDataTableProps<RowType> = {
  rows: RowType[];
  columns: TableColumn<RowType>[];
  rowKey: (row: RowType) => string;
  filters?: FilterDefinition[];
  rowActions?: RowActionDefinition<RowType>[];
  emptyLabel?: string;
  recordCard?: RecordCardDefinition<RowType>;
  rowsPerPage?: {
    mobile?: number;
    desktop?: number;
  };
};

export function EnterpriseDataTable<RowType>({
  rows,
  columns,
  rowKey,
  filters = [],
  rowActions = [],
  emptyLabel = "No records found.",
  recordCard,
  rowsPerPage = { mobile: 3, desktop: 8 },
}: EnterpriseDataTableProps<RowType>) {
  const [mobilePage, setMobilePage] = useState(1);
  const [desktopPage, setDesktopPage] = useState(1);

  const mobileSize = Math.max(rowsPerPage.mobile ?? 3, 1);
  const desktopSize = Math.max(rowsPerPage.desktop ?? 8, 1);

  const mobilePageCount = Math.max(Math.ceil(rows.length / mobileSize), 1);
  const desktopPageCount = Math.max(Math.ceil(rows.length / desktopSize), 1);

  const currentMobilePage = Math.min(mobilePage, mobilePageCount);
  const currentDesktopPage = Math.min(desktopPage, desktopPageCount);

  const mobileRows = useMemo(
    () => rows.slice((currentMobilePage - 1) * mobileSize, currentMobilePage * mobileSize),
    [currentMobilePage, mobileSize, rows]
  );
  const desktopRows = useMemo(
    () => rows.slice((currentDesktopPage - 1) * desktopSize, currentDesktopPage * desktopSize),
    [currentDesktopPage, desktopSize, rows]
  );

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={2} flexWrap="wrap">
        {filters.map((filter) => (
          <Badge
            key={filter.id}
            colorScheme="brand"
            variant="subtle"
            borderRadius="full"
            px={3}
            py={1}
          >
            {filter.label}: {filter.value}
          </Badge>
        ))}
      </HStack>

      <Box borderWidth="1px" borderColor="border.default" borderRadius="2xl" overflow="hidden" bg="bg.surface">
        <VStack display={{ base: "flex", md: "none" }} align="stretch" spacing={3} p={3}>
          {rows.length === 0 ? (
            <Card variant="outline">
              <CardBody>
                <Text py={2} color="text.secondary" textAlign="center">
                  {emptyLabel}
                </Text>
              </CardBody>
            </Card>
          ) : (
            mobileRows.map((row) => (
              <Card key={rowKey(row)} variant="outline">
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <Box>
                      <Text fontSize="md" fontWeight="bold" color="text.primary">
                        {recordCard?.title(row) ?? columns[0]?.render(row)}
                      </Text>
                      {recordCard?.subtitle ? (
                        <Text fontSize="sm" color="text.secondary">
                          {recordCard.subtitle(row)}
                        </Text>
                      ) : null}
                    </Box>

                    <VStack align="stretch" spacing={2}>
                      {(recordCard?.fields ??
                        columns.slice(1, 4).map((column) => ({
                          id: column.id,
                          label: String(column.header),
                          render: column.render,
                        }))).map((field) => (
                        <HStack key={field.id} justify="space-between" align="start" spacing={4}>
                          <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wide">
                            {field.label}
                          </Text>
                          <Text fontSize="sm" color="text.primary" textAlign="right">
                            {field.render(row)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>

                    {rowActions.length > 0 ? (
                      <>
                        <Divider />
                        <HStack spacing={2} flexWrap="wrap">
                          {rowActions.map((action) => (
                            <Button
                              key={action.id}
                              onClick={() => action.onClick(row)}
                              isDisabled={action.isDisabled?.(row) ?? false}
                              size="sm"
                              variant="outline"
                              minH="44px"
                            >
                              {action.label}
                            </Button>
                          ))}
                        </HStack>
                      </>
                    ) : null}
                  </VStack>
                </CardBody>
              </Card>
            ))
          )}
          {rows.length > mobileSize ? (
            <HStack justify="space-between" pt={1}>
              <Button size="sm" variant="outline" onClick={() => setMobilePage((current) => Math.max(1, current - 1))} isDisabled={currentMobilePage <= 1}>
                Prev
              </Button>
              <Text fontSize="xs" color="text.secondary">
                {currentMobilePage}/{mobilePageCount}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMobilePage((current) => Math.min(mobilePageCount, current + 1))}
                isDisabled={currentMobilePage >= mobilePageCount}
              >
                Next
              </Button>
            </HStack>
          ) : null}
        </VStack>

        <TableContainer display={{ base: "none", md: "block" }}>
          <Table variant="simple" size="sm" role="table">
            <Thead>
              <Tr>
                {columns.map((column) => (
                  <Th key={column.id} w={column.width}>
                    {column.header}
                  </Th>
                ))}
                {rowActions.length > 0 ? <Th textAlign="right">Actions</Th> : null}
              </Tr>
            </Thead>
            <Tbody>
              {rows.length === 0 ? (
                <Tr>
                  <Td colSpan={columns.length + (rowActions.length > 0 ? 1 : 0)}>
                    <Text py={4} color="text.secondary" textAlign="center">
                      {emptyLabel}
                    </Text>
                  </Td>
                </Tr>
              ) : (
                desktopRows.map((row) => (
                  <Tr key={rowKey(row)}>
                    {columns.map((column) => (
                      <Td key={column.id} isNumeric={column.isNumeric}>
                        {column.render(row)}
                      </Td>
                    ))}
                    {rowActions.length > 0 ? (
                      <Td textAlign="right">
                        <Menu>
                          <MenuButton
                            as={IconButton}
                            aria-label="Row actions"
                            size="sm"
                            variant="ghost"
                            icon={<MoreHorizontal size={16} />}
                          />
                          <MenuList>
                            {rowActions.map((action) => (
                              <MenuItem
                                key={action.id}
                                onClick={() => action.onClick(row)}
                                isDisabled={action.isDisabled?.(row) ?? false}
                              >
                                {action.label}
                              </MenuItem>
                            ))}
                          </MenuList>
                        </Menu>
                      </Td>
                    ) : null}
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
          {rows.length > desktopSize ? (
            <HStack justify="flex-end" spacing={3} px={4} py={3} borderTopWidth="1px" borderColor="border.default">
              <Button size="sm" variant="outline" onClick={() => setDesktopPage((current) => Math.max(1, current - 1))} isDisabled={currentDesktopPage <= 1}>
                Prev
              </Button>
              <Text fontSize="xs" color="text.secondary" minW="14" textAlign="center">
                {currentDesktopPage}/{desktopPageCount}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDesktopPage((current) => Math.min(desktopPageCount, current + 1))}
                isDisabled={currentDesktopPage >= desktopPageCount}
              >
                Next
              </Button>
            </HStack>
          ) : null}
        </TableContainer>
      </Box>
    </VStack>
  );
}
