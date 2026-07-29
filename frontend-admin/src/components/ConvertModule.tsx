import React, { useState } from 'react';
import {
  UploadCloud,
  ArrowRightLeft,
  Download,
  Braces,
  FileSpreadsheet,
  FileText,
  Terminal,
  Clock,
  Eye
} from 'lucide-react';
import Papa from 'papaparse';
import api from '../lib/api';
import { generatePdfFromData } from '../lib/pdfGenerator';

interface ConvertModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ConvertModule({ showToast }: ConvertModuleProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [targetFormat, setTargetFormat] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [converting, setConverting] = useState(false);
  const [sourceFormat, setSourceFormat] = useState<'csv' | 'json' | 'excel' | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === "dragover" || e.type === "dragenter");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      setSourceFormat('csv');
      setTargetFormat('json');
    } else if (ext === 'json') {
      setSourceFormat('json');
      setTargetFormat('csv');
    } else if (ext === 'xlsx' || ext === 'xls') {
      setSourceFormat('excel');
      setTargetFormat('csv');
    } else {
      showToast('Unsupported file type. Please use .csv, .json, or .xlsx files', 'error');
      return;
    }

    setFile(selectedFile);
    setPreviewContent('');
    setPreviewRows([]);
    showToast(`Loaded ${selectedFile.name} successfully`, 'success');
  };

  const executeConversion = async () => {
    if (!file || !sourceFormat) return;
    setConverting(true);

    try {
      if (sourceFormat === 'csv' && targetFormat === 'pdf') {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.errors.length > 0 && results.data.length === 0) {
              showToast('Failed to parse CSV file content', 'error');
              setConverting(false);
              return;
            }
            const data = results.data as any[];
            const cols = results.meta.fields || [];

            const reportModel = `[PDF Document Generation Model Ready]
Document Target: A4 Portrait Report
Source Filename: ${file.name}
Total Mapped Rows: ${data.length}
Identified Table Schema: [${cols.join(', ')}]
Estimated Pages: ~${Math.ceil((data.length * 7 + 50) / 277) || 1} pages (A4 Layout)

Layout Features:
- Elegant Saffron College Header Banner
- Dynamic Document Generation Metadata Block
- Custom Table Header Grid with alternating slate backgrounds
- Intelligent horizontal clipping (safeguards against column overflow)
- Automatic Pagination & Footer numbers ('Page X of Y')

Your report is generated in vectors and ready to save. Click "Download Converted File" below to download the polished PDF document.`;

            setPreviewContent(reportModel);
            setConverting(false);
            showToast('PDF conversion model prepared! Preview loaded below.', 'success');
          },
          error: (err) => {
            showToast(`CSV Parsing Error: ${err.message}`, 'error');
            setConverting(false);
          }
        });
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      let endpoint = '';
      let responseType: any = 'json';

      if (sourceFormat === 'csv') {
        if (targetFormat === 'json') {
          endpoint = '/convert/csv-to-json';
        } else if (targetFormat === 'excel') {
          endpoint = '/convert/csv-to-excel';
          responseType = 'blob';
        } else if (targetFormat === 'sql') {
          endpoint = '/convert/csv-to-sql';
          formData.append('tableName', file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_'));
          responseType = 'text';
        }
      } else if (sourceFormat === 'json') {
        if (targetFormat === 'csv') {
          endpoint = '/convert/json-to-csv';
          responseType = 'text';
        }
      } else if (sourceFormat === 'excel') {
        if (targetFormat === 'csv') {
          endpoint = '/convert/excel-to-csv';
          responseType = 'text';
        }
      }

      const res = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType
      });

      // Format preview
      if (targetFormat === 'json') {
        const rawJson = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        setPreviewContent(JSON.stringify(rawJson.slice(0, 5), null, 2));
        setPreviewRows(rawJson.slice(0, 10));
      } else if (targetFormat === 'sql') {
        setPreviewContent(res.data.split('\n').slice(0, 10).join('\n') + '\n... [Insert statements truncated for preview] ...');
      } else if (targetFormat === 'csv') {
        setPreviewContent(res.data.split('\n').slice(0, 10).join('\n'));
      } else if (targetFormat === 'excel') {
        setPreviewContent('[Excel binary workbook generated successfully. Preview is unavailable for binary sheets. Click download to fetch file.]');
      }

      showToast('Conversion completed! Preview is loaded below.', 'success');
    } catch (err: any) {
      showToast('Conversion failed. Please verify source file schema integrity.', 'error');
    } finally {
      setConverting(false);
    }
  };

  const downloadConvertedFile = async () => {
    if (!file || !sourceFormat) return;
    setConverting(true);

    try {
      if (sourceFormat === 'csv' && targetFormat === 'pdf') {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            const data = results.data as any[];
            const cols = results.meta.fields || [];

            if (cols.length === 0 || data.length === 0) {
              showToast('No columns or rows found in file to convert to PDF', 'error');
              setConverting(false);
              return;
            }

            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'converted_file';
            const pdfFilename = `${baseName}_converted.pdf`;

            generatePdfFromData(
              `${baseName} Data Report`,
              cols,
              data,
              pdfFilename
            );

            showToast('PDF Document exported successfully!', 'success');
            setConverting(false);
          },
          error: (err) => {
            showToast(`PDF conversion failed: ${err.message}`, 'error');
            setConverting(false);
          }
        });
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      let endpoint = '';
      let responseType: any = 'blob';
      let mimeType = 'text/plain';
      let targetExt = 'txt';

      if (sourceFormat === 'csv') {
        if (targetFormat === 'json') {
          endpoint = '/convert/csv-to-json';
          mimeType = 'application/json';
          targetExt = 'json';
        } else if (targetFormat === 'excel') {
          endpoint = '/convert/csv-to-excel';
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          targetExt = 'xlsx';
        } else if (targetFormat === 'sql') {
          endpoint = '/convert/csv-to-sql';
          formData.append('tableName', file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_'));
          mimeType = 'text/plain';
          targetExt = 'sql';
        }
      } else if (sourceFormat === 'json') {
        if (targetFormat === 'csv') {
          endpoint = '/convert/json-to-csv';
          mimeType = 'text/csv';
          targetExt = 'csv';
        }
      } else if (sourceFormat === 'excel') {
        if (targetFormat === 'csv') {
          endpoint = '/convert/excel-to-csv';
          mimeType = 'text/csv';
          targetExt = 'csv';
        }
      }

      const res = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType
      });

      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.'));
      link.setAttribute('download', `${originalBaseName}_converted.${targetExt}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast('File downloaded successfully!', 'success');
    } catch (err) {
      showToast('Download trigger failed', 'error');
    } finally {
      setConverting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setSourceFormat(null);
    setPreviewContent('');
    setPreviewRows([]);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-6 transition-colors duration-200">

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

        {/* Left/Middle Column: Configuration Upload */}
        <div className="xl:col-span-2 space-y-6">

          {/* Upload card */}
          <div className="bg-white border border-saffron-100 rounded-xl p-6 shadow-sm">

            {!file ? (
              <div
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center relative transition-all ${dragActive
                  ? 'border-saffron-500 bg-saffron-500/5'
                  : 'border-slate-300 hover:border-slate-400'
                  }`}
              >
                <input
                  type="file"
                  accept=".csv,.json,.xlsx"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <UploadCloud className="h-8 w-8 text-saffron-500 mb-3" />
                  <span className="font-bold text-xs text-slate-700 block">
                    Upload source file to convert
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Accepts CSV, JSON, or Excel sheets. Limit up to 15MB.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-saffron-50 text-saffron-600 rounded-lg">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-1 block">
                      Type: {sourceFormat?.toUpperCase()} • Size: {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Clear File
                </button>
              </div>
            )}
          </div>

          {/* Direction Configuration */}
          {file && sourceFormat && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-6 flex items-center gap-2.5">
                <ArrowRightLeft className="h-4.5 w-4.5 text-saffron-500" />
                Select Output Format Target
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {sourceFormat === 'csv' && (
                  <>
                    <button
                      onClick={() => setTargetFormat('json')}
                      className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'json' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <Braces className="h-5 w-5 text-saffron-500 mb-2" />
                      <span className="font-semibold text-xs text-slate-800 block">Convert to JSON</span>
                      <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Translate rows into a structured JSON array</span>
                    </button>

                    <button
                      onClick={() => setTargetFormat('excel')}
                      className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'excel' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <FileSpreadsheet className="h-5 w-5 text-emerald-500 mb-2" />
                      <span className="font-semibold text-xs text-slate-800 block">Convert to Excel</span>
                      <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Package rows into a download binary .xlsx workbook</span>
                    </button>

                    <button
                      onClick={() => setTargetFormat('sql')}
                      className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'sql' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <Terminal className="h-5 w-5 text-amber-500 mb-2" />
                      <span className="font-semibold text-xs text-slate-800 block">Convert to SQL</span>
                      <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Generate database SQL INSERT commands</span>
                    </button>

                    <button
                      onClick={() => setTargetFormat('pdf')}
                      className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'pdf' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <FileText className="h-5 w-5 text-rose-500 mb-2" />
                      <span className="font-semibold text-xs text-slate-800 block">Convert to PDF</span>
                      <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Format spreadsheet rows into a highly polished A4 PDF document</span>
                    </button>
                  </>
                )}

                {sourceFormat === 'json' && (
                  <button
                    onClick={() => setTargetFormat('csv')}
                    className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'csv' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <FileText className="h-5 w-5 text-saffron-500 mb-2" />
                    <span className="font-semibold text-xs text-slate-800 block">Convert to CSV</span>
                    <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Map objects list to raw comma-separated values</span>
                  </button>
                )}

                {sourceFormat === 'excel' && (
                  <button
                    onClick={() => setTargetFormat('csv')}
                    className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${targetFormat === 'csv' ? 'border-saffron-500 bg-saffron-500/5' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <FileText className="h-5 w-5 text-saffron-500 mb-2" />
                    <span className="font-semibold text-xs text-slate-800 block">Convert to CSV</span>
                    <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Flatten first worksheet rows into simple CSV format</span>
                  </button>
                )}

              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={executeConversion}
                  disabled={converting || !targetFormat}
                  className="px-6 py-2.5 bg-saffron-500 hover:bg-saffron-600 text-white font-medium rounded-lg text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {converting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span>Preview Converted Output</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Right side: Preview output */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h4 className="font-bold text-slate-950 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-saffron-500" />
              In-app Conversion Preview
            </h4>

            {previewContent ? (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 overflow-x-auto">
                  <pre className="text-[10px] font-mono text-slate-600 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                    {previewContent}
                  </pre>
                </div>

                <button
                  onClick={downloadConvertedFile}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-medium py-2.5 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Converted File</span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Load a file and click "Preview Converted Output" to view parsing summaries.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
