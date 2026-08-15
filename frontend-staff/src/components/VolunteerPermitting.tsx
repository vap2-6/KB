import React, { useState, useEffect } from "react";
import { 
  HeartHandshake, 
  Send, 
  MessageSquare, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  Printer, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  ShieldCheck, 
  User, 
  Calendar, 
  Tag, 
  Phone, 
  Sparkles, 
  X, 
  Copy, 
  Clock,
  Ticket
} from "lucide-react";
import { VolunteerToken } from "../types";
import { apiFetch } from "../lib/api";

interface VolunteerPermittingProps {
  staffId?: string;
  showToast: (title: string, message: string, type: "success" | "warning" | "error" | "info") => void;
  playBeep?: (type: "success" | "warning" | "error" | "info") => void;
}

export default function VolunteerPermitting({ staffId = "STAFF101", showToast, playBeep }: VolunteerPermittingProps) {
  // Form State
  const [volunteerName, setVolunteerName] = useState("");
  const [volunteerRole, setVolunteerRole] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [email, setEmail] = useState("");
  const [passCount, setPassCount] = useState<1 | 2>(1);
  const [sendVia, setSendVia] = useState<"whatsapp" | "email" | "both">("both");
  const [validDate, setValidDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // List & Search State
  const [volunteerTokens, setVolunteerTokens] = useState<VolunteerToken[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Pass Modal State
  const [activePassModal, setActivePassModal] = useState<{
    token_id: string;
    volunteer_name: string;
    volunteer_role: string;
    meal_type: string;
    valid_date: string;
    phone_no?: string;
    email?: string;
    whatsapp_url?: string;
    whatsapp_text?: string;
    email_sent?: boolean;
  } | null>(null);

  // Fetch list of volunteer passes on mount
  useEffect(() => {
    fetchVolunteerTokens();
  }, []);

  const fetchVolunteerTokens = async () => {
    setIsLoadingList(true);
    try {
      const res = await apiFetch("/api/staff/volunteer-tokens");
      if (res.ok) {
        const data = await res.json();
        setVolunteerTokens(data);
      }
    } catch (e) {
      console.warn("Failed to fetch volunteer tokens:", e);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!volunteerName.trim()) {
      setFormError("Volunteer Name is required.");
      return;
    }

    if ((sendVia === "whatsapp" || sendVia === "both") && !phoneNo.trim()) {
      setFormError("Mobile number is required for WhatsApp dispatch.");
      return;
    }

    if ((sendVia === "email" || sendVia === "both") && !email.trim()) {
      setFormError("Email address is required for Email dispatch.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch("/api/staff/volunteer-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volunteer_name: volunteerName.trim(),
          volunteer_role: volunteerRole.trim() || "Guest",
          phone_no: phoneNo.trim(),
          email: email.trim(),
          pass_count: passCount,
          send_via: sendVia,
          staff_id: staffId,
          valid_date: validDate,
          note: note.trim()
        })
      });

      if (res.ok) {
        const result = await res.json();
        
        // Show success modal pass card
        setActivePassModal({
          token_id: result.token_uid || result.primary_token_uid || "GUS-001",
          volunteer_name: result.volunteer_name,
          volunteer_role: result.volunteer_role,
          meal_type: `${passCount} Meal Pass (${passCount >= 2 ? 'Both Meals' : 'Single Meal'})`,
          valid_date: result.valid_date,
          phone_no: result.phone_no,
          email: result.email,
          whatsapp_url: result.whatsapp_url,
          whatsapp_text: result.whatsapp_text,
          email_sent: result.email_sent
        });

        // Reset form
        setVolunteerName("");
        setVolunteerRole("");
        setPhoneNo("");
        setEmail("");
        setNote("");

        showToast(
          "Volunteer Token Permitted!", 
          `Pass successfully created for ${result.volunteer_name}.${result.email_sent ? ' Pass email dispatched.' : ''}`, 
          "success"
        );
        if (playBeep) playBeep("success");

        // Refresh ledger list
        fetchVolunteerTokens();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || "Failed to permit volunteer token.";
        setFormError(errMsg);
        showToast("Permitting Failed", errMsg, "error");
        if (playBeep) playBeep("error");
      }
    } catch (err) {
      console.error("Volunteer Permitting submission error:", err);
      setFormError("Network or server error. Please try again.");
      showToast("Connection Error", "Could not connect to staff backend server.", "error");
      if (playBeep) playBeep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async (tokenId: string, recipientEmail?: string) => {
    if (!recipientEmail) {
      showToast("Missing Email", "No email ID associated with this volunteer token.", "warning");
      return;
    }

    try {
      const res = await apiFetch("/api/staff/volunteer-tokens/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_id: tokenId, email: recipientEmail })
      });

      if (res.ok) {
        showToast("Email Resent", `Volunteer pass email dispatched to ${recipientEmail}`, "success");
      } else {
        showToast("Email Dispatch Failed", "Could not resend email. Check backend SMTP settings.", "error");
      }
    } catch (e) {
      showToast("Network Error", "Failed to connect to server.", "error");
    }
  };

  const openWhatsAppLink = (phone?: string, tokenId?: string, volName?: string, volRole?: string, mType?: string) => {
    if (!phone) {
      showToast("No Phone Number", "No phone number available for WhatsApp dispatch.", "warning");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `🎓 *RKMVC CANTEEN VOLUNTEER MEAL PASS*\n-----------------------------------------\n👤 *Volunteer:* ${volName || 'Volunteer'}\n🏷️ *Role:* ${volRole || 'Event Volunteer'}\n🎫 *Pass Token ID:* \`${tokenId}\`\n🍽️ *Meal Session:* ${mType || 'Canteen Meal'}\n🏛️ *Issued By:* RKMVC Staff Office\n\nPlease show this Token ID (\`${tokenId}\`) at the canteen counter to claim your meal.\n\nThank you for your service! 🙏`;
    
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const filteredTokens = volunteerTokens.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      (t.volunteer_name && t.volunteer_name.toLowerCase().includes(q)) ||
      (t.token_id && t.token_id.toLowerCase().includes(q)) ||
      (t.phone_no && t.phone_no.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.volunteer_role && t.volunteer_role.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      
      {/* SECTION HEADER */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-amber-100">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Staff Portal &bull; Guest Token Hub</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight font-display">
            Guest Meal Pass Permitting
          </h2>
          <p className="text-amber-100 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
            Generate official meal authentication vouchers for guests & event volunteers and dispatch pass cards instantly via WhatsApp or Email.
          </p>
        </div>
        <div className="shrink-0 z-10 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center flex flex-col items-center">
          <Ticket className="w-8 h-8 text-amber-200 mb-1 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-200">Active Passes</span>
          <span className="text-2xl font-black font-mono">{volunteerTokens.filter(t => t.status === "active").length}</span>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (5 Cols): FORM TO PERMIT NEW VOLUNTEER TOKEN */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-md font-extrabold text-slate-900 tracking-tight font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Permit Guest Token</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter guest details and choose dispatch channel (WhatsApp or Email).
            </p>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Volunteer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Guest Full Name *</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Guest Name / Chief Guest / Inspector"
                value={volunteerName}
                onChange={(e) => setVolunteerName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Event / Role */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>Role / Purpose / Department</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Special Guest / Event Speaker / Inspector"
                value={volunteerRole}
                onChange={(e) => setVolunteerRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Pass Count Selection (1 Pass or 2 Passes) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Number of QR Tokens / Meal Passes
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPassCount(1)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    passCount === 1
                      ? "bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-sm font-black">1 Meal Pass</span>
                  <span className="text-[10px] font-normal text-slate-500">Single Meal (Breakfast or Lunch)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPassCount(2)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    passCount === 2
                      ? "bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-sm font-black">2 Meal Passes</span>
                  <span className="text-[10px] font-normal text-slate-500">Both Meals (Breakfast & Lunch)</span>
                </button>
              </div>
            </div>

            {/* Dispatch Method Options (WhatsApp, Email, Both) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pass Dispatch Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSendVia("whatsapp")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sendVia === "whatsapp"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSendVia("email")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sendVia === "email"
                      ? "bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-400/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Email ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSendVia("both")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sendVia === "both"
                      ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-amber-600" />
                  <span>Both Channels</span>
                </button>
              </div>
            </div>

            {/* Mobile / WhatsApp Number Field */}
            {(sendVia === "whatsapp" || sendVia === "both") && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Phone Number *</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210 (10-digit number)"
                  value={phoneNo}
                  onChange={(e) => setPhoneNo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            )}

            {/* Email Address Field */}
            {(sendVia === "email" || sendVia === "both") && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Guest Email Address *</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. guest@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            )}

            {/* Date of Validity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Pass Valid Date</span>
              </label>
              <input
                type="date"
                value={validDate}
                onChange={(e) => setValidDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Custom Remarks / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Stage Setup Duty Pass"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Permitting Guest Token...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Permit & Dispatch Pass</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* RIGHT COLUMN (7 Cols): VOLUNTEER PASS LEDGER TABLE */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-md font-extrabold text-slate-900 tracking-tight font-display flex items-center gap-2">
                <span>Guest Pass Ledger</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-mono">
                  {filteredTokens.length} Passes
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                History of all permitted guest meal tokens.
              </p>
            </div>
            <button
              onClick={fetchVolunteerTokens}
              className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Guest Name, Phone, Email, or Token ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Table */}
          {filteredTokens.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic text-xs">
              {isLoadingList ? "Loading guest tokens..." : "No guest passes found."}
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-2xl">
              <div className="overflow-x-auto max-h-[460px]">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-3">Guest</th>
                      <th className="py-3 px-3">Token ID</th>
                      <th className="py-3 px-3">Meal</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTokens.map((item) => (
                      <tr key={item.token_id || item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.volunteer_name}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{item.volunteer_role}</div>
                          {(item.phone_no || item.email) && (
                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                              {item.phone_no && <span className="mr-2">📱 {item.phone_no}</span>}
                              {item.email && <span>✉️ {item.email}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-700">
                          {item.token_id}
                        </td>
                        <td className="py-3 px-3 uppercase font-extrabold text-[10px] text-slate-600">
                          {item.meal_type}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              item.status === "approved" || item.status === "redeemed"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : item.status === "expired"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-100 text-amber-800 animate-pulse"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp Button */}
                            {item.phone_no && (
                              <button
                                onClick={() => openWhatsAppLink(item.phone_no, item.token_id, item.volunteer_name, item.volunteer_role, item.meal_type)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
                                title="Send via WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Email Resend Button */}
                            {item.email && (
                              <button
                                onClick={() => handleResendEmail(item.token_id, item.email)}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Resend Email Pass"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View QR Pass Modal Button */}
                            <button
                              onClick={() =>
                                setActivePassModal({
                                  token_id: item.token_id,
                                  volunteer_name: item.volunteer_name,
                                  volunteer_role: item.volunteer_role,
                                  meal_type: item.meal_type,
                                  valid_date: new Date(item.created_at).toISOString().split("T")[0],
                                  phone_no: item.phone_no,
                                  email: item.email
                                })
                              }
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                              title="View Pass Card"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* VOLUNTEER PASS CARD MODAL */}
      {activePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            
            {/* Pass Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white text-center relative">
              <button
                onClick={() => setActivePassModal(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 bg-white rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-md p-1.5">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Emblem-Ramakrishna-Mission-Transparent.png" 
                  alt="RKMVC Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-lg font-black tracking-tight font-display uppercase">Ramakrishna Mission Vivekananda College</h3>
              <p className="text-xs text-amber-100 font-bold uppercase tracking-wider mt-0.5">Official Guest Meal Voucher Pass</p>
            </div>

            {/* Pass Content Body */}
            <div className="p-6 space-y-5 text-center">
              
              {/* Token ID Voucher Container */}
              <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 block mb-1">Voucher Token ID</span>
                <span className="font-mono text-2xl font-black text-amber-900 tracking-widest selection:bg-amber-200">
                  {activePassModal.token_id}
                </span>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activePassModal.token_id)}`}
                    alt="Volunteer Pass QR Code"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present QR Code to Canteen Staff Scanner</p>
              </div>

              {/* Details List */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Guest Name</span>
                  <span className="font-extrabold text-slate-900">{activePassModal.volunteer_name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Event / Role</span>
                  <span className="font-extrabold text-slate-900">{activePassModal.volunteer_role}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Meal Session</span>
                  <span className="font-extrabold text-amber-600 uppercase">{activePassModal.meal_type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Valid Date</span>
                  <span className="font-mono font-bold text-slate-800">{activePassModal.valid_date}</span>
                </div>
              </div>

              {/* Quick Actions inside Modal */}
              <div className="grid grid-cols-2 gap-3">
                {activePassModal.phone_no ? (
                  <button
                    onClick={() => openWhatsAppLink(activePassModal.phone_no, activePassModal.token_id, activePassModal.volunteer_name, activePassModal.volunteer_role, activePassModal.meal_type)}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activePassModal.token_id);
                      showToast("Copied!", "Token ID copied to clipboard.", "info");
                    }}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy ID</span>
                  </button>
                )}

                {activePassModal.email ? (
                  <button
                    onClick={() => handleResendEmail(activePassModal.token_id, activePassModal.email)}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Resend Email</span>
                  </button>
                ) : (
                  <button
                    onClick={() => window.print()}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Pass</span>
                  </button>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
              <button
                onClick={() => setActivePassModal(null)}
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
