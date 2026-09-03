'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, KeyRound, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  // Step state: 1 = Email/Password, 2 = TOTP 2FA
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('flaadmin40@gmail.com');
  const [password, setPassword] = useState('Fla@714367');
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Submit email & password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await AdminApi.login(email, password);
      if (res.data?.success && res.data?.data?.tempToken) {
        setTempToken(res.data.data.tempToken);
        setStep(2);
      } else {
        setError('Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit TOTP 2FA Code
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await AdminApi.verifyTotp(tempToken, totpCode);
      if (res.data?.success && res.data?.data?.accessToken) {
        localStorage.setItem('admin_access_token', res.data.data.accessToken);
        localStorage.setItem('admin_user', JSON.stringify(res.data.data.user));
        window.location.replace('/');
      } else {
        setError('2FA verification failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid 2FA code. Please check your authenticator app.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-textPrimary flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="w-full max-w-md bg-surface rounded-2xl border border-hairline border-border p-8 shadow-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border bg-surfaceMuted mb-3 shadow-md flex items-center justify-center">
            <img src="/app_logo.png?v=3" alt="FLA Esports" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-textPrimary">FLA ESPORTS Staff Portal</h1>
          <p className="text-xs text-textSecondary mt-1 font-medium">
            {step === 1
              ? 'Enter your internal staff credentials to proceed'
              : 'Enter 6-digit 2FA verification code'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className={`h-1.5 w-12 rounded-full transition-all ${
              step === 1 ? 'bg-primary' : 'bg-status-success'
            }`}
          />
          <div
            className={`h-1.5 w-12 rounded-full transition-all ${
              step === 2 ? 'bg-primary' : 'bg-border'
            }`}
          />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-status-dangerBg border border-hairline border-status-dangerBorder flex items-start gap-2.5 text-xs text-status-danger font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Step 1: Email + Password */}
        {step === 1 ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                Staff email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ffesports.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceMuted border border-hairline border-border rounded-lg text-textPrimary placeholder:text-textSecondary/50 focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 font-bold text-xs rounded-full transition-colors flex items-center justify-center gap-2 mt-2 shadow-xs"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Continue to 2FA</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Form Step 2: TOTP 2FA */
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-textSecondary mb-1.5">
                6-digit 2FA code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 text-center tracking-[0.5em] text-sm font-mono font-bold bg-surfaceMuted border border-hairline border-border rounded-lg text-primary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-slate-950 font-bold text-xs rounded-full transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Verify & enter dashboard</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setTotpCode('');
                setError(null);
              }}
              className="w-full text-center text-xs text-textSecondary hover:text-textPrimary font-semibold transition-colors"
            >
              ← Back to password login
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <p className="text-center text-[11px] text-textSecondary/60 mt-6 font-medium">
        Internal Administration Dashboard • Role-based access controlled server-side
      </p>
    </div>
  );
}
