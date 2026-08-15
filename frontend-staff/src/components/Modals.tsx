import React, { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, User, Calendar, ShieldCheck, HelpCircle, RefreshCw } from "lucide-react";
import { Student, Token } from "../types";

interface IssueTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  existingToken?: Token | null;
  tokens?: Token[];
  onConfirmIssue: (mealType: string) => Promise<void>;
  onRejectIssue: () => void;
}

export function IssueTokenModal({
  isOpen,
  onClose,
  student,
  existingToken,
  tokens,
  onConfirmIssue,
  onRejectIssue
}: IssueTokenModalProps) {
  const [mealSession, setMealSession] = useState<string>("Breakfast");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Time-based meal inference
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      const cutoffMinutes = 11 * 60 + 30; // 11:30 AM

      if (totalMinutes < cutoffMinutes) {
        setMealSession("Breakfast");
      } else {
        setMealSession("Lunch");
      }
      setImageLoading(true);
    }
  }, [isOpen]);

  if (!isOpen || !student) return null;

  // Real-Time Session Eligibility Guards (Rule A & Rule B)
  const isBreakfastSession = mealSession === "Breakfast" || mealSession === "Forenoon";
  const isLunchSession = mealSession === "Lunch" || mealSession === "Afternoon";

  const forenoonEligible = student.forenoon_meal !== false;
  const afternoonEligible = student.afternoon_meal !== false;

  const isForenoonIneligible = isBreakfastSession && !forenoonEligible;
  const isAfternoonIneligible = isLunchSession && !afternoonEligible;

  const isIneligible = isForenoonIneligible || isAfternoonIneligible;
  const ineligibilityReason = isForenoonIneligible
    ? "NOT ELIGIBLE FOR FORENOON MEAL"
    : isAfternoonIneligible
    ? "NOT ELIGIBLE FOR AFTERNOON MEAL"
    : null;

  // Lookup today's token for this student
  const todayStr = new Date().toISOString().split('T')[0];
  const todayToken = existingToken || tokens?.find(t => {
    const sReg = String(student.reg_no || (student as any).student_id || '').trim().toLowerCase();
    const tReg = String(t.student_reg || (t as any).student_id || '').trim().toLowerCase();
    if (!sReg || !tReg || sReg !== tReg) return false;
    if (!t.created_at) return true;
    try {
      const tokenDateStr = new Date(t.created_at).toISOString().split('T')[0];
      return tokenDateStr === todayStr;
    } catch {
      return true;
    }
  });

  const tokenStatusLower = (todayToken?.status || "").toLowerCase();
  const isTokenActive = tokenStatusLower === "active" || tokenStatusLower === "approved" || tokenStatusLower === "token_issued" || tokenStatusLower === "staff_verified";
  const isTokenClaimed = tokenStatusLower === "redeemed" || tokenStatusLower === "claimed" || tokenStatusLower === "used";
  const isTokenDisabled = isTokenActive || isTokenClaimed;

  const handleGenerate = async () => {
    if (isIneligible || isSubmitting || isTokenDisabled) return;
    setIsSubmitting(true);
    try {
      await onConfirmIssue(mealSession);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Saffron accent header bar */}
        <div className="bg-[#FF9933] px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-sm uppercase tracking-wider font-display">
              UNIFIED VERIFICATION VIEW MAPPING
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/85 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Top-centered circular profile image with Tailwind loading skeleton */}
          <div className="relative w-24 h-24 mb-4 rounded-full border-4 border-slate-100 shadow-md flex items-center justify-center bg-slate-50 overflow-hidden">
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                <User className="w-10 h-10 text-slate-400" />
              </div>
            )}
            <img
              src={student.image_url}
              alt={student.name}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>

          <h4 className="text-lg font-extrabold text-slate-900 text-center">
            {student.name}
          </h4>
          <p className="text-xs font-mono font-bold text-[#FF9933] bg-amber-50 px-3 py-1 rounded-full border border-amber-100 mt-1">
            REG: {student.reg_no}
          </p>

          {/* Student Profile Info Fields */}
          <div className="w-full mt-4 space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Academic Year:</span>
              <span className="font-bold text-slate-900">{student.year}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
              <span className="text-slate-500">Department:</span>
              <span className="font-bold text-slate-900">{student.department}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
              <span className="text-slate-500">Meal:</span>
              <span className="font-bold text-slate-900 uppercase">
                {mealSession}
              </span>
            </div>
          </div>

          {/* Alert Banner when Ineligible */}
          {isIneligible && (
            <div className="w-full mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs animate-in fade-in duration-200 text-center">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{ineligibilityReason}</span>
            </div>
          )}

          {/* Alert Banner at bottom of window when Token is Active */}
          {isTokenActive && (
            <div className="w-full mt-3 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs animate-in fade-in duration-200 text-center shadow-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Token is active</span>
            </div>
          )}

          {/* Alert Banner at bottom of window when Token is Claimed */}
          {isTokenClaimed && (
            <div className="w-full mt-3 bg-blue-50 border border-blue-300 text-blue-900 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs animate-in fade-in duration-200 text-center shadow-sm">
              <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Token is claimed</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 italic text-center mt-3">
            Automatically detected client machine context: {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
          <button
            onClick={onRejectIssue}
            disabled={isSubmitting}
            className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            REJECT
          </button>
          <button
            onClick={handleGenerate}
            disabled={isSubmitting || isIneligible || isTokenDisabled}
            className={`flex-1 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 ${
              isIneligible || isTokenDisabled
                ? "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60"
                : "bg-[#FF9933] hover:bg-[#e68a2e] text-white shadow-md shadow-[#FF9933]/15 cursor-pointer"
            }`}
          >
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {isTokenActive ? "TOKEN IS ACTIVE" : isTokenClaimed ? "TOKEN IS CLAIMED" : "GENERATE TOKEN"}
          </button>
        </div>

      </div>
    </div>
  );
}

interface VerifyTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenData: { token: Token; student: Student } | null;
  onApproveVerify: () => Promise<void>;
  onRejectVerify: () => Promise<void>;
}

