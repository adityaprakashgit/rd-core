"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";

import { InlineErrorState } from "@/components/enterprise/AsyncState";
import ControlTowerLayout from "@/components/layout/ControlTowerLayout";

type RecordRouteRedirectProps = {
  endpoint: string;
  buildHref: (payload: Record<string, string | null | undefined>) => string;
  title: string;
};

export function RecordRouteRedirect({ endpoint, buildHref, title }: RecordRouteRedirectProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { details?: string } | null;
          throw new Error(payload?.details ?? `${title} could not be resolved.`);
        }

        const payload = (await response.json()) as Record<string, string | null | undefined>;
        if (!active) {
          return;
        }
        router.replace(buildHref(payload));
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : `${title} could not be resolved.`);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [buildHref, endpoint, router, title]);

  return (
    <ControlTowerLayout>
      {error ? (
        <InlineErrorState title={`${title} unavailable`} description={error} />
      ) : (
        <Box borderWidth="1px" borderColor="border.default" borderRadius="xl" bg="bg.surface" px={6} py={12}>
          <VStack spacing={3}>
            <Spinner />
            <Text color="text.secondary">Opening {title.toLowerCase()}...</Text>
          </VStack>
        </Box>
      )}
    </ControlTowerLayout>
  );
}
