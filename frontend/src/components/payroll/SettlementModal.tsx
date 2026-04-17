import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'
import { payrollApi } from '@/api/payroll'
import type { Settlement, SettlementItem, SettlementAdjustment, SettlementPayment, SettlementHistory } from '@/api/payroll'
import { formatCurrency, formatDate, formatDateTime } from '@/utils'
import type { Driver } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  settlementId: number
  onClose: () => void
  onSaved: () => void
  drivers: Driver[]
  onBackToOpenBalance?: () => void
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoX        = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
const IcoCheck    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
const IcoPlus     = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
const IcoMinus    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
const IcoPencil   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
const IcoDown     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
const IcoTrash    = () => <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
const IcoDownload = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
const IcoMail     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
const IcoHistory  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
const IcoQB       = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
const IcoBack     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
const IcoCarry    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
const IcoHoS      = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
const IcoExpand   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>

const STATUS_OPTS = ['Preparing', 'Ready', 'Sent', 'Paid', 'Void']
const STATUS_LABEL: Record<string,string> = {
  'Ready': 'Ready for payment', 'Preparing': 'Preparing', 'Paid': 'Paid', 'Sent': 'Sent', 'Void': 'Void'
}
const ADJ_CATEGORIES = [
  'Detention','Driver payments','Factoring Fee','Fuel','IFTA Tax','Insurance',
  'Internet','Legal & Professional','Lumper','NM/KY/NY/OR/CT miles tax',
  'Office Expenses','Other','Parking','Permits','Quick Pay fee','Software',
  'Supplies','Telephone','Tolls','Travel','Truck Registration',
]

