/**
 * ConnectorInstallPanel
 *
 * Shows a client how to install their connector: the connection code (shown once) and the command for
 * their stack. Used after creating a connector and after rotating its token.
 *
 * The code and token live only in this component's props. Nothing here logs, stores or sends them.
 */

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { nodeInstallCommand, standaloneInstallCommand } from "../../../utils/connectorInstall";
import type { ConnectorInstallSettings } from "../../../services/api";

interface ConnectorInstallPanelProps {
  connectionCode: string;
  connectorId: string;
  gatewayAddress: string;
  token: string;
  install: ConnectorInstallSettings;
}

function CopyBox({ value, label, testId }: { value: string; label: string; testId: string }) {
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

  return (
    <div className="flex items-stretch gap-2">
      <code
        data-testid={testId}
        className="flex-1 min-w-0 rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono break-all select-all"
      >
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 self-start">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

export function ConnectorInstallPanel({ connectionCode, connectorId, gatewayAddress, token, install }: ConnectorInstallPanelProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-foreground">Your connection code</p>
        <CopyBox value={connectionCode} label="connection code" testId="connection-code" />
        <p className="flex items-start gap-2 text-xs text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>It is shown only once and works like a password. Copy it now. If you lose it, rotate the token to get a new one.</span>
        </p>
      </div>

      <Tabs defaultValue="node">
        <TabsList>
          <TabsTrigger value="node" data-testid="tab-node">Node.js app (recommended)</TabsTrigger>
          <TabsTrigger value="other" data-testid="tab-other">Other stacks (Linux, macOS)</TabsTrigger>
        </TabsList>

        <TabsContent value="node" className="space-y-3 pt-3">
          <ol className="list-decimal pl-5 space-y-3 text-sm text-foreground">
            <li className="space-y-2">
              <span>In your app's folder, run:</span>
              <CopyBox value={nodeInstallCommand(install)} label="install command" testId="node-command" />
            </li>
            <li>When it asks for the connection code, paste the code above.</li>
            <li>Approve the one-line change it shows for your <code className="text-xs">start</code> script, then restart your app.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            You do not enter a database URL. The connector finds the database your app already uses and keeps it on your machine. It needs Node.js 18.18 or newer, and it changes <code>package.json</code> and adds a <code>vendor</code> folder, which you commit.
          </p>
        </TabsContent>

        <TabsContent value="other" className="space-y-3 pt-3">
          <ol className="list-decimal pl-5 space-y-3 text-sm text-foreground">
            <li className="space-y-2">
              <span>Replace the database URL with your own, then run it on the server that can reach your database:</span>
              <CopyBox
                value={standaloneInstallCommand(install, { connectorId, gatewayAddress, token })}
                label="install command"
                testId="other-command"
              />
            </li>
            <li>It installs the connector as a service that starts with the server.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            The database URL stays in a protected file on your server. It is never sent to VizAI. A read-only database login is the safest choice.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
