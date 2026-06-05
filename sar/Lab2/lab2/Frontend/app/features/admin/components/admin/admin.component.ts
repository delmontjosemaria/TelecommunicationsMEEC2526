import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SigninService } from '../../../../core/services';
import { User, Item } from '../../../../core/models';
import { jwtDecode } from "/workspaces/lab2/node_modules/jwt-decode/build/esm/index";
import type { JwtPayload } from '../../../../core/models/jwt.model';

interface AuditLog {
  _id: string;
  action: string;
  performedBy: string;
  targetType: string;
  targetId: string;
  reason?: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
  standalone: false
})
export class AdminComponent implements OnInit {

  activeTab: 'users' | 'items' | 'logs' = 'users';

  users: any[] = [];
  items: Item[] = [];
  auditLogs: AuditLog[] = [];

  errorMessage = '';
  successMessage = '';

  // Block user modal
  showBlockModal = false;
  selectedUser: any = null;
  blockReason = '';

  // Remove item modal
  showRemoveItemModal = false;
  selectedItem: any = null;
  removeReason = '';

  private apiBase = '/api/admin';
  isAdmin : boolean = false;

  constructor(
    private http: HttpClient,
    private signinService: SigninService,
    private router: Router
  ) {}

  ngOnInit(): void {

     //signature already valid because he signed in
     const decoded = jwtDecode<JwtPayload>(this.signinService.token.token);
     this.isAdmin = decoded.role === 'admin';

    // Redirect if not admin
    if (!this.isAdmin) {
      this.router.navigate(['/auction']);
      return;
    }
    this.loadUsers();
    this.loadItems();
  }

  private get headers(): HttpHeaders {
    const token = this.signinService.token.token;
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // load data
  loadUsers(): void {
    this.http.get<any[]>(`${this.apiBase}/users`, { headers: this.headers })
      .subscribe({
        next: data => this.users = data,
        error: () => this.showError('Failed to load users')
      });
  }

  loadItems(): void {
    this.http.get<Item[]>('/api/items', { headers: this.headers })
      .subscribe({
        next: data => this.items = data,
        error: () => this.showError('Failed to load items')
      });
  }

  loadLogs(): void {
    this.http.get<AuditLog[]>(`${this.apiBase}/audit-logs`, { headers: this.headers })
      .subscribe({
        next: data => this.auditLogs = data,
        error: () => this.showError('Failed to load audit logs')
      });
  }

  // block / unblock user 
  openBlockModal(user: any): void {
    this.selectedUser = user;
    this.blockReason = '';
    this.showBlockModal = true;
  }

  blockUser(): void {
    if (!this.selectedUser) return;
    this.http.post(
      `${this.apiBase}/users/${this.selectedUser._id}/block`,
      { reason: this.blockReason },
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.selectedUser.isActive = false;
        this.showSuccess(`${this.selectedUser.username} blocked.`);
        this.closeModals();
      },
      error: () => this.showError('Failed to block user')
    });
  }

  unblockUser(user: any): void {
    this.http.post(
      `${this.apiBase}/users/${user._id}/unblock`,
      {},
      { headers: this.headers }
    ).subscribe({
      next: () => {
        user.isActive = true;
        this.showSuccess(`${user.username} unblocked.`);
      },
      error: () => this.showError('Failed to unblock user')
    });
  }

  // role change

  onRoleChange(user: any, event: Event): void {
    const role = (event.target as HTMLSelectElement).value;
    this.http.patch(
      `${this.apiBase}/users/${user._id}/role`,
      { role },
      { headers: this.headers }
    ).subscribe({
      next: () => {
        user.role = role;
        this.showSuccess(`${user.username} role set to ${role}.`);
      },
      error: () => this.showError('Failed to update role')
    });
  }

  // remove item

  openRemoveItemModal(item: any): void {
    this.selectedItem = item;
    this.removeReason = '';
    this.showRemoveItemModal = true;
  }

  removeItem(): void {
    if (!this.selectedItem) return;
    this.http.delete(
      `${this.apiBase}/items/${this.selectedItem._id}`,
      { headers: this.headers, body: { reason: this.removeReason } }
    ).subscribe({
      next: () => {
        this.items = this.items.filter(i => (i as any)._id !== this.selectedItem._id);
        this.showSuccess(`Item "${this.selectedItem.title}" removed.`);
        this.closeModals();
      },
      error: () => this.showError('Failed to remove item')
    });
  }

  // Modal helpers

  closeModals(): void {
    this.showBlockModal = false;
    this.showRemoveItemModal = false;
    this.selectedUser = null;
    this.selectedItem = null;
  }

  // Feedback

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage = '', 5000);
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 4000);
  }
}