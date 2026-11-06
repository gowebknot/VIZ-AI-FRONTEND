/**
 * ConnectorSetup
 *
 * "Use a connector": the client's own connector reads their database, so VizAI never holds the login.
 *
 *   1. Name the connection  ->  VizAI creates the connector and shows a one-time connection code
 *   2. Install screen: the command for the client's stack, with live status while they run it
 *
 * Unlike a direct connection, nothing here can finish on its own: the schema arrives only after the
 * client has installed the connector, which may be minutes or days later. So this screen never blocks.
 * "I'll finish later" leaves it, and the connection shows in the list as "Waiting for connector".
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { GradientButton } from "../../shared/GradientButton";
import { ConnectorInstallPanel } from "./ConnectorInstallPanel";
import { connectorPhase } from "../../../utils/connectorInstall";
import { API_BASE_URL, createConnector, getConnector, type ConnectorInfo, type CreatedConnector } from "../../../services/api";

export interface ConnectorSetupResult {
  connectionId: string;
  name: string;
  /** True when the connector connected and VizAI saved its schema. */
  ready: boolean;
}

interface ConnectorSetupProps {
  projectId?: string;
  /** The connector now exists, so the wizard can warn before the one-time code is lost. */
  onCreated?: (created: { connectionId: string; name: string }) => void;
  onFinished: (result: ConnectorSetupResult) => void;
}

const POLL_MS = 3000;

function progressSocketUrl(taskId: string): string {
  const base = API_BASE_URL.replace(/\/+$/, "").replace(/^http/, "ws");
  return `${base}/api/v1/backend/ws/progress/${taskId}`;
}

type StepState = "done" | "active" | "todo";

function Step({ state, label, testId }: { state: StepState; label: string; testId: string }) {
  return (
    <li className="flex items-center gap-2 text-sm" data-testid={testId} data-state={state}>
      {state === "done" && <CheckCircle2 className="w-4 h-4 text-success" />}
      {state === "active" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
      {state === "todo" && <Circle className="w-4 h-4 text-muted-foreground" />}
      <span className={state === "todo" ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    </li>
  );
}

export function ConnectorSetup({ projectId, onCreated, onFinished }: ConnectorSetupProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedConnector | null>(null);
  const [info, setInfo] = useState<ConnectorInfo | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [schemaProblem, setSchemaProblem] = useState<string | null>(null);
  const connectorId = created?.connectorId;
  const taskId = created?.taskId;
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Live status: the status endpoint is the source of truth.
  useEffect(() => {
    if (!connectorId) return;
    let stopped = false;
    const poll = async () => {
      const response = await getConnector(connectorId);
      if (!stopped && alive.current && response.success && response.data) setInfo(response.data);
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [connectorId]);

  // Progress messages from VizAI, such as "Received a schema with 17 tables". Best effort only.
  useEffect(() => {
    if (!taskId) return;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(progressSocketUrl(taskId));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; message?: string };
          if (message.type === "error" && message.message) setSchemaProblem(message.message);
          else if (message.message && message.type !== "completed") setNote(message.message);
        } catch {
          // ignore a message that is not JSON
        }
      };
    } catch {
      // The status polling above still works without the socket.
    }
    return () => socket?.close();
  }, [taskId]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this connection.");
      return;
    }
    if (!projectId) {
      setError("Open a project first.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const response = await createConnector(projectId, { connectionName: trimmed });
      if (!response.success || !response.data) {
        setError(response.error?.message || "Could not create the connector.");
        return;
      }
      setCreated(response.data);
      onCreated?.({ connectionId: response.data.connectionId, name: trimmed });
    } finally {
      setIsCreating(false);
    }
  };

  // --- Step 1: name ---------------------------------------------------------------------------
  if (!created) {
    return (
      <Card className="max-w-xl mx-auto p-6 space-y-5">
        <div>
          <h2 className="text-xl text-foreground mb-1">Use a connector</h2>
          <p className="text-sm text-muted-foreground">
            VizAI creates a connector for you to install next to your database. Your database login never leaves your environment.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="connectorName">
            Connection name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="connectorName"
            data-testid="connector-name"
            value={name}
            maxLength={200}
            placeholder="e.g. Production database"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isCreating && handleCreate()}
            className="h-12"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="connectorType">Database type</Label>
          <Input id="connectorType" value="PostgreSQL" disabled className="h-12" />
          <p className="text-xs text-muted-foreground">PostgreSQL is the only type supported for connectors so far.</p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert" data-testid="connector-error">
            {error}
          </p>
        )}

        <GradientButton onClick={handleCreate} disabled={isCreating} data-testid="connector-create" className="w-full h-12">
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create connector"
          )}
        </GradientButton>
      </Card>
    );
  }

  // --- Step 2: install, with live status ------------------------------------------------------
  const phase = info ? connectorPhase(info) : "waiting";
  const ready = phase === "ready";
  const finish = () => onFinished({ connectionId: created.connectionId, name: name.trim(), ready });

  return (
    <Card className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl text-foreground mb-1">Install your connector</h2>
        <p className="text-sm text-muted-foreground">
          "{name.trim()}" is created. Run the command below where your database can be reached. This page updates by itself.
        </p>
      </div>

      <ConnectorInstallPanel
        connectionCode={created.connectionCode}
        connectorId={created.connectorId}
        gatewayAddress={created.gatewayAddress}
        token={created.token}
        install={created.install}
      />

      <div className="rounded-lg border border-border p-4 space-y-3" data-testid="connector-status" data-phase={phase}>
        <ul className="space-y-2">
          <Step state="done" label="Connector created" testId="step-created" />
          <Step
            state={phase === "waiting" ? "active" : "done"}
            label={phase === "waiting" ? "Waiting for your connector to connect..." : "Connector connected"}
            testId="step-connected"
          />
          <Step
            state={phase === "ready" ? "done" : phase === "connected" ? "active" : "todo"}
            label={phase === "ready" ? "Database structure saved" : "Receiving your database structure"}
            testId="step-schema"
          />
        </ul>
        {note && (
          <p className="text-xs text-muted-foreground" data-testid="connector-note">
            {note}
          </p>
        )}
        {schemaProblem && (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert" data-testid="connector-schema-problem">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{schemaProblem}</span>
          </p>
        )}
        {phase === "revoked" && (
          <p className="text-sm text-destructive" role="alert">
            This connector was revoked. Create a new one.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          data-testid="connector-later"
          onClick={() => {
            if (!ready) toast.info("The connection is in your list. It shows as online once the connector connects.");
            finish();
          }}
        >
          {ready ? "Close" : "I'll finish later"}
        </Button>
        <GradientButton disabled={!ready} onClick={finish} data-testid="connector-done">
          Done
        </GradientButton>
      </div>
    </Card>
  );
}
