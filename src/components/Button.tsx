import { Button as ChakraButton, type ButtonProps } from "@chakra-ui/react";

export type AppButtonProps = ButtonProps;

export function Button(props: AppButtonProps) {
  return <ChakraButton size={props.size ?? "sm"} {...props} />;
}
