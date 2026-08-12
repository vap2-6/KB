import { useState, useEffect, useCallback } from 'react';
import { Send, Search, X, Check, AlertCircle, Loader2, Mail, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { ToastType } from './Toast';
import api from '../lib/api';

interface Student {
  student_id: string;
  name: string;
  grade_section: string;
  forenoon_meal: number;
  afternoon_meal: number;
  email: string;
  display_name: string | null;
}

interface FilterOptions {
  grade_sections: string[];
  total_students: number;
  with_email: number;
}

interface CommunicationsModuleProps {
  showToast: (message: string, type: ToastType) => void;
}

export default function CommunicationsModule({ showToast }: CommunicationsModuleProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  const [filters, setFilters] = useState({
    grade_section: '',
    forenoon: false,
    afternoon: false,
    q: '',
  });

  const [compose, setCompose] = useState({
    sender_email: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    api.get('/communications/filter-options').then(r => setFilterOptions(r.data));
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.grade_section) params.grade_section = filters.grade_section;
      if (filters.forenoon) params.forenoon = '1';
      if (filters.afternoon) params.afternoon = '1';
      if (filters.q) params.q = filters.q;
      const r = await api.get('/communications/students', { params });
      const sorted = Array.isArray(r.data) ? [...r.data].sort((a: any, b: any) => {
        const idA = String(a.student_id || a.reg_no || '').trim();
        const idB = String(b.student_id || b.reg_no || '').trim();
        return idA.localeCompare(idB, undefined, { numeric: true });
      }) : r.data;
      setStudents(sorted);
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(students.map(s => s.student_id)));
      setSelectAll(true);
    }
  };

  const selectedStudents = students.filter(s => selectedIds.has(s.student_id));

  const handleSend = async () => {
    if (!compose.subject.trim() || !compose.body.trim()) {
      showToast('Subject and body are required', 'error');
      return;
    }
    if (selectedIds.size === 0) {
      showToast('Select at least one student', 'error');
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const r = await api.post('/communications/send', {
        student_ids: Array.from(selectedIds),
        subject: compose.subject.trim(),
        body: compose.body.trim(),
        sender_email: compose.sender_email.trim() || undefined,
      });
      setSendResult(r.data);
      showToast(`Sent: ${r.data.sent}, Failed: ${r.data.failed}`, r.data.failed > 0 ? 'info' : 'success');
    } catch {
      showToast('Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  };

  const previewBody = compose.body.trim() || 'Your message will appear here...';

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={filters.grade_section}
                onChange={e => setFilters(f => ({ ...f, grade_section: e.target.value }))}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40"
              >
                <option value="">All Sections</option>
                {(filterOptions?.grade_sections || []).map(gs => (
                  <option key={gs} value={gs}>{gs}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={filters.forenoon} onChange={e => setFilters(f => ({ ...f, forenoon: e.target.checked }))} className="rounded border-slate-300" />
                Forenoon
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={filters.afternoon} onChange={e => setFilters(f => ({ ...f, afternoon: e.target.checked }))} className="rounded border-slate-300" />
                Afternoon
              </label>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{students.length} students matched ({students.filter(s => s.email).length} with email)</span>
              <span>{selectedIds.size} selected</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-saffron-500" /></div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Mail className="h-8 w-8 mb-2" />
                <span className="text-sm">No students match filters</span>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded border-slate-300" />
                    Select All ({students.length})
                  </label>
                </div>
                {students.map(s => (
                  <label
                    key={s.student_id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 cursor-pointer hover:bg-saffron-50/50 transition-colors ${selectedIds.has(s.student_id) ? 'bg-saffron-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.student_id)}
                      onChange={() => toggleStudent(s.student_id)}
                      className="rounded border-slate-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.student_id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{s.grade_section}</span>
                        {s.forenoon_meal ? <span className="text-saffron-600">FN</span> : null}
                        {s.afternoon_meal ? <span className="text-saffron-600">AN</span> : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{s.email}</div>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Compose Broadcast</h3>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From Sender Address</label>
              <div className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span>vforvendetta0608@gmail.com</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">Configured System Sender</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
              <input
                type="text"
                placeholder="Subject of the email"
                value={compose.subject}
                onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-medium text-slate-500 mb-1">Body (plain text or HTML)</label>
              <textarea
                placeholder="Type your message here..."
                value={compose.body}
                onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                className="flex-1 min-h-[200px] text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500/40 resize-none"
              />
            </div>
            {sendResult && (
              <div className={`p-3 rounded-lg text-sm ${sendResult.failed > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {sendResult.failed > 0 ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <Check className="h-4 w-4 text-emerald-500" />}
                  <span>{sendResult.sent} sent, {sendResult.failed} failed</span>
                </div>
                {sendResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 space-y-1 max-h-24 overflow-y-auto">
                    {sendResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Sending to <strong>{selectedIds.size}</strong> student(s)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(true)}
                disabled={!compose.body.trim() || selectedIds.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={handleSend}
                disabled={sending || selectedIds.size === 0 || !compose.subject.trim() || !compose.body.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-saffron-600 hover:bg-saffron-700 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Preview Email</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="text-xs text-slate-500">
                <strong>From:</strong> {compose.sender_email || 'noreply@rkmvc.ac.in'}
              </div>
              <div className="text-xs text-slate-500">
                <strong>To:</strong> {selectedIds.size} recipient(s)
              </div>
              <div className="text-xs text-slate-500">
                <strong>Subject:</strong> {compose.subject || '(no subject)'}
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-white text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                {compose.body.trim() || 'Your message will appear here...'}
              </div>
              <div className="text-[11px] text-slate-400">
                Recipients: {selectedStudents.slice(0, 10).map(s => s.name).join(', ')}{selectedStudents.length > 10 ? ` +${selectedStudents.length - 10} more` : ''}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">Close</button>
              <button
                onClick={() => { setShowPreview(false); handleSend(); }}
                className="px-4 py-2 text-xs font-medium text-white bg-saffron-600 hover:bg-saffron-700 rounded-lg cursor-pointer"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
