/**
 * Builds the commands a client runs to install the VizAI connector.
 *
 * Pure functions: no network, no storage. The download URL, version and extra settings come from the
 * backend (it validates them so they are safe to put in a shell command). The Node command contains no
 * secret: the connection code is typed at the script's prompt, not on the command line.
 */

import type { ConnectorInstallSettings } from "../services/api";

export interface ConnectorCredentials {
  connectorId: string;
  gatewayAddress: string;
  token: string;
}

function envPrefix(env: string[]): string {
  return env.length ? `${env.join(" ")} ` : "";
}

/** For a Node.js app: one script, no database URL. Run it in the app's folder. */
export function nodeInstallCommand(install: ConnectorInstallSettings): string {
  const base = install.downloadUrl.replace(/\/+$/, "");
  return `curl -fsSL ${base}/${install.version}/connect.sh | ${envPrefix(install.env)}sh -s -- --download-url ${base}`;
}

/** For any other stack on Linux or macOS: runs the connector as a service. The client fills in their own database URL. */
export function standaloneInstallCommand(install: ConnectorInstallSettings, credentials: ConnectorCredentials): string {
  const base = install.downloadUrl.replace(/\/+$/, "");
  return (
    `curl -fsSL ${base}/${install.version}/install.sh | sudo ` +
    `${envPrefix(install.env)}` +
    `VIZAI_GATEWAY_ADDRESS=${credentials.gatewayAddress} ` +
    `VIZAI_CONNECTOR_ID=${credentials.connectorId} ` +
    `VIZAI_CONNECTOR_TOKEN=${credentials.token} ` +
    `VIZAI_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE' ` +
    `sh -s -- --download-url ${base}`
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
