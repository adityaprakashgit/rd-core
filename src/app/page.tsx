"use client";

import { Center, Spinner } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getStoredAuth } from "@/lib/auth-client";
import { normalizeRole } from "@/lib/role";
import { CLIENT_AUTH_BYPASS_ENABLED } from "@/lib/runtime-flags";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth && CLIENT_AUTH_BYPASS_ENABLED) {
      router.replace("/userinsp");
      return;
    }

    const role = normalizeRole(auth?.role);
    if (role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    if (role === "RND") {
      router.replace("/rnd");
      return;
    }

    router.replace("/userinsp");
  }, [router]);

  return (
    <Center minH="100vh">
      <Spinner size="xl" color="brand.500" />
    </Center>
  );
}
