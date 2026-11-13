/**
 * ConnectionTypeChoice
 *
 * The first screen of "Add Connection": connect directly with credentials, or use a connector that
 * keeps the credentials in the client's environment.
 */

import { Database, Plug, ShieldCheck } from "lucide-react";

import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";

export type ConnectionMode = "direct" | "connector";

interface ConnectionTypeChoiceProps {
  onChoose: (mode: ConnectionMode) => void;
}

export function ConnectionTypeChoice({ onChoose }: ConnectionTypeChoiceProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl text-foreground mb-1">How do you want to connect?</h2>
        <p className="text-muted-foreground">Choose how VizAI reaches your database.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("direct")}
          data-testid="choose-direct"
          className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Card className="h-full p-6 border-border hover:border-primary/50 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg text-foreground mb-1">Connect directly</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your database host, username and password. VizAI connects to the database itself and reads its structure.
            </p>
            <Badge variant="outline" className="border-border">Quickest to set up</Badge>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => onChoose("connector")}
          data-testid="choose-connector"
          className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Card className="h-full p-6 border-border hover:border-primary/50 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
              <Plug className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg text-foreground mb-1">Use a connector</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Install a small program next to your database. Your database credentials stay with you and are never shared with VizAI.
            </p>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Credentials stay with you
            </Badge>
          </Card>
        </button>
      </div>
    </div>
  );
}
