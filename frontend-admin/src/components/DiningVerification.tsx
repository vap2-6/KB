import React, { useEffect, useState } from 'react';
import { Sun, Soup, Search, Check, ChefHat, Filter } from 'lucide-react';
import api from '../lib/api';

interface DiningVerificationProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function DiningVerification({ showToast }: DiningVerificationProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<'All' | 'Pending_FN' | 'Pending_AN'>('All');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/tables/student_meals?limit=150');
      setStudents(res.data?.rows || []);
    } catch (err) {
      showToast('Could not load Students & Rosters data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Quick Action: toggle FN/AN served state with Optimistic UI rendering
  const handleToggleMeal = async (student: any, session: 'forenoon_meal' | 'afternoon_meal') => {
    setUpdatingId(`${student.student_id}_${session}`);
    const isCurrentlyServed = student[session] === true || student[session] === 'true' || student[session] === 1;
    const newValue = !isCurrentlyServed;

    // Optimistic UI flip
    setStudents(prev => prev.map(s => s.student_id === student.student_id ? { ...s, [session]: newValue } : s));

    try {
      // 1. Update the student table directly
      await api.put(`/records/${student.student_id}`, {
        targetTableName: 'student_meals',
        [session]: newValue,
        last_served_date: new Date().toISOString().split('T')[0]
      });

      // 2. Insert audit record into meal_distribution_log (non-fatal)
      const sessionLabel = session === 'forenoon_meal' ? 'Forenoon' : 'Afternoon';
      if (newValue) {
        try {
          const nowStr = new Date().toISOString();
          await api.post('/tables/meal_distribution_log/records', {
            log_id: 'LOG_' + Math.random().toString(36).substr(2, 9),
            student_id: student.student_id,
            session_type: sessionLabel,
            status: 'Distributed',
            served_by: 'admin',
            served_at: nowStr,
            timestamp: nowStr
          });
        } catch (logErr) {
          console.warn('Meal distribution log notice:', logErr);
        }
      }

      showToast(`${student.name}'s ${sessionLabel} meal status updated!`, 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(`Failed to update meal status: ${err?.response?.data?.error || err.message || 'Error'}`, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Grade lists for filters
  const grades = ['All', ...Array.from(new Set(students.map(s => s.grade_section))).filter(Boolean)];

  // Filtering students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name?.toLowerCase().includes(search.toLowerCase()) ||
      student.student_id?.toLowerCase().includes(search.toLowerCase()) ||
      student.grade_section?.toLowerCase().includes(search.toLowerCase());

    const matchesGrade = selectedGrade === 'All' || student.grade_section === selectedGrade;

    let matchesSession = true;
    if (selectedSessionFilter === 'Pending_FN') {
      matchesSession = !student.forenoon_meal;
    } else if (selectedSessionFilter === 'Pending_AN') {
      matchesSession = !student.afternoon_meal;
    }

    return matchesSearch && matchesGrade && matchesSession;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dining Verification</h2>
        <p className="text-xs text-slate-500 mt-1">Live student dining verification and manual meal status overrides</p>
      </div>

      <div className="bg-white border border-saffron-200/60 rounded-2xl shadow-2xs flex flex-col overflow-hidden">

        <div className="p-6 border-b border-saffron-100/60 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-saffron-500" />
              Live Student Dining Verification
            </h3>

            {/* Reset/Sync Indicator */}
            <span className="text-[10px] font-semibold text-saffron-700 bg-saffron-50 border border-saffron-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-saffron-500 animate-ping" /> Real-time Sync Active
            </span>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student ID, name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-saffron-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500 bg-saffron-50/20"
              />
            </div>

            {/* Grade Filter */}
            <div className="relative flex items-center">
              <Filter className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-saffron-50/20 border border-saffron-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
              >
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade === 'All' ? 'All Classes' : grade}</option>
                ))}
              </select>
            </div>

            {/* Status Session Filter */}
            <div className="flex border border-saffron-200/60 rounded-xl overflow-hidden p-0.5 bg-saffron-50/20">
              <button
                onClick={() => setSelectedSessionFilter('All')}
                className={`flex-1 text-[10px] font-bold py-1 px-1.5 rounded-lg cursor-pointer ${selectedSessionFilter === 'All' ? 'bg-white text-saffron-600 shadow-2xs' : 'text-slate-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedSessionFilter('Pending_FN')}
                className={`flex-1 text-[10px] font-bold py-1 px-1.5 rounded-lg cursor-pointer ${selectedSessionFilter === 'Pending_FN' ? 'bg-white text-saffron-600 shadow-2xs' : 'text-slate-400'}`}
                title="Needs Forenoon meal"
              >
                Pending FN
              </button>
              <button
                onClick={() => setSelectedSessionFilter('Pending_AN')}
                className={`flex-1 text-[10px] font-bold py-1 px-1.5 rounded-lg cursor-pointer ${selectedSessionFilter === 'Pending_AN' ? 'bg-white text-saffron-600 shadow-2xs' : 'text-slate-400'}`}
                title="Needs Afternoon meal"
              >
                Pending AN
              </button>
            </div>
          </div>
        </div>

        {/* Student Grid / Rows */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching students found on current filters.
              <br />
              Try importing more student lists or clearing filters.
            </div>
          ) : (
            <div className="divide-y divide-saffron-100/50 max-h-[600px] overflow-y-auto pr-2">
              {filteredStudents.map((student) => {
                const isFnServed = student.forenoon_meal === true || student.forenoon_meal === 'true' || student.forenoon_meal === 1;
                const isAnServed = student.afternoon_meal === true || student.afternoon_meal === 'true' || student.afternoon_meal === 1;

                return (
                  <div key={student.student_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">

                    {/* Student Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 font-mono tracking-tight shrink-0 bg-saffron-50/50 px-1.5 py-0.5 border border-saffron-200/50 rounded">
                          {student.student_id}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {student.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-medium">
                        <span className="font-semibold text-slate-700">{student.grade_section}</span>
                        {student.last_served_date && (
                          <>
                            <span>•</span>
                            <span>Served: {student.last_served_date}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Interactive meal buttons */}
                    <div className="flex items-center gap-3 shrink-0">

                      {/* Forenoon (FN) Button */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleToggleMeal(student, 'forenoon_meal')}
                          disabled={updatingId !== null}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${isFnServed
                            ? 'bg-saffron-500 text-white border-saffron-500 shadow-2xs'
                            : 'bg-slate-50 text-slate-500 border-saffron-200/60 hover:bg-saffron-50/50'
                            }`}
                        >
                          <Sun className={`h-3.5 w-3.5 ${isFnServed ? 'text-white' : 'text-amber-500'}`} />
                          <span>Forenoon</span>
                          {isFnServed && <Check className="h-3 w-3 text-white" />}
                        </button>
                      </div>

                      {/* Afternoon (AN) Button */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleToggleMeal(student, 'afternoon_meal')}
                          disabled={updatingId !== null}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${isAnServed
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-500 border-saffron-200/60 hover:bg-amber-50/50'
                            }`}
                        >
                          <Soup className={`h-3.5 w-3.5 ${isAnServed ? 'text-white' : 'text-amber-600'}`} />
                          <span>Afternoon</span>
                          {isAnServed && <Check className="h-3 w-3 text-white" />}
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
