import { useState, useEffect, useRef, useCallback } from 'react'
import { driversExtApi } from '@/api/driversExt'
import { trucksApi, trailersApi, driversApi } from '@/api/entities'
import { vendorsApi, scheduledTxApi } from '@/api/vendors'
import type { Vendor, ScheduledTransaction } from '@/api/vendors'
import type { Truck, Trailer, Driver } from '@/types'
import { formatDate } from '@/utils'
import toast from 'react-hot-toast'

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
const PAGE_SIZES = [10, 25, 50, 100]
const DOC_TYPES = [
  { key: 'application', label: 'Application' },
  { key: 'cdl', label: 'CDL' },
  { key: 'medical_card', label: 'Medical card' },
  { key: 'drug_test', label: 'Drug Test' },
  { key: 'mvr', label: 'MVR' },
  { key: 'ssn_card', label: 'SSN card' },
  { key: 'employment_verification', label: 'Employment verification' },
  { key: 'other', label: 'Other' },
]
const DRIVER_STATUSES = ['Applicant','Hired','On Leave','Terminated','Inactive']
const PAY_TYPES = [
  { v: 'per_mile', l: 'Per mile' },
  { v: 'freight_percentage', l: 'Freight percentage' },
  { v: 'flatpay', l: 'Flatpay' },
  { v: 'hourly', l: 'Hourly' },
]
const TX_CATEGORIES = [
  'Detention','Driver payments','Factoring Fee','Fuel','IFTA Tax','Insurance','Internet',
  'Legal & Professional','Lumper','NM/KY/NY/OR/CT miles tax','Office Expenses','Office Rent',
  'Other','Parking','Permits','Quick Pay fee','Rent','Repairs','Software','Supplies',
  'Telephone','Tolls','Travel','Truck Registration',
]

interface ExtDriver {
  id: number; name: string; phone?: string; email?: string
  driver_type: string; pay_rate_loaded: number; pay_rate_empty: number
  is_active: boolean; created_at?: string
  profile?: {
    first_name: string; last_name: string; date_of_birth?: string
    hire_date?: string; termination_date?: string
    address: string; address2: string; city: string; state: string; zip_code: string
    payable_to: string; co_driver_id?: number; co_driver_name?: string
    truck_id?: number; truck_unit?: string; trailer_id?: number; trailer_unit?: string
    fuel_card: string; ifta_handled: boolean; driver_status: string
    pay_type: string; per_extra_stop: number; freight_percentage: number
    flatpay: number; hourly_rate: number; notes: string
  }
  documents: DriverDoc[]
}

interface DriverDoc {
  id: number; doc_type: string; status?: string; doc_number?: string
  issue_date?: string; exp_date?: string; hire_date?: string; termination_date?: string
  notes?: string; filename?: string; created_at?: string
}

interface DriverFormState {
  first_name: string; last_name: string; date_of_birth: string
  phone: string; email: string; address: string; address2: string
  city: string; state: string; zip: string
  hire_date: string; term_date: string; driver_status: string
  truck_id: string; trailer_id: string; fuel_card: string; ifta_handled: boolean
  payable_to: string; co_driver_id: string; driver_type: string
  pay_type: string; per_mile: string; per_empty_mile: string
  per_extra_stop: string; freight_percentage: string; flatpay: string; hourly: string; notes: string
}

function emptyForm(): DriverFormState {
  return {
    first_name: '', last_name: '', date_of_birth: '', phone: '', email: '',
    address: '', address2: '', city: '', state: '', zip: '',
    hire_date: new Date().toISOString().slice(0, 10), term_date: '', driver_status: 'Hired',
    truck_id: '', trailer_id: '', fuel_card: '', ifta_handled: true,
    payable_to: '', co_driver_id: '', driver_type: 'Drv',
    pay_type: 'per_mile', per_mile: '0.65', per_empty_mile: '0.30',
    per_extra_stop: '0', freight_percentage: '0', flatpay: '0', hourly: '0', notes: '',
  }
}

function formFromExt(d: ExtDriver): DriverFormState {
  const p = d.profile
  return {
    first_name: p?.first_name || d.name.split(' ')[0] || '',
    last_name: p?.last_name || d.name.split(' ').slice(1).join(' ') || '',
    date_of_birth: p?.date_of_birth || '',
    phone: d.phone || '', email: d.email || '',
    address: p?.address || '', address2: p?.address2 || '',
    city: p?.city || '', state: p?.state || '', zip: p?.zip_code || '',
    hire_date: p?.hire_date || '', term_date: p?.termination_date || '',
    driver_status: p?.driver_status || 'Hired',
    truck_id: String(p?.truck_id || ''), trailer_id: String(p?.trailer_id || ''),
    fuel_card: p?.fuel_card || '', ifta_handled: p?.ifta_handled ?? true,
    payable_to: p?.payable_to || d.name,
    co_driver_id: String(p?.co_driver_id || ''),
    driver_type: d.driver_type || 'Drv',
    pay_type: p?.pay_type || 'per_mile',
    per_mile: String(d.pay_rate_loaded || 0.65),
    per_empty_mile: String(d.pay_rate_empty || 0.30),
    per_extra_stop: String(p?.per_extra_stop || 0),
    freight_percentage: String(p?.freight_percentage || 0),
    flatpay: String(p?.flatpay || 0),
    hourly: String(p?.hourly_rate || 0),
    notes: p?.notes || '',
  }
}

