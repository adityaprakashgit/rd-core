import { Box, Heading, Stack, Text, type StackProps } from "@chakra-ui/react";

export type SectionProps = StackProps & {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function Section({ title, subtitle, actions, children, ...props }: SectionProps) {
  return (
    <Stack spacing={4} {...props}>
      <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "center" }} spacing={3}>
        <Box>
          <Heading size="sm">{title}</Heading>
          {subtitle ? <Text fontSize="sm" color="text.secondary">{subtitle}</Text> : null}
        </Box>
        {actions}
      </Stack>
      {children}
    </Stack>
  );
}
