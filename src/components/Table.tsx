import { Box, Table as ChakraTable, TableContainer, type TableProps } from "@chakra-ui/react";

export type AppTableProps = TableProps;

export function Table({ children, ...props }: AppTableProps) {
  return (
    <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" overflow="hidden" bg="bg.surface">
      <TableContainer overflowX="auto">
        <ChakraTable size="sm" variant="simple" {...props}>
          {children}
        </ChakraTable>
      </TableContainer>
    </Box>
  );
}
