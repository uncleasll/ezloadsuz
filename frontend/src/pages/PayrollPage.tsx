import { useState, useEffect, useCallback, useRef } from 'react'
import { payrollApi } from '@/api/payroll'
import type { Settlement } from '@/api/payroll'
import { driversApi } from '@/api/entities'
import { formatCurrency, formatDate } from '@/utils'
import type { Driver } from '@/types'
import SettlementModal from '@/components/payroll/SettlementModal'
import NewSettlementModal from '@/components/payroll/NewSettlementModal'
import toast from 'react-hot-toast'

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoSearch  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
const IcoFilter  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2"/></svg>
const IcoNew     = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
const IcoEdit    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
const IcoChevron = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
const IcoX       = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
const IcoCheck   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
const IcoGear    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
const IcoInfo    = () => <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  'Ready':     'bg-amber-500 text-white border-amber-500',
  'Preparing': 'bg-white text-gray-600 border-gray-300',
  'Paid':      'bg-green-50 text-green-700 border-green-300',
  'Sent':      'bg-blue-50 text-blue-700 border-blue-300',
  'Void':      'bg-red-50 text-red-600 border-red-300',
}
const STATUS_DISPLAY: Record<string, string> = {
  'Ready': 'Ready for payment',
  'Preparing': 'Preparing',
  'Paid': 'Paid',
  'Sent': 'Sent',
  'Void': 'Void',
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_DISPLAY[status] || status
  if (status === 'Ready') {
    return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-500 text-white border border-amber-500">{label}</span>
  }
  const cls = STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-300'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
      {children}
    </button>
  )
}

