import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LogIn, Shield, Info, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import StaffForgotPasswordPage from './StaffForgotPasswordPage';
// @ts-ignore
import rkmLogo from '../assets/images/rkm_logo.png';
// @ts-ignore
import rkmPortrait from '../assets/images/regenerated_image_1783062789272.png';

interface AuthModuleProps {
  onLoginSuccess: (user: any, token: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const VIVEKANANDA_QUOTES = [
  "Arise, awake, and stop not till the goal is reached.",
  "You cannot believe in God until you believe in yourself.",
  "Truth can be stated in a thousand different ways, yet each one can be true.",
  "The greatest sin is to think yourself weak.",
  "In a conflict between the heart and the brain, follow your heart.",
  "Talk to yourself once in a day, otherwise you may miss meeting an excellent person in this world.",
  "All the powers in the universe are already ours. It is we who have put our hands before our eyes and cry that it is dark.",
  "Take up one idea. Make that one idea your life; dream of it; think of it; live on that idea."
];

export default function AuthModule({ onLoginSuccess, showToast }: AuthModuleProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isForgotPasswordPage, setIsForgotPasswordPage] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.includes('forgot-password');
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % VIVEKANANDA_QUOTES.length);
        setFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      let rawBase = (import.meta.env.VITE_API_BASE_URL || '/api/admin').replace(/\/+$/, '');
      if (rawBase.endsWith('/api')) {
        rawBase = rawBase.substring(0, rawBase.length - 4);
      }

      const candidateUrls = [
        '/api/admin/auth/login',
        `${rawBase}/auth/login`,
        '/auth/login'
      ];

      let response: Response | null = null;

