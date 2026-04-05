import { Injectable } from '@nestjs/common';
import { FunctionDeclaration } from '@google/generative-ai';
import { AgentTool } from './interfaces/tool.interface';
import { reverse1999Tools } from './implementations/reverse1999.tools';

@Injectable()
export class ToolRegistryService {
  private tools = new Map<string, AgentTool>();
  private toolsByFunctionName = new Map<string, AgentTool>();

  constructor() {
    reverse1999Tools.forEach(tool => this.registerTool(tool));
  }

  registerTool(tool: AgentTool) {
    this.tools.set(tool.id, tool);
    this.toolsByFunctionName.set(tool.declaration.name, tool);
  }

  getTool(id: string): AgentTool | undefined {
    return this.tools.get(id) || this.toolsByFunctionName.get(id);
  }

  getDeclarations(toolIds: string[]): FunctionDeclaration[] {
    return toolIds
      .map(id => this.tools.get(id)?.declaration)
      .filter((declaration): declaration is FunctionDeclaration => declaration !== undefined);
  }

  getAllToolsMetadata(nicheFilter?: string) {
    const allTools = Array.from(this.tools.values());

    const filteredTools = nicheFilter
      ? allTools.filter(tool => (tool.niches || []).includes(nicheFilter) || (tool.niches || []).includes('generic'))
      : allTools;

    return filteredTools.map(tool => ({
      id: tool.id,
      name: tool.displayName || tool.declaration.name,
      icon: tool.icon || '🔧',
      description: tool.declaration.description,
      niches: tool.niches || []
    }));
  }
}
