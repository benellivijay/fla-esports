'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { PillBadge } from '@/components/ui/PillBadge';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Lock,
  Mail,
  User,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { AdminApi } from '@/lib/api';

interface StaffUser {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: 'admin' | 'moderator';
  status: 'active' | 'suspended';
  totpSecret: string;
  totp_secret?: string;
  totp_enabled?: number;
  otpauthUri: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Staff Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator'>('admin');
  const [newTotpSecret, setNewTotpSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success Created Modal
  const [createdStaff, setCreatedStaff] = useState<StaffUser | null>(null);

  // View 2FA Modal
  const [viewing2FaStaff, setViewing2FaStaff] = useState<StaffUser | null>(null);

  // Reset Password Modal
  const [resetStaff, setResetStaff] = useState<StaffUser | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getStaff();
      if (res.data?.data) {
        setStaffList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const generateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewTotpSecret(result);
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
    let pass = 'Fla@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  };

  const handleOpenAddModal = () => {
    setNewEmail('');
    setNewUsername('');
    setNewDisplayName('');
    setNewPassword('');
    setNewRole('admin');
    generateRandomSecret();
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await AdminApi.createStaff({
        email: newEmail.trim(),
        username: newUsername.trim() || undefined,
        displayName: newDisplayName.trim() || undefined,
        password: newPassword,
        role: newRole,
        totpSecret: newTotpSecret.trim().toUpperCase() || undefined,
      });

      if (res.data?.data) {
        setIsAddModalOpen(false);
        setCreatedStaff(res.data.data);
        fetchStaff();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate2Fa = async (staff: StaffUser) => {
    if (!confirm(`Are you sure you want to regenerate a new 2FA Authenticator key for "${staff.email}"? The old authenticator key will stop working immediately.`)) {
      return;
    }

    try {
      const res = await AdminApi.regenerateStaffTotp(staff.id);
      if (res.data?.data) {
        setViewing2FaStaff({
          ...staff,
          totpSecret: res.data.data.totpSecret,
          otpauthUri: res.data.data.otpauthUri,
        });
        fetchStaff();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to regenerate 2FA key.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaff || resetNewPassword.length < 6) return;

    setIsSubmittingReset(true);
    try {
      await AdminApi.updateStaff(resetStaff.id, {
        password: resetNewPassword,
      });
      alert(`Password for ${resetStaff.email} updated successfully.`);
      setResetStaff(null);
      setResetNewPassword('');
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleToggleStatus = async (staff: StaffUser) => {
    const nextStatus = staff.status === 'active' ? 'suspended' : 'active';
    if (!confirm(`Are you sure you want to ${nextStatus === 'suspended' ? 'suspend' : 'reinstate'} "${staff.email}"?`)) {
      return;
    }

    try {
      await AdminApi.updateStaff(staff.id, { status: nextStatus });
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleDeleteStaff = async (staff: StaffUser) => {
    if (!confirm(`WARNING: Are you sure you want to permanently delete staff account "${staff.email}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await AdminApi.deleteStaff(staff.id);
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete staff account.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AdminLayout>
      <Header
        title="Staff & 2FA Management"
        description="Add new admin credentials, set passwords, and manage dedicated 2FA Authenticator keys"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Info Banner & Action Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-5 rounded-2xl border border-hairline border-border shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-textPrimary">Staff Access & TOTP 2FA Controls</h2>
              <p className="text-xs text-textSecondary mt-0.5">
                Each administrator or moderator has a dedicated secret key for Google Authenticator / Microsoft Authenticator.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="py-2 px-4 bg-primary hover:bg-primary-hover text-slate-950 font-bold text-xs rounded-full transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add new staff / admin</span>
          </button>
        </div>

        {/* Staff Table Card */}
        <Card orientation="vertical">
          <div className="p-4 border-b border-hairline border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary">
                Authorized Staff Accounts ({staffList.length})
              </h3>
            </div>
            <button
              onClick={fetchStaff}
              className="p-1.5 text-textSecondary hover:text-textPrimary rounded-lg hover:bg-surfaceMuted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-hairline border-border bg-surfaceMuted/50 text-textSecondary font-semibold">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">2FA Authenticator Key</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline divide-border">
                {isLoading && staffList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-textSecondary">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-textSecondary">
                      No staff accounts found. Click "Add new staff / admin" to create one.
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => {
                    const secretKey = staff.totp_secret || staff.totpSecret || 'FLAADMINAUTHK234';
                    return (
                      <tr key={staff.id} className="hover:bg-surfaceMuted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-bold text-textPrimary block">
                              {staff.display_name || staff.username || 'Staff'}
                            </span>
                            <span className="text-[11px] text-textSecondary flex items-center gap-1">
                              <Mail className="w-3 h-3 text-textMuted" />
                              {staff.email}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <PillBadge
                            label={staff.role === 'admin' ? 'SUPER ADMIN' : 'MODERATOR'}
                            variant={staff.role === 'admin' ? 'primary' : 'outline'}
                          />
                        </td>

                        <td className="py-3 px-4">
                          <PillBadge
                            label={staff.status.toUpperCase()}
                            variant={staff.status === 'active' ? 'success' : 'danger'}
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] bg-background px-2 py-1 rounded border border-hairline border-border font-bold text-primary">
                              {secretKey}
                            </span>
                            <button
                              onClick={() => copyToClipboard(secretKey, `key-${staff.id}`)}
                              className="p-1 text-textSecondary hover:text-textPrimary rounded transition-colors"
                              title="Copy 2FA Secret Key"
                            >
                              {copiedId === `key-${staff.id}` ? (
                                <Check className="w-3.5 h-3.5 text-status-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setViewing2FaStaff(staff)}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>Guide</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-textSecondary font-mono text-[11px]">
                          {new Date(staff.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setResetStaff(staff);
                                setResetNewPassword('');
                              }}
                              className="py-1 px-2.5 bg-surfaceMuted hover:bg-border text-textPrimary text-[11px] font-semibold rounded-md border border-hairline border-border transition-colors flex items-center gap-1"
                              title="Reset Password"
                            >
                              <Lock className="w-3 h-3 text-textSecondary" />
                              <span>Reset pass</span>
                            </button>

                            <button
                              onClick={() => handleRegenerate2Fa(staff)}
                              className="py-1 px-2.5 bg-surfaceMuted hover:bg-border text-primary text-[11px] font-semibold rounded-md border border-hairline border-border transition-colors flex items-center gap-1"
                              title="Regenerate Authenticator Key"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>New 2FA</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(staff)}
                              className={`py-1 px-2 text-[11px] font-semibold rounded-md transition-colors ${
                                staff.status === 'active'
                                  ? 'text-status-danger hover:bg-status-dangerBg'
                                  : 'text-status-success hover:bg-status-successBg'
                              }`}
                              title={staff.status === 'active' ? 'Suspend Staff' : 'Activate Staff'}
                            >
                              {staff.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>

                            <button
                              onClick={() => handleDeleteStaff(staff)}
                              className="p-1 text-textMuted hover:text-status-danger rounded transition-colors"
                              title="Delete staff account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ADD NEW STAFF MODAL */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Staff / Admin Account"
        >
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2 text-xs text-status-danger font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Staff Email Address <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. flaadmin02@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="flaadmin02"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary transition-colors font-medium"
                >
                  <option value="admin">Super Admin (Full Access)</option>
                  <option value="moderator">Moderator (Match Operations)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                Display / Staff Name
              </label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. FLA Operations Admin"
                className="w-full px-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-textSecondary">
                  Password <span className="text-primary">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate strong</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Dedicated TOTP 2FA Key Preview */}
            <div className="p-3 bg-surfaceMuted/80 rounded-xl border border-hairline border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-textPrimary flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Dedicated 2FA Authenticator Key</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomSecret}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  Regenerate
                </button>
              </div>
              <input
                type="text"
                required
                value={newTotpSecret}
                onChange={(e) => setNewTotpSecret(e.target.value.toUpperCase())}
                placeholder="16-character Base32 Key"
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-background border border-hairline border-border rounded-lg text-primary focus:outline-none focus:border-primary transition-colors tracking-widest text-center"
              />
              <p className="text-[10px] text-textSecondary">
                This Base32 key is added directly to Google Authenticator or Authy to generate 6-digit login codes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="py-2 px-4 bg-surfaceMuted hover:bg-border text-textSecondary text-xs font-semibold rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2 px-5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Create staff account</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ACCOUNT CREATED SUCCESS MODAL */}
      {createdStaff && (
        <Modal
          isOpen={Boolean(createdStaff)}
          onClose={() => setCreatedStaff(null)}
          title="Staff Account Created Successfully!"
        >
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-status-successBg border border-status-successBorder text-status-success flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-textPrimary">{createdStaff.email}</h3>
              <p className="text-xs text-textSecondary mt-0.5">
                Staff member can now log in using their credentials and Authenticator app.
              </p>
            </div>

            {/* Secret Key Card */}
            <div className="p-4 bg-surfaceMuted rounded-2xl border border-hairline border-border text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-textPrimary">2FA Secret Setup Key:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdStaff.totpSecret, 'created-key')}
                  className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
                >
                  {copiedId === 'created-key' ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'created-key' ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>

              <div className="p-2.5 bg-background border border-hairline border-border rounded-xl font-mono text-center font-bold text-sm text-primary tracking-widest select-all">
                {createdStaff.totpSecret}
              </div>

              <div className="space-y-1.5 text-xs text-textSecondary">
                <p className="font-semibold text-textPrimary">How to set up Google Authenticator / Authy:</p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Open <strong>Google Authenticator</strong> or <strong>Authy</strong>.</li>
                  <li>Tap <strong>+</strong> and select <strong>"Enter a setup key"</strong>.</li>
                  <li>Account name: <span className="font-semibold text-textPrimary">FLA ({createdStaff.email})</span></li>
                  <li>Your key: <span className="font-mono text-primary">{createdStaff.totpSecret}</span></li>
                  <li>Type of key: <strong>Time-based</strong> (30s).</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setCreatedStaff(null)}
              className="w-full py-2 px-4 bg-primary hover:bg-primary-hover text-slate-950 font-bold text-xs rounded-full transition-colors"
            >
              Done & close
            </button>
          </div>
        </Modal>
      )}

      {/* VIEW 2FA KEY MODAL */}
      {viewing2FaStaff && (
        <Modal
          isOpen={Boolean(viewing2FaStaff)}
          onClose={() => setViewing2FaStaff(null)}
          title={`2FA Authenticator Guide • ${viewing2FaStaff.email}`}
        >
          <div className="space-y-4 text-center">
            <div className="p-4 bg-surfaceMuted rounded-2xl border border-hairline border-border text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-textPrimary">Current 2FA Secret Key:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(viewing2FaStaff.totpSecret || viewing2FaStaff.totp_secret || '', 'view-key')}
                  className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
                >
                  {copiedId === 'view-key' ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'view-key' ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>

              <div className="p-2.5 bg-background border border-hairline border-border rounded-xl font-mono text-center font-bold text-sm text-primary tracking-widest select-all">
                {viewing2FaStaff.totpSecret || viewing2FaStaff.totp_secret}
              </div>

              <div className="space-y-1.5 text-xs text-textSecondary">
                <p className="font-semibold text-textPrimary">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Open <strong>Google Authenticator</strong> / <strong>Microsoft Authenticator</strong> / <strong>Authy</strong>.</li>
                  <li>Tap <strong>+</strong> and select <strong>"Enter a setup key"</strong>.</li>
                  <li>Account name: <span className="font-semibold text-textPrimary">FLA ({viewing2FaStaff.email})</span></li>
                  <li>Key: <span className="font-mono text-primary">{viewing2FaStaff.totpSecret || viewing2FaStaff.totp_secret}</span></li>
                  <li>Type of key: <strong>Time-based (30s)</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewing2FaStaff(null)}
                className="py-2 px-5 bg-surfaceMuted hover:bg-border text-textPrimary font-semibold text-xs rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetStaff && (
        <Modal
          isOpen={Boolean(resetStaff)}
          onClose={() => setResetStaff(null)}
          title={`Reset Password • ${resetStaff.email}`}
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1">
                New Password (minimum 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetStaff(null)}
                className="py-2 px-4 bg-surfaceMuted hover:bg-border text-textSecondary text-xs font-semibold rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReset || resetNewPassword.length < 6}
                className="py-2 px-5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSubmittingReset ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Update password</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