      for (const url of candidateUrls) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          if (r && (r.ok || r.status === 401 || r.status === 403)) {
            response = r;
            break;
          }
        } catch (fetchErr) {
          // try next candidate URL
        }
      }

      if (!response) {
        throw new Error('Unable to connect to login server. Please check backend status.');
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Invalid credentials');
      }

      // 3. Extract your data packets cleanly matching your original state structures
      const role = responseData.user?.role;

      if (role === 'admin') {
        localStorage.setItem('token', responseData.token);
        localStorage.setItem('user', JSON.stringify(responseData.user));
        showToast('Successfully logged in!', 'success');
        setUsername('');
        setPassword('');
        onLoginSuccess(responseData.user, responseData.token);
        window.location.href = '/admin/'; // Keep relative path admin routing logic
      } else if (role === 'canteen_staff') {
        const token = responseData.token;
        const userJson = JSON.stringify(responseData.user);
        window.location.href = `/canteen/?token=${encodeURIComponent(token)}&user=${encodeURIComponent(userJson)}`;
      } else if (role === 'approval_staff' || role === 'staff') {
        const token = responseData.token;
        const userJson = JSON.stringify(responseData.user);
        window.location.href = `/staff/?token=${encodeURIComponent(token)}&user=${encodeURIComponent(userJson)}`;
      } else if (role === 'student') {
        showToast('Students must authenticate via the Student Portal link.', 'error');
        setFormError('Students must authenticate via the Student Portal link.');
        setLoading(false);
        return;
      } else {
        showToast('Invalid role specified.', 'error');
        setFormError('Invalid role specified.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      const errMsg = err.message || 'Login failed';
      showToast(errMsg, 'error');
      setFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPasswordPage) {
    return (
      <StaffForgotPasswordPage
        initialUsername={username}
        onBackToLogin={() => {
          setIsForgotPasswordPage(false);
          window.history.replaceState({}, '', '/admin-login/');
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#FFFBF7] transition-colors duration-200">
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <div className="bg-white border-b-3 border-[#FA9632] px-4 py-3.5 md:px-6 md:py-5 flex items-center justify-center relative shadow-sm shrink-0">
          <div className="flex items-center justify-center mb-1">
            {rkmLogo ? (
              <img src={rkmLogo} alt="Ramakrishna Mission Crest" className="h-10 w-10 md:h-14 md:w-14 object-contain" />
            ) : (
              <div className="h-10 w-10 md:h-14 md:w-14 bg-saffron-100 rounded-full flex items-center justify-center text-saffron-700 font-bold text-lg">R</div>
            )}
          </div>
          <h1 className="text-xs sm:text-base md:text-2xl font-extrabold text-[#1E293B] tracking-wide text-center uppercase font-sans leading-tight ml-3">
            RAMAKRISHNA MISSION VIVEKANANDA COLLEGE (Autonomous)
          </h1>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wider text-center uppercase font-sans mt-1 ml-3">
            Mylapore, Chennai-600004.
          </p>
  
        </div>

        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center p-4 md:p-8">
          <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch my-auto">
            <div className="hidden lg:flex lg:col-span-6 flex-col justify-between">
              <div className="bg-white border border-[#FCEFD9] rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center flex-1 min-h-[350px]">
                <img
                  src={rkmPortrait}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = "https://upload.wikimedia.org/wikipedia/commons/b/bf/Swami_Vivekananda_colour_image.png";
                  }}
                  alt="Swami Vivekananda portrait"
                  className="rounded-2xl h-[364px] w-auto object-contain border border-slate-100 shadow-md aspect-[3/4]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="bg-[#2E2520] rounded-2xl p-4 border-l-4 border-[#FA9632] mt-4 text-center shadow-md min-h-[90px] flex flex-col justify-center">
                <span className={`italic text-white text-xs md:text-sm font-semibold block leading-relaxed transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
                  "{VIVEKANANDA_QUOTES[quoteIndex]}"
                </span>
                <span className="text-[10px] text-[#FBBF24] font-extrabold block mt-2 tracking-widest uppercase">
                  — SWAMI VIVEKANANDA
                </span>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center self-center w-full">
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-fit flex flex-col justify-center"
              >
                <div className="bg-white border border-[#FCEFD9] rounded-3xl shadow-lg overflow-hidden flex flex-col justify-start w-full h-fit">
                  <div className="bg-[#FA9632] text-white p-4 flex flex-col gap-3 items-center justify-center relative">
                    <div className="lg:hidden relative w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-white flex items-center justify-center">
                      <img
                        src={rkmPortrait}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = "https://upload.wikimedia.org/wikipedia/commons/b/bf/Swami_Vivekananda_colour_image.png";
                        }}
                        className="w-full h-full object-cover object-top scale-105"
                        alt="Swami Vivekananda Avatar"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex items-center gap-2 font-bold text-xs md:text-sm tracking-wide justify-center">
                      <Shield className="h-4 w-4 text-white" />
                      <span>Meal Portal Login</span>
                    </div>
                  </div>

                  <div className="p-4 md:p-5 flex flex-col justify-start space-y-6">
                    <div className="bg-[#FFFBEB] border border-dashed border-[#FBBF24] rounded-xl p-3 text-xs flex gap-2.5 text-amber-900 leading-normal">
                      <Info className="h-4.5 w-4.5 text-[#FBBF24] flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[10.5px] text-[#B45309] block">Secure Login</span>
                        <p className="text-slate-600 text-[10px] mt-0.5">
                          Use your registered username and password. Staff and Admin all sign in here.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wide text-slate-600 mb-1">
                          Username / ID
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g., admin, STAFF101"
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FA9632] font-semibold text-slate-800 transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              window.history.pushState({}, '', '/admin-login/forgot-password');
                              setIsForgotPasswordPage(true);
                            }}
                            className="text-[10.5px] font-bold text-[#FA9632] hover:text-[#E58222] transition-colors cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="********"
                            className="w-full px-3.5 py-2 pr-10 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FA9632] font-semibold text-slate-800 transition-all shadow-inner"
                          />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                              title={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                      </div>
                      {formError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold rounded-lg px-3 py-2">
                          {formError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#FA9632] hover:bg-[#E58222] text-white font-extrabold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-3.5 text-xs"
                      >
                        {loading ? (
                          <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <><LogIn className="h-4 w-4" /> Sign In</>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <footer className="bg-[#1C1613] text-stone-400 py-6 px-4 mt-auto border-t border-[#FA9632]/20 text-center space-y-3 shrink-0">
          <p className="text-[11px] md:text-xs text-stone-400 leading-relaxed font-medium">
            © 2026 Ramakrishna Mission Vivekananda College. All Rights Reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
