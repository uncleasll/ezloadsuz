import { useState, useEffect, useCallback, useRef } from 'react'
import { loadsApi } from '@/api/loads'
import type { LoadListItem, LoadFilters } from '@/types'
import {
  formatCurrency, formatDate,
  getPickupStop, getDeliveryStop, stopLabel,
  PERIOD_OPTIONS, periodToDates,
} from '@/utils'
import LoadModal from '@/components/loads/LoadModal'
import NewLoadModal from '@/components/loads/NewLoadModal'
import FilterDrawer from '@/components/loads/FilterDrawer'
import { useEntities } from '@/hooks/useEntities'
import toast from 'react-hot-toast'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const STATUS_STYLE: Record<string, string> = {
  'New':        'bg-green-100 text-green-700',
  'Canceled':   'bg-red-100 text-red-600',
  'TONU':       'bg-red-100 text-red-600',
  'Dispatched': 'bg-blue-100 text-blue-700',
  'En Route':   'bg-cyan-100 text-cyan-700',
  'Picked-up':  'bg-amber-100 text-amber-700',
  'Delivered':  'bg-purple-100 text-purple-700',
  'Closed':     'bg-gray-100 text-gray-500',
}

/* ── Responsive breakpoint hook ──────────────────────────────── */
type Bp = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const BP_ORDER: Bp[] = ['sm', 'md', 'lg', 'xl', '2xl']
const atLeast = (bp: Bp, target: Bp) => BP_ORDER.indexOf(bp) >= BP_ORDER.indexOf(target)

