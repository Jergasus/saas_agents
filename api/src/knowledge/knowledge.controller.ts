import { Controller, Post, Body, Get, Query, Delete, Param, UseGuards } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
const pdfParse = require('pdf-parse');

@Controller('knowledge')
@UseGuards(AuthGuard) // Protegemos TODAS las rutas de conocimiento
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // POST localhost:3000/knowledge
  @Post()
  async create(@Body() body: { tenantId: string; content: string }) {
    return this.knowledgeService.ingestText(body.tenantId, body.content);
  }

  // GET localhost:3000/knowledge?tenantId=...
  @Get()
  async findAll(@Query('tenantId') tenantId: string) {
    return this.knowledgeService.findAll(tenantId);
  }

  // DELETE localhost:3000/knowledge/:id
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.knowledgeService.remove(id);
  }

  private chunkText(text: string, maxCharLength: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=\.)\s+|\n+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxCharLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += sentence + ' ';
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // 👉 NUEVO: Endpoint para procesar Archivos (PDF)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // NestJS atrapa el archivo que viene en el formulario
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('tenantId') tenantId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    let extractedText = '';

    // 1. EXTRAER TEXTO SEGÚN EL TIPO DE ARCHIVO
    try {
      if (file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text.replace(/\s+/g, ' ').trim();
      } else if (file.mimetype === 'text/markdown' || file.originalname?.endsWith('.md')) {
        extractedText = file.buffer.toString('utf-8').trim();
      } else {
        throw new BadRequestException('Unsupported format. Please upload a PDF or Markdown file.');
      }

      const fileType = file.originalname?.endsWith('.md') ? 'markdown' : 'pdf';
      console.log(`📄 ${fileType.toUpperCase()} leído con éxito. Caracteres extraídos: ${extractedText.length}`);

      // 2. GUARDAR EL TEXTO EN EL RAG (Procesamiento en Lotes / Batching)
      const chunks = this.chunkText(extractedText, 1000);
      const batchSize = 5; // Procesamos de 5 en 5 para no saturar la API de Google
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Ejecutamos las 5 peticiones a la vez (en paralelo)
        await Promise.all(
          batch.map(chunk => this.knowledgeService.ingestText(tenantId, chunk, fileType))
        );
        
        console.log(`Procesados ${Math.min(i + batchSize, chunks.length)} de ${chunks.length} fragmentos...`);
      }

      return {
        message: 'File processed and ingested into the AI knowledge base',
        chars: extractedText.length,
        chunks: chunks.length
      };

    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      throw new BadRequestException('Could not process the file. Is it corrupted?');
    }
  }
}