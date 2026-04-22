"use client";

import { useMemo, useState } from "react";
import { Badge, Center, Link, Stack, Text, useToast, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { setStoredAuth } from "@/lib/auth-client";

type FormState = {
  companyName: string;
  loginCode: string;
  adminEmail: string;
  password: string;
};

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<FormState>({
    companyName: "",
    loginCode: "",
    adminEmail: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(
    () =>
      submitting ||
      !form.companyName.trim() ||
      !form.loginCode.trim() ||
      !form.adminEmail.trim() ||
      !form.password.trim(),
    [form, submitting]
  );

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.companyName.trim()) {
      nextErrors.companyName = "Company name is required.";
    }

    if (!form.loginCode.trim()) {
      nextErrors.loginCode = "Login code is required.";
    }

    if (!form.adminEmail.trim()) {
      nextErrors.adminEmail = "Admin email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.adminEmail.trim())) {
      nextErrors.adminEmail = "Enter a valid email address.";
    }

    if (!form.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (form.password.trim().length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
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
      const response = await fetch("/api/auth/signup", {
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
        throw new Error(payload.details ?? "Signup failed.");
      }

      setStoredAuth({
        userId: payload.userId,
        companyId: payload.companyId,
        role: payload.role,
        email: payload.email,
      });

      router.push("/admin");
    } catch (error) {
      const details = error instanceof Error ? error.message : "Signup failed.";
      toast({ title: "Signup failed", description: details, status: "error" });
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
              Enterprise Onboarding
            </Badge>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold" color="text.primary">
              Create Company Account
            </Text>
            <Text color="text.secondary" fontSize={{ base: "sm", md: "md" }}>
              Register administrator access for your workspace.
            </Text>
          </VStack>

          <Input
            label="Company Name"
            isRequired
            value={form.companyName}
            onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
            error={errors.companyName}
            placeholder="Company name"
          />

          <Input
            label="Login Code"
            isRequired
            value={form.loginCode}
            onChange={(event) => setForm((prev) => ({ ...prev, loginCode: event.target.value }))}
            error={errors.loginCode}
            placeholder="Unique company code"
          />

          <Input
            label="Admin Email"
            isRequired
            type="email"
            value={form.adminEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
            error={errors.adminEmail}
            placeholder="admin@company.com"
          />

          <Input
            label="Password"
            isRequired
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            error={errors.password}
            placeholder="At least 8 characters"
          />

          <Button onClick={onSubmit} isLoading={submitting} isDisabled={disabled}>
            Create Workspace
          </Button>

          <Text fontSize={{ base: "sm", md: "md" }} color="text.secondary" textAlign="center">
            Already registered?{" "}
            <Link color="brand.600" onClick={() => router.push("/login")}>
              Sign in
            </Link>
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
