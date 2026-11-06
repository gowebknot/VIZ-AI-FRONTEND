/**
 * ConnectorStatusDialog
 *
 * Details and actions for one connector: status, agent version, last seen, connected instances, and
 * Refresh schema / Rotate token / Revoke. Rotating shows the new connection code once.
 */

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { StatusBadge } from "../../shared/StatusBadge";
import { ConnectorInstallPanel } from "./ConnectorInstallPanel";
import { connectorStatusLabel, timeAgo } from "../../../utils/connectorInstall";
import {
  getConnector,
  refreshConnectorSchema,
  revokeConnector,
  rotateConnectorToken,
  type ConnectorInfo,
  type RotatedConnectorToken,
} from "../../../services/api";

interface ConnectorStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectorId: string | null;
  name: string;
  /** Called after something changed, so the list can refresh. */
  onChanged: () => void;
}

const POLL_MS = 5000;

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0" data-testid={testId}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{children}</span>
    </div>
  );
}

export function ConnectorStatusDialog({ open, onOpenChange, connectorId, name, onChanged }: ConnectorStatusDialogProps) {
  const [info, setInfo] = useState<ConnectorInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "refresh" | "rotate" | "revoke">(null);
  const [confirm, setConfirm] = useState<null | "rotate" | "revoke">(null);
  const [rotated, setRotated] = useState<RotatedConnectorToken | null>(null);

  const load = useCallback(async () => {
    if (!connectorId) return;
    const response = await getConnector(connectorId);
    if (response.success && response.data) {
      setInfo(response.data);
      setLoadError(null);
    } else {
      setLoadError(response.error?.message || "Could not load the connector.");
    }
  }, [connectorId]);

  useEffect(() => {
    if (!open || !connectorId) return;
    setInfo(null);
    setConfirm(null);
    setRotated(null);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, connectorId, load]);

  const runRefresh = async () => {
    if (!connectorId) return;
    setBusy("refresh");
    const response = await refreshConnectorSchema(connectorId);
    setBusy(null);
    if (response.success) {
      toast.success("Asked the connector to read your database again.");
      window.setTimeout(load, 1500);
      onChanged();
    } else {
      toast.error(response.error?.message || "Could not request a refresh.");
    }
  };

  const runRotate = async () => {
    if (!connectorId) return;
    setBusy("rotate");
    const response = await rotateConnectorToken(connectorId);
    setBusy(null);
    setConfirm(null);
    if (response.success && response.data) {
      setRotated(response.data);
      toast.success("New token created. The old one no longer works.");
      load();
      onChanged();
    } else {
      toast.error(response.error?.message || "Could not rotate the token.");
    }
  };

  const runRevoke = async () => {
    if (!connectorId) return;
    setBusy("revoke");
    const response = await revokeConnector(connectorId);
    setBusy(null);
    setConfirm(null);
    if (response.success) {
      toast.success("Connector revoked.");
      load();
      onChanged();
    } else {
      toast.error(response.error?.message || "Could not revoke the connector.");
    }
  };

  const status = info ? connectorStatusLabel(info) : null;
  const revoked = info?.status === "revoked";
  const online = info?.status === "online";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="connector-dialog">
        <DialogHeader>
          <DialogTitle>Connector: {name}</DialogTitle>
          <DialogDescription>
            A program in your environment that reads your database for VizAI. Your database login stays with it.
          </DialogDescription>
        </DialogHeader>

        {loadError && !info && <p className="text-sm text-destructive">{loadError}</p>}
        {!info && !loadError && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </p>
        )}

        {info && status && (
          <div>
            <Row label="Status" testId="connector-dialog-status">
              <StatusBadge status={status.kind} label={status.label} />
            </Row>
            <Row label="Agent version">{info.agentVersion ?? "not connected yet"}</Row>
            <Row label="Last seen">{timeAgo(info.lastSeenAt)}</Row>
            <Row label="Database structure" testId="connector-dialog-schema">
              {info.hasSchema ? `saved${info.schemaHash ? ` (${info.schemaHash.slice(0, 8)})` : ""}` : "not received yet"}
            </Row>
            <Row label="Connected instances">
              {info.instances.length === 0 ? (
                "none"
              ) : (
                <ul className="space-y-1">
                  {info.instances.map((i) => (
                    <li key={i.instanceId} className="text-xs">
                      {i.instanceId} · v{i.agentVersion} · {i.inflight === 0 ? "idle" : `${i.inflight} running`}
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          </div>
        )}

        {rotated && (
          <div className="rounded-lg border border-border p-4 space-y-3" data-testid="rotated-panel">
            <p className="text-sm text-foreground">
              The connector was disconnected. Run the command again with this new code to connect it.
            </p>
            <ConnectorInstallPanel
              connectionCode={rotated.connectionCode}
              connectorId={rotated.connectorId}
              gatewayAddress={rotated.gatewayAddress}
              token={rotated.token}
              install={rotated.install}
            />
          </div>
        )}

        {confirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3" data-testid="confirm-panel">
            <p className="text-sm text-foreground">
              {confirm === "rotate"
                ? "This disconnects the connector now. It stays offline until you run the install command again with the new code."
                : "This cuts the connector off for good. It cannot be undone, and you will need to create a new connector to reconnect."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(null)} disabled={busy !== null}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                data-testid="confirm-action"
                disabled={busy !== null}
                onClick={confirm === "rotate" ? runRotate : runRevoke}
              >
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {confirm === "rotate" ? "Rotate token" : "Revoke connector"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="action-refresh"
              disabled={!online || revoked || busy !== null}
              onClick={runRefresh}
              title={online ? "Read the database structure again" : "The connector must be online"}
            >
              {busy === "refresh" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh schema
            </Button>
            <Button variant="outline" size="sm" data-testid="action-rotate" disabled={!info || revoked || busy !== null} onClick={() => setConfirm("rotate")}>
              <KeyRound className="w-4 h-4 mr-2" />
              Rotate token
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="action-revoke"
              className="text-destructive hover:text-destructive"
              disabled={!info || revoked || busy !== null}
              onClick={() => setConfirm("revoke")}
            >
              <Ban className="w-4 h-4 mr-2" />
              Revoke
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
