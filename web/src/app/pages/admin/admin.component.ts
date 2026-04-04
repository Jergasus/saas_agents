import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../services/tenant.service';
import { KnowledgeService } from '../../services/knowledge.service';
import { ChatService } from '../../services/chat.service';
import { ChatWidgetComponent } from '../../components/chat-widget/chat-widget.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatWidgetComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit, OnDestroy {
  tenants: any[] = [];
  agentMemories: any[] = [];
  analytics: any = { totalMessages: 0, totalChats: 0, recentSessions: [] };
  selectedTenant: any = null;
  private pollingInterval: any;

  newKnowledgeContent = '';
  isLoadingKnowledge = false;
  isSaving = false;

  activeModal: 'general' | 'appearance' | 'install' | 'tools' | 'knowledge' | 'analytics' | 'account' | null = null;

  frontendUrl = window.location.origin;

  availableTools: any[] = [];

  // Account management
  accountEmail = '';
  accountCurrentPassword = '';
  accountNewPassword = '';
  accountNewPasswordConfirm = '';
  isSavingAccount = false;

  constructor(
    private tenantService: TenantService,
    private knowledgeService: KnowledgeService,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService,
  ) {}

  ngOnInit() {
    this.loadTenants();

    this.pollingInterval = setInterval(() => {
      if (this.selectedTenant) {
        this.knowledgeService.getAll(this.selectedTenant._id).subscribe((data: any[]) => {
          if (this.agentMemories.length !== data.length) {
            this.agentMemories = data;
            this.cdr.detectChanges();
          }
        });

        this.chatService.getAnalytics(this.selectedTenant._id).subscribe((data: any) => {
          if (
            this.analytics.totalMessages !== data.totalMessages ||
            this.analytics.totalChats !== data.totalChats ||
            JSON.stringify(this.analytics.recentSessions) !== JSON.stringify(data.recentSessions)
          ) {
            this.analytics = data;
            this.cdr.detectChanges();
          }
        });
      }
    }, 3000);
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  loadTenants() {
    const myTenantId = localStorage.getItem('tenantId');

    this.tenantService.getTenants().subscribe(data => {
      this.tenants = data.filter((t: any) => t._id === myTenantId);

      if (this.tenants.length > 0) {
        this.selectTenant(this.tenants[0]);
      }

      this.cdr.detectChanges();
    });
  }

  loadMemories() {
    if (!this.selectedTenant) return;
    this.knowledgeService.getAll(this.selectedTenant._id).subscribe((data) => {
      this.agentMemories = data;
      this.cdr.detectChanges();
    });
  }

  deleteMemory(id: string) {
    if (confirm('Are you sure you want to delete this knowledge entry?')) {
      this.knowledgeService.delete(id).subscribe(() => {
        this.loadMemories();
      });
    }
  }

  selectTenant(tenant: any) {
    this.selectedTenant = { ...tenant };
    if (!this.selectedTenant.allowedTools) {
      this.selectedTenant.allowedTools = [];
    }

    this.tenantService.getAvailableTools(this.selectedTenant.niche).subscribe((tools) => {
      this.availableTools = tools;
      this.cdr.detectChanges();
    });

    this.chatService.getAnalytics(this.selectedTenant._id).subscribe((data) => {
      this.analytics = data;
      this.cdr.detectChanges();
    });

    this.loadMemories();

    // Pre-fill account email
    this.accountEmail = tenant.email || '';
  }

  toggleTool(toolId: string) {
    const index = this.selectedTenant.allowedTools.indexOf(toolId);
    if (index > -1) {
      this.selectedTenant.allowedTools.splice(index, 1);
    } else {
      this.selectedTenant.allowedTools.push(toolId);
    }
  }

  openModal(modalName: typeof this.activeModal) {
    this.activeModal = modalName;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.activeModal = null;
    this.cdr.detectChanges();
  }

  saveTenantChanges() {
    this.isSaving = true;
    const { _id, name, systemPrompt, allowedTools, primaryColor, chatTitle } = this.selectedTenant;

    this.tenantService.updateTenant(_id, { name, systemPrompt, allowedTools, primaryColor, chatTitle }).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Agent profile updated successfully!');
        this.loadTenants();
        this.closeModal();
      },
      error: (err) => {
        this.isSaving = false;
        console.error(err);
        alert('Error saving changes.');
      }
    });
  }

  saveAccountChanges() {
    if (this.accountNewPassword && this.accountNewPassword !== this.accountNewPasswordConfirm) {
      alert('New passwords do not match.');
      return;
    }
    if (this.accountNewPassword && !this.accountCurrentPassword) {
      alert('Please enter your current password to change it.');
      return;
    }

    this.isSavingAccount = true;
    const payload: any = {};
    if (this.accountEmail && this.accountEmail !== this.selectedTenant.email) {
      payload.email = this.accountEmail;
    }
    if (this.accountNewPassword) {
      payload.currentPassword = this.accountCurrentPassword;
      payload.newPassword = this.accountNewPassword;
    }

    if (Object.keys(payload).length === 0) {
      this.isSavingAccount = false;
      this.closeModal();
      return;
    }

    this.tenantService.updateAccount(this.selectedTenant._id, payload).subscribe({
      next: () => {
        this.isSavingAccount = false;
        this.accountCurrentPassword = '';
        this.accountNewPassword = '';
        this.accountNewPasswordConfirm = '';
        alert('Account updated successfully!');
        this.closeModal();
      },
      error: (err) => {
        this.isSavingAccount = false;
        const message = err.error?.message || 'Error updating account.';
        alert(message);
      }
    });
  }

  addKnowledge() {
    if (!this.newKnowledgeContent.trim()) return;
    this.isLoadingKnowledge = true;
    this.knowledgeService
      .addKnowledge(this.selectedTenant._id, this.newKnowledgeContent)
      .subscribe({
        next: () => {
          this.newKnowledgeContent = '';
          this.isLoadingKnowledge = false;
          this.loadMemories();
          alert('Knowledge added successfully!');
        },
        error: (err) => {
          console.error(err);
          alert('Error saving knowledge.');
          this.isLoadingKnowledge = false;
        },
      });
  }

  uploadFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.processUploadedFile(file);
    event.target.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files[0];
    if (file) this.processUploadedFile(file);
  }

  private processUploadedFile(file: File) {
    const allowedTypes = ['application/pdf', 'text/markdown'];
    const allowedExtensions = ['.pdf', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      alert('Please upload PDF or Markdown (.md) files only.');
      return;
    }

    this.isLoadingKnowledge = true;
    this.knowledgeService.uploadFile(this.selectedTenant._id, file).subscribe({
      next: (res) => {
        this.isLoadingKnowledge = false;
        this.loadMemories();
        const chunksMsg = res.chunks ? ` in ${res.chunks} chunks` : '';
        alert(`File processed successfully! Learned ${res.chars} characters${chunksMsg}.`);
      },
      error: (err) => {
        console.error(err);
        alert('Error processing file.');
        this.isLoadingKnowledge = false;
      },
    });
  }

  truncate(text: string, maxLength: number = 150): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
