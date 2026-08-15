import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  Calendar,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  IndianRupee,
  FileText,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Building2,
  Users,
  Award,
  UserCheck
} from 'lucide-react';
import api from '../lib/api';
import { jsPDF } from 'jspdf';

interface InvoiceModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type DurationPreset = '1m' | '2m' | '6m' | '1y' | 'custom';

export interface CategoryBreakdown {
  name: string;
  tokens: number;
  rate: number;
  total_amount: number;
}

export interface InvoiceStatement {
  id: string;
  invoice_no: string;
  title: string;
  from_date: string;
  to_date: string;
  category_filter: string;
  rate_per_meal: number;
  general_student_tokens: number;
  general_student_amount: number;
  ncc_student_tokens: number;
  ncc_student_amount: number;
  volunteer_tokens: number;
  volunteer_amount: number;
  guest_tokens: number;
  guest_amount: number;
  total_tokens: number;
  grand_total_amount: number;
  generated_by: string;
  created_at: string;
  is_automated_cron?: number;
  notes?: string;
  breakdown?: {
    general_students: CategoryBreakdown;
    ncc_students: CategoryBreakdown;
    volunteers: CategoryBreakdown;
    guests: CategoryBreakdown;
  };
}

// Convert numbers to Indian Rupees in words
function numberToWords(num: number): string {
  if (!num || num === 0) return 'Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  }

  const integerPart = Math.floor(num);
  const words = inWords(integerPart);
  return `Rupees ${words} Only`;
}