function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">{children}</button>
}

function FF({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function docWarnings(docs: DriverDoc[]): string[] {
  const warnings: string[] = []
  const today = new Date()
  const soon = new Date(today); soon.setDate(today.getDate() + 30)
  if (!docs.some(d => d.doc_type === 'cdl')) warnings.push('CDL missing')
  if (!docs.some(d => d.doc_type === 'medical_card')) warnings.push('Medical card missing')
  docs.forEach(doc => {
    if (doc.exp_date) {
      const exp = new Date(doc.exp_date)
      const label = DOC_TYPES.find(t => t.key === doc.doc_type)?.label || doc.doc_type
      if (exp < today) warnings.push(`${label} expired`)
      else if (exp < soon) warnings.push(`${label} expiring soon`)
    }
  })
  return warnings
}

// Icons
const IcoSearch = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
const IcoFilter = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2"/></svg>
const IcoPlus   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
const IcoEdit   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
const IcoTrash  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
const IcoX      = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
const IcoChk    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
const IcoWarn   = () => <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
const IcoPDF    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
const IcoChevD  = () => <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>

export default function DriversPage() {
  const [drivers, setDrivers] = useState<ExtDriver[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editDriver, setEditDriver] = useState<ExtDriver | 'new' | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize }
      if (search) params.search = search
      if (!showInactive) params.is_active = true
      if (filterType) params.driver_type = filterType
      if (filterStatus) params.driver_status = filterStatus
      const [res, t, tr, d] = await Promise.all([
        driversExtApi.list(params),
        trucksApi.list(),
        trailersApi.list(),
        driversApi.list(),
      ])
      const items = res.items || res
      setDrivers(items)
      setTotal(res.total ?? items.length)
      setTotalPages(res.total_pages ?? Math.max(1, Math.ceil((res.total ?? items.length) / pageSize)))
      setTrucks(t); setTrailers(tr); setAllDrivers(d)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [search, showInactive, filterType, filterStatus, page, pageSize])

  useEffect(() => { load() }, [load])

  const startEntry = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endEntry = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Drivers</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary gap-1.5 text-xs py-1.5"><IcoPDF /> PDF</button>
          <button className="btn-secondary gap-1.5 text-xs py-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18"/></svg> Excel
          </button>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IcoSearch /></span>
            <input type="text" placeholder="Search..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-brand-500 w-44" />
          </div>
          <button onClick={() => setShowFilter(v => !v)}
            className={`btn-secondary gap-1.5 text-sm ${showFilter ? 'border-brand-500 text-brand-600 bg-brand-50' : ''}`}>
            <IcoFilter /> Filter
          </button>
          <button onClick={() => setEditDriver('new')} className="btn-primary gap-1.5">
            <IcoPlus /> New Driver
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="flex items-end gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} className="select-base text-sm">
              <option value="">All Types</option>
              <option value="Drv">Company Driver</option>
              <option value="OO">Owner Operator</option>
            </select>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="select-base text-sm">
              <option value="">All Statuses</option>
              {DRIVER_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterType(''); setFilterStatus(''); setPage(1) }} className="btn-secondary text-sm">Clear All</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: 980 }}>
          <colgroup>
            <col style={{ width: '16%' }} /><col style={{ width: '6%' }} /><col style={{ width: '7%' }} />
            <col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} />
            <col style={{ width: '10%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} />
          </colgroup>
          <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <tr>
              {['NAME','TYPE','STATUS','HIRE DATE','TERM DATE','PHONE','EMAIL','TRUCK','TRAILER','PAYABLE TO','WARNINGS','ACTIONS'].map((h, i) => (
                <th key={i} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={12} className="py-16 text-center text-gray-400">Loading...</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={12} className="py-16 text-center text-gray-400">No drivers found</td></tr>
            ) : drivers.map(d => {
              const warnings = docWarnings(d.documents || [])
              const statusColor = d.profile?.driver_status === 'Terminated' ? 'text-red-600'
                : d.profile?.driver_status === 'Hired' ? 'text-green-700' : 'text-gray-600'
              return (
                <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditDriver(d)}>
                  <td className="table-td font-medium text-blue-600 truncate">
                    {d.name}{!d.is_active && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                  </td>
                  <td className="table-td">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${d.driver_type === 'OO' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                      {d.driver_type === 'OO' ? 'O/O' : 'Drv'}
                    </span>
                  </td>
                  <td className={`table-td text-xs font-medium ${statusColor}`}>{d.profile?.driver_status || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{formatDate(d.profile?.hire_date) || '—'}</td>
                  <td className="table-td text-xs text-gray-500">{formatDate(d.profile?.termination_date) || '—'}</td>
                  <td className="table-td text-xs truncate">{d.phone || '—'}</td>
                  <td className="table-td text-xs truncate">{d.email || '—'}</td>
                  <td className="table-td text-xs">{d.profile?.truck_unit || '—'}</td>
                  <td className="table-td text-xs">{d.profile?.trailer_unit || '—'}</td>
                  <td className="table-td text-xs truncate">{d.profile?.payable_to || d.name}</td>
                  <td className="table-td">
                    {warnings.length > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-yellow-600 cursor-help" title={warnings.join('\n')}>
                        <IcoWarn /> {warnings.length}
                      </div>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg>
                    )}
                  </td>
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditDriver(d)} className="p-1.5 border border-brand-200 text-brand-600 rounded hover:bg-brand-50 transition-colors">
                      <IcoEdit />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-2 bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <PagBtn onClick={() => setPage(1)} disabled={page <= 1}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg></PagBtn>
            <PagBtn onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg></PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page-2, totalPages-4)); return s+i }).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded font-medium ${p===page?'bg-brand-600 text-white':'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
            ))}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></PagBtn>
            <PagBtn onClick={() => setPage(totalPages)} disabled={page >= totalPages}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg></PagBtn>
          </div>
          <span className="text-xs text-gray-500">Showing {startEntry} to {endEntry} of {total} entries</span>
          <button onClick={() => { setShowInactive(v => !v); setPage(1) }}
            className={`text-xs underline ${showInactive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {showInactive ? 'Hide inactive drivers' : 'Show inactive drivers'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Show records</span>
          {PAGE_SIZES.map(n => (
            <button key={n} onClick={() => { setPageSize(n); setPage(1) }}
              className={`text-xs px-1.5 py-0.5 rounded ${pageSize===n?'text-brand-600 font-bold underline':'text-gray-500 hover:text-gray-700'}`}>{n}</button>
          ))}
          <span className="text-xs text-gray-500">on page</span>
        </div>
      </div>

      {editDriver !== null && (
        <DriverModal driver={editDriver === 'new' ? undefined : editDriver}
          trucks={trucks} trailers={trailers} allDrivers={allDrivers}
          onClose={() => setEditDriver(null)}
          onSaved={() => { setEditDriver(null); load() }} />
      )}
    </div>
  )
}

type PayTab = 'pay_rates' | 'scheduled' | 'additional_payee' | 'notes' | 'driver_app'

function DriverModal({ driver, trucks, trailers, allDrivers, onClose, onSaved }: {
  driver?: ExtDriver; trucks: Truck[]; trailers: Trailer[]; allDrivers: Driver[]
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!driver
  const [form, setForm] = useState<DriverFormState>(driver ? formFromExt(driver) : emptyForm())
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [payTab, setPayTab] = useState<PayTab>('pay_rates')
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({})
  const [driverDocs, setDriverDocs] = useState<DriverDoc[]>(driver?.documents || [])
  const [showAddDoc, setShowAddDoc] = useState<string | null>(null)
  const [addDocForm, setAddDocForm] = useState<Record<string, string>>({})
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [scheduledTxs, setScheduledTxs] = useState<ScheduledTransaction[]>([])
  const [showTxModal, setShowTxModal] = useState(false)
  const [editTx, setEditTx] = useState<ScheduledTransaction | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    vendorsApi.list({ is_active: true }).then(setVendors).catch(() => {})
    if (isEdit && driver) scheduledTxApi.list(driver.id).then(setScheduledTxs).catch(() => {})
  }, [driver, isEdit])

  const set = (k: keyof DriverFormState, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const name = `${form.first_name} ${form.last_name}`.trim()
      const payload: Record<string, unknown> = {
        name, first_name: form.first_name, last_name: form.last_name,
        phone: form.phone || undefined, email: form.email || undefined,
        driver_type: form.driver_type,
        pay_rate_loaded: parseFloat(form.per_mile) || 0.65,
        pay_rate_empty: parseFloat(form.per_empty_mile) || 0.30,
        is_active: form.driver_status !== 'Terminated',
        date_of_birth: form.date_of_birth || undefined,
        hire_date: form.hire_date || undefined,
        termination_date: form.term_date || undefined,
        address: form.address, address2: form.address2,
        city: form.city, state: form.state, zip_code: form.zip,
        payable_to: form.payable_to || name,
        co_driver_id: form.co_driver_id ? parseInt(form.co_driver_id) : undefined,
        truck_id: form.truck_id ? parseInt(form.truck_id) : undefined,
        trailer_id: form.trailer_id ? parseInt(form.trailer_id) : undefined,
        fuel_card: form.fuel_card, ifta_handled: form.ifta_handled,
        driver_status: form.driver_status, pay_type: form.pay_type,
        per_extra_stop: parseFloat(form.per_extra_stop) || 0,
        freight_percentage: parseFloat(form.freight_percentage) || 0,
        flatpay: parseFloat(form.flatpay) || 0,
        hourly_rate: parseFloat(form.hourly) || 0,
        notes: form.notes,
      }
      if (isEdit && driver) { await driversExtApi.update(driver.id, payload); toast.success('Driver updated') }
      else { await driversExtApi.create(payload); toast.success('Driver created') }
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleAddDoc = async (docType: string) => {
    if (!isEdit || !driver) { toast.error('Save the driver first to add documents'); return }
    try {
      const fieldMap: Record<string, string> = {
        doc_number: 'number', hire_date: 'hire_date', termination_date: 'termination_date',
        issue_date: 'issue_date', exp_date: 'exp_date', status: 'status',
        notes: 'notes', name: 'name', state: 'state', application_date: 'application_date',
      }
      const payload: Record<string, string | undefined> = { doc_type: docType }
      Object.entries(addDocForm).forEach(([k, v]) => { if (v) payload[fieldMap[k] || k] = v })
      const doc = await driversExtApi.addDocument(driver.id, payload as Parameters<typeof driversExtApi.addDocument>[1])
      setDriverDocs(prev => [...prev, doc as DriverDoc])
      setShowAddDoc(null); setAddDocForm({})
      toast.success('Document added')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!driver) return
    try {
      await driversExtApi.deleteDocument(driver.id, docId)
      setDriverDocs(prev => prev.filter(d => d.id !== docId))
      toast.success('Document deleted')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const reloadTxs = () => { if (driver) scheduledTxApi.list(driver.id).then(setScheduledTxs).catch(() => {}) }

  const PAY_TABS: { key: PayTab; label: string }[] = [
    { key: 'pay_rates', label: 'Pay rates' },
    { key: 'scheduled', label: 'Scheduled payments/deductions' },
    { key: 'additional_payee', label: 'Additional payee' },
    { key: 'notes', label: 'Notes' },
    { key: 'driver_app', label: 'Driver App' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[960px] bg-white flex flex-col h-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Driver' : 'New Driver'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"><IcoX /></button>
        </div>

        {!isEdit && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-100 rounded text-sm flex-shrink-0">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-gray-600">Need Help? Watch our quick video tutorial on </span>
            <a href="#" className="text-brand-600 font-medium hover:underline">How to create and manage drivers.</a>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex gap-6 mb-5">
            <div className="flex-shrink-0">
              <div className="relative w-28 h-28 rounded-full overflow-hidden bg-[#3d4f6e] flex items-center justify-center">
                {photo ? <img src={photo} alt="" className="w-full h-full object-cover" />
                  : <svg className="w-16 h-16 text-[#5a7199]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
                <button onClick={() => photoRef.current?.click()}
                  className="absolute bottom-0 left-0 right-0 bg-brand-600 text-white text-xs font-medium py-1.5 text-center hover:bg-brand-700">Update photo</button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target?.result as string); r.readAsDataURL(f) } }} />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="space-y-3">
                <FF label="First Name" required><input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="input-base text-sm" /></FF>
                <FF label="Last Name"><input value={form.last_name} onChange={e => set('last_name', e.target.value)} className="input-base text-sm" /></FF>
                <FF label="Date of Birth"><input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} className="input-base text-sm" /></FF>
              </div>
              <div className="space-y-3">
                <FF label="Status">
                  <div className="flex items-center gap-2">
                    <select value={form.driver_status} onChange={e => set('driver_status', e.target.value)} className="select-base text-sm flex-1">
                      {DRIVER_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    {isEdit && <button className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50 flex-shrink-0">Terminate</button>}
                  </div>
                </FF>
                <FF label="Payable to">
                  <div className="flex gap-2 items-center">
                    <select value={form.payable_to} onChange={e => set('payable_to', e.target.value)} className="select-base text-sm flex-1">
                      <option value={`${form.first_name} ${form.last_name}`.trim()}>{form.first_name} {form.last_name}</option>
                      {vendors.map(v => <option key={v.id} value={v.company_name}>{v.company_name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowVendorModal(true)} className="text-brand-600 text-xs hover:underline whitespace-nowrap flex-shrink-0">+ New vendor</button>
                  </div>
                </FF>
                <FF label="Co-Driver">
                  <select value={form.co_driver_id} onChange={e => set('co_driver_id', e.target.value)} className="select-base text-sm">
                    <option value=""></option>
                    {allDrivers.map(d => <option key={d.id} value={d.id}>{d.name} [{d.driver_type}]</option>)}
                  </select>
                </FF>
                <div className="grid grid-cols-2 gap-3">
                  <FF label="Truck">
                    <select value={form.truck_id} onChange={e => set('truck_id', e.target.value)} className="select-base text-sm">
                      <option value=""></option>
                      {trucks.map(t => <option key={t.id} value={t.id}>{t.unit_number}</option>)}
                    </select>
                  </FF>
                  <FF label="Trailer">
                    <select value={form.trailer_id} onChange={e => set('trailer_id', e.target.value)} className="select-base text-sm">
                      <option value=""></option>
                      {trailers.map(t => <option key={t.id} value={t.id}>{t.unit_number}</option>)}
                    </select>
                  </FF>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <FF label="Hire Date"><input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="input-base text-sm" /></FF>
            <FF label="Termination Date"><input type="date" value={form.term_date} onChange={e => set('term_date', e.target.value)} className="input-base text-sm" /></FF>
            <FF label="Driver Type">
              <select value={form.driver_type} onChange={e => set('driver_type', e.target.value)} className="select-base text-sm">
                <option value="Drv">Company Driver [Drv]</option>
                <option value="OO">Owner Operator [OO]</option>
              </select>
            </FF>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
            <FF label="Phone">
              <div className="relative">
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="input-base text-sm pl-8" />
              </div>
            </FF>
            <FF label="Email">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">@</span>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-base text-sm pl-7" />
              </div>
            </FF>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
            <div className="space-y-3">
              <FF label="Address"><input value={form.address} onChange={e => set('address', e.target.value)} className="input-base text-sm" /></FF>
              <FF label="Address line 2"><input value={form.address2} onChange={e => set('address2', e.target.value)} className="input-base text-sm" /></FF>
              <div className="grid grid-cols-3 gap-2">
                <FF label="City"><input value={form.city} onChange={e => set('city', e.target.value)} className="input-base text-sm" /></FF>
                <FF label="State">
                  <select value={form.state} onChange={e => set('state', e.target.value)} className="select-base text-sm">
                    <option value=""></option>
                    {STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FF>
                <FF label="Zip"><input value={form.zip} onChange={e => set('zip', e.target.value)} className="input-base text-sm" /></FF>
              </div>
            </div>
            <div className="space-y-3">
              <FF label="Fuel card #"><input value={form.fuel_card} onChange={e => set('fuel_card', e.target.value)} className="input-base text-sm" placeholder="Fuel card number..." /></FF>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.ifta_handled} onChange={e => set('ifta_handled', e.target.checked)} className="rounded accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700">IFTA handled by Company</span>
              </label>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">Documents</h3>
            <div className="border border-gray-200 rounded divide-y divide-gray-100">
              {DOC_TYPES.map(dt => {
                const docs = driverDocs.filter(d => d.doc_type === dt.key)
                const hasDoc = docs.length > 0
                const hasExpired = docs.some(d => d.exp_date && new Date(d.exp_date) < new Date())
                const isOpen = expandedDocs[dt.key]
                return (
                  <div key={dt.key}>
                    <button onClick={() => setExpandedDocs(p => ({ ...p, [dt.key]: !p[dt.key] }))}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {hasExpired ? <IcoWarn />
                          : hasDoc ? <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg>
                          : <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>}
                        <span className="text-sm font-semibold text-gray-800">{dt.label}</span>
                        {!hasDoc && <span className="text-xs text-gray-400">(No documents)</span>}
                        {hasExpired && <span className="text-xs text-red-500 font-medium ml-1">— Expired</span>}
                      </div>
                      <IcoChevD />
                    </button>
                    {isOpen && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="flex justify-end mb-2">
                          <button onClick={() => { setShowAddDoc(dt.key); setAddDocForm({}) }} className="btn-primary text-xs py-1 px-3">+ Add</button>
                        </div>
                        {showAddDoc === dt.key && (
                          <div className="mb-3 p-3 bg-white border border-gray-200 rounded">
                            <DocAddForm docType={dt.key} form={addDocForm} setForm={setAddDocForm}
                              onSave={() => handleAddDoc(dt.key)} onCancel={() => setShowAddDoc(null)} />
                          </div>
                        )}
                        <DocTable docType={dt.key} docs={docs} onDelete={handleDeleteDoc} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!isEdit && (
              <p className="mt-2 text-center text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5 border border-gray-200">
                Documents will be available for adding and editing after saving a driver.
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {PAY_TABS.map(tab => (
                <button key={tab.key} onClick={() => setPayTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${payTab===tab.key?'border-brand-600 text-brand-600':'border-transparent text-gray-500 hover:text-brand-500'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {payTab === 'pay_rates' && (
                <div>
                  <div className="flex gap-6 mb-4">
                    {[{v:'Drv',l:'Company driver'},{v:'OO',l:'Owner operator'}].map(o => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="dr_type" value={o.v} checked={form.driver_type===o.v} onChange={() => set('driver_type',o.v)} className="accent-brand-600 w-4 h-4" />
                        <span className="text-sm text-gray-700">{o.l}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-6 mb-4 flex-wrap">
                    {PAY_TYPES.map(o => (
                      <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="pay_type" value={o.v} checked={form.pay_type===o.v} onChange={() => set('pay_type',o.v)} className="accent-brand-600 w-4 h-4" />
                        <span className="text-sm text-gray-700">{o.l}</span>
                      </label>
                    ))}
                  </div>
                  {form.pay_type==='per_mile' && (
                    <div className="grid grid-cols-3 gap-4">
                      <FF label="Per mile ($)"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.per_mile} onChange={e=>set('per_mile',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
                      <FF label="Per empty mile ($)"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.per_empty_mile} onChange={e=>set('per_empty_mile',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
                      <FF label="Per extra stop ($)"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.per_extra_stop} onChange={e=>set('per_extra_stop',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
                    </div>
                  )}
                  {form.pay_type==='freight_percentage' && (
                    <div className="grid grid-cols-2 gap-4">
                      <FF label="Freight % (0-100)"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span><input type="number" step="0.1" min="0" max="100" value={form.freight_percentage} onChange={e=>set('freight_percentage',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
                      <FF label="Per extra stop ($)"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.per_extra_stop} onChange={e=>set('per_extra_stop',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
                    </div>
                  )}
                  {form.pay_type==='flatpay' && <FF label="Flat pay ($)"><div className="relative w-48"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.flatpay} onChange={e=>set('flatpay',e.target.value)} className="input-base text-sm pl-6"/></div></FF>}
                  {form.pay_type==='hourly' && <FF label="Hourly rate ($/hr)"><div className="relative w-48"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" value={form.hourly} onChange={e=>set('hourly',e.target.value)} className="input-base text-sm pl-6"/></div></FF>}
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <strong>Note:</strong> Changing pay rates only affects future/open loads. Settled loads preserve their historical snapshot values.
                  </div>
                </div>
              )}
              {payTab==='scheduled' && (
                <div>
                  {!isEdit ? <div className="py-6 text-center text-sm text-gray-400">Save driver first to configure scheduled payments.</div> : (
                    <>
                      <div className="flex justify-end mb-3">
                        <button onClick={() => { setEditTx(null); setShowTxModal(true) }} className="btn-primary gap-1.5 text-xs"><IcoPlus /> Add</button>
                      </div>
                      {scheduledTxs.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">No scheduled transactions</div> : (
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-gray-200">{['Category','Amount','Schedule','Last','Next','Active','Notes',''].map((h,i)=><th key={i} className="px-2 py-2 text-left text-gray-500 font-semibold uppercase">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-gray-100">
                            {scheduledTxs.map(tx => (
                              <tr key={tx.id} className="hover:bg-gray-50">
                                <td className="px-2 py-2"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${tx.trans_type==='deduction'?'bg-red-50 text-red-700':'bg-green-50 text-green-700'}`}>{tx.category||tx.trans_type}</span></td>
                                <td className="px-2 py-2 font-medium">{tx.trans_type==='deduction'?'-':'+'}${tx.amount.toFixed(2)}</td>
                                <td className="px-2 py-2 text-gray-600">{tx.schedule||'—'}</td>
                                <td className="px-2 py-2 text-gray-500">{formatDate(tx.last_applied)||'—'}</td>
                                <td className="px-2 py-2 text-gray-500">{formatDate(tx.next_due)||'—'}</td>
                                <td className="px-2 py-2"><span className={`inline-block w-2 h-2 rounded-full ${tx.is_active?'bg-green-500':'bg-gray-300'}`}/></td>
                                <td className="px-2 py-2 text-gray-400 truncate max-w-[120px]">{tx.notes||'—'}</td>
                                <td className="px-2 py-2">
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditTx(tx); setShowTxModal(true) }} className="text-brand-500 hover:text-brand-700"><IcoEdit /></button>
                                    <button onClick={async () => { if (!driver) return; await scheduledTxApi.delete(driver.id, tx.id); reloadTxs(); toast.success('Removed') }} className="text-red-400 hover:text-red-600"><IcoTrash /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </div>
              )}
              {payTab==='additional_payee' && (
                !isEdit ? <div className="py-6 text-center text-sm text-gray-400">Save driver first.</div> : (
                  <div className="p-4 border border-gray-200 rounded">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Equipment Owner / Additional Payee</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FF label="Payable to (Vendor)">
                        <select className="select-base text-sm"><option value=""></option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company_name}</option>)}</select>
                      </FF>
                      <FF label="Additional payee rate %"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span><input type="number" step="0.1" className="input-base text-sm pl-6" placeholder="0"/></div></FF>
                    </div>
                    <div className="mt-3"><button onClick={() => setShowVendorModal(true)} className="text-brand-600 text-sm hover:underline">+ Create new vendor</button></div>
                  </div>
                )
              )}
              {payTab==='notes' && <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} className="input-base text-sm w-full h-28 resize-none" placeholder="Driver notes..."/>}
              {payTab==='driver_app' && <div className="py-6 text-center text-sm text-gray-400">Driver app integration — coming soon.</div>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900"><IcoX /> Close</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2"><IcoChk /> {saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {showVendorModal && (
        <VendorModal onClose={() => setShowVendorModal(false)}
          onSaved={v => { setVendors(prev => [...prev, v]); set('payable_to', v.company_name); setShowVendorModal(false); toast.success(`Vendor created`) }} />
      )}
      {showTxModal && driver && (
        <ScheduledTxModal driverId={driver.id} tx={editTx}
          onClose={() => { setShowTxModal(false); setEditTx(null) }}
          onSaved={() => { setShowTxModal(false); setEditTx(null); reloadTxs() }} />
      )}
    </div>
  )
}

