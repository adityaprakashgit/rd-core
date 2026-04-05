import { Box, HStack, Heading, Stack, Text, type StackProps } from "@chakra-ui/react";

export type PageHeaderProps = StackProps & {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions, meta, ...props }: PageHeaderProps) {
  return (
    <Stack direction={{ base: "column", lg: "row" }} justify="space-between" spacing={4} {...props}>
      <Box>
        {meta ? <HStack spacing={2} mb={2}>{meta}</HStack> : null}
        <Heading size="lg">{title}</Heading>
        {subtitle ? <Text color="text.secondary" mt={1}>{subtitle}</Text> : null}
      </Box>
      {actions ? <HStack spacing={2} flexWrap="wrap">{actions}</HStack> : null}
    </Stack>
  );
}
