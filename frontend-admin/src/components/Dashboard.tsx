import React, { useEffect, useState } from 'react';
import {
  Users,
  Sun,
  Moon,
  Soup,
  Plus,
  TrendingUp,
  Clock,
  ShieldCheck,
  FileCheck,
  UtensilsCrossed,
  ChefHat,
  Activity,
  CheckCircle,
  Loader,
  Upload
} from 'lucide-react';
import api from '../lib/api';

interface DashboardProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ showToast, onNavigate }: DashboardProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenGenerated, setTokenGenerated] = useState(0);
  const [tokenRedeemed, setTokenRedeemed] = useState(0);
  const [tokensRaw, setTokensRaw] = useState<any[]>([]);

  // Quick registration states
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    name: '',
    grade_section: 'B.Sc. Comp Sci',
    forenoon_meal: true,
    afternoon_meal: true
  });

  const fetchDashboardData = async () => {
    try {
      const [studentsResult, logsResult, tokensResult] = await Promise.allSettled([
        api.get('/tables/student_meals?limit=150'),
        api.get('/tables/meal_distribution_log?limit=50').catch(() => ({ data: { rows: [] } })),
        api.get('/tokens?limit=200').catch(() => ({ data: [] }))
      ]);

      setStudents(studentsResult.status === 'fulfilled' && studentsResult.value.data?.rows ? studentsResult.value.data.rows : []);
      setLogs(logsResult.status === 'fulfilled' && logsResult.value.data?.rows ? logsResult.value.data.rows : []);

      if (tokensResult.status === 'fulfilled') {
        const tokenData = tokensResult.value.data?.tokens || tokensResult.value.data || [];
        setTokensRaw(tokenData);
        setTokenGenerated(tokenData.filter((t: any) => t.status && ['approved', 'token_issued', 'redeemed', 'staff_verified'].includes(t.status.toLowerCase())).length);
        setTokenRedeemed(tokenData.filter((t: any) => t.status && t.status.toLowerCase() === 'redeemed').length);
      }

      if (studentsResult.status === 'rejected') {
        showToast('Could not load Students & Rosters data.', 'error');
      }
    } catch (err) {
      showToast('Offline or tables not initialized. Standard offline defaults active.', 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // refresh every 30s (Area 5 Item 4)
    return () => clearInterval(interval);
  }, []);

  // Quick Action: add student
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.student_id || !newStudent.name) {
      showToast('Please fill out student ID and Name.', 'error');
      return;
    }

    try {
      await api.post('/tables/student_meals/records', {
        student_id: newStudent.student_id.trim().toUpperCase(),
        name: newStudent.name.trim(),
        email: newStudent.email.trim() || null,
        grade_section: newStudent.grade_section,
        forenoon_meal: newStudent.forenoon_meal,
        afternoon_meal: newStudent.afternoon_meal,
        image_url: newStudent.image_url || null,
        last_served_date: null
      });

      // Create an audit trail log
      await api.post('/tables/meal_distribution_log/records', {
        log_id: 'LOG_' + Math.random().toString(36).substr(2, 9),
        student_id: newStudent.student_id.toUpperCase(),
        session_type: 'Registration',
        status: 'Registered',
        served_by: 'admin',
        timestamp: new Date().toISOString()
      });

      showToast(`Student ${newStudent.name} registered successfully!`, 'success');
      setShowQuickRegister(false);
      setNewStudent({
        student_id: '',
        name: '',
        email: '',
        grade_section: 'B.Sc. Comp Sci',
        forenoon_meal: true,
        afternoon_meal: true,
        image_url: ''
      });
      fetchDashboardData();
    } catch (err: any) {
      showToast(`Registration failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  // Calculations for stats
  const totalStudents = students.length;
  const fnServed = students.filter(s => s.forenoon_meal === true || s.forenoon_meal === 'true' || s.forenoon_meal === 1).length;
  const anServed = students.filter(s => s.afternoon_meal === true || s.afternoon_meal === 'true' || s.afternoon_meal === 1).length;
  const overallServedCount = fnServed + anServed;
  const overallTargetCount = totalStudents * 2;
  const complianceRate = overallTargetCount > 0 ? Math.round((overallServedCount / overallTargetCount) * 100) : 0;

  // Status styling for the Live Token Activity Stream
  const tokenStatusStyles: Record<string, string> = {
    redeemed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    approved: 'bg-blue-50 text-blue-600 border-blue-200',
    token_issued: 'bg-amber-50 text-amber-600 border-amber-200',
    awaiting_scan: 'bg-purple-50 text-purple-600 border-purple-200',
    staff_verified: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    expired: 'bg-rose-50 text-rose-600 border-rose-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
  };
  const tokenStatusLabels: Record<string, string> = {
    redeemed: 'Redeemed',
    approved: 'Generated',
    token_issued: 'Generated',
    awaiting_scan: 'Pending',
    staff_verified: 'Verified',
    expired: 'Expired',
    rejected: 'Rejected',
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-6 sm:p-8 space-y-8">

      {/* Top Welcome and Quick Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-saffron-100 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-saffron-500 animate-bounce" />
            RKMVC Meal Tracker
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track, verify, and log daily student meal distributions for Ramakrishna Mission Vivekananda College.
          </p>
        </div>
        <button
          onClick={() => setShowQuickRegister(!showQuickRegister)}
          className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-md shadow-saffron-500/20 cursor-pointer transition-all shrink-0 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Quick Add Student
        </button>
      </div>

      {/* Quick Add Dialog Form (Inline) */}
      {showQuickRegister && (
        <form onSubmit={handleQuickRegister} className="bg-white border border-saffron-200 rounded-2xl p-6 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ChefHat className="h-4.5 w-4.5 text-saffron-500" />
              Register New Student & Meal Plan
            </h3>
            <button
              type="button"
              onClick={() => setShowQuickRegister(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Student ID *</label>
              <input
                type="text"
                placeholder="e.g. STU110"
                value={newStudent.student_id}
                onChange={e => setNewStudent({ ...newStudent, student_id: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Rohini Sen"
                value={newStudent.name}
                onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="e.g. student@example.com"
                value={newStudent.email}
                onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Department / Degree</label>
              <select
                value={newStudent.grade_section}
                onChange={e => setNewStudent({ ...newStudent, grade_section: e.target.value })}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
              >
                <option value="B.Sc. Comp Sci">B.Sc. Comp Sci</option>
                <option value="B.Sc. Physics">B.Sc. Physics</option>
                <option value="B.Sc. Chemistry">B.Sc. Chemistry</option>
                <option value="B.Com General">B.Com General</option>
                <option value="B.A. Economics">B.A. Economics</option>
                <option value="M.Sc. Comp Sci">M.Sc. Comp Sci</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Meal Plan Opt-in Choices</label>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newStudent.forenoon_meal}
                    onChange={e => setNewStudent({ ...newStudent, forenoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500"
                  />
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Forenoon Meal (Breakfast)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newStudent.afternoon_meal}
                    onChange={e => setNewStudent({ ...newStudent, afternoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500"
                  />
                  <Soup className="h-3.5 w-3.5 text-amber-600" />
                  <span>Afternoon Meal (Lunch)</span>
                </label>
              </div>
            </div>

            {/* Student Photo Upload Option (Between Checkboxes and Confirm Registration Button) */}
            <div className="flex flex-col justify-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Student Image
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="quick-student-photo"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewStudent(prev => ({ ...prev, image_url: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="quick-student-photo"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                >
                  {newStudent.image_url ? (
                    <>
                      <img src={newStudent.image_url} alt="Preview" className="w-4.5 h-4.5 rounded-full object-cover border border-saffron-400" />
                      <span className="text-saffron-600 font-bold">Image Uploaded ✓</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload Student Image</span>
                    </>
                  )}
                </label>
                {newStudent.image_url && (
                  <button
                    type="button"
                    onClick={() => setNewStudent(prev => ({ ...prev, image_url: '' }))}
                    className="text-[10px] text-red-500 hover:underline font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer shrink-0"
            >
              Confirm Registration
            </button>
          </div>
        </form>
      )}      {/* Metrics Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Card 1: Registered Students */}
        <div className="text-left bg-saffron-50/30 border border-saffron-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-saffron-600/80 uppercase tracking-widest block">Registered Students</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{totalStudents}</span>
          </div>
          <div className="bg-saffron-100/70 text-saffron-700 p-2.5 rounded-xl border border-saffron-200/60">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Forenoon Served */}
        <div className="text-left bg-amber-50/30 border border-amber-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest block">Forenoon Served</span>
            <span className="text-2xl font-extrabold text-saffron-600 mt-0.5 block">
              {fnServed} <span className="text-xs font-semibold text-slate-400">/ {totalStudents}</span>
            </span>
          </div>
          <div className="bg-amber-100/70 text-amber-700 p-2.5 rounded-xl border border-amber-200/60">
            <Sun className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Afternoon Served */}
        <div className="text-left bg-amber-50/30 border border-amber-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest block">Afternoon Served</span>
            <span className="text-2xl font-extrabold text-amber-700 mt-0.5 block">
              {anServed} <span className="text-xs font-semibold text-slate-400">/ {totalStudents}</span>
            </span>
          </div>
          <div className="bg-amber-100/70 text-amber-800 p-2.5 rounded-xl border border-amber-200/60">
            <Soup className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Daily Compliance */}
        <div className="text-left bg-emerald-50/30 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest block">Daily compliance</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-0.5 block">{complianceRate}%</span>
          </div>
          <div className="bg-emerald-100/70 text-emerald-700 p-2.5 rounded-xl border border-emerald-200/60">
            <FileCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Card 5: Tokens Generated */}
        <div className="text-left bg-blue-50/30 border border-blue-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest block">Tokens Generated</span>
            <span className="text-2xl font-extrabold text-blue-600 mt-0.5 block">{tokenGenerated}</span>
          </div>
          <div className="bg-blue-100/70 text-blue-700 p-2.5 rounded-xl border border-blue-200/60">
            <Loader className="h-5 w-5" />
          </div>
        </div>

        {/* Card 6: Tokens Redeemed */}
        <div className="text-left bg-emerald-50/30 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest block">Tokens Redeemed</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-0.5 block">{tokenRedeemed}</span>
          </div>
          <div className="bg-emerald-100/70 text-emerald-700 p-2.5 rounded-xl border border-emerald-200/60">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Main interactive serving grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Interactive Grid - Live Token Activity Stream */}
        <div className="lg:col-span-2 bg-white border border-saffron-200/60 rounded-2xl shadow-2xs flex flex-col overflow-hidden">

          <div className="p-6 border-b border-saffron-100/60 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-saffron-500" />
              Live Token Activity Stream
            </h3>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-saffron-700 bg-saffron-50 border border-saffron-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-saffron-500 animate-ping" /> Real-time Sync Active
              </span>
              <button
                onClick={() => onNavigate('token-monitor')}
                className="text-[10px] font-bold text-saffron-600 hover:text-saffron-700 cursor-pointer"
              >
                View full stream →
              </button>
            </div>
          </div>

          {/* Token Stream Rows */}
          <div className="p-6">
            {tokensRaw.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No token activity recorded yet.
                <br />
                Tokens issued and redeemed by staff will appear here live.
              </div>
            ) : (
              <div className="divide-y divide-saffron-100/50 max-h-[480px] overflow-y-auto pr-2">
                {tokensRaw.slice(0, 25).map((t: any, idx: number) => {
                  const st = (t.status || '').toLowerCase();
                  const stStyle = tokenStatusStyles[st] || 'bg-gray-50 text-gray-600 border-gray-200';
                  const stLabel = tokenStatusLabels[st] || t.status || 'Active';
                  const code = t.token_code || t.token_uid || t.token_id || t.id;
                  const meal = t.session_type || t.meal_type || 'Standard';
                  const isForenoon = meal.toLowerCase().includes('break') || meal.toLowerCase().includes('forenoon');

                  return (
                    <div key={code || idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">

                      {/* Token Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 font-mono tracking-tight shrink-0 bg-saffron-50/50 px-1.5 py-0.5 border border-saffron-200/50 rounded">
                            {code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {t.student_name || t.student_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-medium">
                          <span className="font-semibold text-slate-700 inline-flex items-center gap-1">
                            {isForenoon ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-indigo-500" />}
                            {meal}
                          </span>
                          {t.created_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(t.created_at).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${stStyle}`}>
                          {st === 'redeemed' ? <CheckCircle className="h-3 w-3" /> : null}
                          {stLabel}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Column - Activity audit feed & details */}
        <div className="space-y-6">

          {/* Quick Stats Distribution Progress */}
          <div className="bg-white border border-saffron-200/60 rounded-2xl p-6 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-4 flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-saffron-500" />
              Session Breakdown
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span>Forenoon Target Met</span>
                  <span>{Math.round((fnServed / (totalStudents || 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-saffron-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents > 0 ? (fnServed / totalStudents) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">{fnServed} of {totalStudents} students served</span>
              </div>

              <div className="border-t border-saffron-100/60 pt-3">
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span>Afternoon Target Met</span>
                  <span>{Math.round((anServed / (totalStudents || 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents > 0 ? (anServed / totalStudents) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">{anServed} of {totalStudents} students served</span>
              </div>
            </div>
          </div>

          {/* Live Distribution Logs Feed */}
          <div className="bg-white border border-saffron-200/60 rounded-2xl p-6 shadow-2xs flex flex-col h-[340px]">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-4 flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-saffron-500" />
              Meal logs trail
            </h3>

            {logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-400">
                <span>No meal logs recorded today.</span>
                <span className="text-[10px] text-slate-350 mt-1">Start serving students to see live updates.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {logs.slice(0, 8).map((log, index) => (
                  <div key={log.log_id || index} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-saffron-500 mt-1.5 shrink-0" />
                      <div className="flex-1 w-[1px] bg-saffron-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-medium">
                        Student <span className="font-semibold text-slate-900">#{log.student_id}</span> received <span className="font-semibold text-saffron-600">{log.session_type}</span> meal
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>By {log.served_by || 'admin'}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