// ── TH helper ─────────────────────────────────────────────────────────────────
function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ' + (right ? 'text-right' : '')}>
      {children}
    </th>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function SettlementModal({ settlementId, onClose, onSaved, drivers, onBackToOpenBalance }: Props) {
  const [settlement, setSettlement] = useState<Settlement|null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [dirty, setDirty]           = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showEmail, setShowEmail]   = useState(false)
  const [showAdjModal, setShowAdjModal] = useState<'addition'|'deduction'|null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showCarryModal, setShowCarryModal] = useState(false)
  const [form, setForm] = useState({ driver_id: '', status: '', date: '', payable_to: '' })

  const pdfUrl = payrollApi.getPdfUrl(settlementId)

  const refetch = useCallback(() => {
    return payrollApi.get(settlementId)
      .then(data => {
        setSettlement(data)
        setForm({ driver_id: String(data.driver_id), status: data.status, date: data.date, payable_to: data.payable_to || '' })
        setDirty(false)
      })
      .catch(e => toast.error(e.message))
  }, [settlementId])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const setFF = (k: keyof typeof form, v: string) => { setForm(p=>({...p,[k]:v})); setDirty(true) }

  const handleSave = () => {
    if (!settlement) return
    setSaving(true)
    payrollApi.update(settlementId, {
      driver_id: parseInt(form.driver_id) || settlement.driver_id,
      status: form.status, date: form.date,
      payable_to: form.payable_to || undefined,
    })
      .then(() => { toast.success('Settlement saved'); setDirty(false); onSaved() })
      .catch(e => toast.error(e.message))
      .finally(() => setSaving(false))
  }

  const handleAddItem = (loadId: number) => {
    payrollApi.addLoadItem(settlementId, loadId)
      .then(() => refetch())
      .then(() => toast.success('Load added'))
      .catch(e => toast.error(e.message))
  }

  const handleRemoveItem = (itemId: number) => {
    if (!confirm('Remove this load from the settlement?')) return
    payrollApi.removeItem(settlementId, itemId)
      .then(() => refetch())
      .catch(e => toast.error(e.message))
  }

  const handleDeleteAdj = (adjId: number) => {
    payrollApi.deleteAdjustment(settlementId, adjId)
      .then(() => refetch())
      .catch(e => toast.error(e.message))
  }

  const handleDeletePayment = (paymentId: number) => {
    if (!confirm('Delete this payment?')) return
    payrollApi.deletePayment(settlementId, paymentId)
      .then(() => { refetch(); toast.success('Payment deleted') })
      .catch(e => toast.error(e.message))
  }

  const handleExportQB = () => {
    payrollApi.exportQB(settlementId)
      .then(() => { refetch(); toast.success('Exported to QuickBooks') })
      .catch(e => toast.error(e.message))
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose}/>
      <div className="w-[1060px] bg-white flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
          <span className="text-sm">Loading settlement...</span>
        </div>
      </div>
    </div>
  )
  if (!settlement) return null

  const loadItems       = settlement.items.filter(i => i.item_type === 'load')
  const paymentsTotal   = settlement.payments.reduce((a,p) => a + p.amount, 0)
  const currentLoadIds  = loadItems.map(i => i.load_id).filter(Boolean) as number[]

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={() => { if (!dirty) onClose() }}/>
        <div className="w-[1060px] bg-white flex flex-col h-full shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900 text-sm">
                {settlement.id === -1 ? 'New Settlement' : 'Edit Settlement #' + settlement.settlement_number}
              </h2>
              {dirty && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10"/></svg>
                  Unsaved Changes
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"><IcoX /></button>
          </div>

          {/* ── Help banner ── */}
          <div className="flex items-center gap-2 px-6 py-2 bg-purple-50 border-b border-purple-100 flex-shrink-0">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-sm text-gray-600">
              Need Help? Watch our quick video tutorial on{' '}
              <a href="#" className="text-blue-600 font-medium hover:underline">How to create and manage driver payroll settlements.</a>
            </p>
          </div>

          {/* ── Top form ── */}
          <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-60">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Driver</label>
                <select value={form.driver_id} onChange={e=>setFF('driver_id',e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-brand-500">
                  {drivers.map(d=><option key={d.id} value={d.id}>{d.name} [{d.driver_type}]</option>)}
                </select>
              </div>
              <div className="w-52">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Settlement Status <span className="text-red-500">*</span></label>
                <select value={form.status} onChange={e=>setFF('status',e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500">
                  {STATUS_OPTS.map(s=><option key={s} value={s}>{STATUS_LABEL[s]||s}</option>)}
                </select>
              </div>
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={e=>setFF('date',e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500"/>
              </div>
              <div className="w-52">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payable to <span className="text-red-500">*</span></label>
                <select value={form.payable_to} onChange={e=>setFF('payable_to',e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500">
                  <option value=""></option>
                  {drivers.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

            {/* ── Report HoS button ── */}
            <div className="flex justify-end">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded">
                <IcoHoS /> Report HoS
              </button>
            </div>

            {/* ── A. Available Loads (open loads for this driver) ── */}
            <AvailableLoadsSection
              driverId={parseInt(form.driver_id) || settlement.driver_id}
              currentLoadIds={currentLoadIds}
              onAdd={handleAddItem}
            />

            {/* ── B. Advanced Payments ── */}
            <section>
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Advanced Payments</h3>
              <SectionTable cols={['DATE','PAYMENT #','DESCRIPTION','AMOUNT']} rightLast>
                <tr><td colSpan={4} className="py-5 text-center text-gray-400 text-xs">No records</td></tr>
              </SectionTable>
            </section>

            {/* ── C. Driver Settlement (loads added + adjustments) ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                    Driver Settlement #{settlement.settlement_number}
                    <button className="text-brand-500 hover:text-brand-700"><IcoPencil /></button>
                  </h3>
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <IcoDownload /> Download as PDF
                  </a>
                  <button onClick={() => setShowEmail(true)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <IcoMail /> Email
                  </button>
                  <button onClick={() => setShowHistory(v=>!v)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <IcoHistory /> History
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAdjModal('addition')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded">
                    <IcoPlus /> Addition
                  </button>
                  <button onClick={() => setShowAdjModal('deduction')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded">
                    <IcoMinus /> Deduction
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <TH>Date</TH><TH>Delivery</TH><TH>Load #</TH>
                      <TH>Description</TH><TH>Status</TH>
                      <TH>Billing Status</TH><TH right>Amount</TH>
                      <th className="w-10"/>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadItems.map(item => (
                      <LoadItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item.id)}/>
                    ))}
                    {settlement.adjustments.map(adj => (
                      <AdjRow key={adj.id} adj={adj} onDelete={() => handleDeleteAdj(adj.id)}/>
                    ))}
                    {loadItems.length === 0 && settlement.adjustments.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-gray-400">No records</td></tr>
                    )}
                  </tbody>
                  {(loadItems.length > 0 || settlement.adjustments.length > 0) && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={6} className="px-3 py-2 text-xs font-bold text-gray-700">TOTAL:</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{formatCurrency(settlement.settlement_total)}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* History panel */}
              {showHistory && (
                <div className="mt-2 border border-gray-200 rounded max-h-52 overflow-y-auto">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>History</span>
                    <button onClick={()=>setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><IcoX /></button>
                  </div>
                  {settlement.history.length === 0 ? (
                    <div className="py-5 text-center text-xs text-gray-400">No history yet</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-3 py-1.5 text-left text-gray-500 font-semibold">DATE</th>
                        <th className="px-3 py-1.5 text-left text-gray-500 font-semibold">DESCRIPTION</th>
                        <th className="px-3 py-1.5 text-left text-gray-500 font-semibold">AUTHOR</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {settlement.history.map((h: SettlementHistory) => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                            <td className="px-3 py-2 text-gray-700">{h.description}</td>
                            <td className="px-3 py-2 text-gray-500">{h.author || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="text-[10px] text-gray-400 px-3 py-1.5 border-t border-gray-100">
                    * History available starting from April 3, 2025.
                  </p>
                </div>
              )}
            </section>

            {/* ── D. Payments ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900 text-sm">Payments</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowPayModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded">
                    <IcoPencil /> New Payment
                  </button>
                  <button onClick={() => setShowCarryModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded">
                    <IcoCarry /> Create Carryover
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <TH>Date</TH><TH>Payment #</TH><TH>Description</TH>
                      <TH right>Amount</TH><th className="w-10"/>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settlement.payments.length === 0 ? (
                      <tr><td colSpan={5} className="py-5 text-center text-gray-400">No records</td></tr>
                    ) : settlement.payments.map((p: SettlementPayment) => (
                      <tr key={p.id} className="hover:bg-gray-50 group">
                        <td className="px-3 py-2 text-gray-500">{formatDate(p.payment_date)}</td>
                        <td className="px-3 py-2">
                          <button className="text-blue-600 hover:underline font-medium">{p.payment_number}</button>
                          {p.is_carryover && <span className="ml-1 text-purple-500">(carryover)</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{p.description || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button className="text-brand-600 hover:underline font-semibold">{formatCurrency(p.amount)}</button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleDeletePayment(p.id)}
                            className="text-green-500 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IcoPencil />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-xs font-bold text-gray-700">TOTAL:</td>
                      <td className="px-3 py-2 text-right text-xs font-bold">{formatCurrency(paymentsTotal)}</td>
                      <td/>
                    </tr>
                    <tr className="bg-gray-100 border-t border-gray-200">
                      <td colSpan={3} className="px-3 py-3 text-xs font-black text-gray-800 uppercase tracking-wide">BALANCE DUE:</td>
                      <td className={'px-3 py-3 text-right text-sm font-black ' + (settlement.balance_due < 0 ? 'text-red-600' : 'text-gray-900')}>
                        {formatCurrency(settlement.balance_due)}
                      </td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-sm font-semibold text-gray-600 mb-1">Notes</h3>
              <textarea
                defaultValue={settlement.notes || ''}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-500"
                placeholder="Add notes..."/>
            </section>

          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-4">
              {onBackToOpenBalance && (
                <button onClick={onBackToOpenBalance}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <IcoBack /> Back to Open Balance
                </button>
              )}
              <button onClick={handleExportQB}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded">
                <IcoQB /> Export to QuickBooks
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded">
                <IcoX /> Close
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded disabled:opacity-50">
                <IcoCheck /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {showAdjModal && (
        <AdjModal type={showAdjModal} settlementId={settlementId}
          onClose={() => setShowAdjModal(null)}
          onSaved={() => { setShowAdjModal(null); refetch() }}/>
      )}
      {showPayModal && (
        <PaymentModal settlementId={settlementId} settlement={settlement}
          onClose={() => setShowPayModal(false)}
          onSaved={() => { setShowPayModal(false); refetch() }}/>
      )}
      {showCarryModal && (
        <CarryModal settlementId={settlementId} balanceDue={settlement.balance_due} settlementNumber={settlement.settlement_number}
          onClose={() => setShowCarryModal(false)}
          onSaved={() => { setShowCarryModal(false); refetch() }}/>
      )}
      {showEmail && (
        <EmailModal settlement={settlement} pdfUrl={pdfUrl} onClose={() => setShowEmail(false)}/>
      )}
    </>
  )
}

// ── SectionTable helper ───────────────────────────────────────────────────────
function SectionTable({ cols, children, rightLast }: { cols: string[]; children: React.ReactNode; rightLast?: boolean }) {
  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {cols.map((c,i) => (
              <th key={i} className={'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase ' + (rightLast && i===cols.length-1 ? 'text-right' : '')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

// ── Available Loads Section ───────────────────────────────────────────────────
function AvailableLoadsSection({ driverId, currentLoadIds, onAdd }: {
  driverId: number; currentLoadIds: number[]; onAdd: (id: number) => void
}) {
  const [loads, setLoads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!driverId) { setLoads([]); setLoading(false); return }
    setLoading(true)
    client.get('/api/v1/loads', { params: { driver_id: driverId, page_size: 100, show_only_active: true } })
      .then(r => {
        const items = (r.data.items || r.data) as any[]
        setLoads(items.filter((l: any) => !currentLoadIds.includes(l.id)))
      })
      .catch(() => setLoads([]))
      .finally(() => setLoading(false))
  }, [driverId, currentLoadIds.join(',')])

  return (
    <section>
      <button onClick={() => setExpanded(v=>!v)}
        className="flex items-center gap-2 mb-2 text-left w-full group">
        <span className={'transition-transform ' + (expanded?'':'rotate-[-90deg]')}><IcoExpand /></span>
        <span className="font-bold text-gray-900 text-sm">Available Loads</span>
        {!loading && <span className="text-xs text-gray-400">({loads.length} open)</span>}
      </button>
      {expanded && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <TH>Date</TH><TH>Delivery</TH><TH>Load #</TH>
                <TH>Description</TH><TH>Status</TH>
                <TH>Billing Status</TH><TH right>Amount</TH>
                <th className="w-10"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">Loading...</td></tr>
              ) : loads.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">No open loads available</td></tr>
              ) : loads.map((load: any) => {
                const pickup   = (load.stops||[]).find((s:any)=>s.stop_type==='pickup')
                const delivery = (load.stops||[]).find((s:any)=>s.stop_type==='delivery')
                const pLabel   = pickup   ? (pickup.city||'')  +', '+(pickup.state||'')   : '—'
                const dLabel   = delivery ? (delivery.city||'')+', '+(delivery.state||'') : '—'
                const amount   = load.drivers_payable_snapshot ?? 0
                const desc     = '#' + load.load_number + ' ' + pLabel + ' - ' + dLabel + ' / $' + (load.rate||0).toFixed(2)
                return (
                  <tr key={load.id} className="hover:bg-blue-50/40 group">
                    <td className="px-3 py-2 text-gray-500">{formatDate(load.load_date)}</td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(load.actual_delivery_date)}</td>
                    <td className="px-3 py-2 text-blue-600 font-medium">{load.load_number}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{desc}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{load.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{load.billing_status}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => onAdd(load.id)}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded p-0.5 transition-colors font-bold text-base leading-none">
                        +
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Load Item Row ─────────────────────────────────────────────────────────────
function LoadItemRow({ item, onRemove }: { item: SettlementItem; onRemove: () => void }) {
  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-gray-500">{formatDate(item.load_date)}</td>
      <td className="px-3 py-2 text-gray-500">{item.load?.actual_delivery_date ? formatDate(item.load.actual_delivery_date) : '—'}</td>
      <td className="px-3 py-2 text-blue-600 font-medium">{item.load?.load_number || '—'}</td>
      <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{item.description}</td>
      <td className="px-3 py-2">
        {item.load_status && <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{item.load_status}</span>}
      </td>
      <td className="px-3 py-2 text-gray-500">{item.load_billing_status || '—'}</td>
      <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
      <td className="px-3 py-2 text-center">
        <button onClick={onRemove}
          className="text-blue-500 hover:text-red-600 hover:bg-red-50 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-all font-bold text-base leading-none">
          −
        </button>
      </td>
    </tr>
  )
}

// ── Adjustment Row ────────────────────────────────────────────────────────────
function AdjRow({ adj, onDelete }: { adj: SettlementAdjustment; onDelete: () => void }) {
  const isDed = adj.adj_type === 'deduction'
  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-gray-500">{formatDate(adj.date)}</td>
      <td colSpan={2}/>
      <td className="px-3 py-2 text-gray-700">
        {adj.category ? adj.category + (adj.description ? ': ' + adj.description : '') : adj.description || adj.adj_type}
      </td>
      <td colSpan={2}/>
      <td className={'px-3 py-2 text-right font-semibold ' + (isDed ? 'text-red-600' : 'text-brand-700')}>
        {isDed ? '-' : '+'}{formatCurrency(adj.amount)}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-brand-500 hover:text-brand-700 p-0.5 rounded hover:bg-brand-50"><IcoPencil /></button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Adjustment Modal ──────────────────────────────────────────────────────────
function AdjModal({ type, settlementId, onClose, onSaved }: {
  type: 'addition'|'deduction'; settlementId: number; onClose: ()=>void; onSaved: ()=>void
}) {
  const [date, setDate]     = useState(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState('')
  const [category, setCat]  = useState('Other')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!amount) return
    setSaving(true)
    payrollApi.addAdjustment(settlementId, {
      adj_type: type, date: date||undefined,
      category: category||undefined, description: notes||undefined,
      amount: parseFloat(amount),
    })
      .then(() => { toast.success((type==='addition'?'Addition':'Deduction') + ' added'); onSaved() })
      .catch(e => toast.error(e.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[440px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">New {type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-2">
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="flex-1 text-sm focus:outline-none"/>
              {date && <button onClick={()=>setDate('')} className="text-gray-400 hover:text-gray-600"><IcoX /></button>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)}
                placeholder="0.00" className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select value={category} onChange={e=>setCat(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-500">
              {ADJ_CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-500"
              placeholder="Notes (optional)"/>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <IcoX /> Close
          </button>
          <button onClick={save} disabled={saving||!amount}
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <IcoCheck /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ settlementId, settlement, onClose, onSaved }: {
  settlementId: number; settlement: Settlement; onClose: ()=>void; onSaved: ()=>void
}) {
  const today = new Date().toISOString().slice(0,10)
  const [date, setDate]   = useState(today)
  const [desc, setDesc]   = useState('Settlement total #' + settlement.settlement_number)
  const [amount, setAmount] = useState(String(Math.max(0, settlement.balance_due)))
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!amount) return
    setSaving(true)
    payrollApi.addPayment(settlementId, {
      description: desc, amount: parseFloat(amount),
      payment_date: date||undefined, is_carryover: false,
    })
      .then(() => { toast.success('Payment recorded'); onSaved() })
      .catch(e => toast.error(e.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[500px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Make Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <div className="flex items-center gap-1 border border-gray-300 rounded px-3 py-2">
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="flex-1 text-sm focus:outline-none"/>
                {date && <button onClick={()=>setDate('')} className="text-gray-400 hover:text-gray-600 text-xs"><IcoX /></button>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input type="text" value={desc} onChange={e=>setDesc(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <IcoX /> Close
          </button>
          <button onClick={save} disabled={saving||!amount}
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <IcoCheck /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carryover Modal ───────────────────────────────────────────────────────────
function CarryModal({ settlementId, balanceDue, settlementNumber, onClose, onSaved }: {
  settlementId: number; balanceDue: number; settlementNumber: number; onClose: ()=>void; onSaved: ()=>void
}) {
  const [date, setDate]   = useState(new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState(String(Math.abs(balanceDue)))
  const [saving, setSaving] = useState(false)

  const save = () => {
    setSaving(true)
    payrollApi.addPayment(settlementId, {
      description: 'Carryover from settlement #' + settlementNumber,
      amount: parseFloat(amount), payment_date: date||undefined, is_carryover: true,
    })
      .then(() => { toast.success('Carryover created'); onSaved() })
      .catch(e => toast.error(e.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[400px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Create Carryover</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Create a carryover for the remaining balance of{' '}
            <strong className="text-gray-900">{formatCurrency(balanceDue)}</strong> from settlement #{settlementNumber}.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <IcoX /> Close
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <IcoCarry /> {saving ? 'Creating...' : 'Create Carryover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({ settlement, pdfUrl, onClose }: {
  settlement: Settlement; pdfUrl: string; onClose: ()=>void
}) {
  const [to, setTo]           = useState('')
  const [cc, setCc]           = useState('')
  const [showCc, setShowCc]   = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [bcc, setBcc]         = useState('')
  const [subject, setSubject] = useState('Your payroll settlement #' + settlement.settlement_number + ' [preview]')
  const [sending, setSending] = useState(false)
  const driverName = settlement.driver?.name || settlement.payable_to || 'Driver'
  const fname = 'driver_settlement_' + settlement.settlement_number + '_' + (settlement.payable_to||'driver').replace(/\s/g,'_') + '.pdf'

  const send = () => {
    if (!to) { toast.error('Enter recipient email'); return }
    setSending(true)
    setTimeout(() => { toast.success('Settlement email sent'); onClose() }, 800)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl w-[860px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="font-bold text-gray-900">Email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IcoX /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 px-5 py-4 overflow-y-auto space-y-3 border-r border-gray-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-gray-600 w-6">To</label>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-2 focus-within:border-brand-500">
                <span className="text-gray-400 text-sm">@</span>
                <input type="email" value={to} onChange={e=>setTo(e.target.value)}
                  className="flex-1 text-sm focus:outline-none" placeholder="recipient@example.com"/>
              </div>
              <div className="flex gap-3 mt-1 justify-end">
                <button onClick={()=>setShowCc(v=>!v)} className="text-xs text-blue-600 hover:underline">add CC recipient</button>
                <button onClick={()=>setShowBcc(v=>!v)} className="text-xs text-blue-600 hover:underline">add BCC recipient</button>
              </div>
              {showCc  && <input type="email" value={cc}  onChange={e=>setCc(e.target.value)}  placeholder="CC"  className="mt-1.5 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>}
              {showBcc && <input type="email" value={bcc} onChange={e=>setBcc(e.target.value)} placeholder="BCC" className="mt-1.5 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input type="text" value={subject} onChange={e=>setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Body</label>
              <div className="border border-gray-200 rounded p-5 bg-white text-sm text-gray-800 min-h-[180px]">
                <div className="flex justify-center mb-5">
                  <div className="text-center">
                    <div className="text-2xl font-black text-red-600 tracking-tight">TOPTRUCK</div>
                    <div className="text-xs text-gray-500 font-semibold tracking-widest">COMPANY</div>
                  </div>
                </div>
                <hr className="border-brand-500 mb-4"/>
                <p className="font-semibold mb-2">Hello {driverName}</p>
                <p className="text-gray-600 mb-3">Attached is your payroll settlement from Silkroad llc</p>
                <hr className="mb-3"/>
                <p className="font-bold text-center">Thank you for your hard work!</p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-gray-600">Attachments</span>
                <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{fname}</a>
                <span className="text-gray-400">(~60KB)</span>
                <button className="text-gray-400 hover:text-red-500">✕</button>
              </div>
            </div>
          </div>
          <div className="w-[280px] px-5 py-4 bg-gray-50">
            <div className="text-center mb-5">
              <div className="text-2xl font-black text-red-600 tracking-tight">TOPTRUCK</div>
              <div className="text-xs text-gray-500 font-semibold tracking-widest">COMPANY</div>
            </div>
            <hr className="border-brand-500 mb-4"/>
            <p className="font-semibold text-sm mb-2">Hello {driverName}</p>
            <p className="text-gray-600 text-sm mb-3">Attached is your payroll settlement from Silkroad llc</p>
            <hr className="mb-3"/>
            <p className="font-bold text-sm text-center">Thank you for your hard work!</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button onClick={send} disabled={sending||!to}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <IcoCheck /> {sending ? 'Sending...' : 'Send'}
          </button>
          <button onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-semibold">
            <IcoX /> Close
          </button>
        </div>
      </div>
    </div>
  )
}
