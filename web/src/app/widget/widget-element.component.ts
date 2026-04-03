import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import katex from 'katex';

@Component({
  selector: 'ai-chat-widget-inner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './widget-element.component.html',
  styleUrl: './widget-element.component.css',
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class WidgetElementComponent implements OnInit, OnChanges, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  @Input('api-key') apiKey = '';
  @Input('api-url') apiUrl = '';

  agentData: any = null;
  sessionId = '';
  messages: { text: string; html: string; isUser: boolean }[] = [];
  rawHistory: any[] = [];
  newMessage = '';
  isLoading = false;
  isOpen = false;
  unreadCount = 1;

  private initialized = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.tryInit();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['apiKey'] || changes['apiUrl']) && !this.initialized) {
      this.tryInit();
    }
  }

  private tryInit() {
    if (!this.apiKey || this.initialized) return;
    this.initialized = true;

    const baseUrl = this.resolveApiUrl();

    // Generate or retrieve session ID
    const storageKey = `widget_session_${this.apiKey}`;
    let savedSessionId = localStorage.getItem(storageKey);
    if (!savedSessionId) {
      savedSessionId = 'sess_w_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(storageKey, savedSessionId);
    }
    this.sessionId = savedSessionId;

    // Fetch agent config
    this.http.get<any>(`${baseUrl}/tenants/public/${this.apiKey}`).subscribe({
      next: (data) => {
        this.agentData = data;
        this.loadHistory(baseUrl);
      },
      error: () => {
        this.agentData = { name: 'AI Assistant', primaryColor: '#2563EB', chatTitle: 'AI Assistant' };
        this.messages = [{ text: 'Connection error. Please check your configuration.', html: 'Connection error. Please check your configuration.', isUser: false }];
        this.cdr.detectChanges();
      },
    });
  }

  private loadHistory(baseUrl: string) {
    this.isLoading = true;
    this.http.get<any[]>(`${baseUrl}/chat/history/${this.sessionId}`).subscribe({
      next: (history) => {
        this.rawHistory = history || [];
        if (this.rawHistory.length > 0) {
          this.messages = [];
          for (const msg of this.rawHistory) {
            if (msg.parts?.[0]?.text) {
              const text = msg.parts[0].text;
              this.messages.push({
                text,
                html: msg.role === 'user' ? text : this.renderMarkdown(text),
                isUser: msg.role === 'user',
              });
            }
          }
        } else {
          const welcome = `Hi! I'm ${this.agentData.name}. How can I help you?`;
          this.messages = [{ text: welcome, html: welcome, isUser: false }];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        const welcome = `Hi! I'm ${this.agentData?.name || 'your assistant'}. How can I help you?`;
        this.messages = [{ text: welcome, html: welcome, isUser: false }];
        this.rawHistory = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.unreadCount = 0;
    this.cdr.detectChanges();
  }

  resetChat() {
    const baseUrl = this.resolveApiUrl();
    if (this.sessionId) {
      this.http.delete(`${baseUrl}/chat/history/${this.sessionId}`).subscribe();
    }

    const storageKey = `widget_session_${this.apiKey}`;
    const newSessionId = 'sess_w_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(storageKey, newSessionId);
    this.sessionId = newSessionId;

    const welcome = `Hi! I'm ${this.agentData?.name || 'your assistant'}. How can I help you?`;
    this.messages = [{ text: welcome, html: welcome, isUser: false }];
    this.rawHistory = [];
    this.cdr.detectChanges();
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.apiKey) return;

    const baseUrl = this.resolveApiUrl();
    const userMsg = this.newMessage;

    this.messages = [...this.messages, { text: userMsg, html: userMsg, isUser: true }];
    this.rawHistory = [...this.rawHistory, { role: 'user', parts: [{ text: userMsg }] }];
    this.newMessage = '';
    this.isLoading = true;
    this.cdr.detectChanges();

    this.http
      .post<any>(`${baseUrl}/chat`, {
        message: userMsg,
        sessionId: this.sessionId,
      }, {
        headers: { 'x-api-key': this.apiKey },
      })
      .subscribe({
        next: (res) => {
          this.messages = [...this.messages, {
            text: res.reply,
            html: this.renderMarkdown(res.reply),
            isUser: false,
          }];
          this.rawHistory = res.history || [];
          this.isLoading = false;
          if (!this.isOpen) this.unreadCount++;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messages = [...this.messages, { text: 'Connection error.', html: 'Connection error.', isUser: false }];
          this.isLoading = false;
          if (!this.isOpen) this.unreadCount++;
          this.cdr.detectChanges();
        },
      });
  }

  ngAfterViewChecked() {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  private resolveApiUrl(): string {
    if (this.apiUrl) return this.apiUrl.replace(/\/$/, '');
    // Default: same origin on port 3000
    if (typeof window !== 'undefined') {
      return window.location.protocol + '//' + window.location.hostname + ':3000';
    }
    return 'http://localhost:3000';
  }

  private renderMarkdown(text: string): string {
    // Block LaTeX ($$...$$)
    let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex) => {
      try {
        return '<div class="katex-block">' + katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false }) + '</div>';
      } catch {
        return `<div class="katex-block"><code>${latex.trim()}</code></div>`;
      }
    });

    // Inline LaTeX ($...$)
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_match, latex) => {
      try {
        return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<code>${latex.trim()}</code>`;
      }
    });

    return marked.parse(processed, { async: false, breaks: true }) as string;
  }
}
