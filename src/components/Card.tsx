import { Card as ChakraCard, CardBody, type CardProps } from "@chakra-ui/react";

export type AppCardProps = CardProps & {
  padded?: boolean;
};

export function Card({ padded = true, children, ...props }: AppCardProps) {
  return (
    <ChakraCard borderRadius="xl" variant="outline" {...props}>
      {padded ? <CardBody p={{ base: 4, md: 5 }}>{children}</CardBody> : children}
    </ChakraCard>
  );
}