function useBreakpoint(): Bp {
  const calc = (): Bp => {
    if (typeof window === 'undefined') return 'xl'
    const w = window.innerWidth
    if (w >= 1536) return '2xl'
    if (w >= 1280) return 'xl'
    if (w >= 1024) return 'lg'
    if (w >= 768)  return 'md'
    return 'sm'
  }
  const [bp, setBp] = useState<Bp>(calc)
  useEffect(() => {
    const update = () => setBp(calc())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp
}

/* ── Column width profiles per breakpoint (ALL percentages, sum to 100%) ── */
const WIDTHS: Record<Bp, Record<string, string>> = {
  sm:   { checkbox: '6%',  dot: '2%', load: '14%',                                                                                  pickup: '19%', delivery: '19%', rate: '11%',                                          status: '15%',                                                    actions: '14%' },
  md:   { checkbox: '4%',  dot: '2%', load: '7%',  date: '9%',   driver: '14%',                                                     pickup: '13%', delivery: '13%', rate: '8%',                                           status: '10%', billing: '9%',                                     actions: '11%' },
  lg:   { checkbox: '3%',  dot: '1%', load: '6%',  date: '7%',   driver: '12%', broker: '10%',                                      pickup: '11%', delivery: '11%', rate: '7%',                                           status: '8%',  billing: '9%',                  attachments: '4%', actions: '11%' },
  xl:   { checkbox: '3%',  dot: '1%', load: '5%',  date: '6%',   driver: '10%', broker: '9%',  po: '5%',                            pickup: '10%', delivery: '10%', rate: '6%',   completed: '5%',                        status: '7%',  billing: '7%',                  attachments: '4%', actions: '12%' },
  '2xl':{ checkbox: '2%',  dot: '1%', load: '5%',  date: '5%',   driver: '9%',  broker: '8%',  po: '4%',                            pickup: '9%',  delivery: '9%',  rate: '5%',   completed: '5%',                        status: '6%',  billing: '6%',   notes: '10%',  attachments: '4%', actions: '12%' },
}

export default function LoadsPage() {
  const bp = useBreakpoint()

  /* Column visibility derived from breakpoint */
  const show = {
    load:        true,
    date:        atLeast(bp, 'md'),
    driver:      atLeast(bp, 'md'),
    broker:      atLeast(bp, 'lg'),
    po:          atLeast(bp, 'xl'),
    pickup:      true,
    delivery:    true,
    rate:        true,
    completed:   atLeast(bp, 'xl'),
    status:      true,
    billing:     atLeast(bp, 'md'),
    notes:       atLeast(bp, '2xl'),
    attachments: atLeast(bp, 'lg'),
    actions:     true,
  }
  const W = WIDTHS[bp]

  const [loads, setLoads] = useState<LoadListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRate, setTotalRate] = useState(0)
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState<LoadFilters>({ page: 1, page_size: 50 })
  const [period, setPeriod] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [activeFilters, setActiveFilters] = useState<LoadFilters>({})

  const [selectedLoad, setSelectedLoad] = useState<LoadListItem | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)

  /* Dropdown menus */
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [actionMenuOpenId, setActionMenuOpenId] = useState<number | null>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)
  const actionMenuRef   = useRef<HTMLDivElement>(null)

  const entities = useEntities()
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchLoads = useCallback(async (f: LoadFilters) => {
    setLoading(true)
    try {
      const res = await loadsApi.list({ ...f, show_only_active: showOnlyActive })
      setLoads(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setTotalRate(res.total_rate)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [showOnlyActive])

  useEffect(() => {
    let periodDates: { date_from?: string; date_to?: string } = {}
    if (period === 'custom') {
      periodDates = { date_from: customFrom || undefined, date_to: customTo || undefined }
    } else if (period !== 'all') {
      periodDates = periodToDates(period)
    }
    fetchLoads({ ...activeFilters, ...filters, ...periodDates })
  }, [filters, activeFilters, period, customFrom, customTo, showOnlyActive, fetchLoads])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setSettingsMenuOpen(false)
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpenId(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSettingsMenuOpen(false); setActionMenuOpenId(null) }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim()
    const isNum = /^\d+$/.test(v)
    setFilters(prev => ({
      ...prev, page: 1,
      search: isNum ? undefined : (v || undefined),
      load_number: isNum ? parseInt(v) : undefined,
    }))
  }

  const handleApplyFilters = (f: LoadFilters) => {
    setActiveFilters(f)
    setFilters(prev => ({ ...prev, page: 1 }))
    setShowFilterDrawer(false)
  }

  const removeFilter = (key: keyof LoadFilters) => {
    if (key === 'load_number' || key === 'search') {
      setFilters(prev => { const n = { ...prev }; delete n[key]; return n })
      if (searchRef.current) searchRef.current.value = ''
    } else {
      setActiveFilters(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  const clearAllFilters = () => {
    setActiveFilters({})
    setFilters({ page: 1, page_size: filters.page_size || 50 })
    setPeriod('all')
    setCustomFrom('')
    setCustomTo('')
    if (searchRef.current) searchRef.current.value = ''
  }

  const handleLoadSaved = () => {
    setShowNewForm(false)
    fetchLoads({ ...activeFilters, ...filters })
  }

  /* Row actions */
  const handleEditLoad = (load: LoadListItem) => {
    setActionMenuOpenId(null)
    setSelectedLoad(load)
  }
 const handleCopyLoad = async (load: LoadListItem) => {
    setActionMenuOpenId(null)
    toast('Copy Load — not wired up yet')
  }

  const handleShowOnMap = (load: LoadListItem) => {
    setActionMenuOpenId(null)
    toast(`Show on map — load #${load.load_number}`)
  }

  const handleDeleteLoad = async (load: LoadListItem) => {
    setActionMenuOpenId(null)
    if (!window.confirm(`Delete load #${load.load_number}? This cannot be undone.`)) return
    try {
      await loadsApi.delete(load.id)
      toast.success(`Load #${load.load_number} deleted`)
      fetchLoads({ ...activeFilters, ...filters })
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  const filterChips: { label: string; key: keyof LoadFilters }[] = []
  if (filters.load_number) filterChips.push({ label: `#${filters.load_number}`, key: 'load_number' })
  if (filters.search) filterChips.push({ label: `"${filters.search}"`, key: 'search' })
  if (activeFilters.driver_id) {
    const drv = entities.drivers.find(d => d.id === activeFilters.driver_id)
    if (drv) filterChips.push({ label: drv.name, key: 'driver_id' })
  }
  if (activeFilters.broker_id) {
    const brk = entities.brokers.find(b => b.id === activeFilters.broker_id)
    if (brk) filterChips.push({ label: brk.name, key: 'broker_id' })
  }
  if (activeFilters.status) filterChips.push({ label: activeFilters.status, key: 'status' })
  if (activeFilters.billing_status) filterChips.push({ label: activeFilters.billing_status, key: 'billing_status' })

  const startEntry = ((filters.page || 1) - 1) * (filters.page_size || 50) + 1
  const endEntry = Math.min((filters.page || 1) * (filters.page_size || 50), total)
  const pendingTotal = loads.filter(l => l.billing_status === 'Pending').reduce((s, l) => s + l.rate, 0)
  const invoicedTotal = loads.filter(l => ['Invoiced', 'Sent to factoring', 'Funded', 'Paid'].includes(l.billing_status)).reduce((s, l) => s + l.rate, 0)
  const remainingTotal = Math.max(0, totalRate - pendingTotal - invoicedTotal)

  const showTotalBar = atLeast(bp, 'md')

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">

        <span className="font-bold text-gray-900 text-base flex-shrink-0">Loads</span>

        {/* Period */}
        <div className="relative flex items-center flex-shrink-0">
          <select
            value={period}
            onChange={e => { setPeriod(e.target.value); setFilters(p => ({ ...p, page: 1 })) }}
            className="appearance-none bg-transparent border-0 text-gray-600 text-xs font-medium pr-4 pl-0 py-0 focus:outline-none cursor-pointer"
          >
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-0 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </div>

        {period === 'custom' && showTotalBar && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <input type="date" value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setFilters(p => ({ ...p, page: 1 })) }}
              className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400 w-28" />
            <span className="text-gray-300">—</span>
            <input type="date" value={customTo}
              onChange={e => { setCustomTo(e.target.value); setFilters(p => ({ ...p, page: 1 })) }}
              className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400 w-28" />
          </div>
        )}

        {/* Total bar — hidden below md */}
        {showTotalBar && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
              {formatCurrency(0)}
            </span>
            <div className="relative flex-1 h-1.5 bg-gray-100 rounded-full overflow-visible">
              <div className="absolute left-0 top-0 h-full bg-red-300 rounded-full transition-all"
                style={{ width: totalRate > 0 ? `${Math.min((pendingTotal / totalRate) * 100, 100)}%` : '0%' }} />
              <div className="absolute top-0 h-full bg-green-400 transition-all"
                style={{
                  left: totalRate > 0 ? `${Math.min((pendingTotal / totalRate) * 100, 100)}%` : '0%',
                  width: totalRate > 0 ? `${Math.min((invoicedTotal / totalRate) * 100, 100)}%` : '0%',
                }} />
              {pendingTotal > 0 && (
                <span
                  className="absolute top-full mt-0.5 text-[11px] text-gray-500 whitespace-nowrap -translate-x-1/2 pointer-events-none"
                  style={{ left: totalRate > 0 ? `${Math.min((pendingTotal / totalRate) * 50, 100)}%` : '0%' }}
                >
                  {formatCurrency(pendingTotal)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
              {formatCurrency(remainingTotal)}
            </span>
            <span className="text-xs text-gray-700 whitespace-nowrap font-semibold flex-shrink-0 ml-1">
              TOTAL: {formatCurrency(totalRate)}
            </span>
          </div>
        )}

        {!showTotalBar && <div className="flex-1" />}

        {/* Search */}
        <div className="relative flex-shrink-0">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search..."
            onChange={handleSearch}
            className="pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-green-400 w-44"
          />
          <button onClick={() => setShowFilterDrawer(true)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2"/></svg>
          </button>
        </div>

        {/* New Load */}
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md transition-colors flex-shrink-0 shadow-sm"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">New Load</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
      </div>

      {/* ── Filter chips ── */}
      {filterChips.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white border-b border-gray-100 flex-wrap flex-shrink-0">
          <span className="text-xs text-gray-400">Filtered by:</span>
          {filterChips.map(chip => (
            <span key={chip.key} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-sky-50 text-sky-600 text-xs rounded">
              {chip.label}
              <button onClick={() => removeFilter(chip.key)} className="hover:text-sky-900 ml-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
          <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-red-500 ml-1">clear all</button>
        </div>
      )}

      {/* ── New Load inline form ── */}
      {showNewForm && (
        <div className="flex-shrink-0 border-b border-gray-200">
          <NewLoadModal onClose={() => setShowNewForm(false)} onSaved={handleLoadSaved} entities={entities} />
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: W.checkbox }} />
            <col style={{ width: W.dot }} />
            <col style={{ width: W.load }} />
            {show.date        && <col style={{ width: W.date }} />}
            {show.driver      && <col style={{ width: W.driver }} />}
            {show.broker      && <col style={{ width: W.broker }} />}
            {show.po          && <col style={{ width: W.po }} />}
            <col style={{ width: W.pickup }} />
            <col style={{ width: W.delivery }} />
            <col style={{ width: W.rate }} />
            {show.completed   && <col style={{ width: W.completed }} />}
            <col style={{ width: W.status }} />
            {show.billing     && <col style={{ width: W.billing }} />}
            {show.notes       && <col style={{ width: W.notes }} />}
            {show.attachments && <col style={{ width: W.attachments }} />}
            <col style={{ width: W.actions }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            {/* Header row */}
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-1 py-2.5 text-center">
                <input type="checkbox" className="w-3.5 h-3.5 rounded" />
              </th>
              <th className="px-0 py-2.5" />
              <Th>Load</Th>
              {show.date        && <Th>Date</Th>}
              {show.driver      && <Th>Driver</Th>}
              {show.broker      && <Th>Broker</Th>}
              {show.po          && <Th>PO #</Th>}
              <Th>Pickup</Th>
              <Th>Delivery</Th>
              <Th>Rate</Th>
              {show.completed   && <Th>Completed</Th>}
              <Th>Status</Th>
              {show.billing     && <Th>Billing</Th>}
              {show.notes       && <Th>Notes</Th>}
              {show.attachments && <th className="px-1 py-2.5" />}
              <Th>Actions</Th>
            </tr>

            {/* Inline filters row */}
            <tr className="bg-white border-b border-gray-100">
              <td className="px-1 py-1" />
              <td className="px-0 py-1" />
              {/* Load # */}
              <td className="px-1.5 py-1">
                <input type="text"
                  onChange={e => {
                    const v = e.target.value; const num = parseInt(v)
                    setFilters(p => ({ ...p, page: 1, load_number: !isNaN(num) && v ? num : undefined }))
                  }}
                  className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400"
                />
              </td>
              {show.date && (
                <td className="px-1.5 py-1">
                  <input type="date"
                    value={activeFilters.date_from || ''}
                    onChange={e => { setActiveFilters(p => ({ ...p, date_from: e.target.value || undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400"
                  />
                </td>
              )}
              {show.driver && (
                <td className="px-1.5 py-1">
                  <select value={activeFilters.driver_id || ''}
                    onChange={e => { setActiveFilters(p => ({ ...p, driver_id: e.target.value ? parseInt(e.target.value) : undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none bg-white">
                    <option value="">Choose</option>
                    {entities.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
              )}
              {show.broker && (
                <td className="px-1.5 py-1">
                  <select value={activeFilters.broker_id || ''}
                    onChange={e => { setActiveFilters(p => ({ ...p, broker_id: e.target.value ? parseInt(e.target.value) : undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none bg-white">
                    <option value=""></option>
                    {entities.brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
              )}
              {show.po && (
                <td className="px-1.5 py-1">
                  <input type="text"
                    onChange={e => setFilters(p => ({ ...p, page: 1, search: e.target.value || undefined }))}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400"
                  />
                </td>
              )}
              {/* Pickup, Delivery, Rate — readonly */}
              <td className="px-1.5 py-1"><input readOnly className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 cursor-not-allowed" /></td>
              <td className="px-1.5 py-1"><input readOnly className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 cursor-not-allowed" /></td>
              <td className="px-1.5 py-1"><input readOnly className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 cursor-not-allowed" /></td>
              {show.completed && (
                <td className="px-1.5 py-1">
                  <input type="date"
                    value={activeFilters.date_to || ''}
                    onChange={e => { setActiveFilters(p => ({ ...p, date_to: e.target.value || undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-green-400"
                  />
                </td>
              )}
              <td className="px-1.5 py-1">
                <select value={activeFilters.status || ''}
                  onChange={e => { setActiveFilters(p => ({ ...p, status: e.target.value || undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                  className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none bg-white">
                  <option value=""></option>
                  {['New','Canceled','TONU','Dispatched','En Route','Picked-up','Delivered','Closed'].map(s => <option key={s}>{s}</option>)}
                </select>
              </td>
              {show.billing && (
                <td className="px-1.5 py-1">
                  <select value={activeFilters.billing_status || ''}
                    onChange={e => { setActiveFilters(p => ({ ...p, billing_status: e.target.value || undefined })); setFilters(p => ({ ...p, page: 1 })) }}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none bg-white">
                    <option value=""></option>
                    {['Pending','Canceled','BOL received','Invoiced','Sent to factoring','Funded','Paid'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              )}
              {show.notes && <td className="px-1.5 py-1" />}
              {show.attachments && <td className="px-1 py-1" />}

              {/* Settings gear dropdown */}
              <td className="px-1.5 py-1 relative">
                <div ref={settingsMenuRef} className="relative inline-block">
                  <button
                    onClick={() => setSettingsMenuOpen(v => !v)}
                    className={`text-gray-400 hover:text-gray-600 transition-colors ${settingsMenuOpen ? 'text-gray-700' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>

                  {settingsMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1">
                      <MenuItem onClick={() => { clearAllFilters(); setSettingsMenuOpen(false) }}>Clear All Filters</MenuItem>
                      <MenuItem onClick={() => { setSettingsMenuOpen(false); toast('Default Settings — not wired up') }}>Default Settings</MenuItem>
                      <MenuItem onClick={() => { setSettingsMenuOpen(false); setShowFilterDrawer(true) }}>Customize Loadlist</MenuItem>
                      <MenuItem onClick={() => { setSettingsMenuOpen(false); toast('Import Loads — not wired up') }}>Import Loads</MenuItem>
                      <MenuItem onClick={() => { setSettingsMenuOpen(false); toast('Export Loads — not wired up') }}>Export Loads</MenuItem>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <tr><td colSpan={20} className="py-16 text-center text-gray-400 text-xs">Loading...</td></tr>
            ) : loads.length === 0 ? (
              <tr><td colSpan={20} className="py-16 text-center text-gray-400 text-xs">No loads found</td></tr>
            ) : loads.map(load => {
              const pickup = getPickupStop(load.stops)
              const delivery = getDeliveryStop(load.stops)
              const svcLabel = load.services[0]?.service_type
              const svcAmt = load.services.reduce((s, v) => s + v.invoice_amount, 0)
              const isActionOpen = actionMenuOpenId === load.id

              return (
                <tr key={load.id} onClick={() => setSelectedLoad(load)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                  <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                  </td>
                  <td className="px-0 py-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </td>
                  <td className="px-1.5 py-2">
                    <button onClick={e => { e.stopPropagation(); setSelectedLoad(load) }}
                      className="text-blue-600 hover:underline font-semibold">
                      {load.load_number}
                    </button>
                  </td>
                  {show.date && (
                    <td className="px-1.5 py-2 text-gray-500 truncate">{formatDate(load.load_date)}</td>
                  )}
                  {show.driver && (
                    <td className="px-1.5 py-2 text-gray-800 truncate">
                      {load.driver?.name || <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {show.broker && (
                    <td className="px-1.5 py-2 truncate">
                      {load.broker
                        ? <button onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline text-left truncate max-w-full">{load.broker.name}</button>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {show.po && (
                    <td className="px-1.5 py-2 text-gray-500 truncate">
                      {load.po_number || <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-1.5 py-2 text-gray-700 truncate">{stopLabel(pickup)}</td>
                  <td className="px-1.5 py-2 text-gray-700 truncate">{stopLabel(delivery)}</td>
                  <td className="px-1.5 py-2 font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(load.rate)}</td>
                  {show.completed && (
                    <td className="px-1.5 py-2 text-gray-500 truncate">{formatDate(load.actual_delivery_date) || '—'}</td>
                  )}
                  <td className="px-1.5 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLE[load.status] || 'bg-gray-100 text-gray-500'}`}>
                      {load.status}
                    </span>
                  </td>
                  {show.billing && (
                    <td className="px-1.5 py-2 text-gray-500 truncate">{load.billing_status}</td>
                  )}
                  {show.notes && (
                    <td className="px-1.5 py-2 text-gray-400 truncate">
                      {svcAmt > 0 && svcLabel ? `${svcLabel}: ${formatCurrency(svcAmt)}` : <span className="text-gray-200">—</span>}
                    </td>
                  )}
                  {show.attachments && (
                    <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {load.documents.length > 0 && (
                        <svg className="w-3.5 h-3.5 text-green-500 inline-block" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      )}
                    </td>
                  )}

                  {/* Row actions */}
                  <td className="px-1.5 py-2 relative" onClick={e => e.stopPropagation()}>
                    <div ref={isActionOpen ? actionMenuRef : null} className="relative">
                      <button
                        onClick={() => setActionMenuOpenId(isActionOpen ? null : load.id)}
                        className={`flex items-center gap-1 w-full rounded px-1.5 py-1 hover:bg-gray-100 transition-colors ${isActionOpen ? 'bg-gray-100' : ''}`}
                      >
                        {svcLabel && atLeast(bp, 'md')
                          ? <span className="text-gray-600 truncate text-[11px] flex-1 text-left min-w-0">{svcLabel}</span>
                          : <span className="flex-1 text-gray-300 text-left">{atLeast(bp, 'md') ? '—' : ''}</span>}
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>

                      {isActionOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1">
                          <MenuItem onClick={() => handleEditLoad(load)}>Edit Load</MenuItem>
                          <MenuItem onClick={() => handleCopyLoad(load)}>Copy Load</MenuItem>
                          <MenuItem onClick={() => handleShowOnMap(load)}>Show on Map</MenuItem>
                          <MenuItem danger onClick={() => handleDeleteLoad(load)}>Delete Load</MenuItem>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200 flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-0.5">
            <PagBtn onClick={() => setFilters(p => ({ ...p, page: 1 }))} disabled={(filters.page || 1) <= 1}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
            </PagBtn>
            <PagBtn onClick={() => setFilters(p => ({ ...p, page: Math.max(1, (p.page || 1) - 1) }))} disabled={(filters.page || 1) <= 1}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const cur = filters.page || 1
              const start = Math.max(1, Math.min(cur - 2, totalPages - 4))
              return start + i
            }).map(p => (
              <button key={p} onClick={() => setFilters(prev => ({ ...prev, page: p }))}
                className={`min-w-[24px] h-6 px-1.5 rounded text-xs font-medium transition-colors ${
                  p === (filters.page || 1) ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {p}
              </button>
            ))}
            <PagBtn onClick={() => setFilters(p => ({ ...p, page: Math.min(totalPages, (p.page || 1) + 1) }))} disabled={(filters.page || 1) >= totalPages}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </PagBtn>
            <PagBtn onClick={() => setFilters(p => ({ ...p, page: totalPages }))} disabled={(filters.page || 1) >= totalPages}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
            </PagBtn>
          </div>

          <span className="text-xs text-gray-500 whitespace-nowrap">
            Showing {total === 0 ? 0 : startEntry}–{endEntry} of {total}
          </span>

          {atLeast(bp, 'md') && (
            <button onClick={() => setShowOnlyActive(p => !p)}
              className={`text-xs underline whitespace-nowrap ${showOnlyActive ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {showOnlyActive ? 'Show all loads' : 'Show only active loads'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {atLeast(bp, 'md') && <span className="text-xs text-gray-400">Show</span>}
          {PAGE_SIZE_OPTIONS.map(n => (
            <button key={n} onClick={() => setFilters(p => ({ ...p, page: 1, page_size: n }))}
              className={`text-xs px-1.5 py-0.5 rounded ${(filters.page_size || 50) === n ? 'text-green-600 font-bold underline' : 'text-gray-400 hover:text-gray-700'}`}>
              {n}
            </button>
          ))}
          {atLeast(bp, 'md') && <span className="text-xs text-gray-400">per page</span>}
        </div>
      </div>

      {/* Modals */}
      {selectedLoad && (
        <LoadModal loadId={selectedLoad.id} onClose={() => setSelectedLoad(null)}
          onSaved={() => fetchLoads({ ...activeFilters, ...filters })} entities={entities} />
      )}
      {showFilterDrawer && (
        <FilterDrawer initial={activeFilters} entities={entities}
          onApply={handleApplyFilters} onClose={() => setShowFilterDrawer(false)} />
      )}
    </div>
  )
}

/* ── Shared sub-components ────────────────────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-1.5 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap text-[11px] uppercase tracking-wide">
      {children}
      <span className="ml-0.5 opacity-30">⇅</span>
    </th>
  )
}

function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
      {children}
    </button>
  )
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}