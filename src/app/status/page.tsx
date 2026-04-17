"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Center,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { RefreshCw } from "lucide-react";

import ControlTowerLayout from "@/components/layout/ControlTowerLayout";
import { InlineErrorState } from "@/components/enterprise/AsyncState";
import { EnterpriseDataTable } from "@/components/enterprise/EnterpriseDataTable";
import { EnterpriseSummaryStrip } from "@/components/enterprise/EnterprisePatterns";
import { WorkflowStateChip } from "@/components/enterprise/WorkflowStateChip";
import { FilterRail, RegistryPageTemplate } from "@/components/enterprise/PageTemplates";

type StatusResponse = {
  ok: boolean;
  checkedAt: string;
  services: {
    api: {
      ok: boolean;
      latencyMs: number;
    };
    database: {
      ok: boolean;
      latencyMs: number;
      error?: string;
    };
  };
  checks: {
    migrationsApplied?: number;
    requiredTablesOk?: boolean;
    usersWithPassword?: number;
  };
};

type FontAudit = {
  bodyFontFamily: string;
  headingFontFamily: string;
  ibmLoaded: boolean;
};

export default function StatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontAudit, setFontAudit] = useState<FontAudit | null>(null);

  const loadStatus = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const payload = (await response.json()) as StatusResponse;
      setStatus(payload);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let active = true;
    const run = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      if (!active) {
        return;
      }

      const bodyStyles = window.getComputedStyle(document.body);
      const headingNode = document.querySelector("h1, h2, h3, h4, h5, h6");
      const headingStyles = headingNode ? window.getComputedStyle(headingNode) : bodyStyles;
      const ibmLoaded = typeof document.fonts?.check === "function" ? document.fonts.check("14px 'IBM Plex Sans'") : false;

      setFontAudit({
        bodyFontFamily: bodyStyles.fontFamily,
        headingFontFamily: headingStyles.fontFamily,
        ibmLoaded,
      });
    };

    void run();
    return () => {
      active = false;
    };
  }, [status?.checkedAt]);

  const checkedAtText = useMemo(() => {
    if (!status?.checkedAt) {
      return "-";
    }
    return new Date(status.checkedAt).toLocaleString();
  }, [status?.checkedAt]);

  if (loading) {
    return (
      <ControlTowerLayout>
        <Center minH="60vh">
          <Spinner size="xl" color="brand.500" />
        </Center>
      </ControlTowerLayout>
    );
  }

  return (
    <ControlTowerLayout>
      <RegistryPageTemplate
        summary={
          <VStack align="stretch" spacing={3}>
            <EnterpriseSummaryStrip
              items={[
                { label: "Last checked", value: checkedAtText },
                { label: "Overall health", value: <WorkflowStateChip status={status?.ok ? "SUCCESS" : "ERROR"} /> },
                { label: "API latency", value: `${status?.services.api.latencyMs ?? 0} ms` },
                { label: "Database latency", value: `${status?.services.database.latencyMs ?? 0} ms` },
              ]}
            />
            <HStack justify="end">
              <Button
                variant="outline"
                leftIcon={<RefreshCw size={14} />}
                onClick={() => void loadStatus(true)}
                isLoading={refreshing}
              >
                Refresh Monitoring Snapshot
              </Button>
            </HStack>
          </VStack>
        }
        filters={
          <FilterRail>
            <WorkflowStateChip status={status?.services.api.ok ? "SUCCESS" : "ERROR"} />
            <Text fontSize="sm" color="text.secondary">API: {status?.services.api.latencyMs ?? 0} ms</Text>
            <WorkflowStateChip status={status?.services.database.ok ? "SUCCESS" : "ERROR"} />
            <Text fontSize="sm" color="text.secondary">Database: {status?.services.database.latencyMs ?? 0} ms</Text>
          </FilterRail>
        }
        content={
          <VStack align="stretch" spacing={4}>
            <EnterpriseDataTable
              rows={[
                { id: "migrations", metric: "Migrations Applied", value: String(status?.checks.migrationsApplied ?? 0) },
                { id: "tables", metric: "Required Tables", value: status?.checks.requiredTablesOk ? "Healthy" : "Attention Required" },
                { id: "users", metric: "Users With Password", value: String(status?.checks.usersWithPassword ?? 0) },
                { id: "font-loaded", metric: "IBM Plex Loaded", value: fontAudit?.ibmLoaded ? "Yes" : "No" },
                { id: "font-body", metric: "Body Font", value: fontAudit?.bodyFontFamily ?? "-" },
                { id: "font-heading", metric: "Heading Font", value: fontAudit?.headingFontFamily ?? "-" },
              ]}
              rowKey={(row) => row.id}
              columns={[
                { id: "metric", header: "System Metric", render: (row) => row.metric },
                { id: "value", header: "Current Value", render: (row) => row.value },
              ]}
              emptyLabel="No monitoring records available."
            />
            {status?.services.database.error ? (
              <InlineErrorState
                title="Database check failed"
                description={status.services.database.error}
                onRetry={() => void loadStatus(true)}
              />
            ) : null}
            {error ? (
              <InlineErrorState
                title="Status check unavailable"
                description={error}
                onRetry={() => void loadStatus(true)}
              />
            ) : null}
          </VStack>
        }
      />
    </ControlTowerLayout>
  );
}
