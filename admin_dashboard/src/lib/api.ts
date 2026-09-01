import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Admin JWT Token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isAuthRoute = window.location.pathname.startsWith('/login');
      if (!isAuthRoute) {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const AdminApi = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/admin/auth/login', { email, password }),

  verifyTotp: (tempToken: string, totpCode: string) =>
    apiClient.post('/admin/auth/2fa/verify', { tempToken, totpCode }),

  // Dashboard Stats
  getDashboardStats: () =>
    apiClient.get('/admin/dashboard/stats'),

  // Tournaments
  getTournaments: (params?: any) =>
    apiClient.get('/admin/tournaments', { params }),

  getTournamentById: (id: string) =>
    apiClient.get(`/admin/tournaments/${id}`),

  createTournament: (data: any) =>
    apiClient.post('/admin/tournaments', data),

  updateTournament: (id: string, data: any) =>
    apiClient.patch(`/admin/tournaments/${id}`, data),

  updateRoomCredentials: (id: string, data: { roomId: string; roomPassword?: string; forceUpdateAfterStart?: boolean }) =>
    apiClient.patch(`/admin/tournaments/${id}/room`, data),

  revealRoom: (id: string) =>
    apiClient.post(`/admin/tournaments/${id}/reveal-room`),

  cancelTournament: (id: string, reason?: string) =>
    apiClient.post(`/admin/tournaments/${id}/cancel`, { reason }),

  // Result Review Queue
  getResultsQueue: (params?: { tournamentId?: string; status?: string }) =>
    apiClient.get('/admin/results/queue', { params }),

  verifyResult: (resultId: string, data: { confirmedRank?: number; confirmedKills?: number }) =>
    apiClient.patch(`/admin/results/${resultId}/verify`, data),

  disputeResult: (resultId: string, reasonNote: string) =>
    apiClient.patch(`/admin/results/${resultId}/dispute`, { reasonNote }),

  // Payout Runs (Idempotent)
  getPayoutPreview: (tournamentId: string) =>
    apiClient.get(`/admin/tournaments/${tournamentId}/payout-preview`),

  executePayoutRun: (tournamentId: string) =>
    apiClient.post(`/admin/tournaments/${tournamentId}/payout-run`),

  // User Management
  getUsers: (params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) =>
    apiClient.get('/admin/users', { params }),

  updateUserStatus: (userId: string, status: 'active' | 'suspended' | 'banned', reason?: string) =>
    apiClient.patch(`/admin/users/${userId}/status`, { status, reason }),

  updateUserRole: (userId: string, role: 'user' | 'moderator' | 'admin') =>
    apiClient.patch(`/admin/users/${userId}/role`, { role }),

  // Wallet Management
  getUserLedger: (userId: string) =>
    apiClient.get(`/admin/users/${userId}/ledger`),

  adjustWallet: (data: { targetUserId: string; amount: number; type: 'deposit' | 'refund' | 'entry_fee_debit'; reason: string }) =>
    apiClient.post('/admin/wallet/adjust', data),

  // UPI QR Deposit Queue & Approvals (Option A)
  getDepositQueue: (params?: { status?: string }) =>
    apiClient.get('/admin/deposits/queue', { params }),

  approveDeposit: (orderId: string) =>
    apiClient.post(`/admin/deposits/${orderId}/approve`),

  rejectDeposit: (orderId: string, reason?: string) =>
    apiClient.post(`/admin/deposits/${orderId}/reject`, { reason }),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; actorId?: string }) =>
    apiClient.get('/admin/audit-logs', { params }),
};
