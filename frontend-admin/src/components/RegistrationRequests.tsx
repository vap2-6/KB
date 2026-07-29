import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, XCircle, ChevronDown, ChevronUp, Loader2, Maximize2 } from 'lucide-react';
import api from '../lib/api';
import { ToastType } from './Toast';
import MediaLightbox, { LightboxMediaItem } from './MediaLightbox';

interface RegistrationRow {
  registration_id: string;
  app_no?: string;
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
  last_year_id?: string;
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

interface RegistrationRequestsProps {
  showToast: (message: string, type: ToastType) => void;
  onCountChange?: (count: number) => void;
}

const POLL_INTERVAL_MS = 15000;

export default function RegistrationRequests({ showToast, onCountChange }: RegistrationRequestsProps) {
  const [pending, setPending] = useState<RegistrationRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, RegistrationDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // Lightbox state
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

  const fetchPending = async () => {
    try {
      const res = await api.get('/registrations/pending');
      const rows: RegistrationRow[] = res.data.registrations || [];

      if (!firstLoadRef.current) {
        const newOnes = rows.filter(r => !seenIdsRef.current.has(r.registration_id));
        if (newOnes.length > 0) {
          showToast(`🔔 ${newOnes.length} new registration request(s) received!`, 'info');
        }
      }
      firstLoadRef.current = false;
      seenIdsRef.current = new Set(rows.map(r => r.registration_id));
      setPending(rows);
      onCountChange?.(rows.length);
    } catch {
      // Background poll failure silent catch
    }
  };

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, POLL_INTERVAL_MS);
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
        showToast(action === 'reject' ? 'Registration rejected & email sent' : 'Registration approved & credentials email sent!', 'success');
      } else {
        showToast(action === 'reject' ? 'Registration rejected' : 'Registration approved successfully!', 'success');
      }
      setDetails(prev => { const n = { ...prev }; delete n[registrationId]; return n; });
      await fetchPending();
    } catch (err: any) {
      showToast('Registration action failed', 'error');
    } finally {
      setActingOn(null);
    }
  };

  const count = pending.length;

  const detailRow = (label: string, value: string | undefined | null, fullWidth?: boolean) =>
    value ? (
      <div className={`flex flex-col bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60 ${fullWidth ? 'sm:col-span-2' : ''}`}>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-slate-800 mt-0.5">{value}</span>
      </div>
    ) : null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="relative p-2 text-slate-600 hover:text-saffron-600 hover:bg-saffron-50 rounded-xl transition-all border border-slate-200/80 cursor-pointer shadow-2xs"
        title="Pending Registration Requests"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-saffron-600 text-white font-extrabold text-[10px] min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center shadow-xs animate-bounce">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 md:px-6 md:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-saffron-100 flex items-center justify-center text-saffron-700 font-bold">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Pending Registrations ({count})</h3>
                  <p className="text-xs text-slate-500">Review student dining access submissions</p>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content List */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
              {count === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No pending registration requests.
                </div>
              ) : (
                pending.map(r => {
                  const isExpanded = expandedIds.has(r.registration_id);
                  const sessions = [r.forenoon_meal && 'Forenoon', r.afternoon_meal && 'Afternoon'].filter(Boolean).join(' & ') || 'None';
                  const d = details[r.registration_id] || (r as any);
                  const photoSrc = d.student_image_path || d.student_photo_url || d.student_photo_base64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.student_name)}&background=random`;

                  return (
                    <div key={r.registration_id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      
                      {/* Top Right Photo Card Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-base">{r.student_name}</h4>
                          <p className="text-xs text-saffron-700 font-semibold mt-0.5">
                            {r.course} {r.department ? `• ${r.department}` : ''} {r.degree_year ? `• Year ${r.degree_year}` : ''}
                          </p>

                          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span><span className="text-slate-400">Mobile:</span> <strong>{r.mobile_no || 'N/A'}</strong></span>
                            <span><span className="text-slate-400">Dept No:</span> <strong>{r.dept_number || 'N/A'}</strong></span>
                            <span><span className="text-slate-400">Sessions:</span> <strong>{sessions}</strong></span>
                          </div>
                        </div>

                        {/* Top Right Photo */}
                        <div className="shrink-0 flex flex-col items-center">
                          <button
                            onClick={() => openLightboxForRegistration(r, 0)}
                            className="w-16 h-20 rounded-xl border-2 border-amber-200 hover:border-saffron-500 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer relative group bg-amber-50"
                            title="Click to view student photo popup"
                          >
                            <img
                              src={photoSrc.startsWith('data:') || photoSrc.startsWith('http') ? photoSrc : `/${photoSrc.replace(/^\/+/, '')}`}
                              alt={r.student_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-saffron-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4 drop-shadow-md" />
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4">
                          
                          {/* Single-flow Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {detailRow('App No', d.app_no || 'N/A')}
                            {detailRow('Date of Birth', d.date_of_birth || d.dob_age || 'N/A')}
                            {detailRow('Age', d.age ? `${d.age} Years` : 'N/A')}
                            {detailRow('Course', d.course || 'N/A')}
                            {detailRow('Department', d.department || 'N/A')}
                            {detailRow('Degree Year', d.degree_year ? `Year ${d.degree_year}` : 'N/A')}
                            {detailRow('Dept Number', d.dept_number || 'N/A')}
                            {detailRow('Mobile Number', d.mobile_no || 'N/A')}
                            {detailRow('Parent/Guardian', d.father_name || 'N/A')}
                            {detailRow('Parent Occupation', d.father_occupation || 'N/A')}
                            {detailRow('Employment Sector', d.employment_type || 'N/A')}
                            {detailRow('Annual Income', d.annual_income ? `₹${Number(d.annual_income).toLocaleString('en-IN')}` : 'N/A')}
                            {detailRow('Distance', d.distance_km ? `${d.distance_km} Km` : 'N/A')}
                            {d.permanent_address && detailRow('Permanent Address', `${d.permanent_address} (${d.permanent_pin || ''})`, true)}
                            {d.local_address && detailRow('Local Address', `${d.local_address} (${d.local_pin || ''})`, true)}
                          </div>

                          {/* Signature & Income Document at Bottom of Block */}
                          <div className="bg-slate-100/80 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-4">
                              
                              {/* Signature */}
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Signature</span>
                                {d.signature_path || d.applicant_signature_url || d.applicant_signature_base64 ? (
                                  <button
                                    onClick={() => openLightboxForRegistration(r, 1)}
                                    className="h-12 px-3 bg-white border border-slate-300 hover:border-saffron-500 rounded-lg flex items-center justify-center cursor-pointer"
                                  >
                                    <img
                                      src={(d.signature_path || d.applicant_signature_url || d.applicant_signature_base64 || '').replace(/^\/+/, '/')}
                                      alt="Signature"
                                      className="max-h-10 object-contain"
                                    />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">No Signature</span>
                                )}
                              </div>

                              {/* Income Doc */}
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Income Certificate</span>
                                {d.income_proof_path || d.income_proof_url || d.income_proof_base64 ? (
                                  <button
                                    onClick={() => openLightboxForRegistration(r, 2)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    <span>📁 View Certificate</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">No Document</span>
                                )}
                              </div>

                            </div>

                            {/* Action Buttons (Reject, Forenoon Only, Afternoon Only, Approve Both) */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleAction(r.registration_id, 'reject')}
                                disabled={actingOn === r.registration_id}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 cursor-pointer"
                                title="Reject registration"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleAction(r.registration_id, 'forenoon')}
                                disabled={actingOn === r.registration_id}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                                title="Approve Forenoon meal only"
                              >
                                Forenoon
                              </button>
                              <button
                                onClick={() => handleAction(r.registration_id, 'afternoon')}
                                disabled={actingOn === r.registration_id}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-orange-300 text-orange-900 bg-orange-50 hover:bg-orange-100 cursor-pointer"
                                title="Approve Afternoon meal only"
                              >
                                Afternoon
                              </button>
                              <button
                                onClick={() => handleAction(r.registration_id, 'approve')}
                                disabled={actingOn === r.registration_id}
                                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-saffron-600 text-white hover:bg-saffron-700 cursor-pointer"
                                title="Approve Both Forenoon & Afternoon meals"
                              >
                                Approve Both
                              </button>
                            </div>

                          </div>

                        </div>
                      )}

                      {/* Expand / Collapse Footer */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => toggleExpand(r.registration_id)}
                          className="flex items-center gap-1 text-xs font-bold text-saffron-700 hover:text-saffron-900 transition-colors cursor-pointer"
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
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Popup */}
      {activeLightbox && (
        <MediaLightbox
          mediaList={activeLightbox.mediaList}
          initialIndex={activeLightbox.initialIndex}
          studentName={activeLightbox.studentName}
          onClose={() => setActiveLightbox(null)}
        />
      )}
    </>
  );
}
