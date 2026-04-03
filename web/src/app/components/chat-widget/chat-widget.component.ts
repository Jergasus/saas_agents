import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { TenantService } from '../../services/tenant.service';
import { marked } from 'marked';
import katex from 'katex';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.css'
})
export class ChatWidgetComponent implements AfterViewChecked, OnInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isFullscreen = false;
  unreadCount = 1;
  messages: { text: string; html: string; isUser: boolean }[] = [];
  rawHistory: any[] = [];
  newMessage = '';
  isLoading = false;

  // Nuevas variables para el selector
  tenants: any[] = [];
  selectedApiKey: string = '';
  currentAgentName: string = 'Selecciona un Agente';
  currentAgentData: any = null;
  sessionId: string = ''; // <--- ID de sesión único para este usuario y agente

  constructor(
    private chatService: ChatService,
    private tenantService: TenantService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // 1. Miramos quién ha iniciado sesión
    const myTenantId = localStorage.getItem('tenantId');

    this.tenantService.getTenants().subscribe(data => {
      this.tenants = data;
      
      // 2. Buscamos automáticamente TU agente en la base de datos
      const myAgent = this.tenants.find(t => t._id === myTenantId);
      
      if (myAgent) {
        // 3. Lo seleccionamos sin que tengas que hacer clic en nada
        this.selectAgent(myAgent);
        this.cdr.detectChanges();
      } else if (this.tenants.length > 0) {
        // (Por si acaso no estás logueado, cogemos el primero)
        this.selectAgent(this.tenants[0]);
      }
    });
  }

  selectAgent(tenant: any) {
    this.selectedApiKey = tenant.apiKey;
    this.currentAgentName = tenant.name;
    this.currentAgentData = tenant;
    
    // 1. Generar o recuperar un ID de sesión único para este agente
    const storageKey = `chat_session_${tenant._id}`;
    let savedSessionId = localStorage.getItem(storageKey);
    if (!savedSessionId) {
      savedSessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(storageKey, savedSessionId);
    }
    this.sessionId = savedSessionId;

    // 2. Cargar historial desde el backend
    this.isLoading = true;
    this.chatService.getHistory(this.sessionId).subscribe({
      next: (history) => {
        this.rawHistory = history || [];
        
        // Reconstruir los mensajes visuales a partir del historial de Gemini
        if (this.rawHistory.length > 0) {
          this.messages = [];
          for (const msg of this.rawHistory) {
            if (msg.parts && msg.parts[0] && msg.parts[0].text) {
              const text = msg.parts[0].text;
              this.messages.push({
                text,
                html: msg.role === 'user' ? text : this.renderMarkdown(text),
                isUser: msg.role === 'user'
              });
            }
          }
        } else {
          const welcomeText = `Hi! I'm ${tenant.name}. How can I help you?`;
          this.messages = [{ text: welcomeText, html: welcomeText, isUser: false }];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        const welcomeText = `Hi! I'm ${tenant.name}. How can I help you?`;
        this.messages = [{ text: welcomeText, html: welcomeText, isUser: false }];
        this.rawHistory = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
    }
    this.cdr.detectChanges();
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.detectChanges();
  }

  resetChat() {
    // Borramos la sesión actual en la base de datos
    if (this.sessionId) {
      this.chatService.deleteHistory(this.sessionId).subscribe();
    }

    // Borramos la sesión actual y creamos una nueva en el navegador
    if (this.currentAgentData) {
      const storageKey = `chat_session_${this.currentAgentData._id}`;
      const newSessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(storageKey, newSessionId);
      this.sessionId = newSessionId;
    }

    this.messages = [{ text: `Hi! I'm ${this.currentAgentData?.name || 'your assistant'}. How can I help you?`, html: `Hi! I'm ${this.currentAgentData?.name || 'your assistant'}. How can I help you?`, isUser: false }];
    this.rawHistory = [];
    this.cdr.detectChanges();
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedApiKey) return;
    
    const userMsg = this.newMessage;

    // 1. Añadimos el mensaje a la UI
    this.messages = [...this.messages, { text: userMsg, html: userMsg, isUser: true }];
    
    // 2. Añadimos el mensaje al historial crudo (rawHistory) para Gemini (optimista)
    this.rawHistory = [...this.rawHistory, { role: 'user', parts: [{ text: userMsg }] }];

    this.newMessage = '';
    this.isLoading = true;
    this.cdr.detectChanges();

    // 3. Enviamos el mensaje y el ID de sesión al backend
    this.chatService.sendMessage(this.selectedApiKey, userMsg, this.sessionId).subscribe({
      next: (res) => {
        this.messages = [...this.messages, { text: res.reply, html: this.renderMarkdown(res.reply), isUser: false }];
        // 4. Actualizamos el historial con la respuesta completa del backend
        this.rawHistory = res.history || [];
        this.isLoading = false;

        if (!this.isOpen) {
          this.unreadCount++;
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.messages = [...this.messages, { text: 'Connection error.', html: 'Connection error.', isUser: false }];
        this.isLoading = false;
        if (!this.isOpen) {
          this.unreadCount++;
        }
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  /** Convierte markdown + LaTeX ($..$ y $$..$$) a HTML listo para renderizar */
  private renderMarkdown(text: string): string {
    // 1. Procesamos bloques de LaTeX ($$...$$) ANTES de que marked los rompa
    let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex) => {
      try {
        return '<div class="katex-block">' + katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false }) + '</div>';
      } catch {
        return `<div class="katex-block"><code>${latex.trim()}</code></div>`;
      }
    });

    // 2. Procesamos LaTeX inline ($...$)
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_match, latex) => {
      try {
        return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<code>${latex.trim()}</code>`;
      }
    });

    // 3. Procesamos el markdown
    const html = marked.parse(processed, { async: false, breaks: true }) as string;
    return html;
  }
}