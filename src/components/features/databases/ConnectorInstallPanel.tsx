/**
 * ConnectorInstallPanel
 *
 * Shows a client how to run their connector as a container next to their app: the values (the token is
 * shown once) and examples for their deployment. Used after creating a connector and after rotating its
 * token.
 *
 * The token lives only in this component's props. Nothing here logs, stores or sends it. VizAI never asks
 * for the database login: the client sets it on the container from their own secrets.
 */

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { composeSnippet, ecsContainerSnippet } from "../../../utils/connectorInstall";
import type { ConnectorInstallSettings } from "../../../services/api";

interface ConnectorInstallPanelProps {
  connectorId: string;
  gatewayAddress: string;
  token: string;
  install: ConnectorInstallSettings;
}

function CopyBox({ value, label, testId, block = false }: { value: string; label: string; testId: string; block?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const textClass = "flex-1 min-w-0 rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono select-all";
  return (
    <div className="flex items-stretch gap-2">
      {block ? (
        <pre data-testid={testId} className={`${textClass} overflow-x-auto whitespace-pre`}>
          {value}
        </pre>
      ) : (
        <code data-testid={testId} className={`${textClass} break-all`}>
          {value}
        </code>
      )}
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 self-start">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

export function ConnectorInstallPanel({ connectorId, gatewayAddress, token, install }: ConnectorInstallPanelProps) {
  const values = { connectorId, gatewayAddress };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm text-foreground">Gateway address</p>
          <CopyBox value={gatewayAddress} label="gateway address" testId="connector-gateway" />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-foreground">Connector ID</p>
          <CopyBox value={connectorId} label="connector ID" testId="connector-id" />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-foreground">Token</p>
          <CopyBox value={token} label="token" testId="connector-token" />
          <p className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>It is shown only once and works like a password. Save it in your secret manager now. If you lose it, rotate the token to get a new one.</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Add the connector container to your deployment, using one of these examples, then deploy. Your platform starts it with your app, and your app's code does not change.
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Docker Compose: add this service, with VIZAI_CONNECTOR_TOKEN and DATABASE_URL set in your environment</p>
          <CopyBox value={composeSnippet(install, values)} label="Docker Compose example" testId="compose-snippet" block />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Amazon ECS: add this container to your task definition</p>
          <CopyBox value={ecsContainerSnippet(install, values)} label="Amazon ECS example" testId="ecs-snippet" block />
        </div>
      </div>

      <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
        <li>
          Set the database login on the container from your own secrets. It is never sent to VizAI. If your secret keeps the fields apart, set <code>PGHOST</code>, <code>PGUSER</code>, <code>PGPASSWORD</code> and <code>PGDATABASE</code> instead of <code>VIZAI_DATABASE_URL</code>. A read-only login is the safest choice.
        </li>
        <li>
          The container must be able to reach your database, and connect out to <code>{gatewayAddress}</code>. It needs no inbound port.
        </li>
      </ul>
    </div>
  );
}
