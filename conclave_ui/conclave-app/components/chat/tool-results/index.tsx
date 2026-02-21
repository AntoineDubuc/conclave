"use client";

import type { ReactNode } from "react";
import { DiagramResult } from "./diagram-result";
import { CostEstimateResult } from "./cost-estimate-result";
import { ModelListResult } from "./model-list-result";
import { TestFlowResult } from "./test-flow-result";
import { TaskResult } from "./task-result";
import type {
  ShowDiagramOutput,
  EstimateCostOutput,
  ListModelsOutput,
  TestFlowOutput,
  TaskOutput,
} from "@/lib/types/agent-chat";

interface ToolResultRendererProps {
  tool: string;
  result: unknown;
}


export function ToolResultRenderer({ tool, result }: ToolResultRendererProps): ReactNode {
  switch (tool) {
    case "list_available_models":
      return <ModelListResult result={result as ListModelsOutput} />;

    case "show_flow_diagram":
      return <DiagramResult result={result as ShowDiagramOutput} />;

    case "estimate_cost":
      return <CostEstimateResult result={result as EstimateCostOutput} />;

    case "test_flow":
      return <TestFlowResult result={result as TestFlowOutput} />;

    case "task":
      return <TaskResult result={result as TaskOutput} />;

    default:
      // Generic JSON display for unknown tools
      return (
        <pre className="text-xs text-white/60 overflow-auto max-h-40">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

export { DiagramResult } from "./diagram-result";
export { CostEstimateResult } from "./cost-estimate-result";
export { ModelListResult } from "./model-list-result";
export { TestFlowResult } from "./test-flow-result";
export { TaskResult } from "./task-result";
