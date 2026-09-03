'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, KeyRound, ArrowRight, AlertCircle, RefreshCw, Copy, Check, Info, QrCode, Eye, EyeOff } from 'lucide-react';
import { AdminApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  // Step state: 1 = Email/Password, 2 = TOTP 2FA
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const currentSecretKey = email.toLowerCase().includes('01') ? 'FLAADMINAUTHK234' : 'JBSWY3DPEHPK3PXP';

  // Step 1: Submit email & password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await AdminApi.login(email.trim(), password);
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
      const res = await AdminApi.verifyTotp(tempToken, totpCode.trim());
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

  const copySecret = () => {
    navigator.clipboard.writeText(currentSecretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
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
                  placeholder="Enter staff email"
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-textSecondary">
                  6-digit 2FA code
                </label>
                <button
                  type="button"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  <span>{showSetupGuide ? 'Hide setup key' : 'Authenticator setup key'}</span>
                </button>
              </div>
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

            {/* Authenticator Setup Helper Box */}
            {showSetupGuide && (
              <div className="p-3 bg-surfaceMuted/80 rounded-xl border border-hairline border-border text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-textPrimary">2FA Secret Setup Key:</span>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="text-[11px] text-primary hover:text-primary-hover font-semibold flex items-center gap-1"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                  </button>
                </div>
                <div className="p-2 bg-background border border-hairline border-border rounded font-mono text-center font-bold text-xs text-primary select-all">
                  {currentSecretKey}
                </div>
                <ol className="text-[10px] text-textSecondary list-decimal list-inside space-y-1">
                  <li>Open <strong>Google Authenticator</strong> or <strong>Authy</strong>.</li>
                  <li>Tap <strong>+</strong> and choose <strong>"Enter a setup key"</strong>.</li>
                  <li>Account name: <span className="text-textPrimary font-semibold">FLA Admin ({email})</span></li>
                  <li>Paste key: <span className="text-primary font-mono">{currentSecretKey}</span></li>
                  <li>Type the generated 6-digit code above.</li>
                </ol>
              </div>
            )}

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
