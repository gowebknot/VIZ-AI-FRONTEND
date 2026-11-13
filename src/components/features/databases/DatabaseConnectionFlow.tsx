/**
 * DatabaseConnectionFlow Component
 *
 * A wizard for adding database connections. It starts with a choice:
 *
 * "Connect directly"
 *   - Form-based or connection string method
 *   - Validates and tests the connection
 *   - On success, immediately redirects to charts page (no conversation step)
 *
 * "Use a connector"
 *   - VizAI creates a connector; the client installs it next to their database, so their
 *     database login is never shared with VizAI (see ConnectorSetup)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Database, ArrowLeft } from "lucide-react";
import { DatabaseSetupGuided } from "./DatabaseSetupGuided.tsx";
import { ConnectionTypeChoice, type ConnectionMode } from "./ConnectionTypeChoice";
import { ConnectorSetup, type ConnectorSetupResult } from "./ConnectorSetup";

interface DatabaseConnectionFlowProps {
  projectId?: string;
  onComplete: (connectionData: {
    database: any;
    selectedTables: string[];
    databaseContext: Record<string, string>;
  }) => void;
  onCancel: () => void;
  /** A connector was set up (or left to finish later). The connection is already created. */
  onConnectorFinished?: (result: ConnectorSetupResult) => void;
}

export function DatabaseConnectionFlow({ projectId, onComplete, onCancel, onConnectorFinished }: DatabaseConnectionFlowProps) {
  const [mode, setMode] = useState<"choose" | ConnectionMode>("choose");
  // Set once a connector exists. Its token is shown only once, so leaving needs a warning.
  const [createdConnector, setCreatedConnector] = useState<{ connectionId: string; name: string } | null>(null);

  const leave = () => {
    if (createdConnector) {
      const sure = window.confirm(
        "Your connector token is shown only once. If you leave now you can still get a new one later with Rotate token. Leave anyway?"
      );
      if (!sure) return;
      onConnectorFinished?.({ ...createdConnector, ready: false });
      return;
    }
    onCancel();
  };

  const handleBack = () => {
    if (mode === "choose" || createdConnector) {
      leave();
      return;
    }
    setMode("choose");
  };

  // When the DB connection succeeds, skip the conversation step and complete immediately.
  const handleDatabaseComplete = (dbConfig: any) => {
    onComplete({
      database: dbConfig,
      selectedTables: [],
      databaseContext: {},
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="w-full max-w-5xl relative z-10">
        {/* Back & Cancel Actions */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            data-testid="wizard-back"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={leave}
            data-testid="wizard-cancel"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Progress Step */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-accent text-white shadow-lg">
                <Database className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <p className="text-xs text-foreground hidden md:block">Connect Datasource</p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {mode === "choose" && <ConnectionTypeChoice onChoose={setMode} />}
            {mode === "direct" && (
              <DatabaseSetupGuided
                projectName="your workspace"
                projectId={projectId}
                onComplete={handleDatabaseComplete}
              />
            )}
            {mode === "connector" && (
              <ConnectorSetup
                projectId={projectId}
                onCreated={setCreatedConnector}
                onFinished={(result) => onConnectorFinished?.(result)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
