/**
 * Builds the settings a client adds to their deployment to run the VizAI connector as a container.
 *
 * Pure functions: no network, no storage. The image and extra settings come from the backend, which
 * validates them. The snippets hold no secret: the token and the database login are references to the
 * client's own secrets, so a snippet can be pasted into a repository.
 */

import type { ConnectorInstallSettings } from "../services/api";

export interface ConnectorValues {
  connectorId: string;
  gatewayAddress: string;
}

const CONTAINER_CA_PATH = "/etc/vizai/ca.pem";

function extraEnv(install: ConnectorInstallSettings): Array<[string, string]> {
  return install.env.map((entry) => {
    const at = entry.indexOf("=");
    return [entry.slice(0, at), entry.slice(at + 1)];
  });
}

/** A private CA is for local testing. A public certificate needs no file, so nothing is mounted. */
function caFile(install: ConnectorInstallSettings): string | undefined {
  return extraEnv(install).find(([name]) => name === "VIZAI_TLS_CA_FILE")?.[1];
}

/** A service to add to the client's compose file. */
export function composeSnippet(install: ConnectorInstallSettings, values: ConnectorValues): string {
  const ca = caFile(install);
  const env = extraEnv(install).map(([name, value]): [string, string] => [name, name === "VIZAI_TLS_CA_FILE" ? CONTAINER_CA_PATH : value]);
  return [
    "services:",
    "  vizai-connector:",
    `    image: ${install.image}`,
    "    restart: unless-stopped",
    "    environment:",
    `      VIZAI_GATEWAY_ADDRESS: "${values.gatewayAddress}"`,
    `      VIZAI_CONNECTOR_ID: "${values.connectorId}"`,
    "      VIZAI_CONNECTOR_TOKEN: ${VIZAI_CONNECTOR_TOKEN}",
    "      VIZAI_DATABASE_URL: ${DATABASE_URL}",
    ...env.map(([name, value]) => `      ${name}: "${value}"`),
    ...(ca ? ["    volumes:", `      - "${ca}:${CONTAINER_CA_PATH}:ro"`] : []),
  ].join("\n");
}

/**
 * A container for the client's ECS task definition. Not essential, so a connector problem never stops
 * their app. Restarts on a crash, but not after exit code 2 (bad settings) or 3 (token revoked or
 * rotated), which a restart cannot fix.
 */
export function ecsContainerSnippet(install: ConnectorInstallSettings, values: ConnectorValues): string {
  return JSON.stringify(
    {
      name: "vizai-connector",
      image: install.image,
      essential: false,
      restartPolicy: { enabled: true, ignoredExitCodes: [0, 2, 3] },
      environment: [
        { name: "VIZAI_GATEWAY_ADDRESS", value: values.gatewayAddress },
        { name: "VIZAI_CONNECTOR_ID", value: values.connectorId },
        ...extraEnv(install).map(([name, value]) => ({ name, value })),
      ],
      secrets: [
        { name: "VIZAI_CONNECTOR_TOKEN", valueFrom: "<ARN of the secret holding this token>" },
        { name: "VIZAI_DATABASE_URL", valueFrom: "<ARN of your app's database URL secret>" },
      ],
    },
    null,
    2
  );
}

/** The backend sends times in UTC without a zone suffix; without one the browser reads them as local time. */
export function asUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

export function timeAgo(value: string | null | undefined, now: Date = new Date()): string {
  const iso = asUtc(value);
  if (!iso) return "never";
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes)) return "unknown";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export type ConnectorPhase = "waiting" | "connected" | "ready" | "revoked";

/** Where a connector is in its setup, from the status the backend reports. */
export function connectorPhase(status: { status: string; hasSchema: boolean }): ConnectorPhase {
  if (status.status === "revoked") return "revoked";
  if (status.hasSchema) return "ready";
  if (status.status === "online") return "connected";
  return "waiting";
}

/** How a connector row shows in the databases list. */
export function connectorStatusLabel(status: { status: string; hasSchema: boolean; lastSeenAt: string | null }): {
  kind: "connected" | "disconnected" | "pending" | "error";
  label: string;
} {
  if (status.status === "revoked") return { kind: "error", label: "Revoked" };
  if (status.status === "online") return status.hasSchema ? { kind: "connected", label: "Online" } : { kind: "pending", label: "Receiving schema" };
  if (!status.lastSeenAt && !status.hasSchema) return { kind: "pending", label: "Waiting for connector" };
  return { kind: "disconnected", label: "Offline" };
}
