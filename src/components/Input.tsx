import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input as ChakraInput,
  type InputProps,
} from "@chakra-ui/react";

export type AppInputProps = InputProps & {
  label?: string;
  error?: string;
  isRequired?: boolean;
};

export function Input({ label, error, isRequired, ...props }: AppInputProps) {
  return (
    <FormControl isInvalid={Boolean(error)} isRequired={isRequired}>
      {label ? <FormLabel fontSize={{ base: "sm", md: "md" }}>{label}</FormLabel> : null}
      <ChakraInput size="sm" bg="bg.surface" {...props} />
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : null}
    </FormControl>
  );
}
