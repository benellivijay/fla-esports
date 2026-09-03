'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  Search,
  ShieldCheck,
  UserX,
  UserCheck,
  Shield,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { ManagedUser, UserRole } from '@/types';

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Role Assignment Modal
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getUsers({
        search: searchQuery.trim() || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      if (res.data?.data?.users) {
        setUsers(res.data.data.users);
        setTotalUsers(res.data.data.total);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleToggleStatus = async (user: ManagedUser) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const confirmMsg =
      nextStatus === 'suspended'
        ? `Are you sure you want to suspend "${user.display_name || user.phone}"? They will not be able to log in or enter matches.`
        : `Reinstate account for "${user.display_name || user.phone}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      await AdminApi.updateUserStatus(user.id, nextStatus, 'Admin staff status toggle');
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  const handleOpenRoleModal = (user: ManagedUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleError(null);
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmittingRole(true);
    setRoleError(null);

    try {
      await AdminApi.updateUserRole(selectedUser.id, selectedRole);
      setIsRoleModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setRoleError(err.response?.data?.message || 'Failed to update user role.');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  return (
    <AdminLayout>
      <Header
        title="User management & staff roles"
        subtitle="Inspect player profiles, review KYC status, suspend accounts and assign administrative roles"
      />

      <div className="space-y-6 mt-6">
        {/* Search & Filters */}
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                placeholder="Search phone, email, Free Fire UID/IGN..."
                className="pl-8 pr-3 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/60 focus:outline-none focus:border-primary w-64 font-medium"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-medium"
            >
              <option value="all">All roles</option>
              <option value="user">Players only</option>
              <option value="moderator">Moderators only</option>
              <option value="admin">Admins only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-medium"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <button
            onClick={fetchUsers}
            className="px-3 py-1.5 text-xs font-semibold text-textSecondary hover:text-textPrimary bg-surfaceMuted rounded-lg border border-hairline border-border flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh ({totalUsers})</span>
          </button>
        </Card>

        {/* Users Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceMuted border-b border-hairline border-border text-textSecondary font-semibold">
                <tr>
                  <th className="px-5 py-3">Player / Phone</th>
                  <th className="px-4 py-3">Free Fire Identity</th>
                  <th className="px-4 py-3">KYC Verification</th>
                  <th className="px-4 py-3">Wallet balance</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-textSecondary">
                      No users found matching the query.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-surfaceMuted/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-textPrimary">
                          {u.display_name || 'Player'}
                        </div>
                        <div className="text-[11px] text-textSecondary font-medium">{u.phone || u.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.ff_uid ? (
                          <span className="font-mono text-primary font-medium">
                            {u.ff_uid} ({u.ff_ign})
                          </span>
                        ) : (
                          <span className="text-textSecondary/60 italic font-medium">Unlinked</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {u.is_phone_verified === 1 && (
                            <span className="px-2 py-0.5 bg-status-successBg text-status-success text-[10px] rounded-full border border-status-successBorder font-semibold">
                              Phone
                            </span>
                          )}
                          {u.is_email_verified === 1 && (
                            <span className="px-2 py-0.5 bg-status-successBg text-status-success text-[10px] rounded-full border border-status-successBorder font-semibold">
                              Email
                            </span>
                          )}
                          {u.is_phone_verified === 0 && u.is_email_verified === 0 && (
                            <span className="text-textSecondary/60 italic font-medium">Unverified</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-highlight">
                        ₹{u.walletBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5">
                        <PillBadge
                          label={u.role.toUpperCase()}
                          variant={
                            u.role === 'admin'
                              ? 'primary'
                              : u.role === 'moderator'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <PillBadge
                          label={u.status}
                          variant={u.status === 'active' ? 'success' : 'danger'}
                          size="sm"
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Role Assignment Button (Admin Only) */}
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            title="Assign staff role"
                            className="p-1.5 text-textSecondary hover:text-textPrimary bg-surfaceMuted hover:bg-surface rounded-lg border border-hairline border-border transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reinstate Toggle */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === 'active' ? 'Suspend user' : 'Reinstate user'}
                            className={`p-1.5 rounded-lg border border-hairline transition-colors ${
                              u.status === 'active'
                                ? 'text-status-danger hover:bg-status-dangerBg border-status-dangerBorder'
                                : 'text-status-success hover:bg-status-successBg border-status-successBorder'
                            }`}
                          >
                            {u.status === 'active' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Role Assignment Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={`Staff role assignment: ${selectedUser?.display_name || selectedUser?.phone || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveRole} className="space-y-4">
          <p className="text-xs text-textSecondary font-medium">
            Grant internal administration or moderation privileges. Role changes take effect on the user&apos;s next request.
          </p>

          {roleError && (
            <div className="p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2 text-xs text-status-danger font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
              <span>{roleError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Select Role Privilege Level
            </label>
            <select
              value={selectedRole}
              onChange={(e: any) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary font-semibold"
            >
              <option value="user">Player (Standard participant access)</option>
              <option value="moderator">Moderator (Review match results & room management)</option>
              <option value="admin">Administrator (Full control, payouts & user roles)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary rounded-full border border-hairline border-border hover:bg-surfaceMuted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingRole}
              className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isSubmittingRole ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              <span>Save role assignment</span>
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
