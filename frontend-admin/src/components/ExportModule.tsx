import { useState, useEffect } from 'react';
import {
  FileDown,
  Table,
  Columns,
  Settings,
  FileText,
  FileSpreadsheet,
  Braces,
  Download,
  Check
} from 'lucide-react';
import api from '../lib/api';
import { TableMeta } from '../types';
import { jsPDF } from 'jspdf';

interface ExportModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ExportModule({ showToast }: ExportModuleProps) {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json' | 'pdf'>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data);
      if (res.data.length > 0) {
        setSelectedTable(res.data[0].name);
        setSelectedColumns(res.data[0].columns.map((c: any) => c.name));
      }
    } catch (err) {
      showToast('Failed to load table database schemas', 'error');
    }
  };

  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    const table = tables.find(t => t.name === tableName);
    if (table) {
      setSelectedColumns(table.columns.map(c => c.name));
    }
  };

  const handleColumnToggle = (columnName: string) => {
    if (selectedColumns.includes(columnName)) {
      if (selectedColumns.length === 1) {
        showToast('At least one column must be selected for export', 'info');
        return;
      }
      setSelectedColumns(selectedColumns.filter(c => c !== columnName));
    } else {
      setSelectedColumns([...selectedColumns, columnName]);
    }
  };

  const selectAllColumns = () => {
    const table = tables.find(t => t.name === selectedTable);
    if (table) {
      setSelectedColumns(table.columns.map(c => c.name));
    }
  };

  const selectNoneColumns = () => {
    setSelectedColumns([]);
  };

  // Dedicated custom high-fidelity pdf table exporter
  const generatePDFExport = async (rows: any[]) => {
    const doc = new jsPDF();

    // Title Branding Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 153, 51); // Saffron orange!
    doc.text('RKMVC MEALFLOW PORTAL', 14, 20);

    // Sub-header details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const tableLabel = selectedTable === 'student_meals' ? 'STUDENT MEAL PLAN ROSTER' : selectedTable.toUpperCase();
    doc.text(`${tableLabel} - SYSTEM EXPORT REPORT`, 14, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Report Created: ${new Date().toLocaleString()}`, 14, 34);
    doc.text(`Total Records Selected: ${rows.length}`, 14, 39);

    // Separator Saffron line
    doc.setDrawColor(255, 153, 51);
    doc.setLineWidth(0.6);
    doc.line(14, 43, 196, 43);

    // Columns schema headers
    const colsToRender = selectedColumns;
    const colWidth = 182 / (colsToRender.length || 1);
    let startY = 52;
    let startX = 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    // Draw grid headers
    colsToRender.forEach((col, idx) => {
      // capitalize and replace underscores
      const label = col.replace(/_/g, ' ').toUpperCase();
      doc.text(label, startX + (idx * colWidth), startY);
    });

    // Header Underline
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, startY + 3, 196, startY + 3);

    // Rows printing
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    let currentY = startY + 10;

    rows.forEach((row, rowIdx) => {
      // Manage page overflow
      if (currentY > 275) {
        doc.addPage();

        // draw headers again on new page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.setDrawColor(255, 153, 51);
        doc.setLineWidth(0.4);

        doc.text('RKMVC MEALFLOW PORTAL - CONTINUED', 14, 15);
        doc.line(14, 18, 196, 18);

        colsToRender.forEach((col, idx) => {
          const label = col.replace(/_/g, ' ').toUpperCase();
          doc.text(label, startX + (idx * colWidth), 25);
        });
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 28, 196, 28);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        currentY = 35;
      }

      // Draw values for each column
      colsToRender.forEach((col, colIdx) => {
        let val = row[col];
        if (val === true || val === 'true') val = 'Served';
        if (val === false || val === 'false') val = 'Pending';
        if (val === null || val === undefined) val = '-';

        const textVal = String(val);
        // Truncate to avoid cell overlap
        const truncated = textVal.length > 24 ? textVal.substring(0, 21) + '...' : textVal;
        doc.text(truncated, startX + (colIdx * colWidth), currentY);
      });

      // Row separator
      doc.setDrawColor(241, 245, 249);
      doc.line(14, currentY + 2.5, 196, currentY + 2.5);

      currentY += 8.5;
    });

    // Footer signature
    if (currentY < 270) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('This is an automated meal distribution compliance audit ledger. Keep for RKMVC college compliance records.', 14, currentY + 8);
    }

    doc.save(`${selectedTable}_meal_report.pdf`);
  };

  const triggerDownload = async () => {
    if (!selectedTable) return;
    if (selectedColumns.length === 0) {
      showToast('Please select at least one column to export', 'error');
      return;
    }
    setExporting(true);

    try {
      // PDF handles separately on client side so we get rows
      if (exportFormat === 'pdf') {
        const res = await api.get(`/tables/${selectedTable}?limit=1000`);
        const rows = res.data?.rows || [];
        await generatePDFExport(rows);
        showToast(`Successfully generated PDF report for ${selectedTable}!`, 'success');
        setExporting(false);
        return;
      }

      let endpoint = `/export/${exportFormat}`;
      let mimeType = 'text/csv';
      let fileExt = 'csv';

      if (exportFormat === 'excel') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExt = 'xlsx';
      } else if (exportFormat === 'json') {
        mimeType = 'application/json';
        fileExt = 'json';
      }

      // Crucial: Set responseType to 'blob' for binary formats like Excel!
      const res = await api.post(endpoint, {
        tableName: selectedTable,
        columns: selectedColumns
      }, {
        responseType: 'blob'
      });

      // Construct file download link
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedTable}_export.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(`Successfully exported ${selectedTable} as ${exportFormat.toUpperCase()}!`, 'success');
    } catch (err: any) {
      showToast('Export failed. Please check table integrity.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const activeTableObj = tables.find(t => t.name === selectedTable);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto animate-fade-in">

        {/* Export Controls Config */}
        <div className="lg:col-span-2 space-y-8">

          {/* Table Choice */}
          <div className="bg-white border border-saffron-100 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-950 text-sm tracking-tight mb-4 flex items-center gap-2">
              <Table className="h-4.5 w-4.5 text-saffron-500" />
              1. Select Table to Export
            </h3>

            {tables.length === 0 ? (
              <p className="text-xs text-gray-400">No tables available in SQL database.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tables.map(t => (
                  <button
                    key={t.name}
                    onClick={() => handleTableChange(t.name)}
                    className={`p-4 border rounded-2xl text-left transition-all hover:scale-[1.01] cursor-pointer ${selectedTable === t.name
                      ? 'border-saffron-500 bg-saffron-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block truncate">
                      {t.name === 'student_meals' ? 'Students Meal List' : t.name === 'meal_distribution_log' ? 'Meal Logs Trail' : t.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1.5 font-bold uppercase tracking-wide">
                      {t.recordCount} records • {t.columns.length} columns
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column Selector */}
          <div className="bg-white border border-saffron-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-950 text-sm tracking-tight flex items-center gap-2">
                <Columns className="h-4.5 w-4.5 text-saffron-500" />
                2. Pick Columns to Export
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={selectAllColumns}
                  className="text-xs font-bold text-saffron-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selectNoneColumns}
                  className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {!activeTableObj ? (
              <p className="text-xs text-gray-400">Please select a table first.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeTableObj.columns.map(col => {
                  const isChecked = selectedColumns.includes(col.name);
                  return (
                    <button
                      key={col.name}
                      onClick={() => handleColumnToggle(col.name)}
                      className={`flex items-center gap-3 p-3 border rounded-xl text-left transition-all cursor-pointer ${isChecked
                        ? 'border-saffron-200 bg-saffron-50/20 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-400'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="rounded text-saffron-500 focus:ring-0 h-3.5 w-3.5"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">{col.name}</span>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wide mt-0.5">{col.type}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Export action Card */}
        <div className="space-y-6">
          <div className="bg-white border border-saffron-100 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-950 text-sm tracking-tight mb-6 flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-saffron-500" />
              3. Format & Download
            </h3>

            {/* Export format choices */}
            <div className="space-y-3">

              {/* CSV */}
              <button
                onClick={() => setExportFormat('csv')}
                className={`w-full flex items-center justify-between p-3.5 border rounded-2xl text-left transition-all cursor-pointer ${exportFormat === 'csv'
                  ? 'border-saffron-500 bg-saffron-50/50'
                  : 'border-slate-250 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      CSV Format
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Standard comma-separated format
                    </span>
                  </div>
                </div>
                {exportFormat === 'csv' && <Check className="h-4 w-4 text-saffron-600 shrink-0" />}
              </button>

              {/* PDF conversion in CSV conversion list */}
              <button
                onClick={() => setExportFormat('pdf')}
                className={`w-full flex items-center justify-between p-3.5 border rounded-2xl text-left transition-all cursor-pointer ${exportFormat === 'pdf'
                  ? 'border-saffron-500 bg-saffron-50/50'
                  : 'border-slate-250 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-saffron-50 rounded-xl text-saffron-600">
                    <FileText className="h-4.5 w-4.5 text-saffron-600" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      PDF Document (.pdf)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      High-fidelity formatted print ledger
                    </span>
                  </div>
                </div>
                {exportFormat === 'pdf' && <Check className="h-4 w-4 text-saffron-600 shrink-0" />}
              </button>

              {/* Excel */}
              <button
                onClick={() => setExportFormat('excel')}
                className={`w-full flex items-center justify-between p-3.5 border rounded-2xl text-left transition-all cursor-pointer ${exportFormat === 'excel'
                  ? 'border-saffron-500 bg-saffron-50/50'
                  : 'border-slate-250 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-emerald-600">
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      Excel Workbook (.xlsx)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Rich spreadsheet workbook
                    </span>
                  </div>
                </div>
                {exportFormat === 'excel' && <Check className="h-4 w-4 text-saffron-600 shrink-0" />}
              </button>

              {/* JSON */}
              <button
                onClick={() => setExportFormat('json')}
                className={`w-full flex items-center justify-between p-3.5 border rounded-2xl text-left transition-all cursor-pointer ${exportFormat === 'json'
                  ? 'border-saffron-500 bg-saffron-50/50'
                  : 'border-slate-250 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-blue-500">
                    <Braces className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      JSON Array
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Standard JSON format for developers
                    </span>
                  </div>
                </div>
                {exportFormat === 'json' && <Check className="h-4 w-4 text-saffron-600 shrink-0" />}
              </button>

            </div>

            {/* Run Download Button */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={triggerDownload}
                disabled={exporting || !selectedTable || selectedColumns.length === 0}
                className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-saffron-500/10 cursor-pointer disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Bundling Data File...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download {exportFormat.toUpperCase()} File</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
