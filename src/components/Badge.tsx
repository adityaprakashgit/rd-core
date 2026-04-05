import { Badge as ChakraBadge, type BadgeProps } from "@chakra-ui/react";

export type AppBadgeProps = BadgeProps;

export function Badge(props: AppBadgeProps) {
  return <ChakraBadge borderRadius="full" px={2.5} py={1} fontSize="xs" {...props} />;
}
