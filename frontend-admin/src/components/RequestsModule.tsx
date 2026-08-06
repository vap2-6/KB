import { useState, useEffect } from 'react';
import { Bell, Check, XCircle, Search, Clock, ShieldCheck, Ban, RefreshCw, ChevronDown, ChevronUp, Loader2, FileText, Maximize2, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import MediaLightbox, { LightboxMediaItem } from './MediaLightbox';

interface RegistrationRow {
  registration_id: string;
  student_name: string;
  dob_age?: string;
  date_of_birth?: string;
  age?: number | string;
  course?: string;
  department?: string;
  degree_year?: string;
  dept_number?: string;
  mobile_no?: string;
  landline?: string;
  email?: string;
  father_name?: string;
  father_occupation?: string;
  employment_type?: string;
  forenoon_meal: boolean;
  afternoon_meal: boolean;
  annual_income?: string;
  distance_km?: string;
  permanent_address?: string;
  permanent_pin?: string;
  local_address?: string;
  local_pin?: string;
  status: string;
  submitted_at: string;
  student_image_path?: string;
  student_photo_url?: string;
  signature_path?: string;
  applicant_signature_url?: string;
  income_proof_path?: string;
  income_proof_url?: string;
}

interface RegistrationDetail extends RegistrationRow {
  student_photo_base64?: string;
  applicant_signature_base64?: string;
  income_proof_filename?: string;
  income_proof_base64?: string;
}

interface RequestsModuleProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onPendingCountChange?: (count: number) => void;
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export default function RequestsModule({ showToast, onPendingCountChange }: RequestsModuleProps) {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, RegistrationDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Lightbox popup state
  const [activeLightbox, setActiveLightbox] = useState<{
    mediaList: LightboxMediaItem[];
    initialIndex: number;
    studentName: string;
  } | null>(null);

  const toggleExpand = async (id: string) => {
    if (expandedIds.has(id)) {
      setExpandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }
    setExpandedIds(prev => { const n = new Set(prev); n.add(id); return n; });
    if (!details[id]) {
      setLoadingDetails(prev => { const n = new Set(prev); n.add(id); return n; });
      try {
        const res = await api.get(`/registrations/${id}`);
        setDetails(prev => ({ ...prev, [id]: res.data.registration }));
      } catch {
        showToast('Failed to load registration details.', 'error');
      } finally {
        setLoadingDetails(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  };

  const openLightboxForRegistration = (r: RegistrationRow, initialIndex: number) => {
    const d = details[r.registration_id] || (r as any);
    const photoSrc = d.student_image_path || d.student_photo_url || d.student_photo_base64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.student_name)}&background=random`;
    const sigSrc = d.signature_path || d.applicant_signature_url || d.applicant_signature_base64;
    const incomeSrc = d.income_proof_path || d.income_proof_url || d.income_proof_base64;

    const mediaList: LightboxMediaItem[] = [
      {
        id: 'photo',
        title: 'Student Passport Photo',
        type: 'image',
        src: photoSrc,
      },
      {
        id: 'signature',
        title: 'Student Signature',
        type: 'image',
        src: sigSrc || '',
        fallbackText: 'No Signature Provided',
      },
      {
        id: 'income',
        title: 'Income Proof Certificate',
        type: (incomeSrc && (incomeSrc.endsWith('.pdf') || incomeSrc.includes('application/pdf'))) ? 'pdf' : 'image',
        src: incomeSrc || '',
        fallbackText: 'No Income Document Provided',
      },
    ];

    setActiveLightbox({
      mediaList,
      initialIndex,
      studentName: r.student_name,
    });
  };

  const detailRow = (label: string, value: string | undefined | null, fullWidth?: boolean) =>
    value ? (
      <div className={`flex flex-col bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60 ${fullWidth ? 'sm:col-span-2' : ''}`}>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-slate-800 mt-0.5">{value}</span>
      </div>
    ) : null;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/registrations');
      const rows: RegistrationRow[] = res.data.registrations || [];
      setRegistrations(rows);
      const pendingCount = rows.filter(r => r.status === 'pending').length;
      onPendingCountChange?.(pendingCount);
    } catch (err) {
      showToast('Failed to load registration requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (registrationId: string, action: 'approve' | 'reject' | 'forenoon' | 'afternoon') => {
    setActingOn(registrationId);
    try {
      const payload = action === 'reject' 
        ? { action: 'reject' } 
        : { action, meal_type: action === 'approve' ? 'both' : action };

      const res = await api.post(`/registrations/${registrationId}/action`, payload);
      if (res.data?.email_sent) {
        showToast('Email sent', 'success');
      } else {
        showToast('Email failed to send', 'error');
      }
      setDetails(prev => { const n = { ...prev }; delete n[registrationId]; return n; });
      await fetchAll();
    } catch (err: any) {
      showToast('Email failed to send', 'error');
    } finally {
      setActingOn(null);
    }
  };

  const filtered = registrations.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${r.student_name} ${r.mobile_no || ''} ${r.dept_number || ''} ${r.course || ''} ${r.department || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
    all: registrations.length,
  };

  const tabs: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'approved', label: `Approved (${counts.approved})` },
    { id: 'rejected', label: `Rejected (${counts.rejected})` },
    { id: 'all', label: `All (${counts.all})` },
  ];

  const statusBadge = (status: string) => {
    if (status === 'approved') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          <ShieldCheck className="h-3 w-3" /> Approved
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
          <Ban className="h-3 w-3" /> Rejected
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  };

  const renderExpandContent = (r: RegistrationRow) => {
    const id = r.registration_id;
    if (loadingDetails.has(id)) {
      return (
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-center p-6 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin mr-2 text-saffron-600" /> Loading full details & attachments...
        </div>
      );
    }
    const d = details[id] || (r as any);
    const photoSrc = d.student_image_path || d.student_photo_url || d.student_photo_base64;
    const sigSrc = d.signature_path || d.applicant_signature_url || d.applicant_signature_base64;
    const incomeSrc = d.income_proof_path || d.income_proof_url || d.income_proof_base64;

    return (
      <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-5 animate-fade-in">
        
        {/* Single Flow Details Grid (No Repetition!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {detailRow('Date of Birth', d.date_of_birth || d.dob_age || 'N/A')}
          {detailRow('Age', d.age ? `${d.age} Years` : 'N/A')}
          {detailRow('Course', d.course || 'N/A')}
          {detailRow('Department', d.department || 'N/A')}
          {detailRow('Degree Year', d.degree_year ? `Year ${d.degree_year}` : 'N/A')}
          {detailRow('Dept Number (13 Digits)', d.dept_number || 'N/A')}
          {detailRow('Mobile Number', d.mobile_no || 'N/A')}
          {detailRow('Landline Contact', d.landline || 'N/A')}
          {detailRow('Student Email', d.email || 'N/A')}
          {detailRow('Parent/Guardian Name', d.father_name || 'N/A')}
          {detailRow('Parent Occupation', d.father_occupation || 'N/A')}
          {detailRow('Employment Sector', d.employment_type || 'N/A')}
          {detailRow('Annual Income', d.annual_income ? `₹${Number(d.annual_income).toLocaleString('en-IN')}` : 'N/A')}
          {detailRow('Distance to College', d.distance_km ? `${d.distance_km} Km` : 'N/A')}
          {detailRow('Meal Sessions', [r.forenoon_meal && 'Forenoon', r.afternoon_meal && 'Afternoon'].filter(Boolean).join(' & ') || 'None')}
          {detailRow('Submitted Timestamp', new Date(d.submitted_at).toLocaleString())}
          {d.permanent_address && detailRow('Permanent Address', `${d.permanent_address} (PIN: ${d.permanent_pin || 'N/A'})`, true)}
          {d.local_address && detailRow('Local Address', `${d.local_address} (PIN: ${d.local_pin || 'N/A'})`, true)}
        </div>

        {/* Verification Assets Block (Signature & Income Certificate at Bottom of Block!) */}
        <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            
            {/* Student Signature Asset */}
            <div className="flex flex-col">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Student Signature</span>
              </p>
              {sigSrc ? (
                <button
                  onClick={() => openLightboxForRegistration(r, 1)}
                  className="h-16 px-4 bg-white border border-slate-300 hover:border-saffron-500 rounded-xl flex items-center justify-center shadow-2xs hover:shadow-sm transition-all group cursor-pointer relative"
                  title="Click to view signature popup"
                >
                  <img
                    src={sigSrc.startsWith('data:') || sigSrc.startsWith('http') ? sigSrc : `/${sigSrc.replace(/^\/+/, '')}`}
                    alt="Student Signature"
                    className="max-h-12 object-contain group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-saffron-600/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-saffron-700" />
                  </div>
                </button>
              ) : (
                <div className="h-16 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-[10px] font-semibold text-slate-400">
                  No Signature Provided
                </div>
              )}
            </div>

            {/* Income Certificate Asset (Area 4 Item 2 & GAP 4) */}
            <div className="flex flex-col">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span>Income Certificate</span>
              </p>
              {incomeSrc ? (
                <div className="flex items-center gap-2">
                  <a
                    href={incomeSrc.startsWith('data:') || incomeSrc.startsWith('http') ? incomeSrc : `/${incomeSrc.replace(/^\/+/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                    title="Open Income Proof Document in new tab"
                  >
                    <span className="text-sm">📁</span>
                    <span>View Income Proof Document</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-700 ml-1 group-hover:scale-110 transition-transform" />
                  </a>
                </div>
              ) : (
                <div className="px-4 py-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-[10px] font-semibold text-slate-400">
                  No Document Attached
                </div>
              )}
            </div>

          </div>

          {/* Action Footer Buttons (Reject, Forenoon Only, Afternoon Only, Approve Both) */}
          {r.status === 'pending' && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
              <button
                onClick={() => handleAction(r.registration_id, 'reject')}
                disabled={actingOn === r.registration_id}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Reject registration"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject Request
              </button>
              <button
                onClick={() => handleAction(r.registration_id, 'forenoon')}
                disabled={actingOn === r.registration_id}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Approve Forenoon meal only"
              >
                <Check className="h-3.5 w-3.5 text-amber-700" /> Forenoon
              </button>
              <button
                onClick={() => handleAction(r.registration_id, 'afternoon')}
                disabled={actingOn === r.registration_id}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-orange-300 text-orange-900 bg-orange-50 hover:bg-orange-100 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Approve Afternoon meal only"
              >
                <Check className="h-3.5 w-3.5 text-orange-700" /> Afternoon
              </button>
              <button
                onClick={() => handleAction(r.registration_id, 'approve')}
                disabled={actingOn === r.registration_id}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-xl bg-saffron-600 text-white hover:bg-saffron-700 transition-all shadow-xs hover:shadow-sm disabled:opacity-50 cursor-pointer"
                title="Approve Both Forenoon & Afternoon meals"
              >
                <Check className="h-3.5 w-3.5" /> Approve Both
              </button>
            </div>
          )}
        </div>

      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-saffron-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-saffron-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">Registration Requests</h2>
            <p className="text-xs text-slate-500">Submissions from the student registration form</p>
          </div>
        </div>

        {/* Filter tabs + search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${statusFilter === tab.id
                  ? 'bg-saffron-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, mobile, dept no..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-saffron-500"
            />
          </div>
        </div>

        {/* List */}
        {loading && registrations.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400">Loading requests...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400 bg-white rounded-xl border border-slate-200">
            No {statusFilter !== 'all' ? statusFilter : ''} requests found.
          </div>
        )}

        <div className="space-y-4">
          {filtered.map(r => {
            const isExpanded = expandedIds.has(r.registration_id);
            const sessions = [r.forenoon_meal && 'Forenoon', r.afternoon_meal && 'Afternoon'].filter(Boolean).join(' & ') || 'None';
            const d = details[r.registration_id] || (r as any);
            const photoSrc = d.student_image_path || d.student_photo_url || d.student_photo_base64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.student_name)}&background=random`;

            return (
              <div key={r.registration_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
                
                {/* Card Header (Photo Placed Top Right!) */}
                <div className="flex items-start justify-between gap-4">
                  
                  {/* Left Info Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base">{r.student_name}</h3>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-saffron-700 font-semibold mt-1">
                      {r.course} {r.department ? `• ${r.department}` : ''} {r.degree_year ? `• Year ${r.degree_year}` : ''}
                    </p>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <span><span className="text-slate-400">Mobile:</span> <strong className="text-slate-800">{r.mobile_no || 'N/A'}</strong></span>
                      <span><span className="text-slate-400">Dept No:</span> <strong className="text-slate-800">{r.dept_number || 'N/A'}</strong></span>
                      <span><span className="text-slate-400">Sessions:</span> <strong className="text-slate-800">{sessions}</strong></span>
                      <span><span className="text-slate-400">Distance:</span> <strong className="text-slate-800">{r.distance_km ? `${r.distance_km} Km` : 'N/A'}</strong></span>
                      <span><span className="text-slate-400">Annual Income:</span> <strong className="text-slate-800">{r.annual_income ? `₹${Number(r.annual_income).toLocaleString('en-IN')}` : 'N/A'}</strong></span>
                      <span><span className="text-slate-400">Parent/Guardian:</span> <strong className="text-slate-800">{r.father_name || 'N/A'}</strong></span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-2">
                      Submitted {new Date(r.submitted_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Top Right: Student Passport Photo Thumbnail (Clickable Lightbox!) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <button
                      onClick={() => openLightboxForRegistration(r, 0)}
                      className="w-18 h-22 sm:w-20 sm:h-24 rounded-xl border-2 border-amber-200/90 hover:border-saffron-500 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer relative group bg-amber-50"
                      title="Click to view student photo popup"
                    >
                      <img
                        src={photoSrc.startsWith('data:') || photoSrc.startsWith('http') ? photoSrc : `/${photoSrc.replace(/^\/+/, '')}`}
                        alt={r.student_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-saffron-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5 drop-shadow-md" />
                        <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Expand</span>
                      </div>
                    </button>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Photo</span>
                  </div>

                </div>

                {/* Expanded Full Details Section */}
                {isExpanded && renderExpandContent(r)}

                {/* Collapse / Expand Toggle Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(r.registration_id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-saffron-700 hover:text-saffron-900 transition-colors cursor-pointer"
                  >
                    {loadingDetails.has(r.registration_id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-saffron-600" />
                    ) : isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    <span>{isExpanded ? 'Collapse Details' : 'View Full Details'}</span>
                  </button>

                  <span className="text-[10px] text-slate-400 font-medium">
                    ID: {r.registration_id}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Lightbox Popup (3 Media Assets Carousel) */}
      {activeLightbox && (
        <MediaLightbox
          mediaList={activeLightbox.mediaList}
          initialIndex={activeLightbox.initialIndex}
          studentName={activeLightbox.studentName}
          onClose={() => setActiveLightbox(null)}
        />
      )}
    </div>
  );
}
