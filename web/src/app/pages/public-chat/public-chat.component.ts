import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChatService } from '../../services/chat.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-public-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-chat.component.html'
})
export class PublicChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  
  apiKey: string = '';
  agentData: any = null;
  sessionId: string = ''; // <--- ID de sesión único para este usuario
  
  messages: { text: string; isUser: boolean }[] = [];
  rawHistory: any[] = []; // <--- Historial crudo para Gemini
  newMessage = '';
  isLoading = false;
  isOpen = false; // Controla si la ventana está abierta o es solo el botón
  unreadCount = 1;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // 1. Sacamos la API Key de la URL (ej: /widget/sk_12345)
    this.apiKey = this.route.snapshot.paramMap.get('apiKey') || '';
    
    // 2. Generar o recuperar un ID de sesión único para este widget
    const storageKey = `public_chat_session_${this.apiKey}`;
    let savedSessionId = localStorage.getItem(storageKey);
    if (!savedSessionId) {
      savedSessionId = 'sess_pub_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(storageKey, savedSessionId);
    }
    this.sessionId = savedSessionId;

    // 3. Pedimos los colores y el nombre al backend
    this.http.get<any>(`${environment.apiUrl}/tenants/public/${this.apiKey}`).subscribe(data => {
      this.agentData = data;
      
      // 4. Cargar historial desde el backend
      this.isLoading = true;
      this.chatService.getHistory(this.sessionId).subscribe({
        next: (history) => {
          this.rawHistory = history || [];
          
          if (this.rawHistory.length > 0) {
            this.messages = [];
            for (const msg of this.rawHistory) {
              if (msg.parts && msg.parts[0] && msg.parts[0].text) {
                this.messages.push({
                  text: msg.parts[0].text,
                  isUser: msg.role === 'user'
                });
              }
            }
          } else {
            this.messages = [{ text: `Hi! I'm ${data.name}. How can I help you?`, isUser: false }];
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messages = [{ text: `Hi! I'm ${data.name}. How can I help you?`, isUser: false }];
          this.rawHistory = [];
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    });
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
    }
    this.cdr.detectChanges();
  }

  resetChat() {
    // Borramos la sesión actual en la base de datos
    if (this.sessionId) {
      this.chatService.deleteHistory(this.sessionId).subscribe();
    }

    // Borramos la sesión actual y creamos una nueva en el navegador
    const storageKey = `public_chat_session_${this.apiKey}`;
    const newSessionId = 'sess_pub_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(storageKey, newSessionId);
    this.sessionId = newSessionId;

    this.messages = [{ text: `Hi! I'm ${this.agentData?.name || 'your assistant'}. How can I help you?`, isUser: false }];
    this.rawHistory = [];
    this.cdr.detectChanges();
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.apiKey) return;
    
    const userMsg = this.newMessage;

    this.messages = [...this.messages, { text: userMsg, isUser: true }];
    this.rawHistory = [...this.rawHistory, { role: 'user', parts: [{ text: userMsg }] }];
    
    this.newMessage = '';
    this.isLoading = true;
    this.cdr.detectChanges();

    this.chatService.sendMessage(this.apiKey, userMsg, this.sessionId).subscribe({
      next: (res) => {
        this.messages = [...this.messages, { text: res.reply, isUser: false }];
        this.rawHistory = res.history || [];
        this.isLoading = false;
        if (!this.isOpen) {
          this.unreadCount++;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.messages = [...this.messages, { text: 'Connection error.', isUser: false }];
        this.isLoading = false;
        if (!this.isOpen) {
          this.unreadCount++;
        }
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewChecked() {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) {}
  }
}