function DocTable({ docType, docs, onDelete }: { docType: string; docs: DriverDoc[]; onDelete: (id: number) => void }) {
  const colsByType: Record<string, string[]> = {
    application: ['STATUS','HIRE DATE','TERM DATE'], cdl: ['NUMBER','ISSUE DATE','EXP DATE'],
    medical_card: ['NUMBER','ISSUE DATE','EXP DATE'], drug_test: ['STATUS','DATE','NOTES'],
    mvr: ['DATE'], ssn_card: ['NUMBER'],
    employment_verification: ['STATUS','DATE','NOTES'], other: ['EXP DATE','NOTES'],
  }
  const cols = colsByType[docType] || []
  if (docs.length === 0) return <p className="text-xs text-gray-400 text-center py-3">No records</p>
  const getVal = (col: string, doc: DriverDoc): string => {
    switch (col) {
      case 'STATUS': return doc.status||'—'
      case 'HIRE DATE': return formatDate(doc.hire_date)||'—'
      case 'TERM DATE': return formatDate(doc.termination_date)||'—'
      case 'NUMBER': return doc.doc_number||'—'
      case 'ISSUE DATE': return formatDate(doc.issue_date)||'—'
      case 'EXP DATE': { if (!doc.exp_date) return '—'; const isExp = new Date(doc.exp_date)<new Date(); return formatDate(doc.exp_date)+(isExp?' ⚠':'') }
      case 'DATE': return formatDate(doc.issue_date||doc.hire_date)||'—'
      case 'NOTES': return doc.notes||'—'
      default: return '—'
    }
  }
  return (
    <table className="w-full text-xs">
      <thead><tr className="border-b border-gray-200">{cols.map(c=><th key={c} className="text-left py-1.5 pr-4 text-gray-500 font-semibold uppercase tracking-wide">{c}</th>)}<th className="text-left py-1.5 text-gray-500 font-semibold uppercase">FILE</th><th className="w-12"/></tr></thead>
      <tbody>
        {docs.map(doc=>(
          <tr key={doc.id} className="border-b border-gray-100 last:border-0 hover:bg-white/60">
            {cols.map(col=><td key={col} className="py-2 pr-4 text-gray-700">{getVal(col,doc)}</td>)}
            <td className="py-2 pr-4">{doc.filename?<span className="text-brand-600 text-xs cursor-pointer hover:underline">{doc.filename}</span>:<span className="text-xs text-gray-400">—</span>}</td>
            <td className="py-2"><div className="flex items-center gap-1"><button className="text-brand-400 hover:text-brand-600"><IcoEdit/></button><button onClick={()=>onDelete(doc.id)} className="text-red-400 hover:text-red-600"><IcoTrash/></button></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DocAddForm({ docType, form, setForm, onSave, onCancel }: {
  docType: string; form: Record<string,string>; setForm: React.Dispatch<React.SetStateAction<Record<string,string>>>; onSave: ()=>void; onCancel: ()=>void
}) {
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fieldsByType: Record<string, {key:string;label:string;type?:string}[]> = {
    application: [{key:'status',label:'Status'},{key:'hire_date',label:'Hire Date',type:'date'},{key:'termination_date',label:'Term Date',type:'date'}],
    cdl: [{key:'doc_number',label:'Number'},{key:'issue_date',label:'Issue Date',type:'date'},{key:'exp_date',label:'Exp Date',type:'date'}],
    medical_card: [{key:'doc_number',label:'Number'},{key:'issue_date',label:'Issue Date',type:'date'},{key:'exp_date',label:'Exp Date',type:'date'}],
    drug_test: [{key:'status',label:'Status'},{key:'issue_date',label:'Date',type:'date'},{key:'notes',label:'Notes'}],
    mvr: [{key:'issue_date',label:'Date',type:'date'}],
    ssn_card: [{key:'doc_number',label:'Number'}],
    employment_verification: [{key:'status',label:'Status'},{key:'issue_date',label:'Date',type:'date'},{key:'notes',label:'Notes'}],
    other: [{key:'exp_date',label:'Exp Date',type:'date'},{key:'notes',label:'Notes'}],
  }
  const fields = fieldsByType[docType] || []
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {fields.map(f=>(
          <div key={f.key}><label className="block text-xs font-medium text-gray-600 mb-0.5">{f.label}</label><input type={f.type||'text'} value={form[f.key]||''} onChange={e=>set(f.key,e.target.value)} className="input-base text-sm"/></div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="btn-primary text-xs py-1 px-3"><IcoChk/> Save</button>
        <button onClick={onCancel} className="btn-secondary text-xs py-1 px-3">Cancel</button>
      </div>
    </div>
  )
}

function VendorModal({ onClose, onSaved }: { onClose: ()=>void; onSaved: (v: Vendor)=>void }) {
  const [form, setForm] = useState({ company_name:'', vendor_type:'individual', address:'', address2:'', city:'', state:'', zip_code:'', phone:'', email:'', fid_ein:'', mc_number:'', notes:'', is_equipment_owner:false, is_additional_payee:false, additional_payee_rate_pct:'', settlement_template_type:'' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string|boolean) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      const vendor = await vendorsApi.create({ ...form, additional_payee_rate_pct: form.additional_payee_rate_pct?parseFloat(form.additional_payee_rate_pct):undefined, is_active:true })
      onSaved(vendor)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10"><h3 className="font-bold text-gray-900">New Vendor / Payable To</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX/></button></div>
        <div className="px-6 py-4 space-y-3">
          <FF label="Company Name" required><input value={form.company_name} onChange={e=>set('company_name',e.target.value)} className="input-base text-sm"/></FF>
          <FF label="Vendor Type">
            <select value={form.vendor_type} onChange={e=>set('vendor_type',e.target.value)} className="select-base text-sm">
              <option value="individual">Individual</option><option value="company">Company</option><option value="owner_operator">Owner Operator</option>
            </select>
          </FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Phone"><input value={form.phone} onChange={e=>set('phone',e.target.value)} className="input-base text-sm"/></FF>
            <FF label="Email"><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className="input-base text-sm"/></FF>
          </div>
          <FF label="Address"><input value={form.address} onChange={e=>set('address',e.target.value)} className="input-base text-sm"/></FF>
          <FF label="Address line 2"><input value={form.address2} onChange={e=>set('address2',e.target.value)} className="input-base text-sm"/></FF>
          <div className="grid grid-cols-3 gap-3">
            <FF label="City"><input value={form.city} onChange={e=>set('city',e.target.value)} className="input-base text-sm"/></FF>
            <FF label="State"><select value={form.state} onChange={e=>set('state',e.target.value)} className="select-base text-sm"><option value=""></option>{STATES.map(s=><option key={s}>{s}</option>)}</select></FF>
            <FF label="Zip"><input value={form.zip_code} onChange={e=>set('zip_code',e.target.value)} className="input-base text-sm"/></FF>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FF label="FID/EIN"><input value={form.fid_ein} onChange={e=>set('fid_ein',e.target.value)} className="input-base text-sm"/></FF>
            <FF label="MC #"><input value={form.mc_number} onChange={e=>set('mc_number',e.target.value)} className="input-base text-sm"/></FF>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Settlement Template">
              <select value={form.settlement_template_type} onChange={e=>set('settlement_template_type',e.target.value)} className="select-base text-sm">
                <option value="">Default</option><option value="owner_operator">Owner Operator</option><option value="company_driver">Company Driver</option>
              </select>
            </FF>
            <FF label="Additional Payee Rate %"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span><input type="number" step="0.1" value={form.additional_payee_rate_pct} onChange={e=>set('additional_payee_rate_pct',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_equipment_owner} onChange={e=>set('is_equipment_owner',e.target.checked)} className="rounded accent-brand-600 w-4 h-4"/><span className="text-sm text-gray-700">Equipment owner</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_additional_payee} onChange={e=>set('is_additional_payee',e.target.checked)} className="rounded accent-brand-600 w-4 h-4"/><span className="text-sm text-gray-700">Additional payee</span></label>
          </div>
          <FF label="Notes"><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} className="input-base text-sm resize-none"/></FF>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"><IcoX/> Close</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5"><IcoChk/> {saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function ScheduledTxModal({ driverId, tx, onClose, onSaved }: { driverId:number; tx:ScheduledTransaction|null; onClose:()=>void; onSaved:()=>void }) {
  const isEdit = !!tx
  const [form, setForm] = useState({ trans_type:tx?.trans_type||'deduction', category:tx?.category||'', description:tx?.description||'', amount:String(tx?.amount||''), schedule:tx?.schedule||'monthly', start_date:tx?.start_date||new Date().toISOString().slice(0,10), end_date:tx?.end_date||'', repeat_type:tx?.repeat_type||'always', repeat_times:String(tx?.repeat_times||''), payable_to:tx?.payable_to||'', settlement_description:tx?.settlement_description||'', notes:tx?.notes||'', is_active:tx?.is_active??true })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string|boolean) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => {
    if (!form.amount) { toast.error('Amount is required'); return }
    setSaving(true)
    try {
      const payload = { driver_id:driverId, trans_type:form.trans_type, category:form.category||undefined, description:form.description||undefined, amount:parseFloat(form.amount), schedule:form.schedule||undefined, start_date:form.start_date||undefined, end_date:form.end_date||undefined, repeat_type:form.repeat_type, repeat_times:form.repeat_times?parseInt(form.repeat_times):undefined, payable_to:form.payable_to||undefined, settlement_description:form.settlement_description||undefined, notes:form.notes||undefined, is_active:form.is_active }
      if (isEdit && tx) { await scheduledTxApi.update(driverId, tx.id, payload); toast.success('Updated') }
      else { await scheduledTxApi.create(driverId, payload); toast.success('Scheduled transaction added') }
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10"><h3 className="font-bold text-gray-900">{isEdit?'Edit':'New'} Scheduled Transaction</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX/></button></div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FF label="Type"><select value={form.trans_type} onChange={e=>set('trans_type',e.target.value)} className="select-base text-sm"><option value="addition">Addition</option><option value="deduction">Deduction</option><option value="loan">Driver loan</option><option value="escrow">Escrow</option></select></FF>
            <FF label="Category"><select value={form.category} onChange={e=>set('category',e.target.value)} className="select-base text-sm"><option value=""></option>{TX_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></FF>
          </div>
          <FF label="Amount ($)" required><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" step="0.01" min="0" value={form.amount} onChange={e=>set('amount',e.target.value)} className="input-base text-sm pl-6"/></div></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Schedule"><select value={form.schedule} onChange={e=>set('schedule',e.target.value)} className="select-base text-sm"><option value="daily">Every day</option><option value="weekly">Every week</option><option value="biweekly">Every other week</option><option value="monthly">Every month</option><option value="annually">Annually</option></select></FF>
            <FF label="Start On"><input type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} className="input-base text-sm"/></FF>
          </div>
          <FF label="Repeat">
            <div className="flex gap-4">
              {[{v:'always',l:'Always'},{v:'times',l:'Number of times'},{v:'until',l:'Until the date'}].map(o=>(
                <label key={o.v} className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="repeat_type" value={o.v} checked={form.repeat_type===o.v} onChange={()=>set('repeat_type',o.v)} className="accent-brand-600"/><span className="text-sm text-gray-700">{o.l}</span></label>
              ))}
            </div>
          </FF>
          {form.repeat_type==='times' && <FF label="Number of times"><input type="number" min="1" value={form.repeat_times} onChange={e=>set('repeat_times',e.target.value)} className="input-base text-sm w-32"/></FF>}
          {form.repeat_type==='until' && <FF label="Until date"><input type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} className="input-base text-sm"/></FF>}
          <FF label="Description"><input value={form.description} onChange={e=>set('description',e.target.value)} className="input-base text-sm" placeholder="Appears on settlement..."/></FF>
          <FF label="Notes"><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} className="input-base text-sm resize-none"/></FF>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} className="rounded accent-brand-600 w-4 h-4"/><span className="text-sm text-gray-700">Active</span></label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"><IcoX/> Close</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5"><IcoChk/> {saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  )
}
