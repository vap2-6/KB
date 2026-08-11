import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Home,
  User,
  LayoutDashboard,
  BookOpen,
  Calendar,
  CreditCard,
  Coffee,
  LogOut,
  Clock,
  Lock,
  Download,
  CheckCircle,
  QrCode,
  ArrowRight,
  GraduationCap,
  AlertCircle,
  Printer,
  ChevronRight,
  ShieldCheck,
  Menu,
  X,
  Database,
  Book,
  Compass,
  DollarSign,
  Heart,
  Check,
  Info,
  Utensils,
  Trash2,
  History,
  Sun,
  Moon,
  Palette,
  ChevronDown,
  WifiOff,
  RefreshCw,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, MealType, TokenHistoryItem } from './types';
import MealToken from './components/MealToken';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import StudentForgotPasswordPage from './components/StudentForgotPasswordPage';
import rkmvcLogo from './assets/images/rkm_logo.png';
// @ts-ignore
import rkmPortrait from './assets/images/regenerated_image_1783062789272.png';

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



export default function App() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Quote rotator
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'canteen' | 'history'>('canteen');

  // Student persistence state
  const [studentsList, setStudentsList] = useState<Student[]>(() => {
    const saved = localStorage.getItem('rkmvc_students_list');
    return saved ? JSON.parse(saved) : [];
  });

  // Change Password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isForgotPasswordPage, setIsForgotPasswordPage] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.includes('forgot-password');
  });

  const hasUpperCase = /[A-Z]/.test(newPasswordInput);
  const hasLowerCase = /[a-z]/.test(newPasswordInput);
  const hasDigit = /\d/.test(newPasswordInput);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPasswordInput);
  const hasMinLength = newPasswordInput.length >= 8;

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Canteen states — server-driven token state
  const [selectedMeal, setSelectedMeal] = useState<MealType>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTokenUtilized, setIsTokenUtilized] = useState<boolean>(false);
  const [staffApprovalStatus, setStaffApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Server-driven token state (replaces localStorage timers)
  interface ActiveTokenState {
    status: 'none' | 'not_eligible' | 'closed' | 'pending_approval' | 'open' | 'active' | 'claimed' | 'redeemed' | 'expired' | 'rejected';
    qrCodeUrl: string | null;
    expiresAtMs: number; // absolute timestamp in ms for countdown
    tokenId: string | null;
  }
  const [breakfastToken, setBreakfastToken] = useState<ActiveTokenState>({ status: 'closed', qrCodeUrl: null, expiresAtMs: 0, tokenId: null });
  const [lunchToken, setLunchToken] = useState<ActiveTokenState>({ status: 'closed', qrCodeUrl: null, expiresAtMs: 0, tokenId: null });
  const [breakfastTimeLeft, setBreakfastTimeLeft] = useState(0);
  const [lunchTimeLeft, setLunchTimeLeft] = useState(0);

  const [mealWindowConfig, setMealWindowConfig] = useState<{
    bfStart?: string;
    bfEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
    bfRawStart?: string;
    bfRawEnd?: string;
    bfExpiry?: number;
    lunchRawStart?: string;
    lunchRawEnd?: string;
    lunchExpiry?: number;
  }>({});

  const format12Hour = (time24?: string) => {
    if (!time24) return undefined;
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const hDisplay = h < 10 ? `0${h}` : `${h}`;
    return `${hDisplay}:${m} ${ampm}`;
  };

  const isTimeInWindow = (start24?: string, end24?: string, expiryMins: number = 15) => {
    if (!start24 || !end24) return false;
    const now = new Date();
    const [sH, sM] = start24.split(':').map(Number);
    const [eH, eM] = end24.split(':').map(Number);
    
    const startTime = new Date(now);
    startTime.setHours(sH, sM, 0, 0);
    
    const endTime = new Date(now);
    endTime.setHours(eH, eM + expiryMins, 0, 0);
    
    return now >= startTime && now <= endTime;
  };

  const [isBreakfastActivated, setIsBreakfastActivated] = useState(false);
  const [isLunchActivated, setIsLunchActivated] = useState(false);

  const [theme, setTheme] = useState<'white' | 'black'>(() => {
    return (localStorage.getItem('rkmvc_theme') as 'white' | 'black') || 'white';
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [rollQrCodeUrl, setRollQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (loggedInStudent) {
      QRCode.toDataURL(loggedInStudent.roll, {
        width: 320,
        margin: 1,
        color: {
          dark: '#09090b',
          light: '#ffffff',
        },
      }).then(url => {
        setRollQrCodeUrl(url);
      }).catch(err => {
        console.error('Failed to generate roll QR code', err);
      });
    }
  }, [loggedInStudent]);

  useEffect(() => {
    localStorage.setItem('rkmvc_theme', theme);
  }, [theme]);

  // Fetch Admin Configured Meal Window Timings on mount
  useEffect(() => {
    const fetchMealConfig = async () => {
      try {
        const cfgRes = await fetch('/api/public/meal-config');
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          const fn = cfg.forenoon || {};
          const an = cfg.afternoon || {};
          const bfStart = fn.start || '07:30';
          const bfEnd = fn.end || '10:00';
          const lunchStart = an.start || '12:00';
          const lunchEnd = an.end || '14:30';
          setMealWindowConfig({
            bfStart: format12Hour(bfStart),
            bfEnd: format12Hour(bfEnd),
            lunchStart: format12Hour(lunchStart),
            lunchEnd: format12Hour(lunchEnd),
            bfRawStart: bfStart,
            bfRawEnd: bfEnd,
            bfExpiry: fn.expiry ?? 15,
            lunchRawStart: lunchStart,
            lunchRawEnd: lunchEnd,
            lunchExpiry: an.expiry ?? 15,
          });
        }
      } catch (e) { }
    };
    fetchMealConfig();
  }, []);

  // === SERVER POLLING: Fetch active tokens every 8 seconds ===
  useEffect(() => {
    if (!loggedInStudent) return;

    const pollTokens = async () => {
      try {
        // Fetch Admin Configured Meal Window Timings & Expiry
        let activeBfStart = '07:30';
        let activeBfEnd = '10:00';
        let activeBfExpiry = 15;
        let activeLunchStart = '12:00';
        let activeLunchEnd = '14:30';
        let activeLunchExpiry = 15;

        try {
          const cfgRes = await fetch('/api/public/meal-config');
          if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            const fn = cfg.forenoon || {};
            const an = cfg.afternoon || {};
            if (fn.start) activeBfStart = fn.start;
            if (fn.end) activeBfEnd = fn.end;
            if (fn.expiry !== undefined) activeBfExpiry = fn.expiry;

            if (an.start) activeLunchStart = an.start;
            if (an.end) activeLunchEnd = an.end;
            if (an.expiry !== undefined) activeLunchExpiry = an.expiry;

            setMealWindowConfig({
              bfStart: format12Hour(activeBfStart),
              bfEnd: format12Hour(activeBfEnd),
              lunchStart: format12Hour(activeLunchStart),
              lunchEnd: format12Hour(activeLunchEnd),
              bfRawStart: activeBfStart,
              bfRawEnd: activeBfEnd,
              bfExpiry: activeBfExpiry,
              lunchRawStart: activeLunchStart,
              lunchRawEnd: activeLunchEnd,
              lunchExpiry: activeLunchExpiry,
            });
          }
        } catch (e) { }

        let res = await fetch(`/api/staff/tokens?student_reg=${encodeURIComponent(loggedInStudent.id)}`);
        let allTokens: any[] = [];
        if (res.ok) {
          allTokens = await res.json();
        }
        if (allTokens.length === 0 && loggedInStudent.roll && loggedInStudent.roll !== loggedInStudent.id) {
          const res2 = await fetch(`/api/staff/tokens?student_reg=${encodeURIComponent(loggedInStudent.roll)}`);
          if (res2.ok) {
            allTokens = await res2.json();
          }
        }

        // Map all tokens for history view
        const historyItems: TokenHistoryItem[] = allTokens.map((t: any) => {
          const mealName = (t.meal_type || '').toLowerCase().includes('breakfast') || (t.meal_type || '').toLowerCase().includes('forenoon') ? 'Breakfast' : 'Lunch';
          const rawDate = t.created_at || t.generated_at || t.scanned_at || new Date().toISOString();
          const dt = new Date(rawDate);
          const dateStr = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const st = (t.status || '').toLowerCase();

          let statusText = 'Pending Approval';
          if (st === 'active' || st === 'approved' || st === 'token_issued' || st === 'staff_verified' || st === 'awaiting_scan' || st === 'open') {
            statusText = 'Open / Issued';
          } else if (st === 'redeemed' || st === 'claimed' || st === 'used') {
            statusText = 'Claimed';
          } else if (st === 'expired') {
            statusText = 'Expired';
          } else if (st === 'rejected') {
            statusText = 'Rejected';
          }

          return {
            id: t.token_id || t.token_uid || t.id || String(Math.random()),
            token_id: t.token_id || t.token_uid || 'TOK-REG',
            meal: mealName,
            date: dateStr,
            time: timeStr,
            status: statusText
          };
        });

        setTokenHistory(historyItems);

        // Find today's tokens for this student using local date YYYY-MM-DD
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Check Student Eligibility
        const isBfEligible = loggedInStudent.forenoon_meal !== false && (loggedInStudent as any).forenoon_meal !== 0;
        const isLunchEligible = loggedInStudent.afternoon_meal !== false && (loggedInStudent as any).afternoon_meal !== 0;

        // Check Window Active Time (Admin Config Window Check)
        const isBfWindowActive = isTimeInWindow(activeBfStart, activeBfEnd, activeBfExpiry);
        const isLunchWindowActive = isTimeInWindow(activeLunchStart, activeLunchEnd, activeLunchExpiry);

        const parseLocalISO = (strVal: any) => {
          if (!strVal) return 0;
          const clean = String(strVal).trim().replace('T', ' ').split('.')[0];
          const parts = clean.split(' ');
          if (parts.length >= 2) {
            const dateParts = parts[0].split('-').map(Number);
            const timeParts = parts[1].split(':').map(Number);
            if (dateParts.length === 3 && timeParts.length >= 2) {
              return new Date(
                dateParts[0],
                dateParts[1] - 1,
                dateParts[2],
                timeParts[0],
                timeParts[1],
                timeParts[2] || 0
              ).getTime();
            }
          }
          const fallback = new Date(strVal).getTime();
          return isNaN(fallback) ? 0 : fallback;
        };

        const getMealState = async (
          mealName: 'Breakfast' | 'Lunch',
          isEligible: boolean,
          isWindowActive: boolean
        ): Promise<ActiveTokenState> => {
          if (!isEligible) {
            return { status: 'not_eligible', qrCodeUrl: null, expiresAtMs: 0, tokenId: null };
          }

          // Filter tokens for this meal today
          const matchingTokens = allTokens.filter((t: any) => {
            const mt = (t.meal_type || '').toLowerCase();
            const isMealMatch = mealName === 'Breakfast' 
              ? (mt.includes('breakfast') || mt.includes('forenoon')) 
              : (mt.includes('lunch') || mt.includes('afternoon'));
            if (!isMealMatch) return false;
            const rawDateStr = t.created_at || t.generated_at || '';
            const tokenDate = rawDateStr.split('T')[0].split(' ')[0];
            return !tokenDate || tokenDate === todayStr;
          });

          if (matchingTokens.length === 0) {
            return {
              status: isWindowActive ? 'pending_approval' : 'closed',
              qrCodeUrl: null,
              expiresAtMs: 0,
              tokenId: null
            };
          }

          // Prioritize any active/approved token over old expired ones
          const activeTok = matchingTokens.find((t: any) => {
            const st = (t.status || '').toLowerCase();
            return st === 'active' || st === 'awaiting_scan' || st === 'approved' || st === 'token_issued' || st === 'staff_verified' || st === 'open';
          });

          const t = activeTok || matchingTokens[0];
          const st = (t.status || '').toLowerCase();
          const generatedAt = t.generated_at || t.created_at || t.issued_at;
          const serverNowMs = t.server_current_time ? parseLocalISO(t.server_current_time) : Date.now();
          const serverTimeOffset = serverNowMs > 0 ? (Date.now() - serverNowMs) : 0;

          const expTimeStr = t.expiry_time || t.expires_at;
          let expiresAtMs = parseLocalISO(expTimeStr);

          if (expiresAtMs <= 0 && generatedAt) {
            const genMs = parseLocalISO(generatedAt);
            if (genMs > 0) {
              expiresAtMs = genMs + (30 * 60 * 1000);
            }
          }

          if (expiresAtMs > 0) {
            expiresAtMs += serverTimeOffset;
          }

          const tokenId = t.token_id || t.token_uid || null;

          if (st === 'active' || st === 'awaiting_scan' || st === 'approved' || st === 'token_issued' || st === 'staff_verified' || st === 'open') {
            if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
              return { status: 'expired', qrCodeUrl: null, expiresAtMs: 0, tokenId };
            }
            let qrUrl: string | null = null;
            if (tokenId) {
              try {
                qrUrl = await QRCode.toDataURL(tokenId, { width: 512, margin: 1, color: { dark: '#09090b', light: '#ffffff' } });
              } catch { }
            }
            return { status: 'open', qrCodeUrl: qrUrl, expiresAtMs, tokenId };
          } else if (st === 'redeemed' || st === 'claimed' || st === 'used') {
            return { status: 'claimed', qrCodeUrl: null, expiresAtMs: 0, tokenId };
          } else if (st === 'expired') {
            return { status: 'expired', qrCodeUrl: null, expiresAtMs: 0, tokenId };
          } else if (st === 'rejected') {
            return { status: 'rejected', qrCodeUrl: null, expiresAtMs: 0, tokenId };
          }

          return {
            status: isWindowActive ? 'pending_approval' : 'closed',
            qrCodeUrl: null,
            expiresAtMs: 0,
            tokenId: null
          };
        };

        const foundBreakfast = await getMealState('Breakfast', isBfEligible, isBfWindowActive);
        const foundLunch = await getMealState('Lunch', isLunchEligible, isLunchWindowActive);

        setBreakfastToken(foundBreakfast);
        setLunchToken(foundLunch);

        // Update approval status for backward compat
        if (foundBreakfast.status === 'open' || foundLunch.status === 'open' || foundBreakfast.status === 'active' || foundLunch.status === 'active') {
          setStaffApprovalStatus('approved');
        }
        if (foundBreakfast.status === 'claimed' || foundLunch.status === 'claimed' || foundBreakfast.status === 'redeemed' || foundLunch.status === 'redeemed') {
          setIsTokenUtilized(true);
        }
      } catch (err) {
        console.warn('Token poll error:', err);
      }
    };

    pollTokens();
    const interval = setInterval(pollTokens, 8000);
    return () => clearInterval(interval);
  }, [loggedInStudent]);

  // === AUTO REFRESH STUDENT PROFILE FROM BACKEND ===
  useEffect(() => {
    if (!loggedInStudent?.id) return;
    const fetchFreshProfile = async () => {
      try {
        const res = await fetch(`/api/student/profile?student_id=${loggedInStudent.id}`);
        if (res.ok) {
          const data = await res.json();
          setLoggedInStudent(prev => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              name: data.name || prev.name,
              year: (data.degree_year && data.degree_year !== 'N/A') ? data.degree_year : (prev.year !== 'Registered' && prev.year !== 'N/A' ? prev.year : 'N/A'),
              email: (data.email && data.email !== 'N/A') ? data.email : (prev.email !== 'N/A' ? prev.email : 'N/A'),
              mobile: (data.mobile_no && data.mobile_no !== 'N/A') ? data.mobile_no : (prev.mobile !== 'N/A' ? prev.mobile : 'N/A'),
              dept: (data.dept && data.dept !== 'N/A') ? data.dept : (prev.dept !== 'Student' && prev.dept !== 'N/A' ? prev.dept : 'N/A'),
              forenoon_meal: data.forenoon_meal !== undefined ? data.forenoon_meal : prev.forenoon_meal,
              afternoon_meal: data.afternoon_meal !== undefined ? data.afternoon_meal : prev.afternoon_meal,
            };
            return updated;
          });
        }
      } catch (err) {
        console.warn('Profile sync error:', err);
      }
    };
    fetchFreshProfile();
  }, [loggedInStudent?.id]);

  // === 1-SECOND COUNTDOWN TICKER USING EXPIRY TIME ===
  useEffect(() => {
    const ticker = setInterval(() => {
      if (breakfastToken.expiresAtMs > 0) {
        const remaining = Math.max(0, Math.floor((breakfastToken.expiresAtMs - Date.now()) / 1000));
        setBreakfastTimeLeft(remaining);
        if (remaining <= 0 && (breakfastToken.status === 'open' || breakfastToken.status === 'active')) {
          setBreakfastToken(prev => ({ ...prev, status: 'expired', qrCodeUrl: null }));
        }
      }
      if (lunchToken.expiresAtMs > 0) {
        const remaining = Math.max(0, Math.floor((lunchToken.expiresAtMs - Date.now()) / 1000));
        setLunchTimeLeft(remaining);
        if (remaining <= 0 && (lunchToken.status === 'open' || lunchToken.status === 'active')) {
          setLunchToken(prev => ({ ...prev, status: 'expired', qrCodeUrl: null }));
        }
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [breakfastToken.expiresAtMs, lunchToken.expiresAtMs, breakfastToken.status, lunchToken.status]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.ceil(seconds / 60);
    return `${mins}m left`;
  };

  const [tokenHistory, setTokenHistory] = useState<Array<any>>([]);

  const handleRegenerateToken = async (mealType: 'Breakfast' | 'Lunch') => {
    if (!loggedInStudent?.id && !loggedInStudent?.roll) return;
    const studentReg = loggedInStudent.roll || loggedInStudent.id;
    const mealTypeDb = mealType === 'Breakfast' ? 'forenoon' : 'afternoon';
    try {
      const res = await fetch('/api/staff/issue-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_reg: studentReg,
          meal_type: mealTypeDb,
          staff_id: 'STUDENT_REGEN'
        })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || errData.message || 'Failed to regenerate token.');
      }
    } catch (err) {
      alert('Unable to connect to server to regenerate token.');
    }
  };



  // Keep a digital clock updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Try to load user session & fee status from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('canteen_student_session');
    if (saved) {
      try {
        const student = JSON.parse(saved);
        if (student.id === 'S1001') {
          student.id = '243301034021';
          student.roll = '243301034021';
          localStorage.setItem('canteen_student_session', JSON.stringify(student));
        }
        setLoggedInStudent(student);
      } catch (e) {
        localStorage.removeItem('canteen_student_session');
      }
    }

    // Also migrate the student in the studentsList if cached
    const savedList = localStorage.getItem('rkmvc_students_list');
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        let updated = false;
        const updatedList = list.map((s: Student) => {
          if (s.id === 'S1001') {
            s.id = '243301034021';
            s.roll = '243301034021';
            updated = true;
          }
          return s;
        });
        if (updated) {
          setStudentsList(updatedList);
          localStorage.setItem('rkmvc_students_list', JSON.stringify(updatedList));
        }
      } catch (e) { }
    }
  }, []);

  // Save student list whenever it changes
  useEffect(() => {
    localStorage.setItem('rkmvc_students_list', JSON.stringify(studentsList));
  }, [studentsList]);

  // Token polling is now handled by the 8-second server polling effect above

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsForgotPasswordModalOpen(false);

    const trimmedId = studentId.trim();
    const trimmedPw = password.trim();

    if (!trimmedId || !trimmedPw) {
      setError('Please enter both Register No and Password.');
      return;
    }

    try {
      const res = await fetch('/api/student/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ register_no: trimmedId, username: trimmedId, password: trimmedPw })
      });
      if (res.ok) {
        const data = await res.json();
        const studentUser: Student = {
          id: data.user?.student_id || data.user?.id || trimmedId,
          password: trimmedPw,
          name: data.user?.display_name || data.user?.name || trimmedId,
          roll: data.user?.student_id || trimmedId,
          dept: data.user?.department || data.user?.grade_section || 'Student',
          year: data.user?.degree_year || '1st Year',
          mobile: data.user?.mobile_no || 'N/A',
          email: data.user?.email || 'N/A',
          forenoon_meal: data.user?.forenoon_meal,
          afternoon_meal: data.user?.afternoon_meal,
          photo: (data.user?.image_url && !data.user.image_url.includes('ui-avatars.com')) ? data.user.image_url : ""
        };
        setLoggedInStudent(studentUser);
        localStorage.setItem('canteen_student_session', JSON.stringify(studentUser));
        if (data.token) {
          localStorage.setItem('student_token', data.token);
        }
        setActiveTab('canteen');
        setStudentId('');
        setPassword('');
        if (data.require_password_change || data.require_password_reset || trimmedPw === 'pass123') {
          setChangePasswordOpen(true);
        }
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Invalid Register No or Password.');
        return;
      }
    } catch (err) {
      console.warn("Backend auth login fallback:", err);
    }

    const found = studentsList.find(
      s => (s.id.toUpperCase() === trimmedId.toUpperCase() || s.roll.toUpperCase() === trimmedId.toUpperCase()) && s.password === trimmedPw
    );

    if (found) {
      setLoggedInStudent(found);
      localStorage.setItem('canteen_student_session', JSON.stringify(found));
      setActiveTab('canteen');
      setStudentId('');
      setPassword('');
      if (trimmedPw === 'pass123') {
        setChangePasswordOpen(true);
      }
    } else {
      setError('Invalid Register No or Password.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setPasswordError('Please fill in all fields.');
      return;
    }

    if (currentPasswordInput !== loggedInStudent?.password && currentPasswordInput !== 'pass123') {
      setPasswordError('Current password is incorrect.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPasswordInput);
    const hasLowerCase = /[a-z]/.test(newPasswordInput);
    const hasDigit = /\d/.test(newPasswordInput);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPasswordInput);
    const hasMinLength = newPasswordInput.length >= 8;

    if (!hasUpperCase || !hasLowerCase || !hasDigit || !hasSpecialChar || !hasMinLength) {
      setPasswordError('Please meet all password strength requirements.');
      return;
    }

    try {
      await fetch('/api/student/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loggedInStudent?.id,
          new_password: newPasswordInput
        })
      });
    } catch (e) {
      console.warn("Change password backend API notice:", e);
    }

    // Update studentsList
    const updatedList = studentsList.map(s => {
      if (s.id === loggedInStudent?.id) {
        return { ...s, password: newPasswordInput };
      }
      return s;
    });

    setStudentsList(updatedList);

    // Update loggedInStudent state & session storage
    const updatedStudent = { ...loggedInStudent!, password: newPasswordInput };
    setLoggedInStudent(updatedStudent);
    localStorage.setItem('canteen_student_session', JSON.stringify(updatedStudent));

    setPasswordSuccess('Password changed successfully!');

    // Clear fields
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');

    // Auto close after 2 seconds
    setTimeout(() => {
      setChangePasswordOpen(false);
      setPasswordSuccess('');
    }, 2000);
  };

  const handleLogout = () => {
    setLoggedInStudent(null);
    setSelectedMeal(null);
    setQrCodeUrl('');
    setMobileSidebarOpen(false);
    localStorage.removeItem('canteen_student_session');
  };

  const formatTimeRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleSimulateStaffDecision = async (decision: 'approved' | 'rejected') => {
    setStaffApprovalStatus(decision);
    if (decision === 'approved' && loggedInStudent) {
      setIsGenerating(true);
      try {
        const qrContent = loggedInStudent.id;
        const url = await QRCode.toDataURL(qrContent, {
          width: 512,
          margin: 1,
          color: {
            dark: '#09090b',
            light: '#ffffff',
          },
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR code generation failed', err);
      } finally {
        setIsGenerating(false);
      }

      if (selectedMeal === 'Lunch') {
        setIsLunchActivated(true);
        setLunchTimeLeft(2700);
        localStorage.setItem('rkmvc_lunch_activated', 'true');
        localStorage.setItem('rkmvc_lunch_time_left', '2700');
      } else if (selectedMeal === 'Breakfast') {
        setIsBreakfastActivated(true);
        setBreakfastTimeLeft(2700);
        localStorage.setItem('rkmvc_breakfast_activated', 'true');
        localStorage.setItem('rkmvc_breakfast_time_left', '2700');
      }
    }
  };

  const handleGenerateToken = async (meal: MealType) => {
    if (!loggedInStudent) return;
    setSelectedMeal(meal);
    setIsTokenUtilized(false);
    setQrCodeUrl('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/staff/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_reg: loggedInStudent.id,
          meal_type: meal,
          staff_id: 'STUDENT_SELF'
        })
      });

      const data = await res.json().catch(() => ({}));
      setStaffApprovalStatus('approved');
      const tokenVal = data.token_id || data.token_uid || loggedInStudent.id;
      const url = await QRCode.toDataURL(tokenVal, {
        width: 512,
        margin: 1,
        color: { dark: '#09090b', light: '#ffffff' }
      });
      setQrCodeUrl(url);

      if (meal === 'Lunch') {
        setIsLunchActivated(true);
        setLunchTimeLeft(2700);
        localStorage.setItem('rkmvc_lunch_activated', 'true');
        localStorage.setItem('rkmvc_lunch_time_left', '2700');
      } else {
        setIsBreakfastActivated(true);
        setBreakfastTimeLeft(2700);
        localStorage.setItem('rkmvc_breakfast_activated', 'true');
        localStorage.setItem('rkmvc_breakfast_time_left', '2700');
      }
    } catch (e) {
      console.error('Generate token network error:', e);
      setStaffApprovalStatus('approved');
      const url = await QRCode.toDataURL(loggedInStudent.id, { width: 512, margin: 1, color: { dark: '#09090b', light: '#ffffff' } });
      setQrCodeUrl(url);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStaffAcceptToken = (meal: MealType) => {
    if (!meal) return;

    // Mark as utilized to trigger the green success screen
    setIsTokenUtilized(true);

    // Set activated state for 45 minutes
    if (meal === 'Lunch') {
      setIsLunchActivated(true);
      setLunchTimeLeft(2700); // 45m * 60s
      localStorage.setItem('rkmvc_lunch_activated', 'true');
      localStorage.setItem('rkmvc_lunch_time_left', '2700');
    } else {
      setIsBreakfastActivated(true);
      setBreakfastTimeLeft(2700); // 45m * 60s
      localStorage.setItem('rkmvc_breakfast_activated', 'true');
      localStorage.setItem('rkmvc_breakfast_time_left', '2700');
    }

    // Record to history (ONLY when staff accepts/utilizes the token)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newToken = {
      id: "T" + Math.floor(102 + Math.random() * 898),
      date: dateStr,
      time: timeStr,
      meal: meal as string,
    };

    const updatedHistory = [newToken, ...tokenHistory];
    setTokenHistory(updatedHistory);
    localStorage.setItem('rkmvc_token_history', JSON.stringify(updatedHistory));
  };



  const handleDownloadStandalone = async () => {
    try {
      const response = await fetch('/student.html');
      if (!response.ok) throw new Error('Could not fetch student.html template');
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'student.html';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to download standalone template:', err);
      alert('Unable to fetch the offline template automatically. Please make sure the app is fully built and running.');
    }
  };

  if (!loggedInStudent) {
    if (isForgotPasswordPage) {
      return (
        <StudentForgotPasswordPage
          initialRegNo={studentId}
          onBackToLogin={() => {
            setIsForgotPasswordPage(false);
            window.history.replaceState({}, '', '/student/');
          }}
        />
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#FFFBF7',
        fontFamily: 'Inter, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          borderBottom: '3px solid #FA9632',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          <img
            src={rkmvcLogo}
            alt="RKM Crest"
            style={{ height: '48px', width: '48px', objectFit: 'contain', marginRight: '16px' }}
          />
          <h1 style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#1E293B',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            margin: 0
          }}>
            RAMAKRISHNA MISSION VIVEKANANDA COLLEGE
          </h1>
        </div>

        {/* Main Container - Shared Responsive Grid */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '1100px',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px',
            alignItems: 'stretch'
          }}>
            {/* Left Column - Vivekananda Portrait */}
            <div className="left-hero-panel" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #FCEFD9',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }}>
                <img
                  src={rkmPortrait}
                  alt="Swami Vivekananda portrait"
                  style={{
                    borderRadius: '16px',
                    maxHeight: '350px',
                    width: 'auto',
                    objectFit: 'contain',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </div>
              <div style={{
                backgroundColor: '#2E2520',
                borderRadius: '16px',
                padding: '16px',
                borderLeft: '4px solid #FA9632',
                textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                minHeight: '75px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontStyle: 'italic',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  transition: 'opacity 0.3s',
                  opacity: fade ? 1 : 0
                }}>
                  "{VIVEKANANDA_QUOTES[quoteIndex]}"
                </span>
                <span style={{
                  fontSize: '9px',
                  color: '#FBBF24',
                  fontWeight: 800,
                  marginTop: '8px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}>
                  — SWAMI VIVEKANANDA
                </span>
              </div>
            </div>

            {/* Right Column - Login Form Card */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #FCEFD9',
              borderRadius: '24px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {/* Card Accent Header */}
              <div style={{
                backgroundColor: '#FA9632',
                color: 'white',
                padding: '20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <Shield style={{ height: '18px', width: '18px' }} />
                  <span>Student Meal Portal</span>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
                {/* Credentials Alert Banner */}
                <div style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px dashed #FBBF24',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  color: '#78350F'
                }}>
                  <Info style={{ height: '20px', width: '20px', color: '#FBBF24', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '12px', color: '#B45309', display: 'block', marginBottom: '4px' }}>
                      Meal Access Credentials
                    </strong>
                    <p style={{ fontSize: '11px', margin: 0, lineHeight: 1.4, color: '#6B7280' }}>
                      Sign in with your Academic ID and password provided during registration.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#64748B',
                      marginBottom: '6px'
                    }}>
                      Student Registration No
                    </label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g., 243301034021"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 14px',
                        backgroundColor: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#64748B',
                        margin: 0
                      }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.history.pushState({}, '', '/student/forgot-password');
                          setIsForgotPasswordPage(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#FA9632',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          margin: '-4px -8px',
                          position: 'relative',
                          zIndex: 20,
                          pointerEvents: 'auto',
                          userSelect: 'none'
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 38px 10px 14px',
                          backgroundColor: 'white',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 600,
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px'
                        }}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      backgroundColor: '#FFF1F2',
                      border: '1px solid #FECDD3',
                      color: '#BE123C',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle style={{ height: '16px', width: '16px', flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      backgroundColor: '#FA9632',
                      border: 'none',
                      color: 'white',
                      fontWeight: 'bold',
                      padding: '12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background-color 0.2s',
                      marginTop: '8px'
                    }}
                  >
                    Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/register/';
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#F1F5F9',
                      border: 'none',
                      color: '#475569',
                      fontWeight: 'bold',
                      padding: '10px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    Sign Up
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          backgroundColor: '#1C1613',
          color: '#A8A29E',
          padding: '24px 16px',
          textAlign: 'center',
          borderTop: '1px solid rgba(250, 150, 50, 0.2)',
          flexShrink: 0
        }}>
          <p style={{ fontSize: '11px', margin: 0, fontWeight: 500 }}>
            © 2026 Ramakrishna Mission Vivekananda College. All Rights Reserved.
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col justify-between font-sans selection:bg-amber-500/20 selection:text-amber-950 ${theme === 'black' ? 'bg-[#0a0a0c] text-zinc-200' : 'bg-[#faf8f5] text-zinc-800'}`}>

      {/* Top Navigation Header Bar */}
      <header className={`transition-colors duration-300 border-b sticky top-0 z-40 shadow-xs ${theme === 'black' ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loggedInStudent && (
              <button
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className={`md:hidden p-2 rounded-xl transition-colors ${theme === 'black' ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                aria-label="Toggle Navigation Menu"
              >
                {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="flex items-center gap-2.5 sm:gap-3">
              <img src={rkmvcLogo} alt="RKMVC Emblem" className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs shrink-0" />
              <span className={`font-black text-sm sm:text-base tracking-widest uppercase font-display whitespace-nowrap ${theme === 'black' ? 'text-zinc-100' : 'text-zinc-900'}`}>
                STUDENT PORTAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Theme Toggle (Moon / Sun icon) */}
            <button
              id="theme-toggle-header-btn"
              onClick={() => setTheme(theme === 'black' ? 'white' : 'black')}
              className={`p-2 sm:p-2.5 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${
                theme === 'black'
                  ? 'bg-zinc-800/90 border-zinc-700 text-amber-400 hover:bg-zinc-750 hover:text-amber-300 hover:border-zinc-600'
                  : 'bg-zinc-100 border-zinc-200/90 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 hover:border-zinc-300'
              }`}
              title={theme === 'black' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label={theme === 'black' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'black' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>

            {loggedInStudent && (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={`flex items-center p-0.5 rounded-full transition-all cursor-pointer focus:outline-none ${profileMenuOpen
                      ? 'ring-2 ring-amber-500'
                      : (theme === 'black' ? 'hover:ring-2 hover:ring-zinc-700' : 'hover:ring-2 hover:ring-zinc-300')
                    }`}
                  title={loggedInStudent.name}
                  aria-label="Student Profile Menu"
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border shadow-xs flex items-center justify-center ${theme === 'black' ? 'bg-zinc-850 border-zinc-750 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>
                    {loggedInStudent.photo ? (
                      <img
                        src={loggedInStudent.photo}
                        alt={loggedInStudent.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {profileMenuOpen && (
                  <>
                    {/* Backdrop to close menu on click outside */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileMenuOpen(false)}
                    />

                    {/* Profile Dropdown Menu */}
                    <div className={`absolute right-0 mt-2 w-60 rounded-2xl shadow-xl border p-4 z-50 flex flex-col items-center text-center transition-all animate-in fade-in zoom-in-95 duration-150 ${theme === 'black' ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                      }`}>
                      {/* Image at Top */}
                      <div className={`w-18 h-18 rounded-full overflow-hidden border-2 shadow-md mb-3 flex items-center justify-center ${theme === 'black' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                        }`}>
                        {loggedInStudent.photo ? (
                          <img
                            src={loggedInStudent.photo}
                            alt={loggedInStudent.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-8 h-8" />
                        )}
                      </div>

                      {/* Student Name Below Image */}
                      <div className="mb-4 w-full">
                        <h4 className="font-bold text-sm leading-tight">
                          {loggedInStudent.name}
                        </h4>
                        <p className={`text-xs font-semibold uppercase tracking-wider mt-1 ${theme === 'black' ? 'text-zinc-400' : 'text-zinc-500'
                          }`}>
                          {loggedInStudent.id}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className={`w-full h-px mb-3 ${theme === 'black' ? 'bg-zinc-800' : 'bg-zinc-100'}`} />

                      {/* Logout Button Below Name */}
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleLogout();
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold uppercase tracking-wider shadow-xs border ${theme === 'black'
                            ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-900/50'
                            : 'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border-rose-100'
                          }`}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-grow flex w-full max-w-7xl mx-auto relative">

        {/* SIDEBAR NAVIGATION - DESKTOP & MOBILE TRANSITIONS */}
        {loggedInStudent && (
          <>
            {/* Desktop Sidebar */}
            <aside className={`hidden md:flex flex-col w-64 border-r p-4 shrink-0 transition-colors duration-300 ${theme === 'black' ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-[#faf8f5] border-amber-900/10'}`}>
              <nav className="flex-grow space-y-1">
                <button
                  onClick={() => setActiveTab('canteen')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'canteen'
                      ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                      : theme === 'black'
                        ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                    }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'history'
                      ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                      : theme === 'black'
                        ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                    }`}
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span>History</span>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'profile'
                      ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                      : theme === 'black'
                        ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                    }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>My Profile</span>
                </button>

                <button
                  onClick={() => setChangePasswordOpen(true)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${theme === 'black'
                      ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                    }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Change Password</span>
                </button>
              </nav>

              <div className={`pt-4 mt-4 border-t ${theme === 'black' ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all duration-200 cursor-pointer mb-4"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            </aside>

            {/* Mobile Navigation Drawer Backdrop */}
            <AnimatePresence>
              {mobileSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileSidebarOpen(false)}
                  className="fixed inset-0 bg-black z-30 md:hidden"
                />
              )}
            </AnimatePresence>

            {/* Mobile Navigation Drawer Panel */}
            <AnimatePresence>
              {mobileSidebarOpen && (
                <motion.aside
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className={`fixed inset-y-0 left-0 w-64 border-r p-4 z-40 md:hidden flex flex-col justify-between pt-16 transition-colors duration-300 ${theme === 'black' ? 'bg-[#0a0a0c] border-zinc-800' : 'bg-[#faf8f5] border-amber-900/10'}`}
                >
                  <nav className="space-y-1">
                    <button
                      onClick={() => { setActiveTab('canteen'); setMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${activeTab === 'canteen'
                          ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                          : theme === 'black'
                            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                        }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('history'); setMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${activeTab === 'history'
                          ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                          : theme === 'black'
                            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                        }`}
                    >
                      <History className="w-4 h-4" />
                      <span>History</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('profile'); setMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${activeTab === 'profile'
                          ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/15'
                          : theme === 'black'
                            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                        }`}
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => { setChangePasswordOpen(true); setMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${theme === 'black'
                          ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                        }`}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Change Password</span>
                    </button>
                  </nav>

                  <div className={`pt-4 border-t ${theme === 'black' ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-rose-600 hover:bg-rose-50 hover:text-rose-700 mb-4"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </>
        )}

        {/* CONTAINER MAIN SCREEN CONTENT */}
        <main className="flex-grow p-4 sm:p-8 flex flex-col items-center justify-center min-w-0">
          <AnimatePresence mode="wait">

            <motion.div
              key="portal-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full flex flex-col"
            >

              {/* B. MY PROFILE VIEW */}
              {activeTab === 'profile' && (
                <div className="space-y-6 w-full max-w-4xl mx-auto">
                  <div className={`border rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start transition-colors duration-300 ${theme === 'black'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl shadow-black/40 dark:bg-zinc-900 dark:border-zinc-800'
                      : 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
                    }`}>
                    {/* Photo column */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-40 h-40 rounded-3xl overflow-hidden border-4 shadow-xl relative ring-4 transition-colors duration-300 flex items-center justify-center ${theme === 'black' ? 'border-zinc-800 ring-amber-500/20 bg-zinc-800 text-zinc-400 dark:border-zinc-800' : 'border-zinc-100 ring-amber-500/10 bg-zinc-100 text-zinc-500'
                        }`}>
                        {loggedInStudent.photo ? (
                          <img
                            src={loggedInStudent.photo}
                            alt={loggedInStudent.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-16 h-16" />
                        )}
                      </div>
                      <span className={`mt-3 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-widest border transition-colors duration-300 ${theme === 'black'
                          ? 'bg-orange-950/40 text-orange-400 border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-400'
                          : 'bg-orange-50/80 text-orange-600 border-orange-200'
                        }`}>
                        ID: {loggedInStudent.id}
                      </span>
                    </div>

                    {/* Info grid */}
                    <div className="flex-grow w-full space-y-6">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest ${theme === 'black' ? 'text-amber-400 dark:text-amber-400' : 'text-amber-600'
                          }`}>Student Profile</p>
                        <h2 className={`text-2xl font-bold font-display mt-0.5 ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'
                          }`}>{loggedInStudent.name}</h2>
                        <p className={`text-xs font-semibold ${theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-500'
                          }`}>Reg No: {loggedInStudent.roll}</p>
                      </div>

                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 text-xs font-sans transition-colors duration-300 ${theme === 'black' ? 'border-zinc-800 dark:border-zinc-800' : 'border-zinc-150'
                        }`}>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <span className={theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-400'}>Department:</span>
                            <span className={`font-semibold ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'}`}>{loggedInStudent.dept || 'Student'}</span>
                            <span className={theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-400'}>Year:</span>
                            <span className={`font-semibold ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'}`}>{loggedInStudent.year || '1st Year'}</span>
                            <span className={theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-400'}>Mobile No:</span>
                            <span className={`font-semibold ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'}`}>{loggedInStudent.mobile || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <span className={theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-400'}>Token Type:</span>
                            <span className={`font-semibold ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'}`}>
                              {[loggedInStudent.forenoon_meal !== false && 'Breakfast', loggedInStudent.afternoon_meal !== false && 'Lunch'].filter(Boolean).join(' & ') || 'Breakfast & Lunch'}
                            </span>
                            <span className={theme === 'black' ? 'text-zinc-400 dark:text-zinc-400' : 'text-zinc-400'}>Email:</span>
                            <span className={`font-semibold break-all ${theme === 'black' ? 'text-zinc-100 dark:text-zinc-100' : 'text-zinc-900'}`}>{loggedInStudent.email || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}







              {/* F. CANTEEN TOKENS VIEW */}
              {activeTab === 'canteen' && (
                <div className="space-y-6 w-full max-w-4xl mx-auto">

                  {/* Standard Canteen QR Verification Card — Always kept in place */}
                  {loggedInStudent && (
                    <div id="student-portal-qr-verification-card" className={`border rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${theme === 'black'
                        ? 'bg-zinc-900/40 border-zinc-800'
                        : 'bg-white border-zinc-200/80 shadow-sm'
                      }`}>
                      <div className="max-w-md w-full flex flex-col items-center">
                        <h4 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-2 ${theme === 'black' ? 'text-zinc-200' : 'text-zinc-950'
                          }`}>
                          Staff Scanning Code
                        </h4>
                        <p className={`text-xs sm:text-sm mb-6 leading-relaxed font-semibold ${theme === 'black' ? 'text-zinc-300' : 'text-zinc-800'
                          }`}>
                          Present this QR code to the staff for quick register number and identity verification.
                        </p>

                        {/* QR Code Container */}
                        <div id="qr-code-wrapper" className={`relative p-5 rounded-3xl bg-white border-2 flex items-center justify-center shadow-md transition-all duration-300 ${theme === 'black' ? 'border-zinc-800' : 'border-zinc-200'
                          }`}>
                          {rollQrCodeUrl ? (
                            <img
                              src={rollQrCodeUrl}
                              alt={`QR Code for Reg No ${loggedInStudent.roll}`}
                              className="w-56 h-56 sm:w-64 sm:h-64 object-contain select-none pointer-events-none"
                            />
                          ) : (
                            <div className="w-56 h-56 sm:w-64 sm:h-64 bg-zinc-100 animate-pulse rounded-2xl flex items-center justify-center">
                              <span className="text-xs text-zinc-500 font-bold">Generating QR...</span>
                            </div>
                          )}
                        </div>

                        {/* Register Number Display */}
                        <div id="roll-number-display" className={`mt-6 px-7 py-3 rounded-2xl border-2 font-mono text-sm sm:text-base font-black tracking-wider transition-all duration-300 shadow-xs ${theme === 'black'
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
                            : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                          }`}>
                          Reg No: <span className="text-amber-700 font-extrabold text-base sm:text-lg">{loggedInStudent.roll}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Breakfast Token Card */}
                    <MealToken
                      mealType="Breakfast"
                      status={breakfastToken.status}
                      timeLeftSeconds={breakfastTimeLeft}
                      qrCodeUrl={breakfastToken.qrCodeUrl}
                      theme={theme}
                      windowStart={mealWindowConfig.bfStart}
                      windowEnd={mealWindowConfig.bfEnd}
                      onOpenQr={() => setSelectedMeal('Breakfast')}
                      onRegenerate={() => handleRegenerateToken('Breakfast')}
                    />

                    {/* Lunch Token Card */}
                    <MealToken
                      mealType="Lunch"
                      status={lunchToken.status}
                      timeLeftSeconds={lunchTimeLeft}
                      qrCodeUrl={lunchToken.qrCodeUrl}
                      theme={theme}
                      windowStart={mealWindowConfig.lunchStart}
                      windowEnd={mealWindowConfig.lunchEnd}
                      onOpenQr={() => setSelectedMeal('Lunch')}
                      onRegenerate={() => handleRegenerateToken('Lunch')}
                    />

                  </div>
                </div>
              )}

              {/* G. HISTORY VIEW */}
              {activeTab === 'history' && (
                <div className="space-y-6 w-full max-w-4xl mx-auto">
                  {/* Token History Section */}
                  <div className={`border rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col transition-colors duration-300 ${theme === 'black'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl shadow-black/40'
                      : 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
                    }`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className={`flex items-center gap-2 ${theme === 'black' ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        <History className="w-5 h-5 text-amber-600" />
                        <h3 className="text-lg font-bold">Canteen Token History</h3>
                      </div>
                    </div>

                    {tokenHistory.length === 0 ? (
                      <div className={`text-center py-12 rounded-2xl border border-dashed flex flex-col items-center justify-center ${theme === 'black' ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                        <History className="w-8 h-8 text-zinc-300 mb-2" />
                        <p className="text-xs text-zinc-400 font-medium">No recent token generation history.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {tokenHistory.map((historyItem) => {
                          const isClaimed = historyItem.status.includes('Claimed') || historyItem.status.includes('Redeemed') || historyItem.status.includes('Verified') || historyItem.status.includes('used');
                          const isActive = historyItem.status.includes('Active') || historyItem.status.includes('Issued') || historyItem.status.includes('Open');
                          const isPending = historyItem.status.includes('Pending');
                          const isExpired = historyItem.status.includes('Expired');
                          const isRejected = historyItem.status.includes('Rejected');

                          return (
                            <div
                              key={historyItem.id}
                              className={`border rounded-2xl p-4 flex items-center justify-between text-xs transition ${theme === 'black'
                                  ? 'bg-zinc-950/70 border-zinc-800/80 hover:bg-zinc-800/50'
                                  : 'bg-zinc-50 border-zinc-200/60 hover:bg-zinc-100/50'
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                  {historyItem.meal === 'Breakfast' ? <Coffee className="w-4.5 h-4.5" /> : <Utensils className="w-4.5 h-4.5" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className={`font-bold ${theme === 'black' ? 'text-zinc-100' : 'text-zinc-800'}`}>{historyItem.meal} Token</p>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${theme === 'black' ? 'text-amber-400 bg-amber-950/50 border-amber-800/60' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                                      {historyItem.token_id}
                                    </span>
                                  </div>
                                  <p className={`text-[10px] mt-0.5 ${theme === 'black' ? 'text-zinc-400' : 'text-zinc-400'}`}>{historyItem.date} at {historyItem.time}</p>
                                </div>
                              </div>
                              <span className={`text-[11px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider shadow-xs ${isClaimed
                                  ? 'bg-emerald-600 text-white border border-emerald-700'
                                  : isActive
                                    ? 'bg-blue-600 text-white border border-blue-700'
                                    : isPending
                                      ? 'bg-amber-500 text-white border border-amber-600'
                                      : (isExpired || isRejected)
                                        ? 'bg-rose-600 text-white border border-rose-700'
                                        : 'bg-zinc-600 text-white border border-zinc-700'
                                }`}>
                                {historyItem.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>

          </AnimatePresence>
        </main>

      </div>



      {/* CANTEEN TOKEN DISPLAY MODAL */}
      <AnimatePresence>
        {selectedMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMeal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 80 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: 250,
                scale: 0.95,
                transition: {
                  type: "tween",
                  ease: "easeInOut",
                  duration: 0.35
                }
              }}
              transition={{
                type: "spring",
                damping: 15,
                stiffness: 180,
                mass: 0.9
              }}
              className="relative rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden z-10 bg-white border border-zinc-200 text-zinc-800 transition-all duration-300"
            >
              {/* --- ACTIVE QR CODE DISPLAY (LEFT PHONE DESIGN) --- */}
              <div className="p-6 sm:p-8 flex flex-col min-h-[520px]">
                  {/* Header Title with RKMVC Emblem and Status Badge */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2.5">
                      <img src={rkmvcLogo} alt="RKMVC Emblem" className="h-8 w-auto object-contain shrink-0" />
                      <h3 className="text-xl font-black uppercase tracking-wider text-zinc-950 font-display leading-none">
                        {selectedMeal} Token
                      </h3>
                    </div>

                    {((selectedMeal === 'Breakfast' ? breakfastToken.status : lunchToken.status) === 'active' || (selectedMeal === 'Breakfast' ? breakfastToken.qrCodeUrl : lunchToken.qrCodeUrl)) ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        QR Code Active
                      </span>
                    ) : ((selectedMeal === 'Breakfast' ? breakfastToken.status : lunchToken.status) === 'redeemed') ? (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-blue-500/20 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Meal Claimed ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20 flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Pending Approval
                      </span>
                    )}
                  </div>

                  {/* MAIN CONTENT AREA BY APPROVAL STATUS */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
                    {((selectedMeal === 'Breakfast' ? breakfastToken.status : lunchToken.status) === 'active' || (selectedMeal === 'Breakfast' ? breakfastToken.qrCodeUrl : lunchToken.qrCodeUrl)) ? (
                      <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
                        {/* Heading */}
                        <h4 className="text-lg sm:text-xl font-bold text-zinc-900 font-display">
                          {selectedMeal} Token QR Code
                        </h4>

                        {/* Message */}
                        <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
                          Your QR code is active. Show this QR to canteen staff to claim your meal.
                        </p>

                        {/* Active QR Code Display */}
                        <motion.div
                          id="qr-code-wrapper"
                          whileHover={{ scale: 1.04 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className="my-4 p-4 bg-white border-2 border-zinc-100 rounded-[2.5rem] shadow-md flex items-center justify-center transition-shadow hover:shadow-lg duration-300 cursor-pointer"
                        >
                          <img
                            src={(selectedMeal === 'Breakfast' ? breakfastToken.qrCodeUrl : lunchToken.qrCodeUrl) || rollQrCodeUrl || qrCodeUrl}
                            alt={`${selectedMeal} Token QR Code`}
                            className="w-64 h-64 sm:w-72 sm:h-72 object-contain select-none pointer-events-none"
                          />
                        </motion.div>

                        {/* Timer countdown & Live Status */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200">
                            <Clock className="w-4 h-4 animate-spin text-amber-600" />
                            <span>
                              Expires in: {selectedMeal === 'Breakfast' ? formatTimeRemaining(breakfastTimeLeft) : formatTimeRemaining(lunchTimeLeft)}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Live Token Active & Scannable
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
                        <div className="relative p-4 bg-zinc-50 border-2 border-zinc-200/80 rounded-[2.5rem] shadow-sm flex items-center justify-center overflow-hidden my-3">
                          <div className="w-56 h-56 sm:w-60 sm:h-60 opacity-20 filter blur-[3px] select-none pointer-events-none bg-zinc-900 grid grid-cols-6 gap-2 p-4 rounded-2xl">
                            {Array.from({ length: 36 }).map((_, i) => (
                              <div key={i} className={`rounded-sm ${i % 2 === 0 ? 'bg-zinc-950' : i % 3 === 0 ? 'bg-zinc-800' : 'bg-transparent'}`} />
                            ))}
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/5 backdrop-blur-[2px]">
                            <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-zinc-200 flex items-center justify-center text-amber-600 mb-1">
                              <Lock className="w-7 h-7" />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-white/90 px-2.5 py-0.5 rounded-full border border-zinc-200 mt-1">
                              Pending
                            </span>
                          </div>
                        </div>
                        <h4 className="text-lg sm:text-xl font-bold text-zinc-900 font-display mt-2">
                          Waiting for Staff Approval
                        </h4>
                        <div className="text-xs sm:text-sm text-zinc-600 mt-2.5 max-w-xs leading-relaxed">
                          <p className="text-zinc-500 font-medium">
                            Your QR code will be activated automatically after staff approval.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <div className="mt-auto pt-4 border-t border-zinc-100 flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedMeal(null)}
                      className="w-full bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs py-3.5 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
                    >
                      <span>Close</span>
                    </button>
                  </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {changePasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (loggedInStudent?.password !== 'pass123') {
                  setChangePasswordOpen(false);
                }
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md z-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-3xl font-normal text-zinc-900 tracking-tight font-display">Change Password</h3>
                  {loggedInStudent?.password === 'pass123' && (
                    <p className="text-xs text-amber-600 font-semibold mt-1">Mandatory first-time password update required to proceed.</p>
                  )}
                </div>
                {loggedInStudent?.password !== 'pass123' && (
                  <button
                    onClick={() => setChangePasswordOpen(false)}
                    className="text-zinc-400 hover:text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 p-2 rounded-full transition-all cursor-pointer shadow-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-2xl text-zinc-800">
                <form onSubmit={handleChangePassword} className="space-y-5">
                  {passwordError && (
                    <div className="bg-rose-50 text-rose-600 border border-rose-200 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-pulse">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-zinc-800">Current Password</label>
                    <input
                      type="password"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-zinc-200 text-zinc-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-zinc-800">New Password</label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-zinc-200 text-zinc-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-2 py-1">
                    <p className="text-sm font-bold text-zinc-800">Password should contain</p>
                    <div className="space-y-1.5 text-sm text-zinc-800 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{hasUpperCase ? '✅' : '❌'}</span>
                        <span>1 upper case letter,</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{hasLowerCase ? '✅' : '❌'}</span>
                        <span>1 lower case letter,</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{hasDigit ? '✅' : '❌'}</span>
                        <span>1 digit,</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{hasSpecialChar ? '✅' : '❌'}</span>
                        <span>1 special character,</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{hasMinLength ? '✅' : '❌'}</span>
                        <span>at least 8 characters</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-zinc-800">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-zinc-200 text-zinc-800 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all duration-150 shadow-sm cursor-pointer"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* FORGOT PASSWORD & GENERATION MODAL COMPONENT */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        initialRegNo={studentId}
        studentsList={studentsList}
        onSuccess={(studentUser, token) => {
          setIsForgotPasswordModalOpen(false);
          setLoggedInStudent(studentUser);
          localStorage.setItem('canteen_student_session', JSON.stringify(studentUser));
          if (token) {
            localStorage.setItem('student_token', token);
          }
          setActiveTab('canteen');
          setStudentId('');
          setPassword('');
        }}
      />

    </div>
  );
}
