import { Injectable, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TenantsService } from '../tenants/tenants.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession, ChatSessionDocument } from '../schemas/chat-session.schema';
import { ToolRegistryService } from '../tools/tool-registry.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private tenantsService: TenantsService,
    private knowledgeService: KnowledgeService,
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSessionDocument>,
    private toolRegistry: ToolRegistryService,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async getSessionHistory(sessionId: string) {
    const session = await this.chatSessionModel.findOne({ sessionId });
    return session ? session.history : [];
  }

  async deleteSessionHistory(sessionId: string) {
    await this.chatSessionModel.deleteOne({ sessionId });
    return { message: 'History deleted successfully' };
  }

  async sendMessage(apiKey: string, userMessage: string, sessionId: string) {
    const tenant = await this.tenantsService.findByApiKey(apiKey);
    if (!tenant) throw new UnauthorizedException('Invalid API Key');

    let session = await this.chatSessionModel.findOne({ sessionId });
    if (!session) {
      session = new this.chatSessionModel({ sessionId, tenantId: tenant.id, history: [] });
    }

    // RAG search
    const relevantInfo = await this.knowledgeService.search(tenant.id, userMessage);
    const prompt = `RAG CONTEXT:\n${relevantInfo}\n\nUSER QUESTION:\n${userMessage}`;

    // Prepare tools
    const activeTools = this.toolRegistry.getDeclarations(tenant.allowedTools || []);

    let systemInstruction = tenant.systemPrompt || '';
    if (activeTools.length > 0) {
      const toolNames = activeTools.map(t => t.name).join(', ');
      systemInstruction += `\n\nIMPORTANT: You have access to these tools: ${toolNames}. ALWAYS use them to answer questions about game data instead of relying on your own knowledge. If the user's question could be answered by multiple tools, call ALL relevant tools. For example, if asked for a full build, use getCharacterInfo AND findTeamsForCharacter AND getPsychubeDetails.`;
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      tools: activeTools.length > 0 ? [{ functionDeclarations: activeTools }] : undefined,
    });

    const safeHistory = Array.isArray(session.history) ? session.history : [];
    const geminiHistory = safeHistory.map(msg => {
      if (msg.parts) {
        return { role: msg.role, parts: msg.parts };
      }
      return {
        role: msg.role,
        parts: [{ text: msg.text || '' }]
      };
    });

    const chatSession = model.startChat({
      history: geminiHistory
    });

    try {
      let result = await chatSession.sendMessage(prompt);
      const toolsUsed: string[] = [];

      // Tool execution loop
      while (result.response.functionCalls() && result.response.functionCalls()!.length > 0) {
        const functionCalls = result.response.functionCalls()!;
        const functionResponses: any[] = [];

        for (const call of functionCalls) {
          this.logger.log(`Executing tool: ${call.name}`, call.args);
          toolsUsed.push(call.name);
          let functionResponseData = {};

          const tool = this.toolRegistry.getTool(call.name);
          if (tool) {
            try {
              functionResponseData = await tool.execute(call.args, {
                tenantId: tenant.id,
              });
            } catch (error) {
              this.logger.error(`Error executing tool ${call.name}:`, error);
              functionResponseData = { error: 'Internal error executing the tool' };
            }
          } else {
            functionResponseData = { error: 'Unknown tool' };
          }

          functionResponses.push({
            functionResponse: { name: call.name, response: functionResponseData },
          });
        }
        result = await chatSession.sendMessage(functionResponses);
      }

      // Save updated history
      const finalHistory = await chatSession.getHistory();

      // Clean RAG context from stored history
      for (let i = finalHistory.length - 1; i >= 0; i--) {
        const part = finalHistory[i].parts?.[0];
        if (
          finalHistory[i].role === 'user' &&
          part &&
          part.text &&
          part.text.includes('RAG CONTEXT:')
        ) {
          part.text = userMessage;
          break;
        }
      }

      session.history = finalHistory;
      await session.save();

      // Generate async summary after 4+ messages
      if (!session.summary && finalHistory.length >= 4) {
        this.generateSummaryAsync(session);
      }

      return {
        agent: tenant.name,
        reply: result.response.text(),
        toolsUsed: toolsUsed,
        history: finalHistory,
      };
    } catch (error) {
      console.error('Error communicating with Gemini:', error);
      throw new InternalServerErrorException('The agent encountered an error. Please try again.');
    }
  }

  private async generateSummaryAsync(session: ChatSessionDocument) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const conversationText = session.history
        .map(msg => `${msg.role}: ${msg.parts[0]?.text || ''}`)
        .join('\n');

      const prompt = `Summarize the following conversation in a single very short phrase (maximum 6 words) as a descriptive title:\n\n${conversationText}`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim().replace(/["']/g, '');

      session.summary = summary;
      await session.save();
      this.logger.log(`Summary generated for session ${session.sessionId}: ${summary}`);
    } catch (error) {
      this.logger.error('Error generating summary:', error);
    }
  }

  async getAnalytics(tenantId: string) {
    const sessions = await this.chatSessionModel.find({ tenantId }).exec();

    let totalMessages = 0;
    let totalChats = 0;

    const recentSessions: any[] = [];

    for (const session of sessions) {
      const updatedAt = (session as any).updatedAt || new Date(0);

      totalChats++;

      const userMessages = session.history.filter(msg => msg.role === 'user').length;
      totalMessages += userMessages;

      recentSessions.push({
        sessionId: session.sessionId,
        updatedAt: updatedAt,
        messageCount: session.history.length,
        preview: session.summary || session.history.find(msg => msg.role === 'user')?.parts[0]?.text || 'No messages'
      });
    }

    recentSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      totalMessages,
      totalChats,
      recentSessions: recentSessions.slice(0, 50)
    };
  }
}
