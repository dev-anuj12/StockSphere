import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import {
  BarChart3,
  Download,
  Calendar,
  Warehouse,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';

export function Reports() {
  const toast = useToast();

  const [reportType, setReportType] = useState('stock');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await api.get('/warehouses');
        setWarehouses(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadWarehouses();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports', {
        params: {
          type: reportType,
          format: 'json',
          warehouseId: warehouseId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      setReportData(res.data);
    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, warehouseId, dateFrom, dateTo]);

  const handleExportCsv = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/reports', {
        params: {
          type: reportType,
          format: 'csv',
          warehouseId: warehouseId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        responseType: 'blob',
      });

      // Trigger browser download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `StockSphere-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV Report downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export CSV report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <span>Operational & Financial Reports</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time warehouse audits, movement histories, valuation calculations, and CSV exports.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={downloading || !reportData?.data || reportData.data.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>Export CSV</span>
        </button>
      </div>

      {/* Report Type Selector & Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100">
          {[
            { id: 'stock', label: 'Inventory Valuation' },
            { id: 'low-stock', label: 'Low Stock Deficit' },
            { id: 'warehouse-stock', label: 'Warehouse Breakdown' },
            { id: 'movements', label: 'All Ledger Movements' },
            { id: 'stock-in', label: 'Inbound Receipts' },
            { id: 'stock-out', label: 'Outbound Dispatches' },
            { id: 'adjustments', label: 'Cycle Count Adjustments' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                reportType === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-slate-400" />
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          {['movements', 'stock-in', 'stock-out', 'adjustments'].includes(reportType) && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {(warehouseId || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setWarehouseId('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-indigo-600 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Report Table Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : reportData?.data?.length > 0 ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Report Preview ({reportData.data.length} records generated)
              </span>
              <span className="text-xs text-slate-400">
                Generated at {new Date().toLocaleTimeString()}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0 shadow-sm">
                  <tr>
                    {reportData.columns.map((col, idx) => (
                      <th key={idx} className="py-3 px-4 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.data.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60 transition">
                      {reportData.columns.map((col, cIdx) => {
                        const val = row[col.key];
                        return (
                          <td key={cIdx} className="py-3 px-4 whitespace-nowrap text-slate-700">
                            {typeof val === 'number'
                              ? col.label.includes('($)')
                                ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : val.toLocaleString()
                              : val === null || val === undefined
                              ? '-'
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            title="No Records in Report"
            description="No entries matched the selected report type and filters."
            icon={FileSpreadsheet}
          />
        )}
      </div>
    </div>
  );
}