export default function InvoiceModule({ showToast }: InvoiceModuleProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('1m');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(todayStr);
  const [ratePerMeal] = useState<number>(50); // Strictly Fixed Rate ₹50

  // Category Multi-Select Filters
  const categoryOptions = ['General Students', 'NCC Students', 'Volunteers', 'Guests'];
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['General Students', 'NCC Students', 'Volunteers', 'Guests']);

  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [activeStatement, setActiveStatement] = useState<InvoiceStatement | null>(null);
  
  // Historical Ledger
  const [ledgerInvoices, setLedgerInvoices] = useState<InvoiceStatement[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  const printRef = useRef<HTMLDivElement>(null);

  // Apply Duration Preset (1 Month, 2 Months, 6 Months, 1 Year)
  const applyDurationPreset = (preset: DurationPreset) => {
    setDurationPreset(preset);
    const end = new Date();
    const start = new Date();

    if (preset === '1m') {
      start.setMonth(start.getMonth() - 1);
    } else if (preset === '2m') {
      start.setMonth(start.getMonth() - 2);
    } else if (preset === '6m') {
      start.setMonth(start.getMonth() - 6);
    } else if (preset === '1y') {
      start.setFullYear(start.getFullYear() - 1);
    } else if (preset === 'custom') {
      return;
    }

    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  useEffect(() => {
    applyDurationPreset('1m');
    fetchInvoicesLedger();
  }, []);

  const fetchInvoicesLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices');
      if (res.data && res.data.invoices) {
        setLedgerInvoices(res.data.invoices);
      }
    } catch (err) {
      console.error('Error fetching invoices ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle category selection
  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) {
        showToast('At least one category must be selected', 'info');
        return;
      }
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const selectAllCategories = () => {
    setSelectedCategories([...categoryOptions]);
  };

  // Generate Professional Invoice API Call
  const handleGenerateInvoice = async () => {
    if (!fromDate || !toDate) {
      showToast('Please select valid From and To dates', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/invoices/generate', {
        from_date: fromDate,
        to_date: toDate,
        categories: selectedCategories,
        rate_per_meal: ratePerMeal,
        save_to_ledger: true
      });

      if (res.data && res.data.invoice) {
        setActiveStatement(res.data.invoice);
        showToast('Professional Financial Statement generated successfully!', 'success');
        fetchInvoicesLedger();
      } else {
        showToast('Failed to generate statement', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || err.message || 'Error generating invoice', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Run 5:00 PM Automated CRON Job manually
  const handleTrigger5pmDailyJob = async () => {
    try {
      const res = await api.post('/invoices/run-daily-job');
      if (res.data && res.data.message) {
        showToast(res.data.message, 'success');
        fetchInvoicesLedger();
      }
    } catch (err: any) {
      showToast('Failed to execute daily CRON job', 'error');
    }
  };

  // Delete Invoice from History Ledger
  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await api.delete(`/invoices/${invoiceId}`);
      showToast('Invoice deleted from ledger', 'info');
      if (activeStatement && activeStatement.id === invoiceId) {
        setActiveStatement(null);
      }
      fetchInvoicesLedger();
    } catch (err) {
      showToast('Failed to delete invoice', 'error');
    }
  };

  // Export Professional PDF Invoice using jsPDF
  const handleExportPDF = () => {
    if (!activeStatement) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const inv = activeStatement;

    // Header Background
    doc.setFillColor(255, 248, 240); // saffron tint
    doc.rect(0, 0, 210, 38, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(194, 65, 12); // saffron-700
    doc.text('RKMVC MEAL DINING PORTAL', 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('INTERNAL FINANCIAL STATEMENT & TOKEN UTILIZATION REPORT', 14, 23);

    // Invoice Meta (Right Aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`INVOICE #: ${inv.invoice_no}`, 196, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(inv.created_at || Date.now()).toLocaleDateString('en-IN')}`, 196, 23, { align: 'right' });
    doc.text(`Period: ${inv.from_date} to ${inv.to_date}`, 196, 29, { align: 'right' });

    // Divider Line
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.line(14, 38, 196, 38);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 182, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL TOKENS UTILIZED', 20, 52);
    doc.text('FIXED UNIT RATE', 80, 52);
    doc.text('TOTAL FINANCIAL VALUE', 140, 52);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(inv.total_tokens.toLocaleString(), 20, 60);
    doc.text(`Rs. ${inv.rate_per_meal} / meal`, 80, 60);
    doc.setTextColor(194, 65, 12);
    doc.text(`Rs. ${Number(inv.grand_total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 140, 60);

    // Table Header
    let y = 76;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 9, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('CATEGORY NAME', 18, y + 6);
    doc.text('UNIT RATE', 85, y + 6);
    doc.text('TOKENS UTILIZED', 125, y + 6);
    doc.text('TOTAL AMOUNT (RS.)', 190, y + 6, { align: 'right' });

    y += 9;

    // Table Rows
    const rows = [
      { name: 'General Students', tokens: inv.general_student_tokens, amount: inv.general_student_amount },
      { name: 'NCC Students', tokens: inv.ncc_student_tokens, amount: inv.ncc_student_amount },
      { name: 'Volunteers', tokens: inv.volunteer_tokens, amount: inv.volunteer_amount },
      { name: 'Guests', tokens: inv.guest_tokens, amount: inv.guest_amount },
    ];

    rows.forEach((r, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, y, 182, 9, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(r.name, 18, y + 6);
      doc.text(`Rs. ${inv.rate_per_meal}.00`, 85, y + 6);
      doc.text((r.tokens || 0).toLocaleString(), 125, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rs. ${Number(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, y + 6, { align: 'right' });
      y += 9;
    });

    // Grand Total Row
    doc.setFillColor(254, 243, 199); // amber/saffron tint
    doc.rect(14, y, 182, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9);
    doc.text('GRAND TOTAL', 18, y + 7);
    doc.text(`${(inv.total_tokens || 0).toLocaleString()} Tokens`, 125, y + 7);
    doc.text(`Rs. ${Number(inv.grand_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, y + 7, { align: 'right' });

    y += 18;

    // Amount in words box
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL AMOUNT IN WORDS:', 14, y);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(15, 23, 42);
    doc.text(numberToWords(Number(inv.grand_total_amount || 0)), 60, y);

    y += 25;

    // Footer Signatures
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.line(14, y, 70, y);
    doc.line(130, y, 196, y);
    doc.text('Authorized Finance Signatory', 14, y + 5);
    doc.text('RKMVC System Admin Stamp', 196, y + 5, { align: 'right' });

    doc.save(`RKMVC_Invoice_${inv.invoice_no}.pdf`);
    showToast('PDF Financial Statement exported successfully!', 'success');
  };

  // Filter historical ledger
  const filteredLedger = ledgerInvoices.filter(inv => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || inv.invoice_no.toLowerCase().includes(q) || (inv.category_filter || '').toLowerCase().includes(q) || (inv.generated_by || '').toLowerCase().includes(q);
    const matchFilter = historyFilter === 'all' || (historyFilter === 'cron' ? inv.is_automated_cron : !inv.is_automated_cron);
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 md:p-6 space-y-6">
      
      {/* ── Control Panel Header ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-saffron-100/70 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-saffron-100 text-saffron-700 rounded-xl">
                <Receipt className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Internal Financial Statement & Invoice Generator</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Calculate internal financial metrics for free meal tokens at the fixed rate of <span className="font-bold text-slate-800">₹50 / meal</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTrigger5pmDailyJob}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              title="Runs automated daily 5:00 PM statement compile"
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Test 5:00 PM CRON</span>
            </button>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Rate: ₹50 / Meal (Fixed)
            </span>
          </div>
        </div>

        {/* Statement Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          {/* Presets */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Statement Duration Presets</label>
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: '1m', label: '1 Month' },
                { id: '2m', label: '2 Months' },
                { id: '6m', label: '6 Months' },
                { id: '1y', label: '1 Year' },
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyDurationPreset(preset.id as DurationPreset)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    durationPreset === preset.id
                      ? 'bg-white text-saffron-700 shadow-sm border border-saffron-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Custom Date Range (From - To)</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setDurationPreset('custom'); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-saffron-500"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setDurationPreset('custom'); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-saffron-500"
              />
            </div>
          </div>

          {/* Category Filter Multi-Select */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">Filter Categories</label>
              <button onClick={selectAllCategories} className="text-[10px] text-saffron-600 hover:text-saffron-700 font-bold cursor-pointer">
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryOptions.map(cat => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-saffron-50 text-saffron-700 border-saffron-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-saffron-500' : 'bg-slate-300'}`} />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Generate Button Row */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={handleGenerateInvoice}
            disabled={generating}
            className="px-6 py-3 bg-saffron-600 hover:bg-saffron-700 text-white rounded-xl text-sm font-extrabold shadow-md shadow-saffron-500/20 transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Compiling Financial Metrics...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Professional Invoice</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* ── Generated Professional Invoice View ─────────────────────────── */}
      {activeStatement && (
        <div ref={printRef} className="bg-white rounded-2xl border-2 border-saffron-200/80 shadow-md overflow-hidden transition-all animate-fadeIn">
          
          {/* Statement Header */}
          <div className="bg-gradient-to-r from-saffron-500 via-saffron-600 to-amber-600 text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-saffron-200" />
                <span className="text-xs font-bold text-saffron-100 uppercase tracking-widest">Ramakrishna Mission Vidyalaya College</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight mt-1">RKMVC Meal Dining Portal</h2>
              <p className="text-xs text-saffron-100/90 font-medium mt-0.5">Internal Financial Statement & Token Utilization Statement</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-right min-w-[220px]">
              <span className="text-[10px] text-saffron-100 font-extrabold uppercase tracking-wider block">Statement Ref No.</span>
              <span className="text-lg font-black font-mono tracking-tight text-white block mt-0.5">{activeStatement.invoice_no}</span>
              <div className="text-[11px] text-saffron-100 font-semibold mt-2">
                <span>Period: </span>
                <span className="font-bold text-white">{activeStatement.from_date}</span>
                <span> to </span>
                <span className="font-bold text-white">{activeStatement.to_date}</span>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards Grid */}
          <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-200/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Meal Tokens</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900">{Number(activeStatement.total_tokens || 0).toLocaleString()}</span>
                  <div className="p-2 bg-saffron-100 text-saffron-700 rounded-lg">
                    <Receipt className="h-5 w-5" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold block mt-1">Collected across selected categories</span>
              </div>

              <div className="bg-white rounded-xl p-4 border border-saffron-200 shadow-2xs">
                <span className="text-[11px] font-bold text-saffron-700 uppercase tracking-wider block">Fixed Meal Unit Rate</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-2xl font-black text-saffron-800">₹{activeStatement.rate_per_meal}</span>
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                </div>
                <span className="text-[10px] text-saffron-600 font-semibold block mt-1">Standard cost per single meal token</span>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Included Categories</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900">{selectedCategories.length} / 4</span>
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Filter className="h-5 w-5" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold block mt-1 font-mono truncate">{activeStatement.category_filter}</span>
              </div>

              <div className="bg-white rounded-xl p-4 border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Total Financial Value</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-2xl font-black text-emerald-800">₹{Number(activeStatement.grand_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-1">Tokens Collected × ₹50</span>
              </div>

            </div>
          </div>

          {/* Itemized Table Breakdown */}
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Categorized Utilization Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">Itemized calculations at ₹50 per meal token for each user category.</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-4 border-b border-slate-200">User Category</th>
                    <th className="py-3.5 px-4 border-b border-slate-200 text-center">Rate / Meal (₹)</th>
                    <th className="py-3.5 px-4 border-b border-slate-200 text-center">Tokens Utilized</th>
                    <th className="py-3.5 px-4 border-b border-slate-200 text-right">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                  
                  {/* General Students */}
                  {selectedCategories.includes('General Students') && (
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>General Students</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">₹{activeStatement.rate_per_meal}.00</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{Number(activeStatement.general_student_tokens || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">₹{Number(activeStatement.general_student_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}

                  {/* NCC Students */}
                  {selectedCategories.includes('NCC Students') && (
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900">
                        <Award className="h-4 w-4 text-emerald-600" />
                        <span>NCC Students</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">₹{activeStatement.rate_per_meal}.00</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{Number(activeStatement.ncc_student_tokens || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">₹{Number(activeStatement.ncc_student_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}

                  {/* Volunteers */}
                  {selectedCategories.includes('Volunteers') && (
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900">
                        <UserCheck className="h-4 w-4 text-amber-600" />
                        <span>Volunteers</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">₹{activeStatement.rate_per_meal}.00</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{Number(activeStatement.volunteer_tokens || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">₹{Number(activeStatement.volunteer_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}

                  {/* Guests */}
                  {selectedCategories.includes('Guests') && (
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900">
                        <Building2 className="h-4 w-4 text-purple-600" />
                        <span>Guests</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">₹{activeStatement.rate_per_meal}.00</td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{Number(activeStatement.guest_tokens || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">₹{Number(activeStatement.guest_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}

                </tbody>
                <tfoot>
                  <tr className="bg-saffron-50/80 text-saffron-900 border-t-2 border-saffron-300 font-extrabold">
                    <td className="py-4 px-4 text-sm font-black uppercase">Grand Total Financial Value</td>
                    <td className="py-4 px-4 text-center text-xs">₹{activeStatement.rate_per_meal} / Meal</td>
                    <td className="py-4 px-4 text-center text-sm font-black text-slate-900">{Number(activeStatement.total_tokens || 0).toLocaleString()} Tokens</td>
                    <td className="py-4 px-4 text-right text-base font-black text-saffron-800">
                      ₹{Number(activeStatement.grand_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Total Amount in Words Banner */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Grand Total in Words</span>
                <span className="text-sm font-black text-slate-900 italic block mt-0.5">
                  {numberToWords(Number(activeStatement.grand_total_amount || 0))}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-amber-700 font-semibold block">Generated By: <strong className="text-amber-900">{activeStatement.generated_by}</strong></span>
              </div>
            </div>

            {/* Export & Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 font-medium">
                * Note: This statement is an internal financial metric calculation for free meal distribution management.
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Export to PDF / Print</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── Generated Invoices Ledger (Bottom Section) ────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Generated Invoices Ledger & History</h3>
            <p className="text-xs text-slate-500 mt-0.5">Historical ledger of generated internal financial statements and automated 5:00 PM CRON reports.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Invoice # or Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-saffron-500 w-56"
              />
            </div>
            
            <button
              onClick={fetchInvoicesLedger}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-slate-200">Invoice #</th>
                <th className="py-3 px-4 border-b border-slate-200">Period</th>
                <th className="py-3 px-4 border-b border-slate-200">Categories</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Total Tokens</th>
                <th className="py-3 px-4 border-b border-slate-200 text-right">Grand Total (₹)</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Type</th>
                <th className="py-3 px-4 border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <span>No generated financial statements found in ledger.</span>
                  </td>
                </tr>
              ) : (
                filteredLedger.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-saffron-700">{inv.invoice_no}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{inv.from_date} → {inv.to_date}</td>
                    <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-600 font-medium">{inv.category_filter}</td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{Number(inv.total_tokens || 0).toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700">₹{Number(inv.grand_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-center">
                      {inv.is_automated_cron ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md">
                          5:00 PM CRON
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-md">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setActiveStatement(inv); showToast(`Loaded invoice ${inv.invoice_no}`, 'info'); }}
                          className="p-1.5 text-saffron-700 hover:bg-saffron-50 rounded-lg transition cursor-pointer"
                          title="View Statement"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
