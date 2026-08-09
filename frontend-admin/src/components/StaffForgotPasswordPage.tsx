import React, { useState } from 'react';
import { Key, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Shield, Mail } from 'lucide-react';
// @ts-ignore
import rkmLogo from '../assets/images/rkm_logo.png';
// @ts-ignore
import rkmPortrait from '../assets/images/regenerated_image_1783062789272.png';

interface StaffForgotPasswordPageProps {
  initialUsername?: string;
  onBackToLogin: () => void;
}

export default function StaffForgotPasswordPage({
  initialUsername = '',
  onBackToLogin
}: StaffForgotPasswordPageProps) {
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);
  const [userChecked, setUserChecked] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCheckUser = async () => {
    const trimmedId = username.trim();
    if (!trimmedId) return;
    setCheckingUser(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedId })
      });
      const data = await res.json();
      if (res.ok && data.exists) {
        setUserChecked(true);
      } else {
        setUserChecked(false);
        setError(data.error || 'Staff user with this Username / ID was not found in database.');
      }
    } catch (e) {
      console.warn("Staff user check failed:", e);
    } finally {
      setCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      setError('Please enter your Username.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter your registered Email Address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, email: trimmedEmail })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password. Please verify your details.');
      }

      setSuccessMsg(data.message || 'Password reset successfully! A new password has been sent to your email address.');
    } catch (err: any) {
      setError(err.message || 'An error occurred while attempting to reset staff password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#FFFBF7] font-sans">
      {/* Header */}
      <header className="bg-white border-b-4 border-[#FA9632] px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          {rkmLogo && <img src={rkmLogo} alt="RKM Crest" className="h-10 w-10 object-contain" />}
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-[#1E293B] tracking-wide uppercase font-sans">
              RAMAKRISHNA MISSION VIVEKANANDA COLLEGE
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Mylapore, Chennai - 600 004.
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-[#FCEFD9] rounded-3xl shadow-xl overflow-hidden">
          {/* Top Title */}
          <div className="pt-6 pb-1 text-center">
            <h2 className="text-xl font-extrabold tracking-tight text-[#FA9632]">Staff Forgot Password</h2>
          </div>

          <div className="p-6 space-y-5">
            {successMsg ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-950 leading-relaxed">
                    <strong className="block font-bold text-emerald-900 mb-1">Password Reset Successful!</strong>
                    {successMsg} Please check your email inbox to retrieve your new password.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full py-3.5 bg-[#FA9632] hover:bg-[#E58222] text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Proceed to Staff Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUserChecked(null);
                    }}
                    onBlur={handleCheckUser}
                    placeholder="e.g., admin, STAFF101"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FA9632] text-slate-800 transition-all shadow-inner"
                  />
                  {checkingUser && (
                    <span className="text-[10px] text-amber-600 font-semibold mt-1 block">Checking database for staff account...</span>
                  )}
                  {userChecked === true && (
                    <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Staff user verified in database
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@example.com"
                      className="w-full px-4 py-3 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FA9632] text-slate-800 transition-all shadow-inner"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#FA9632] hover:bg-[#E58222] text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2"
                >
                  {loading ? (
                    <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Generate New Password</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="text-xs font-bold text-slate-500 hover:text-[#FA9632] transition-colors cursor-pointer"
                  >
                    Return to Staff Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="py-4 px-6 bg-[#1C1613] text-stone-400 text-center text-xs border-t border-[#FA9632]/20">
        © 2026 Ramakrishna Mission Vivekananda College. All Rights Reserved.
      </footer>
    </div>
  );
}
