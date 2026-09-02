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
  const [showQr, setShowQr] = useState(false);

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
        router.push('/');
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-hairline border-slate-200 p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 mb-3 shadow-md flex items-center justify-center">
            <img src="/app_logo.png?v=3" alt="FLA Esports" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">FLA ESPORTS Staff Portal</h1>
          <p className="text-xs text-slate-500 mt-1">
            {step === 1
              ? 'Enter your internal staff credentials to proceed'
              : 'Enter 6-digit TOTP code from your authenticator'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className={`h-1.5 w-12 rounded-full transition-all ${
              step === 1 ? 'bg-slate-900' : 'bg-emerald-500'
            }`}
          />
          <div
            className={`h-1.5 w-12 rounded-full transition-all ${
              step === 2 ? 'bg-slate-900' : 'bg-slate-200'
            }`}
          />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-hairline border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Step 1: Email + Password */}
        {step === 1 ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Staff email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ffesports.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium text-xs rounded-full transition-colors flex items-center justify-center gap-2 mt-2"
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
            <div className="p-3 bg-slate-50 rounded-lg border border-hairline border-slate-200 text-xs text-slate-600">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-800">Google Authenticator Required</span>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  {showQr ? 'Hide QR' : 'Setup Authenticator QR'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Enter the live 6-digit code from your Google Authenticator app (or dev code <code className="font-mono font-bold text-slate-900">123456</code>).
              </p>
            </div>

            {showQr && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-center space-y-3">
                <p className="text-[11px] font-medium text-slate-700">
                  Scan this QR code in <strong>Google Authenticator</strong>:
                </p>
                <div className="flex justify-center">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=otpauth%3A%2F%2Ftotp%2FFLA%2520ESPORTS%3Aflaadmin40%40gmail.com%3Fsecret%3DJBSWY3DPEHPK3PXP%26issuer%3DFLA%2520ESPORTS%26algorithm%3DSHA1%26digits%3D6%26period%3D30"
                    alt="Google Authenticator QR"
                    className="w-40 h-40 border border-slate-200 rounded-lg p-1 bg-white shadow-sm"
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  Manual Entry Key: <strong className="font-mono text-slate-900 select-all">JBSWY3DPEHPK3PXP</strong>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                6-digit authenticator code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 text-center tracking-[0.5em] text-sm font-mono font-bold bg-white border border-hairline border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium text-xs rounded-full transition-colors flex items-center justify-center gap-2"
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
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Back to password login
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <p className="text-center text-[11px] text-slate-400 mt-6">
        Internal Administration Dashboard • Role-based access controlled server-side
      </p>
    </div>
  );
}
