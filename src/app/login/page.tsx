"use client";

import { useMemo, useState } from "react";
import { Badge, Center, Link, Stack, Text, useToast, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { setStoredAuth } from "@/lib/auth-client";
import { normalizeRole } from "@/lib/role";

type FormState = {
  loginCode: string;
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<FormState>({ loginCode: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(
    () => submitting || !form.loginCode.trim() || !form.email.trim() || !form.password.trim(),
    [form, submitting]
  );

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.loginCode.trim()) {
      nextErrors.loginCode = "Login code is required.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.password.trim()) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        error?: string;
        details?: string;
        userId?: string;
        companyId?: string;
        role?: "ADMIN" | "OPERATIONS" | "RND" | "VIEWER";
        email?: string;
      };

      if (!response.ok || !payload.userId || !payload.companyId || !payload.role || !payload.email) {
        throw new Error(payload.details ?? "Login failed.");
      }

      setStoredAuth({
        userId: payload.userId,
        companyId: payload.companyId,
        role: payload.role,
        email: payload.email,
      });

      const role = normalizeRole(payload.role);
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "RND") {
        router.push("/rnd");
      } else {
        router.push("/userinsp");
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : "Login failed.";
      toast({ title: "Login failed", description: details, status: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Center minH="100vh" px={4} bg="bg.app">
      <Card w="full" maxW="md" borderRadius="lg">
        <Stack spacing={4}>
          <VStack align="start" spacing={1}>
            <Badge colorScheme="brand" variant="subtle" w="fit-content">
              Enterprise Access
            </Badge>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold" color="text.primary">
              Sign In
            </Text>
            <Text color="text.secondary" fontSize={{ base: "sm", md: "md" }}>
              Continue to your workspace.
            </Text>
          </VStack>

          <Input
            label="Login Code"
            isRequired
            value={form.loginCode}
            onChange={(event) => setForm((prev) => ({ ...prev, loginCode: event.target.value }))}
            error={errors.loginCode}
            placeholder="Company code"
          />

          <Input
            label="Email"
            isRequired
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            error={errors.email}
            placeholder="name@company.com"
          />

          <Input
            label="Password"
            isRequired
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            error={errors.password}
            placeholder="Enter password"
          />

          <Button onClick={onSubmit} isLoading={submitting} isDisabled={disabled}>
            Continue to Workspace
          </Button>

          <Text fontSize={{ base: "sm", md: "md" }} color="text.secondary" textAlign="center">
            New company?{" "}
            <Link color="brand.600" onClick={() => router.push("/signup")}>
              Create account
            </Link>
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
