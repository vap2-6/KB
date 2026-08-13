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
  AlertCircle,
  XCircle,
  Mail,
  Trash2,
  Sparkles,
  User,
  Search,
  Building2,
  IndianRupee,
  FileText,
  Eye,
  RefreshCw,
  Plus
} from 'lucide-react';
import api from '../lib/api';
import { jsPDF } from 'jspdf';

interface InvoiceModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type DurationPreset = '1m' | '2m' | '3m' | '6m' | '1y' | 'custom';

export default function InvoiceModule({ showToast }: InvoiceModuleProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2m');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [invoiceDate, setInvoiceDate] = useState<string>(todayStr);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(todayStr);
  
  const [ratePerMeal, setRatePerMeal] = useState<number>(50);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState<string>('Meal subscription billing invoice statement');

  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Statement Preview Modal State
  const [statementData, setStatementData] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Helper to compute date range based on duration preset
  const applyDurationPreset = (preset: DurationPreset) => {
    setDurationPreset(preset);
    const end = new Date();
    const start = new Date();

    if (preset === '1m') {
      start.setMonth(start.getMonth() - 1);
    } else if (preset === '2m') {
      start.setMonth(start.getMonth() - 2);
    } else if (preset === '3m') {
      start.setMonth(start.getMonth() - 3);
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
    applyDurationPreset('2m');
    fetchStudents();
    fetchInvoices();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      if (res.data && Array.isArray(res.data)) {
        setStudents(res.data);
      } else if (res.data && res.data.students) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error('Failed to load students list', err);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices');
      if (res.data && res.data.invoices) {
        setInvoices(res.data.invoices);
      }
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStatement = async () => {
    if (!fromDate || !toDate) {
      showToast('Please select valid From and To dates for the statement.', 'error');
      return;
    }

    if (new Date(toDate) < new Date(fromDate)) {
      showToast('Statement "To Date" cannot be before "From Date".', 'error');
      return;
    }

    setGenerating(true);
    try {
      // 1. Trigger Backend Invoice Generation
      const genRes = await api.post('/invoices/generate', {
        student_id: selectedStudent,
        from_date: fromDate,
        to_date: toDate,
        invoice_date: invoiceDate,
        rate_per_meal: ratePerMeal,
        tax_rate: taxRate,
        discount_amount: discountAmount,
        notes: customNotes
      });

      if (genRes.data && genRes.data.success) {
        showToast(genRes.data.message || 'Invoice statement generated successfully!', 'success');
        fetchInvoices();
      }

      // 2. Fetch Bank Statement Payload for Preview
      const stmtRes = await api.post('/invoices/statement', {
        student_id: selectedStudent,
        from_date: fromDate,
        to_date: toDate,
        invoice_date: invoiceDate
      });

      if (stmtRes.data && stmtRes.data.success) {
        setStatementData(stmtRes.data);
        setShowPreviewModal(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate invoice statement.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (invoiceId: string, status: string) => {
    try {
      await api.put(`/invoices/${invoiceId}/status`, { status });
      showToast(`Invoice ${invoiceId} updated to ${status.toUpperCase()}`, 'success');
      fetchInvoices();
      if (statementData) {
        // Refresh active statement preview if open
        const stmtRes = await api.post('/invoices/statement', {
          student_id: selectedStudent,
          from_date: fromDate,
          to_date: toDate,
          invoice_date: invoiceDate
        });
        if (stmtRes.data && stmtRes.data.success) {
          setStatementData(stmtRes.data);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update invoice status', 'error');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceId}?`)) return;
    try {
      await api.delete(`/invoices/${invoiceId}`);
      showToast(`Invoice ${invoiceId} deleted`, 'info');
      fetchInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete invoice', 'error');
    }
  };

  const handleSendEmail = async (invoiceId: string) => {
    try {
      const res = await api.post(`/invoices/${invoiceId}/send-email`);
      showToast(res.data?.message || 'Invoice sent via email', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send invoice email', 'error');
    }
  };

  // PDF Exporter using jsPDF (Bank Statement A4 Layout)
  const downloadPDFStatement = () => {
    if (!statementData) return;
    const doc = new jsPDF();
    const { company, customer, statement_period, summary, ledger } = statementData;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(217, 119, 6); // Saffron Amber
    doc.text(company.name.toUpperCase(), 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(company.address, 14, 24);
    doc.text(company.contact, 14, 29);

    doc.setLineWidth(0.5);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 33, 196, 33);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('INVOICE ACCOUNT STATEMENT', 14, 43);

    // Customer & Metadata Grid
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Customer Name: ${customer.name}`, 14, 52);
    doc.text(`Account / Student ID: ${customer.id}`, 14, 58);
    doc.text(`Department: ${customer.department}`, 14, 64);

    doc.text(`Statement Period: ${statement_period.from} to ${statement_period.to}`, 110, 52);
    doc.text(`Invoice Date: ${statement_period.invoice_date}`, 110, 58);
    doc.text(`Generated Date: ${statement_period.generated_at}`, 110, 64);

    // Table Header
    let y = 74;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('DATE', 16, y + 5.5);
    doc.text('INVOICE NO', 38, y + 5.5);
    doc.text('DESCRIPTION', 72, y + 5.5);
    doc.text('DEBIT (Rs)', 125, y + 5.5);
    doc.text('CREDIT (Rs)', 150, y + 5.5);
    doc.text('STATUS', 174, y + 5.5);

    y += 11;
    doc.setFont('helvetica', 'normal');

    if (!ledger || ledger.length === 0) {
      doc.text('No transaction invoices found for the selected statement period.', 16, y);
      y += 10;
    } else {
      ledger.forEach((item: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.date, 16, y);
        doc.text(item.invoice_id, 38, y);
        doc.text(item.description.substring(0, 30), 72, y);
        doc.text(item.debit.toFixed(2), 125, y);
        doc.text(item.credit.toFixed(2), 150, y);
        doc.text(item.status.toUpperCase(), 174, y);
        y += 7;
      });
    }

    y += 5;
    doc.line(14, y, 196, y);
    y += 8;

    // Financial Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('FINANCIAL STATEMENT SUMMARY', 14, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Billed Amount: Rs ${summary.total_amount.toFixed(2)}`, 14, y);
    doc.text(`Total Credit Paid: Rs ${summary.total_paid.toFixed(2)}`, 85, y);
    doc.text(`Outstanding Balance: Rs ${summary.total_outstanding.toFixed(2)}`, 145, y);

    doc.save(`Invoice_Statement_${customer.id}_${statement_period.from}_to_${statement_period.to}.pdf`);
    showToast('Statement PDF downloaded successfully', 'success');
  };

  // CSV Exporter
  const exportCSVStatement = () => {
    if (!statementData || !statementData.ledger) return;
    const headers = ['Date', 'Invoice No', 'Description', 'Debit (Billed)', 'Credit (Paid)', 'Tax', 'Discount', 'Status', 'Balance'];
    const rows = statementData.ledger.map((i: any) => [
      i.date,
      i.invoice_id,
      `"${i.description}"`,
      i.debit,
      i.credit,
      i.tax,
      i.discount,
      i.status,
      i.balance
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_Ledger_${statementData.customer.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV statement downloaded', 'success');
  };

  // Browser Print Trigger
  const printStatementView = () => {
    window.print();
  };

  // Filtered Invoices List
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.student_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregated Stat Cards Data
  const totalBilled = invoices.reduce((acc, i) => acc + (i.total_amount || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((acc, i) => acc + (i.total_amount || 0), 0);
  const totalOutstanding = invoices.filter((i) => i.status !== 'paid').reduce((acc, i) => acc + (i.total_amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/60 overflow-y-auto p-4 md:p-6 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-saffron-500 via-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-saffron-500/10">
        <div>
          <div className="flex items-center gap-2 text-saffron-100 text-xs font-bold uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" /> Financial Portal & Ledger
          </div>
          <h1 className="text-2xl font-black tracking-tight">Admin Invoice Statement Generator</h1>
          <p className="text-sm text-saffron-100/90 mt-1 max-w-2xl">
            Generate formal bank-statement-style dining bill receipts, customize date ranges, track ledger balances, and dispatch statements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              applyDurationPreset(durationPreset);
              handleGenerateStatement();
            }}
            disabled={generating}
            className="flex items-center gap-2 bg-white text-saffron-700 hover:bg-saffron-50 font-bold px-4 py-2.5 rounded-xl text-sm shadow-md transition cursor-pointer"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-saffron-600" />}
            <span>{generating ? 'Generating...' : 'Generate New Statement'}</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Billed</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">{invoices.length} Total Invoices</span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Paid (Credits)</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
              {invoices.filter(i => i.status === 'paid').length} Paid Invoices
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Outstanding</span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-[11px] text-rose-500 font-semibold mt-0.5 block">
              {invoices.filter(i => i.status !== 'paid').length} Pending / Overdue
            </span>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Rate / Meal</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">₹{ratePerMeal}.00</span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">Standard Subscription</span>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Statement Generator Controls & Filters Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-saffron-100 text-saffron-700 flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Statement Generator Controls</h2>
              <p className="text-xs text-slate-500">Configure customer, duration preset, and statement dates</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Customer / Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-3 font-medium focus:ring-2 focus:ring-saffron-500 focus:border-saffron-500 transition"
            >
              <option value="all">-- All Students (Combined Statement) --</option>
              {students.map((st) => (
                <option key={st.student_id} value={st.student_id}>
                  {st.name} ({st.student_id}) - {st.grade_section || 'General'}
                </option>
              ))}
            </select>
          </div>

          {/* Statement Duration Quick Presets */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Statement Duration Preset
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: '1m', label: '1 Month' },
                { id: '2m', label: '2 Months' },
                { id: '3m', label: '3 Months' },
                { id: '6m', label: '6 Months' },
                { id: '1y', label: '1 Year' },
                { id: 'custom', label: 'Custom Range' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyDurationPreset(p.id as DurationPreset)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    durationPreset === p.id
                      ? 'bg-saffron-500 text-white shadow-md shadow-saffron-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Pickers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-3 font-medium focus:ring-2 focus:ring-saffron-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Statement From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDurationPreset('custom');
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-3 font-medium focus:ring-2 focus:ring-saffron-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Statement To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDurationPreset('custom');
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-3 font-medium focus:ring-2 focus:ring-saffron-500"
            />
          </div>
        </div>

        {/* Pricing Adjustments */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rate per Meal (₹)</label>
            <input
              type="number"
              value={ratePerMeal}
              onChange={(e) => setRatePerMeal(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-2.5 font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tax Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-2.5 font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Amount (₹)</label>
            <input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-2.5 font-medium"
            />
          </div>
        </div>

        {/* Generate Trigger */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerateStatement}
            disabled={generating}
            className="flex items-center gap-2 bg-saffron-600 hover:bg-saffron-700 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-md shadow-saffron-600/20 transition cursor-pointer"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generating Statement...
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4" /> Generate Statement
              </>
            )}
          </button>
        </div>
      </div>

      {/* Existing Invoices Matrix & History Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Generated Invoices Ledger</h2>
            <p className="text-xs text-slate-500">Manage payment status, download individual receipts, or dispatch emails</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search invoice #, student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:ring-2 focus:ring-saffron-500 w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Student / Customer</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Total Meals</th>
                <th className="p-3.5">Billed Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-saffron-500" />
                    Loading invoice ledger records...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No invoice statements found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-saffron-700">{inv.invoice_id}</td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{inv.student_name}</span>
                      <span className="text-[10px] text-slate-400 block">{inv.student_id} | {inv.department || 'N/A'}</span>
                    </td>
                    <td className="p-3.5">{strDate(inv.invoice_date)}</td>
                    <td className="p-3.5">
                      <span className="font-bold">{inv.total_meals}</span>
                      <span className="text-[10px] text-slate-400 block">({inv.forenoon_count} FN / {inv.afternoon_count} AN)</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">₹{(inv.total_amount || 0).toFixed(2)}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : inv.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : inv.status === 'overdue'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {inv.status !== 'paid' ? (
                        <button
                          onClick={() => handleUpdateStatus(inv.invoice_id, 'paid')}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                          title="Mark as Paid"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(inv.invoice_id, 'pending')}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                          title="Mark as Pending"
                        >
                          Unpaid
                        </button>
                      )}
                      <button
                        onClick={() => handleSendEmail(inv.invoice_id)}
                        className="p-1.5 text-slate-400 hover:text-saffron-600 rounded-lg transition cursor-pointer"
                        title="Send Receipt Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(inv.invoice_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Statement Style Preview Modal */}
      {showPreviewModal && statementData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* Modal Control Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-saffron-400" />
                <span className="font-bold text-sm">Bank Statement Style Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadPDFStatement}
                  className="flex items-center gap-1.5 bg-saffron-500 hover:bg-saffron-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={exportCSVStatement}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={printStatementView}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Bank Statement View Body */}
            <div ref={printRef} className="p-8 overflow-y-auto space-y-6 text-slate-900 bg-white" id="printable-statement">
              
              {/* Institution Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-saffron-600 uppercase">
                    {statementData.company.name}
                  </h1>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{statementData.company.tagline}</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-lg">{statementData.company.address}</p>
                  <p className="text-[11px] text-slate-500">{statementData.company.contact}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white text-xs font-black px-3 py-1 rounded uppercase tracking-wider">
                    INVOICE STATEMENT
                  </span>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Generated: {statementData.statement_period.generated_at}
                  </p>
                </div>
              </div>

              {/* Account Metadata Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-4 text-xs font-medium">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer / Student Name</span>
                  <span className="text-sm font-bold text-slate-900">{statementData.customer.name}</span>
                  <span className="block text-slate-500 text-[11px] mt-0.5">Account ID: {statementData.customer.id}</span>
                  <span className="block text-slate-500 text-[11px]">Dept/Grade: {statementData.customer.department}</span>
                </div>
                <div className="text-right border-l border-slate-200 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Statement Period</span>
                  <span className="text-sm font-bold text-slate-900">
                    {statementData.statement_period.from} to {statementData.statement_period.to}
                  </span>
                  <span className="block text-slate-500 text-[11px] mt-0.5">Invoice Date: {statementData.statement_period.invoice_date}</span>
                </div>
              </div>

              {/* Bank Statement Ledger Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Transaction Account Ledger
                </h3>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 border-r border-slate-200">Date</th>
                      <th className="p-2.5 border-r border-slate-200">Invoice No</th>
                      <th className="p-2.5 border-r border-slate-200">Description</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">Debit (₹)</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">Credit (₹)</th>
                      <th className="p-2.5 border-r border-slate-200">Status</th>
                      <th className="p-2.5 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {statementData.ledger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                          No meal invoices recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      statementData.ledger.map((item: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-2.5 border-r border-slate-200 font-mono text-[11px]">{item.date}</td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-saffron-700">{item.invoice_id}</td>
                          <td className="p-2.5 border-r border-slate-200">{item.description}</td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-bold text-slate-900">
                            {item.debit > 0 ? `₹${item.debit.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-bold text-emerald-600">
                            {item.credit > 0 ? `₹${item.credit.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200">
                            <span className="uppercase text-[10px] font-bold tracking-wider text-slate-600">
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            ₹{item.balance.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary Card at Bottom */}
              <div className="bg-slate-900 text-white rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Billed</span>
                  <span className="text-lg font-black text-white">₹{statementData.summary.total_amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Paid (Credit)</span>
                  <span className="text-lg font-black text-emerald-400">₹{statementData.summary.total_paid.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Tax</span>
                  <span className="text-lg font-black text-amber-400">₹{statementData.summary.total_tax.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Outstanding Balance</span>
                  <span className="text-lg font-black text-rose-400">₹{statementData.summary.total_outstanding.toFixed(2)}</span>
                </div>
              </div>

              {/* Verification Footer Notice */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                <p>This is a computer-generated bank-style statement from RKMVC MealFlow Dining Portal.</p>
                <p className="font-bold">Page 1 of 1</p>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function strDate(val: any) {
  if (!val) return 'N/A';
  return strDateSub(val);
}

function strDateSub(val: any) {
  if (typeof val === 'string') return val.split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).substring(0, 10);
}
