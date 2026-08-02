import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Clock, 
  LogOut, 
  RefreshCw, 
  UserCheck, 
  TrendingUp, 
  HelpCircle, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  CornerDownRight,
  Sparkles,
  User,
  ChevronDown,
  LayoutDashboard,
  Download,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  ArrowDownToLine,
  Printer,
  Filter,
  Users
} from "lucide-react";
import { Student, Token, TerminalSession, ScanMode } from "./types";
import QRScanner from "./components/QRScanner";
import { IssueTokenModal, VerifyTokenModal } from "./components/Modals";
import StudentDetails from "./components/StudentDetails";

// Safely wrap sessionStorage to prevent SecurityErrors in sandboxed/cross-origin iframes
const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access blocked by sandbox or browser setting:", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write blocked by sandbox or browser setting:", e);
    }
  },
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage delete blocked by sandbox or browser setting:", e);
    }
  }
};

// Helper to get local date string in YYYY-MM-DD format
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  // Navigation & Filtering States
  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "export" | "settings">("dashboard");
  const [session, setSession] = useState<TerminalSession | null>({
    staffId: "STAFF101",
    terminalName: "Office Registration Desk 1",
    role: "office"
  });

  const activeRole: "office" | "canteen" = session?.role === "canteen" ? "canteen" : "office";

  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "active" | "rejected">("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });

  // Bank Statement filters & states
  const [startDate, setStartDate] = useState<string>(() => getLocalDateString());
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString());
  const [statementFilter, setStatementFilter] = useState<"all" | "approved" | "active" | "rejected">("all");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Application core state
  const [students, setStudents] = useState<Student[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);

  // User settings state (basic client settings, no DB alteration)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("settings_sound_enabled");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const [autoApproveScans, setAutoApproveScans] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("settings_auto_approve");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [cooldownTime, setCooldownTime] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("settings_cooldown_time");
      return stored !== null ? Number(stored) : 3;
    } catch {
      return 3;
    }
  });

  const [defaultMealType, setDefaultMealType] = useState<"Auto" | "Breakfast" | "Lunch">(() => {
    try {
      const stored = localStorage.getItem("settings_default_meal_type");
      return stored === "Breakfast" || stored === "Lunch" || stored === "Auto" ? (stored as "Auto" | "Breakfast" | "Lunch") : "Auto";
    } catch {
      return "Auto";
    }
  });

  // Active Modals state
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  const [currentTokenData, setCurrentTokenData] = useState<{ token: Token; student: Student } | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  // Toast System state
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    type: "success" | "warning" | "error" | "info";
  } | null>(null);
  const [showToastBanner, setShowToastBanner] = useState(false);
  const toastTimerRef = React.useRef<any>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Load database seeds and restore session on mount
  useEffect(() => {
    // 1. Check for token and user in URL query params (from common login redirect)
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get("token");
    const userParam = searchParams.get("user");

    if (tokenParam && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        const token = decodeURIComponent(tokenParam);
        
        // Save credentials
        localStorage.setItem("token", token);
        const activeSession: TerminalSession = {
          staffId: user.username,
          terminalName: user.display_name || user.username,
          role: user.role === "canteen_staff" ? "canteen" : "office"
        };
        safeSessionStorage.setItem("terminal_session", JSON.stringify(activeSession));
        setSession(activeSession);
        
        // Clean query parameters from address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        
        fetchStudents();
        fetchTokens(user.username);
        return;
      } catch (e) {
        console.error("Failed to parse common login redirect credentials", e);
      }
    }

    // 2. Fallback to storage
    const stored = safeSessionStorage.getItem("terminal_session");
    let initialStaffId = "";
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        initialStaffId = parsed.staffId;
      } catch (e) {
        console.error("Failed to restore terminal session", e);
      }
    } else {
      // 3. No active session or parameters -> Redirect to common login page (Port 5050)
      window.location.href = "/admin-login/";
      return;
    }
    
    fetchStudents();
    fetchTokens(initialStaffId);
  }, []);

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem("settings_sound_enabled", String(val));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleToggleAutoApprove = (val: boolean) => {
    setAutoApproveScans(val);
    try {
      localStorage.setItem("settings_auto_approve", String(val));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCooldownChange = (val: number) => {
    setCooldownTime(val);
    try {
      localStorage.setItem("settings_cooldown_time", String(val));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleDefaultMealChange = (val: "Auto" | "Breakfast" | "Lunch") => {
    setDefaultMealType(val as any);
    try {
      localStorage.setItem("settings_default_meal_type", val);
    } catch (e) {
      console.warn(e);
    }
  };

  const apiFetch = (url: string, init?: RequestInit) => {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    let baseUrl = '/api/staff';
    if (envUrl) {
      const clean = envUrl.replace(/\/+$/, '');
      baseUrl = clean.endsWith('/api/staff') ? clean : `${clean}/api/staff`;
    }
    const path = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${path}`;
    
    // Inject Authorization header & bypass Ngrok warning interstitial
    const token = localStorage.getItem("token");
    const headers = new Headers(init?.headers || {});
    headers.set("ngrok-skip-browser-warning", "69420");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    
    return fetch(fullUrl, {
      ...init,
      headers
    });
  };

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        return;
      }
    } catch (e) {
      console.warn("Using local student fallback (API offline):", e);
    }
    // Seed dataset matching database records
    setStudents([
      { reg_no: "243301034021", name: "Chen Kai", year: "1st Year", department: "Computer Applications", image_url: "https://ui-avatars.com/api/?name=Chen+Kai&background=random" },
      { reg_no: "STU101", name: "Arjun Sharma", year: "2nd Year", department: "B.Sc. Comp Sci", image_url: "https://ui-avatars.com/api/?name=Arjun+Sharma&background=random" },
      { reg_no: "STU102", name: "Priya Patel", year: "3rd Year", department: "B.Sc. Comp Sci", image_url: "https://ui-avatars.com/api/?name=Priya+Patel&background=random" },
      { reg_no: "STU103", name: "Rahul Nair", year: "1st Year", department: "B.Sc. Physics", image_url: "https://ui-avatars.com/api/?name=Rahul+Nair&background=random" },
      { reg_no: "STU104", name: "Sneha Rao", year: "2nd Year", department: "B.Sc. Chemistry", image_url: "https://ui-avatars.com/api/?name=Sneha+Rao&background=random" },
      { reg_no: "STU105", name: "Vikram Singh", year: "3rd Year", department: "B.Com General", image_url: "https://ui-avatars.com/api/?name=Vikram+Singh&background=random" },
      { reg_no: "STU106", name: "Ananya Reddy", year: "1st Year", department: "B.A. Economics", image_url: "https://ui-avatars.com/api/?name=Ananya+Reddy&background=random" },
      { reg_no: "STU107", name: "Karthik Krishnan", year: "2nd Year", department: "M.Sc. Comp Sci", image_url: "https://ui-avatars.com/api/?name=Karthik+Krishnan&background=random" },
      { reg_no: "220101", name: "Alice Smith", year: "2nd Year", department: "Computer Science", image_url: "https://ui-avatars.com/api/?name=Alice+Smith&background=random" },
      { reg_no: "220102", name: "Bob Johnson", year: "3rd Year", department: "Mathematics", image_url: "https://ui-avatars.com/api/?name=Bob+Johnson&background=random" },
    ]);
  };

  const fetchTokens = async (staffId?: string) => {
    try {
      const res = await apiFetch(`/api/tokens`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
        return;
      }
    } catch (e) {
      console.warn("API offline when fetching tokens:", e);
    }
    setTokens([]);
  };

  const showToast = (title: string, message: string, type: "success" | "warning" | "error" | "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ title, message, type });
    setShowToastBanner(true);
    // Auto-dismiss toast after 4.5 seconds
    toastTimerRef.current = setTimeout(() => {
      setShowToastBanner(false);
    }, 4500);
  };

  // Sound cue feedback using Web Audio API
  const playBeep = (type: "success" | "warning" | "error") => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        // Soft high-pitched verification tone
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else if (type === "warning") {
        // Medium informative double pulse
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else {
        // Low error buzz frequency
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(130, audioCtx.currentTime); // Low bass
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio feedback blocked or browser permissions required.", e);
    }
  };

  // Safe and clean iframe print mechanism to bypass iframe sandbox restrictions
  const handlePrintStatement = () => {
    const statementTokens = tokens.filter(t => {
      try {
        const tDate = new Date(t.created_at);
        const itemDateStr = tDate.toISOString().split("T")[0];
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
        if (statementFilter !== "all" && t.status !== statementFilter) return false;
        return true;
      } catch (e) {
        return false;
      }
    });

    const printWindowHtml = `
      <html>
        <head>
          <title>Dining Audit Statement</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 40px;
              color: #1e293b;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .subtitle {
              font-size: 14px;
              color: #64748b;
              margin-top: 5px;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 30px;
              background: #f8fafc;
              padding: 15px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .meta-item {
              font-size: 12px;
            }
            .meta-label {
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.05em;
            }
            .meta-value {
              font-weight: 700;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #f1f5f9;
              color: #475569;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              padding: 12px;
              text-align: left;
              border-bottom: 2px solid #e2e8f0;
            }
            td {
              padding: 12px;
              font-size: 12px;
              border-bottom: 1px solid #f1f5f9;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-approved {
              background-color: #dcfce7;
              color: #15803d;
            }
            .badge-rejected {
              background-color: #ffe4e6;
              color: #b91c1c;
            }
            .badge-pending {
              background-color: #fef3c7;
              color: #b45309;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            @media print {
              body { padding: 0; }
              @page { size: portrait; margin: 20mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">RKMVC Dining Hall Ledger</h1>
            <p class="subtitle">Dining Audit Statement Desk</p>
          </div>
          
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Audit Period</div>
              <div class="meta-value">${startDate || "All"} to ${endDate || "All"}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Estimated Value (@ ₹50/meal)</div>
              <div class="meta-value">₹${(statementTokens.filter(t => t.status === "approved").length * 50).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Total Audited Tokens</div>
              <div class="meta-value">${statementTokens.length} matching tokens</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Statement Authenticity</div>
              <div class="meta-value">REF-MEAL-889021</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Transaction Ref</th>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Meal Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${statementTokens.map(item => {
                const student = students.find(s => s.reg_no === item.student_reg);
                const sName = student ? student.name : "Unknown student";
                const badgeClass = item.status === "approved" ? "badge-approved" : item.status === "rejected" ? "badge-rejected" : "badge-pending";
                const statusLabel = item.status === "approved" ? "Cleared" : item.status === "rejected" ? "Declined" : "Pending";
                return `
                  <tr>
                    <td style="font-family: monospace;">${new Date(item.created_at).toLocaleString()}</td>
                    <td style="font-family: monospace; font-weight: bold; color: #4f46e5;">${item.token_id}</td>
                    <td style="font-family: monospace;">${item.student_reg}</td>
                    <td><strong>${sName}</strong></td>
                    <td>${item.meal_type}</td>
                    <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            RKMVC Dining Management Portal &bull; Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    try {
      // Create a temporary hidden iframe for clean, non-blocked printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(printWindowHtml);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Iframe print blocked, falling back to window.print():", e);
            window.print();
          }
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (err) {
              console.error(err);
            }
          }, 1000);
        }, 250);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn("Iframe insertion failed in sandbox environment, calling window.print() directly", err);
      window.print();
    }
  };

  const handleLogout = () => {
    setSession(null);
    safeSessionStorage.removeItem("terminal_session");
    localStorage.removeItem("token");
    setUsername("");
    setPassword("");
    setScannedPayload(null);
    setTokens([]);
    window.location.href = "/admin-login/";
  };

  // Automated Scan trigger success processing with role checks
  const handleScanSuccess = async (decodedText: string) => {
    if (cooldownActive) return;

    setCooldownActive(true);
    setTimeout(() => {
      setCooldownActive(false);
    }, cooldownTime * 1000);

    const rawPayload = decodedText.trim();
    // Store the human-readable label for toasts (extract student ID if possible)
    let displayLabel = rawPayload;
    try {
      const decoded = atob(rawPayload.replace(/-/g, '+').replace(/_/g, '/'));
      const payloadPart = decoded.split('.')[0];
      const parsed = JSON.parse(payloadPart);
      if (parsed.sid) displayLabel = parsed.sid;
      else if (parsed.tu) displayLabel = parsed.tu;
    } catch (_) {
      // Not base64 — raw ID
      if (rawPayload.startsWith('{')) {
        try { const p = JSON.parse(rawPayload); displayLabel = p.sid || p.student_id || rawPayload; } catch (_) {}
      }
    }
    setScannedPayload(displayLabel);

    try {
      // Primary: POST /api/scan — handles all QR formats on the backend
      const scanRes = await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: rawPayload })
      });

      if (scanRes.ok) {
        const tokenData = await scanRes.json();

        if (tokenData.token) {
          const st = (tokenData.token.status || '').toLowerCase();
          if (st === 'redeemed' || st === 'claimed' || st === 'used') {
            showToast("Meal Already Claimed", `A meal was already distributed for ${tokenData.student?.name || tokenData.token.student_reg}.`, "warning");
            playBeep("warning");
            return;
          } else if (st === 'rejected' || st === 'expired') {
            showToast("Token Flagged Invalid", `This token is marked as ${st} in the database.`, "error");
            playBeep("error");
            return;
          }

          if (autoApproveScans) {
            try {
              const approveRes = await apiFetch(`/api/tokens/${tokenData.token.token_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved", staff_id: session?.staffId })
              });
              if (approveRes.ok) {
                await fetchTokens();
                showToast("Access Approved & Redeemed", `Meal distributed successfully for ${tokenData.student?.name || 'Student'}!`, "success");
                playBeep("success");
                return;
              }
            } catch (e) {
              console.warn("Direct approve API failed", e);
            }
          }

          setCurrentTokenData(tokenData);
          setIsVerifyModalOpen(true);
          playBeep("success");
          return;
        } else if (tokenData.student) {
          setCurrentStudent(tokenData.student);
          setIsIssueModalOpen(true);
          playBeep("success");
          return;
        }
      }

      // Fallback: try legacy GET /api/tokens/<id> with raw payload
      const safePayload = encodeURIComponent(rawPayload);
      const tokenRes = await apiFetch(`/api/tokens/${safePayload}`);
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.token || tokenData.student) {
          if (tokenData.token) {
            setCurrentTokenData(tokenData);
            setIsVerifyModalOpen(true);
          } else {
            setCurrentStudent(tokenData.student);
            setIsIssueModalOpen(true);
          }
          playBeep("success");
          return;
        }
      }

      // Fallback 2: GET /api/students/<id>
      const studentRes = await apiFetch(`/api/students/${encodeURIComponent(displayLabel)}`);
      if (studentRes.ok) {
        const studentData = await studentRes.json();
        setCurrentStudent(studentData);
        setIsIssueModalOpen(true);
        playBeep("success");
        return;
      }

      showToast("No Record Found", `No student or token matching '${displayLabel}' was found.`, "error");
      playBeep("error");
    } catch (err) {
      console.error("Scan verification error:", err);
      showToast("Scan Error", `Could not reach the server. Check your connection and try again.`, "error");
      playBeep("error");
    }
  };

  // Workflow A Modal Action: Generate Token
  const handleConfirmIssue = async (mealType: string) => {
    if (!currentStudent) return;

    try {
      const res = await apiFetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_reg: currentStudent.reg_no,
          meal_type: mealType,
          staff_id: session?.staffId
        })
      });

      if (res.ok) {
        await fetchTokens(); // reload registry list
        setIsIssueModalOpen(false);
        setCurrentStudent(null);
        showToast("Success: Token Generated", "Secure meal authentication token has been generated successfully!", "success");
        playBeep("success");
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || errData.message || "Failed to issue token.";
        showToast("Issuance Failed", msg, "error");
        playBeep("error");
      }
    } catch (e: any) {
      console.warn("Issue Token API error", e);
      showToast("Connection Error", "Network or server error while generating token.", "error");
      playBeep("error");
    }
  };

  const handleRejectIssue = () => {
    setIsIssueModalOpen(false);
    setCurrentStudent(null);
    showToast("Cancelled", "Token issuance cancelled by operator.", "warning");
    playBeep("warning");
  };

  // Workflow B Modal Action: Approve Token
  const handleApproveVerify = async () => {
    if (!currentTokenData) return;

    try {
      const res = await apiFetch(`/api/tokens/${currentTokenData.token.token_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          staff_id: session?.staffId
        })
      });

      if (res.ok) {
        await fetchTokens(); // refresh logs
        setIsVerifyModalOpen(false);
        setCurrentTokenData(null);
        showToast("Access Approved", "Meal distributed. Student's breakfast/lunch access has been approved.", "success");
        playBeep("success");
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("Approve API error, simulating approve flow", e);
      setTokens(prev =>
        prev.map(t =>
          t.token_id === currentTokenData.token.token_id
            ? { ...t, status: "approved", processed_by: session?.staffId || "STAFF101" }
            : t
        )
      );
      setIsVerifyModalOpen(false);
      setCurrentTokenData(null);
      showToast("Access Approved (Simulation)", "Meal distributed. Student's breakfast/lunch access has been approved.", "success");
      playBeep("success");
    }
  };

  // Workflow B Modal Action: Reject Token
  const handleRejectVerify = async () => {
    if (!currentTokenData) return;

    try {
      const res = await apiFetch(`/api/tokens/${currentTokenData.token.token_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          staff_id: session?.staffId
        })
      });

      if (res.ok) {
        await fetchTokens(); // refresh logs
        setIsVerifyModalOpen(false);
        setCurrentTokenData(null);
        showToast("Token Rejected", "Authorization revoked. Student's ticket is flagged rejected.", "error");
        playBeep("error");
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("Reject API error, simulating reject flow", e);
      setTokens(prev =>
        prev.map(t =>
          t.token_id === currentTokenData.token.token_id
            ? { ...t, status: "rejected", processed_by: session?.staffId || "STAFF101" }
            : t
        )
      );
      setIsVerifyModalOpen(false);
      setCurrentTokenData(null);
      showToast("Token Rejected (Simulation)", "Authorization revoked. Student's ticket is flagged rejected.", "error");
      playBeep("error");
    }
  };

  // Stats Counters
  const totalTokens = tokens.length;
  const approvedTokens = tokens.filter((t) => {
    const st = (t.status || '').toLowerCase();
    return st === "approved" || st === "redeemed" || st === "claimed";
  }).length;
  const activeTokens = tokens.filter((t) => {
    const st = (t.status || '').toLowerCase();
    return st === "active" || st === "awaiting_scan" || st === "token_issued";
  }).length;
  const rejectedTokens = tokens.filter((t) => {
    const st = (t.status || '').toLowerCase();
    return st === "rejected" || st === "expired";
  }).length;

  const filteredTokens = tokens.filter((tok) => {
    if (statusFilter === "all") return true;
    const st = (tok.status || '').toLowerCase();
    if (statusFilter === "rejected") {
      return st === "rejected" || st === "expired";
    }
    if (statusFilter === "approved") {
      return st === "approved" || st === "redeemed" || st === "claimed";
    }
    return st === statusFilter.toLowerCase();
  });

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-between select-none bg-slate-50">
        
        {/* TOAST NOTIFICATION SLIDEOVER BAR */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white border rounded-2xl p-4 shadow-2xl transition-all duration-300 transform ${
              showToastBanner ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
            } ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/80"
                : toast.type === "warning"
                ? "border-amber-200 bg-amber-50/80"
                : toast.type === "error"
                ? "border-red-200 bg-red-50/80"
                : "border-blue-200 bg-blue-50/80"
            }`}
          >
            <div className="flex gap-3">
              <div className="shrink-0">
                {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {toast.type === "warning" && <AlertCircle className="w-5 h-5 text-amber-600" />}
                {toast.type === "error" && <XCircle className="w-5 h-5 text-red-600" />}
                {toast.type === "info" && <ShieldCheck className="w-5 h-5 text-blue-600" />}
              </div>
              <div className="flex-grow">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  {toast.title}
                </h4>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setShowToastBanner(false)}
                className="text-gray-400 hover:text-gray-600 text-xs shrink-0 font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* GOVERNMENT SCHEME HEADER */}
        <header className="w-full bg-white border-b border-slate-200 py-4.5 px-6 md:px-8 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Emblem-Ramakrishna-Mission-Transparent.png" 
                  alt="RKMVC Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-left">
                <h1 className="text-md font-extrabold tracking-tight text-slate-900 font-display">
                  RKMVC - STAFF PORTAL
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* CORE REDIRECT LOADER */}
        <main className="flex-grow flex items-center justify-center px-4 py-8 max-w-7xl mx-auto w-full">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-4 border-[#FF9933] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider font-display">
              Redirecting to Secure Login Portal...
            </p>
          </div>
        </main>

        <footer className="w-full bg-white border-t border-slate-200 py-6 text-center text-[10px] text-slate-400">
          <div className="max-w-7xl mx-auto px-4 space-y-1">
            <p className="font-extrabold uppercase tracking-widest text-slate-500 font-display">
              RKMVC @ All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 select-none">
      
      {/* 1. TOAST NOTIFICATION SLIDEOVER BAR */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white border rounded-2xl p-4 shadow-2xl transition-all duration-300 transform ${
            showToastBanner ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
          } ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50/80"
              : toast.type === "warning"
              ? "border-amber-200 bg-amber-50/80"
              : toast.type === "error"
              ? "border-red-200 bg-red-50/80"
              : "border-blue-200 bg-blue-50/80"
          }`}
        >
          <div className="flex gap-3">
            <div className="shrink-0">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === "warning" && <AlertCircle className="w-5 h-5 text-amber-600" />}
              {toast.type === "error" && <XCircle className="w-5 h-5 text-red-600" />}
              {toast.type === "info" && <ShieldCheck className="w-5 h-5 text-blue-600" />}
            </div>
            <div className="flex-grow">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                {toast.title}
              </h4>
              <p className="text-[11px] text-gray-600 font-medium mt-0.5 leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setShowToastBanner(false)}
              className="text-gray-400 hover:text-gray-600 text-xs shrink-0 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 2. PERSISTENT SIDEBAR MENU */}
      <aside 
        className={`bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen max-h-screen overflow-y-auto transition-all duration-300 ease-in-out z-50
          fixed inset-y-0 left-0 md:sticky md:top-0
          ${isSidebarOpen 
            ? "w-64 translate-x-0 opacity-100" 
            : "w-64 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 md:overflow-hidden md:border-r-0"
          }
        `}
      >
        <div className="flex flex-col">
          {/* Header branding info - Mobile Only */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-end gap-3 md:hidden">
            {/* Collapse Sidebar Button inside Sidebar */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
 




          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-amber-50 text-[#FF9933] border border-amber-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5 shrink-0 text-[#FF9933]" />
              <span>Dashboard</span>
            </button>
 
            <button
              onClick={() => {
                setActiveTab("students");
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-amber-50 text-[#FF9933] border border-amber-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Users className="w-4.5 h-4.5 shrink-0 text-[#FF9933]" />
              <span>Student Details</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("export");
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "export"
                  ? "bg-amber-50 text-[#FF9933] border border-amber-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Download className="w-4.5 h-4.5 shrink-0 text-[#FF9933]" />
              <span>Export</span>
            </button>
          </nav>
        </div>
 
        {/* Bottom options */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button
            onClick={() => {
              setActiveTab("settings");
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-amber-50 text-[#FF9933] border border-amber-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
            }`}
          >
            <Settings className="w-4.5 h-4.5 shrink-0 text-[#FF9933]" />
            <span>Settings</span>
          </button>
 
          <button
            onClick={() => {
              handleLogout();
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer border border-transparent"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
 
      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-grow flex flex-col min-h-screen min-w-0">
        
        {/* Top Navbar Header */}
        <header className="bg-white border-b border-slate-200 h-16 px-6 md:px-8 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-4">
            {/* Sidebar toggle button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-[#FF9933] hover:bg-slate-50 border border-slate-200/60 shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>

            {/* Persistently visible Website branding (RKMVC Logo + Name) */}
            <div className="flex items-center gap-2.5 pl-1" id="main-brand-header">
              <div className="w-9 h-9 flex items-center justify-center shrink-0">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Emblem-Ramakrishna-Mission-Transparent.png" 
                  alt="RKMVC Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-left hidden sm:block">
                <h1 className="text-[18px] font-black tracking-wider text-slate-900 font-display uppercase leading-[28px]\">
                  RKMVC Staff
                </h1>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

            <div className="text-left">
              <h3 className="text-base md:text-lg font-black text-slate-800 tracking-tight font-display">
                {activeTab === "dashboard" && "Dashboard"}
                {activeTab === "export" && "Export"}
                {activeTab === "settings" && "Settings"}
              </h3>
            </div>
          </div>

          {/* User drop down menu */}
          <div className="relative flex items-center gap-2">
            <button
              id="user-profile-menu-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-250 flex items-center justify-center text-slate-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF9933]/50 shadow-xs shrink-0 relative"
              title={`${session.staffId} - Click for Info & Options`}
            >
              <User className="w-5 h-5 text-slate-600" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
            </button>

            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowUserMenu(false)}
                />
                
                <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xl z-40 w-64 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="space-y-3.5">
                    <div>
                      <div className="text-sm font-extrabold text-slate-800 font-display">
                        {session.staffId}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-600 leading-relaxed">
                        Staff Operator
                      </div>
                    </div>

                    {/* Active Portal Role (RBAC Display) placed in user dropdown above Logout */}
                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${activeRole === "office" ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`}></div>
                      <div className="text-left">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-display">
                          RBAC Role
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 font-display leading-tight">
                          {activeRole === "office" ? "Office Staff" : "Canteen Staff"}
                        </h4>
                        <p className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5">
                          {activeRole === "office" ? "Authorized to Issue" : "Authorized to Verify"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 py-2.5 px-4 rounded-xl transition-all border border-rose-150 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Dynamic page content viewport */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto">
          
          {/* A: DASHBOARD VIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-8 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
              
              {/* Interactive Live Analytics Banner Widgets (work as filtering buttons) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. All issued tokens */}
                <button
                  onClick={() => setStatusFilter("all")}
                  title="Click to view all registry items"
                  className={`bg-white border p-4 rounded-2xl shadow-sm flex items-center gap-3 transition-all cursor-pointer text-left focus:outline-none w-full ${
                    statusFilter === "all"
                      ? "border-[#FF9933] ring-3 ring-[#FF9933]/15 bg-amber-50/10 scale-[1.02] shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                  }`}
                >
                  <div className="p-3 bg-amber-50 rounded-xl text-[#FF9933]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">
                        Total Tokens
                      </p>
                      {statusFilter === "all" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933] animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xl font-extrabold text-slate-900 font-mono">
                      {totalTokens}
                    </p>
                  </div>
                </button>

                {/* 2. Approved only */}
                <button
                  onClick={() => setStatusFilter("approved")}
                  title="Click to filter by Approved claims"
                  className={`bg-white border p-4 rounded-2xl shadow-sm flex items-center gap-3 transition-all cursor-pointer text-left focus:outline-none w-full ${
                    statusFilter === "approved"
                      ? "border-emerald-500 ring-3 ring-emerald-500/15 bg-emerald-50/10 scale-[1.02] shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                  }`}
                >
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">
                        Approved Claims
                      </p>
                      {statusFilter === "approved" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xl font-extrabold text-emerald-600 font-mono">
                      {approvedTokens}
                    </p>
                  </div>
                </button>

                {/* 3. Active only */}
                <button
                  onClick={() => setStatusFilter("active")}
                  title="Click to filter by Active tokens"
                  className={`bg-white border p-4 rounded-2xl shadow-sm flex items-center gap-3 transition-all cursor-pointer text-left focus:outline-none w-full ${
                    statusFilter === "active"
                      ? "border-amber-500 ring-3 ring-amber-500/15 bg-amber-50/10 scale-[1.02] shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                  }`}
                >
                  <div className="p-3 bg-amber-50/50 rounded-xl text-amber-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">
                        Active
                      </p>
                      {statusFilter === "active" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xl font-extrabold text-amber-600 font-mono">
                      {activeTokens}
                    </p>
                  </div>
                </button>

                {/* 4. Rejected / Expired only */}
                <button
                  onClick={() => setStatusFilter("rejected")}
                  title="Click to filter by Rejected or Expired claims"
                  className={`bg-white border p-4 rounded-2xl shadow-sm flex items-center gap-3 transition-all cursor-pointer text-left focus:outline-none w-full ${
                    statusFilter === "rejected"
                      ? "border-rose-500 ring-3 ring-rose-500/15 bg-rose-50/10 scale-[1.02] shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                  }`}
                >
                  <div className="p-3 bg-rose-50 rounded-xl text-rose-500">
                    <XCircle className="w-5 h-5 animate-in" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">
                        REJECTED / EXPIRED
                      </p>
                      {statusFilter === "rejected" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xl font-extrabold text-rose-600 font-mono">
                      {rejectedTokens}
                    </p>
                  </div>
                </button>

              </div>

              {/* Main Application Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column (5 Columns) - Dynamic QR Scanner Panel */}
                <div className="lg:col-span-5 space-y-6">
                  <QRScanner
                    onScanSuccess={handleScanSuccess}
                    students={students}
                    tokens={tokens}
                    cooldownActive={cooldownActive}
                  />


                </div>

                {/* Right Column (7 Columns) - Active Token Registry database table */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <h3 className="text-md font-extrabold text-slate-900 tracking-tight font-display flex items-center gap-2">
                      <span>Token Registry</span>
                      {statusFilter !== "all" && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                          Filter: {statusFilter}
                        </span>
                      )}
                    </h3>
                    <button 
                      onClick={() => setStatusFilter("all")} 
                      className="text-[10px] font-bold text-slate-400 hover:text-[#FF9933] hover:underline text-left cursor-pointer transition-all"
                    >
                      Reset Filter
                    </button>
                  </div>

                  {filteredTokens.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic text-xs">
                      No student meal tokens found matching the filter "{statusFilter}".
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-200 rounded-2xl">
                      <div className="overflow-x-auto max-h-[460px]">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 z-10">
                            <tr className="border-b border-slate-200">
                              <th className="p-3 font-display">Student ID</th>
                              <th className="p-3 font-display">Name</th>
                              <th className="p-3 font-display">Meal Type</th>
                              <th className="p-3 font-display">Token ID</th>
                              <th className="p-3 font-display text-center">Verification Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredTokens.map((tok) => {
                              const studentInfo = students.find((s) => (s.reg_no || '').trim().toLowerCase() === (tok.student_reg || '').trim().toLowerCase());
                              const displayName = studentInfo ? studentInfo.name : (tok.student_name || tok.name || tok.student_reg || "Student");
                              const stLower = (tok.status || '').toLowerCase();
                              return (
                                <tr key={tok.token_id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                  <td className="p-3 text-[10px] text-slate-900">
                                    {tok.student_reg}
                                  </td>
                                  <td className="p-3">
                                    <p className="font-extrabold text-slate-900">
                                      {displayName}
                                    </p>
                                  </td>
                                  <td className="p-3">
                                    <span className="inline-flex items-center gap-1 uppercase text-[9px] font-black text-slate-900">
                                      {tok.meal_type === "Breakfast" ? "Breakfast" : "Lunch"}
                                    </span>
                                  </td>
                                  <td className="p-3 text-[10px] font-bold text-[#FF9933] bg-amber-50 px-2 rounded border border-amber-100/40">
                                    {tok.token_id}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`text-[10px] font-extrabold uppercase tracking-wider ${
                                        stLower === "approved" || stLower === "redeemed"
                                          ? "text-emerald-600"
                                          : stLower === "expired" || stLower === "rejected"
                                          ? "text-rose-600"
                                          : "text-amber-500 animate-pulse"
                                      }`}
                                    >
                                      {stLower === "expired" ? "EXPIRED" : stLower === "rejected" ? "REJECTED" : tok.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* B: STUDENT DETAILS VIEW */}
          {activeTab === "students" && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 my-6 px-4 md:px-0">
              <StudentDetails students={students} onRefresh={fetchStudents} />
            </div>
          )}

          {/* C: EXPORT PORTAL VIEW (Statement Ledger) */}
          {activeTab === "export" && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 my-6 px-4 md:px-0">
              


              {/* Filter controls panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-slate-200 p-5 rounded-3xl shadow-sm" id="statement-filters-panel">
                <div className="space-y-1">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-display">
                    Start Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value || getLocalDateString())}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2.5 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-display">
                    End Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value || getLocalDateString())}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2.5 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-display">
                    Verification Status
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Filter className="w-3.5 h-3.5" />
                    </div>
                    <select
                      value={statementFilter}
                      onChange={(e: any) => setStatementFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2.5 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="approved">Cleared (Approved)</option>
                      <option value="active">Pending (Active)</option>
                      <option value="rejected">Bounced (Rejected)</option>
                    </select>
                  </div>
                </div>
              </div>



              {/* Ledger entries table */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm" id="statement-ledger-table-container">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 font-display">
                    Statement Ledger Particulars
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-500 font-mono">
                    Showing {tokens.filter(t => {
                      try {
                        const tDate = new Date(t.created_at);
                        const itemDateStr = tDate.toISOString().split("T")[0];
                        if (startDate && itemDateStr < startDate) return false;
                        if (endDate && itemDateStr > endDate) return false;
                        if (statementFilter !== "all" && t.status !== statementFilter) return false;
                        return true;
                      } catch (e) {
                        return false;
                      }
                    }).length} matching entries
                  </span>
                </div>

                {tokens.filter(t => {
                  try {
                    const tDate = new Date(t.created_at);
                    const itemDateStr = tDate.toISOString().split("T")[0];
                    if (startDate && itemDateStr < startDate) return false;
                    if (endDate && itemDateStr > endDate) return false;
                    if (statementFilter !== "all" && t.status !== statementFilter) return false;
                    return true;
                  } catch (e) {
                    return false;
                  }
                }).length === 0 ? (
                  <div className="text-center py-16 px-4 text-slate-400 italic text-xs space-y-2">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-500">No entries found for specified criteria</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px] mx-auto">Try adjusting your date range or verification status filters above.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-[11px] border-collapse" id="print-statement-ledger-table">
                      <thead className="bg-slate-100/80 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="p-4 font-display">Date & Time</th>
                          <th className="p-4 font-display">Transaction Ref</th>
                          <th className="p-4 font-display">Student ID</th>
                          <th className="p-4 font-display text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {tokens
                          .filter(t => {
                            try {
                              const tDate = new Date(t.created_at);
                              const itemDateStr = tDate.toISOString().split("T")[0];
                              if (startDate && itemDateStr < startDate) return false;
                              if (endDate && itemDateStr > endDate) return false;
                              if (statementFilter !== "all" && t.status !== statementFilter) return false;
                              return true;
                            } catch (e) {
                              return false;
                            }
                          })
                          .map((item) => {
                            const student = students.find(s => s.reg_no === item.student_reg);
                            return (
                              <tr key={item.token_id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                <td className="p-4 font-mono text-[10px] text-slate-500">
                                  {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td className="p-4">
                                  <p className="font-mono text-indigo-600 font-bold">{item.token_id}</p>
                                  <p className="text-[9px] text-slate-400 font-medium">{item.meal_type} Meal</p>
                                </td>
                                <td className="p-4">
                                  <p className="text-slate-900 font-extrabold">{student ? student.name : "Unknown student"}</p>
                                  <p className="text-[9px] text-slate-400 font-mono font-medium">Reg: {item.student_reg}</p>
                                </td>
                                <td className="p-4 text-right">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                    item.status === "approved"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      : item.status === "rejected"
                                      ? "bg-rose-50 text-rose-700 border border-rose-100"
                                      : "bg-amber-50 text-amber-700 border border-amber-100"
                                  }`}>
                                    {item.status === "approved" ? "Cleared" : item.status === "rejected" ? "Declined" : "Pending"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Actions section */}
              <div className="flex justify-end gap-3 pt-4" id="statement-bottom-actions">
                <button
                  type="button"
                  onClick={() => {
                    const statementTokens = tokens.filter(t => {
                      try {
                        const tDate = new Date(t.created_at);
                        const itemDateStr = tDate.toISOString().split("T")[0];
                        if (startDate && itemDateStr < startDate) return false;
                        if (endDate && itemDateStr > endDate) return false;
                        if (statementFilter !== "all" && t.status !== statementFilter) return false;
                        return true;
                      } catch (e) {
                        return false;
                      }
                    });

                    const headers = ["Transaction Ref (Token ID)", "Date & Time", "Student ID", "Student Name", "Department", "Meal Type", "Status"];
                    const rows = statementTokens.map(t => {
                      const student = students.find(s => s.reg_no === t.student_reg);
                      const name = student ? student.name : "Unknown";
                      const dept = student ? student.department : "Unknown";
                      const meal = t.meal_type;
                      const status = t.status.toUpperCase();
                      const date = new Date(t.created_at).toLocaleString();
                      return [t.token_id, date, t.student_reg, name, dept, meal, status];
                    });

                    const csvContent = [headers, ...rows]
                      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
                      .join("\n");

                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `MealFlow_Statement_${startDate}_to_${endDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  disabled={tokens.filter(t => {
                    try {
                      const tDate = new Date(t.created_at);
                      const itemDateStr = tDate.toISOString().split("T")[0];
                      if (startDate && itemDateStr < startDate) return false;
                      if (endDate && itemDateStr > endDate) return false;
                      if (statementFilter !== "all" && t.status !== statementFilter) return false;
                      return true;
                    } catch (e) {
                      return false;
                    }
                  }).length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer border border-transparent"
                  id="btn-statement-csv-export"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>CSV Export</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  disabled={tokens.filter(t => {
                    try {
                      const tDate = new Date(t.created_at);
                      const itemDateStr = tDate.toISOString().split("T")[0];
                      if (startDate && itemDateStr < startDate) return false;
                      if (endDate && itemDateStr > endDate) return false;
                      if (statementFilter !== "all" && t.status !== statementFilter) return false;
                      return true;
                    } catch (e) {
                      return false;
                    }
                  }).length === 0}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border border-transparent"
                  id="btn-statement-print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          )}

          {/* C: SETTINGS VIEW */}
          {activeTab === "settings" && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300 my-6 px-4 md:px-0" id="settings-view-container">
              
              {/* Premium Heading Header */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6" id="settings-header-banner">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#FF9933] border border-amber-100 flex items-center justify-center shrink-0 shadow-xs">
                  <Settings className="w-7 h-7" />
                </div>
                <div className="text-center sm:text-left space-y-1.5">
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight font-display uppercase">
                    Terminal Preferences
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Personalize local device settings, scan workflows, and audio cues. All preferences are preserved in local storage and will <span className="font-semibold text-slate-700">never modify the database structure</span>.
                  </p>
                </div>
              </div>

              {/* Bento Grid Settings Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="settings-grid">
                
                {/* 1. Audio Alerts Settings Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between" id="settings-card-sound">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                        Audio Feedbacks
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Toggle verification beeps and warning tones for success, duplicates, and terminal rejection errors.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                      <span className="text-xs font-bold text-slate-700">Enable Sound Cues</span>
                      <button
                        onClick={() => handleToggleSound(!soundEnabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${
                          soundEnabled ? "bg-[#FF9933]" : "bg-slate-200"
                        }`}
                        id="btn-toggle-sound"
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                            soundEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {soundEnabled && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 flex items-center justify-between gap-2" id="settings-sound-tester">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Test Sound:</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => playBeep("success")}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-2 py-1 rounded border border-emerald-200 transition-all cursor-pointer"
                          >
                            Success
                          </button>
                          <button
                            onClick={() => playBeep("warning")}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[9px] font-extrabold px-2 py-1 rounded border border-amber-200 transition-all cursor-pointer"
                          >
                            Warning
                          </button>
                          <button
                            onClick={() => playBeep("error")}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-extrabold px-2 py-1 rounded border border-rose-200 transition-all cursor-pointer"
                          >
                            Error
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Automated Clearance workflow */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between" id="settings-card-workflow">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                        Verification Bypass
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Instantly approve scanned tokens and record meal distributions during high-frequency peak queue intervals.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-700 block">Auto-Clear Scanned Tokens</span>
                      <span className="text-[9px] text-emerald-600 font-bold uppercase">Bypasses verification modal</span>
                    </div>
                    <button
                      onClick={() => handleToggleAutoApprove(!autoApproveScans)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${
                        autoApproveScans ? "bg-[#FF9933]" : "bg-slate-200"
                      }`}
                      id="btn-toggle-auto-approve"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                          autoApproveScans ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Cooldown Threshold slider */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4" id="settings-card-cooldown">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                        Duplicate Protection Cooldown
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Adjust duplicate detection threshold timeout (seconds) to prevent accidental double-scanning of student barcodes.
                    </p>
                  </div>

                  <div className="border-t border-slate-50 pt-4 space-y-3">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600">Scan Cooldown Delay</span>
                      <span className="text-[#FF9933] font-mono">{cooldownTime} seconds</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={cooldownTime}
                      onChange={(e) => handleCooldownChange(Number(e.target.value))}
                      className="w-full accent-[#FF9933] bg-slate-100 h-1.5 rounded-lg appearance-none cursor-pointer"
                      id="input-settings-cooldown-slider"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold font-mono">
                      <span>1s (Instant)</span>
                      <span>8s</span>
                      <span>15s (Strict)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Default Meal Session Settings Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4" id="settings-card-mealsession">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                        Default Meal Selection
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Select which meal type gets assigned when a student barcode is registered for token issuance.
                    </p>
                  </div>

                  <div className="border-t border-slate-50 pt-4 space-y-2.5">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Issuance Default Meal Session
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-150" id="settings-meal-selector-tabs">
                      <button
                        type="button"
                        onClick={() => handleDefaultMealChange("Auto")}
                        className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          defaultMealType === "Auto"
                            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Auto-infer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefaultMealChange("Breakfast")}
                        className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          defaultMealType === "Breakfast"
                            ? "bg-white text-[#FF9933] shadow-xs border border-amber-200/50"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Breakfast
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefaultMealChange("Lunch")}
                        className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          defaultMealType === "Lunch"
                            ? "bg-white text-[#FF9933] shadow-xs border border-amber-200/50"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Lunch
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* System Diagnostic Logs (Read Only details) */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-[10px] text-slate-500 font-mono flex flex-col sm:flex-row justify-between gap-4 items-center" id="settings-diagnostic-panel">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="font-bold text-slate-700">Terminal Node Online</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-end text-slate-400">
                  <span>Node: <strong className="text-slate-600 uppercase">{session?.staffId || "STAFF101"}</strong></span>
                  <span>Port: <strong className="text-slate-600">3000</strong></span>
                  <span>Ver: <strong className="text-slate-600 font-sans">v1.4.2-stable</strong></span>
                  <span>App: <strong className="text-slate-600 font-sans">MealFlow</strong></span>
                </div>
              </div>

            </div>
          )}

        </main>

        <footer className="w-full bg-white border-t border-slate-200 py-6 text-center text-[10px] text-slate-400 mt-auto">
          <div className="max-w-7xl mx-auto px-4 space-y-1">
            <p className="font-extrabold uppercase tracking-widest text-slate-500 font-display">
              RKMVC @ All rights reserved.
            </p>
          </div>
        </footer>

      </div>

      {/* 4. DIALOG MODAL LAYER OVERLAYS */}
      <IssueTokenModal
        isOpen={isIssueModalOpen}
        onClose={() => {
          setIsIssueModalOpen(false);
          setCurrentStudent(null);
        }}
        student={currentStudent}
        onConfirmIssue={handleConfirmIssue}
        onRejectIssue={handleRejectIssue}
      />

      <VerifyTokenModal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setCurrentTokenData(null);
        }}
        tokenData={currentTokenData}
        onApproveVerify={handleApproveVerify}
        onRejectVerify={handleRejectVerify}
      />

    </div>
  );
}