const PAGE_SIZES = [10, 25, 50, 100]
const STATUSES   = ['Preparing', 'Ready', 'Sent', 'Paid', 'Void']

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [showFilter, setShowFilter] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [showGearMenu, setShowGearMenu] = useState(false)
  const batchRef = useRef<HTMLDivElement>(null)
  const gearRef  = useRef<HTMLDivElement>(null)

  const [filters, setFilters] = useState({
    status: '', settlement_number: '', amount_from: '', amount_to: '',
    date_from: '', date_to: '', payable_to: '', driver_id: '',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: pageSize }
      if (appliedFilters.status) params.status = appliedFilters.status
      if (appliedFilters.driver_id) params.driver_id = appliedFilters.driver_id
      if (appliedFilters.settlement_number) params.settlement_number = parseInt(appliedFilters.settlement_number)
      if (appliedFilters.amount_from) params.amount_from = parseFloat(appliedFilters.amount_from)
      if (appliedFilters.amount_to) params.amount_to = parseFloat(appliedFilters.amount_to)
      if (appliedFilters.date_from) params.date_from = appliedFilters.date_from
      if (appliedFilters.date_to) params.date_to = appliedFilters.date_to
      if (appliedFilters.payable_to) params.payable_to = appliedFilters.payable_to
      const data = await payrollApi.list(params)
      const items: Settlement[] = data.items || data
      // client-side search fallback
      const filtered = search
        ? items.filter(s =>
            String(s.settlement_number).includes(search) ||
            s.payable_to?.toLowerCase().includes(search.toLowerCase()) ||
            s.driver?.name?.toLowerCase().includes(search.toLowerCase())
          )
        : items
      setSettlements(filtered)
      setTotal(data.total ?? filtered.length)
      setTotalPages(data.total_pages ?? Math.max(1, Math.ceil(filtered.length / pageSize)))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [appliedFilters, page, pageSize, search])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { driversApi.list().then(setDrivers).catch(console.error) }, [])

  // Close menus on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (batchRef.current && !batchRef.current.contains(e.target as Node)) setShowBatchMenu(false)
      if (gearRef.current  && !gearRef.current.contains(e.target as Node))  setShowGearMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const paged = settlements  // already paginated from server
  const startEntry = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endEntry   = Math.min(page * pageSize, total)

  const toggleSelect = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () =>
    setSelected(s => s.length === paged.length && paged.length > 0 ? [] : paged.map(x => x.id))

  const selectedItems = settlements.filter(s => selected.includes(s.id))
  const selectedTotal = selectedItems.reduce((a, s) => a + s.settlement_total, 0)
  const selectedBalance = selectedItems.reduce((a, s) => a + s.balance_due, 0)

  const setF = (k: keyof typeof filters, v: string) => setFilters(p => ({ ...p, [k]: v }))
  const handleApply = () => { setAppliedFilters(filters); setPage(1); setShowFilter(false) }
  const handleClearAll = () => {
    const blank = { status:'', settlement_number:'', amount_from:'', amount_to:'', date_from:'', date_to:'', payable_to:'', driver_id:'' }
    setFilters(blank); setAppliedFilters(blank); setPage(1)
  }

  const handleDelete = async (id: number, num: number) => {
    if (!confirm(`Delete settlement #${num}?`)) return
    try { await payrollApi.delete(id); toast.success('Deleted'); loadData() }
    catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleBatchAction = async (action: string) => {
    setShowBatchMenu(false)
    if (selected.length === 0) return
    if (action === 'Export to QuickBooks') {
      for (const id of selected) {
        try { await payrollApi.exportQB(id) } catch { /* continue */ }
      }
      toast.success(`Exported ${selected.length} settlement(s) to QuickBooks`)
      loadData()
    } else {
      toast(`${action} — coming soon`, { icon: 'ℹ️' })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Driver Payroll</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IcoSearch /></span>
            <input
              type="text" placeholder="Search" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-green-500 w-48"
            />
          </div>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded font-medium transition-colors ${showFilter ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            <IcoFilter /> Extended Filter
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors">
            <IcoNew /> New
          </button>
        </div>
      </div>

      {/* ── Extended filter ── */}
      {showFilter && (
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={filters.status} onChange={e => setF('status', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-green-500">
                <option value=""></option>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_DISPLAY[s] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Settlement #</label>
              <input value={filters.settlement_number} onChange={e => setF('settlement_number', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount: From</label>
              <input type="number" value={filters.amount_from} onChange={e => setF('amount_from', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount: To</label>
              <input type="number" value={filters.amount_to} onChange={e => setF('amount_to', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date: From</label>
              <input type="date" value={filters.date_from} onChange={e => setF('date_from', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date: To</label>
              <input type="date" value={filters.date_to} onChange={e => setF('date_to', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payable To</label>
              <input value={filters.payable_to} onChange={e => setF('payable_to', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
              <select value={filters.driver_id} onChange={e => setF('driver_id', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-green-500">
                <option value=""></option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name} [{d.driver_type}]</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded">
              <IcoCheck /> Apply
            </button>
            <button onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded">
              <IcoX /> Clear All
            </button>
          </div>
        </div>
      )}

      {/* ── Batch actions bar ── */}
      <div className="flex items-center gap-3 px-5 py-1.5 border-b border-gray-100 flex-shrink-0 min-h-[36px]">
        <div className="relative" ref={batchRef}>
          <button
            onClick={() => selected.length > 0 && setShowBatchMenu(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              selected.length > 0
                ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            Batch actions <IcoChevron />
          </button>
          {showBatchMenu && selected.length > 0 && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 py-1 w-52">
              {['Email settlements', 'Change status', 'Export to QuickBooks', 'Download attachments', 'Download Excel'].map(action => (
                <button key={action} onClick={() => handleBatchAction(action)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <span className="text-xs text-gray-500">{selected.length} selected</span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: 900 }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <tr>
              <th className="px-3 py-2.5 text-center">
                <input type="checkbox" className="w-3.5 h-3.5 rounded accent-green-600"
                  checked={selected.length === paged.length && paged.length > 0}
                  onChange={toggleAll} />
              </th>
              {[
                ['NUMBER',''],['DATE',''],['PAYABLE TO',''],['DRIVER',''],
                ['SETTLEMENT TOTAL','text-right'],['BALANCE DUE','text-right'],
                ['QB STATUS','text-center'],['EMAIL','text-center'],['STATUS',''],
                ['NOTES',''],['', ''],
              ].map(([h, cls], i) => (
                <th key={i} className={`px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${cls}`}>
                  {h}{h && <span className="ml-0.5 opacity-30 text-[10px]">⇅</span>}
                </th>
              ))}
              {/* gear */}
              <th className="px-2 py-2.5 text-right">
                <div className="relative inline-block" ref={gearRef}>
                  <button onClick={() => setShowGearMenu(v => !v)} className="text-gray-400 hover:text-gray-600">
                    <IcoGear />
                  </button>
                  {showGearMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 py-1 w-44">
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Default settings</button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Customize table</button>
                    </div>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={13} className="py-16 text-center text-gray-400">Loading...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={13} className="py-16 text-center text-gray-400">No settlements found</td></tr>
            ) : paged.map(s => {
              const isSelected = selected.includes(s.id)
              return (
                <tr key={s.id}
                  onClick={() => setEditId(s.id)}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded accent-green-600"
                      checked={isSelected} onChange={() => toggleSelect(s.id)} />
                  </td>
                  <td className="px-2 py-2.5">
                    <button onClick={e => { e.stopPropagation(); setEditId(s.id) }}
                      className="text-blue-600 hover:underline font-semibold text-sm">
                      {s.settlement_number}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-gray-600 text-xs">{formatDate(s.date)}</td>
                  <td className="px-2 py-2.5 font-medium text-gray-900 truncate">{s.payable_to}</td>
                  <td className="px-2 py-2.5 text-gray-600 truncate text-xs">
                    {s.driver ? `${s.driver.name} [${s.driver.driver_type}]` : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-gray-900">
                    {formatCurrency(s.settlement_total)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-700">
                    {formatCurrency(s.balance_due)}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <div className={`w-4 h-4 rounded-full border-2 mx-auto ${s.qb_exported ? 'border-green-500 bg-green-500' : 'border-gray-300'}`} />
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-400 text-xs">—</td>
                  <td className="px-2 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs truncate max-w-[80px]">{s.notes || '—'}</td>
                  <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                    <RowActions
                      onEdit={() => setEditId(s.id)}
                      onDelete={() => handleDelete(s.id, s.settlement_number)}
                    />
                  </td>
                </tr>
              )
            })}

            {/* Selected totals row */}
            {selected.length > 0 && (
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={5} className="px-3 py-2 text-sm font-semibold text-blue-700">
                  Total ({selected.length}):
                </td>
                <td className="px-2 py-2 text-right font-bold text-blue-700">{formatCurrency(selectedTotal)}</td>
                <td className="px-2 py-2 text-right font-bold text-blue-700">{formatCurrency(selectedBalance)}</td>
                <td colSpan={6} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <PagBtn onClick={() => setPage(1)} disabled={page <= 1}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
            </PagBtn>
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              return start + i
            }).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded font-medium ${p === page ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {p}
              </button>
            ))}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </PagBtn>
            <PagBtn onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
            </PagBtn>
          </div>
          <span className="text-xs text-gray-500">Showing {startEntry} to {endEntry} of {total} entries</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Show records</span>
          {PAGE_SIZES.map(n => (
            <button key={n} onClick={() => { setPageSize(n); setPage(1) }}
              className={`text-xs px-1.5 py-0.5 rounded ${pageSize === n ? 'text-green-600 font-bold underline' : 'text-gray-500 hover:text-gray-700'}`}>
              {n}
            </button>
          ))}
          <span className="text-xs text-gray-500">on page</span>
        </div>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewSettlementModal
          drivers={drivers}
          onClose={() => setShowNewModal(false)}
          onSaved={(id) => { setShowNewModal(false); if (id) setEditId(id); loadData() }}
        />
      )}
      {editId !== null && (
        <SettlementModal
          settlementId={editId}
          drivers={drivers}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); loadData() }}
        />
      )}
    </div>
  )
}

// ─── Row actions ──────────────────────────────────────────────────────────────
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="flex items-center gap-1" ref={ref}>
      <button onClick={e => { e.stopPropagation(); onEdit() }}
        className="p-1.5 border border-green-200 text-green-600 rounded hover:bg-green-50 transition-colors">
        <IcoEdit />
      </button>
      <div className="relative">
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
          <IcoChevron />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 py-1 w-32">
            <button onClick={e => { e.stopPropagation(); setOpen(false); onEdit() }}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
            <button onClick={e => { e.stopPropagation(); setOpen(false); onDelete() }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New Settlement Modal ─────────────────────────────────────────────────────
