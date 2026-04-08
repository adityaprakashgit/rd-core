"use client";

import { useMemo, useState, type MouseEvent } from "react";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";

export type MasterAutocompleteOption = {
  value: string;
  description?: string | null;
};

type MasterAutocompleteProps = {
  label: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  options: MasterAutocompleteOption[];
  isRequired?: boolean;
  isAdding?: boolean;
  addLabel?: (value: string) => string;
  onChange: (value: string) => void;
  onSelect?: (option: MasterAutocompleteOption) => void;
  onAdd?: (value: string) => Promise<void> | void;
};

export function MasterAutocomplete({
  label,
  placeholder,
  helperText,
  value,
  options,
  isRequired,
  isAdding,
  addLabel,
  onChange,
  onSelect,
  onAdd,
}: MasterAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedInput = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const filtered = normalizedInput.length > 0
      ? options.filter((option) => option.value.toLowerCase().includes(normalizedInput))
      : options;

    return filtered.slice(0, 8);
  }, [normalizedInput, options]);

  const hasExactMatch = options.some((option) => option.value.toLowerCase() === normalizedInput);
  const canAdd = Boolean(onAdd) && value.trim().length >= 3 && !hasExactMatch;
  const showPanel = isOpen && (matches.length > 0 || canAdd || normalizedInput.length >= 3);

  return (
    <FormControl isRequired={isRequired} position="relative">
      <FormLabel>{label}</FormLabel>
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          if (!isOpen) {
            setIsOpen(true);
          }
        }}
      />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}

      {showPanel ? (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          left={0}
          right={0}
          zIndex={20}
          bg="white"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="xl"
          boxShadow="lg"
          overflow="hidden"
        >
          <VStack align="stretch" spacing={0}>
            {matches.map((option) => (
              <Box
                key={option.value}
                as="button"
                type="button"
                textAlign="left"
                px={4}
                py={3}
                _hover={{ bg: "bg.rail" }}
                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  onChange(option.value);
                  onSelect?.(option);
                  setIsOpen(false);
                }}
              >
                <Text fontWeight="semibold" color="text.primary">
                  {option.value}
                </Text>
                {option.description ? (
                  <Text fontSize="sm" color="text.secondary" mt={1}>
                    {option.description}
                  </Text>
                ) : null}
              </Box>
            ))}

            {canAdd ? (
              <Box px={3} py={3} borderTopWidth={matches.length > 0 ? "1px" : "0"}>
                <Button
                  width="full"
                  variant="outline"
                  justifyContent="space-between"
                  rightIcon={isAdding ? <Spinner size="sm" /> : undefined}
                  isDisabled={Boolean(isAdding)}
                  onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    void onAdd?.(value.trim());
                    setIsOpen(false);
                  }}
                >
                  {addLabel ? addLabel(value.trim()) : `Add "${value.trim()}"`}
                </Button>
              </Box>
            ) : null}

            {matches.length === 0 && !canAdd && normalizedInput.length >= 3 ? (
              <Box px={4} py={3}>
                <Text fontSize="sm" color="text.secondary">
                  No matches found.
                </Text>
              </Box>
            ) : null}
          </VStack>
        </Box>
      ) : null}
    </FormControl>
  );
}