export function VerifyTokenModal({
  isOpen,
  onClose,
  tokenData,
  onApproveVerify,
  onRejectVerify
}: VerifyTokenModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setImageLoading(true);
    }
  }, [isOpen]);

  if (!isOpen || !tokenData) return null;

  const { token, student } = tokenData;

  const handleAction = async (approve: boolean) => {
    setIsSubmitting(true);
    try {
      if (approve) {
        await onApproveVerify();
      } else {
        await onRejectVerify();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Saffron header */}
        <div className="bg-[#FF9933] px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-sm uppercase tracking-wider font-display">
              UNIFIED VERIFICATION VIEW MAPPING
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/85 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Top-centered Student Profile Circle */}
          <div className="relative w-24 h-24 mb-4 rounded-full border-4 border-slate-100 shadow-md flex items-center justify-center bg-slate-50 overflow-hidden">
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                <User className="w-10 h-10 text-slate-400" />
              </div>
            )}
            <img
              src={student.image_url}
              alt={student.name}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>

          <h4 className="text-lg font-extrabold text-slate-900 text-center">
            {student.name}
          </h4>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {student.department} • {student.year}
          </p>

          {/* Token verification data panel */}
          <div className="w-full mt-6 space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-semibold text-xs text-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Student Reg No:</span>
              <span className="font-mono text-slate-900">{student.reg_no}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
              <span className="text-slate-500">Token Identifier:</span>
              <span className="font-mono text-[#FF9933] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                {token.token_id}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
              <span className="text-slate-500">Meal Session:</span>
              <span className="text-slate-900 font-bold uppercase">{token.meal_type}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
              <span className="text-slate-500">Creation Date:</span>
              <span className="text-slate-900 font-mono text-[10px]">
                {new Date(token.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
          <button
            onClick={() => handleAction(false)}
            disabled={isSubmitting}
            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            REJECT TOKEN
          </button>
          <button
            onClick={() => handleAction(true)}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            APPROVE TOKEN
          </button>
        </div>

      </div>
    </div>
  );
}
