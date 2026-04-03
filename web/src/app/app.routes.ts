import { Routes } from '@angular/router';
import { AdminComponent } from './pages/admin/admin.component';
import { LoginComponent } from './pages/login/login.component';
import { PublicChatComponent } from './pages/public-chat/public-chat.component';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent }, // <--- Ruta nueva
  { 
    path: 'admin', 
    component: AdminComponent,
    canActivate: [authGuard] // 👉 AÑADIMOS EL GUARDIÁN AQUÍ
  },
  { path: 'widget/:apiKey', component: PublicChatComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' } // <--- Ahora al entrar, te manda al login
];