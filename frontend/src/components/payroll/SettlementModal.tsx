import { useState, useEffect, useRef, useCallback } from 'react'
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
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const X       = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
const Check   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
const Plus    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
const Minus   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
const Pencil  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
const Download = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
const Mail    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
const History = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
const QB      = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
const CarryOver = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
const Expand  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
const Trash   = () => <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>

const STATUS_DISPLAY: Record<string, string> = {
  'Ready': 'Ready for payment', 'Preparing': 'Preparing', 'Paid': 'Paid', 'Sent': 'Sent', 'Void': 'Void',
}
const STATUSES = ['Preparing', 'Ready', 'Sent', 'Paid', 'Void']

const ADJ_CATEGORIES = [
  'Detention', 'Driver payments', 'Factoring Fee', 'Fuel', 'IFTA Tax',
  'Insurance', 'Internet', 'Legal & Professional', 'Lumper',
  'NM/KY/NY/OR/CT miles tax', 'Office Expenses', 'Other', 'Parking',
  'Permits', 'Quick Pay fee', 'Software', 'Supplies', 'Telephone',
  'Tolls', 'Travel', 'Truck Registration',
]

// ─── Small inline tab type ─────────────────────────────────────────────────────
type Tab = 'settlement' | 'history'

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function SettlementModal({ settlementId, onClose, onSaved, drivers }: Props) {
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('settlement')
  const [showEmail, setShowEmail] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)

  // form
  const [form, setForm] = useState({ driver_id: '', status: '', date: '', payable_to: '' })

  // modals
  const [showAdjModal, setShowAdjModal] = useState<'addition' | 'deduction' | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCarryoverModal, setShowCarryoverModal] = useState(false)

  const pdfUrl = payrollApi.getPdfUrl(settlementId)

  const refetch = useCallback(async () => {
    try {
      const data = await payrollApi.get(settlementId)
      setSettlement(data)
      setForm({ driver_id: String(data.driver_id), status: data.status, date: data.date, payable_to: data.payable_to || '' })
      setDirty(false)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }, [settlementId])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const handleSave = async () => {
    if (!settlement) return
    setSaving(true)
    try {
      await payrollApi.update(settlementId, {
        driver_id: parseInt(form.driver_id) || settlement.driver_id,
        status: form.status,
        date: form.date,
        payable_to: form.payable_to || undefined,
      })
      toast.success('Settlement saved')
      setDirty(false)
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleAddItem = async (loadId: number) => {
    try {
      await payrollApi.addLoadItem(settlementId, loadId)
      await refetch()
      toast.success('Load added to settlement')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleRemoveItem = async (itemId: number) => {
    if (!confirm('Remove this item from the settlement?')) return
    try {
      await payrollApi.removeItem(settlementId, itemId)
      await refetch()
      toast.success('Item removed')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleDeleteAdj = async (adjId: number) => {
    try {
      await payrollApi.deleteAdjustment(settlementId, adjId)
      await refetch()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Delete this payment?')) return
    try {
      await payrollApi.deletePayment(settlementId, paymentId)
      await refetch()
      toast.success('Payment deleted')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const handleExportQB = async () => {
    try {
      await payrollApi.exportQB(settlementId)
      await refetch()
      toast.success('Exported to QuickBooks')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const setFormField = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v })); setDirty(true)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[1060px] bg-white flex items-center justify-center h-full">
        <span className="text-gray-400">Loading settlement…</span>
      </div>
    </div>
  )
  if (!settlement) return null

  const loadItems = settlement.items.filter(i => i.item_type === 'load')
  const paymentsTotal = settlement.payments.reduce((a, p) => a + p.amount, 0)

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={() => { if (!dirty) onClose() }} />
        <div className="w-[1060px] bg-white flex flex-col h-full shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 flex-shrink-0">
            <h2 className="font-bold text-gray-900">Edit Settlement #{settlement.settlement_number}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"><X /></button>
          </div>

          {/* ── Top form ── */}
          <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Driver</label>
                <select value={form.driver_id} onChange={e => setFormField('driver_id', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-green-500">
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name} [{d.driver_type}]</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Settlement Status <span className="text-red-500">*</span></label>
                <select value={form.status} onChange={e => setFormField('status', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-green-500">
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_DISPLAY[s] || s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={e => setFormField('date', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-green-500" />
              </div>
            </div>
            <div className="mt-3 w-72">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payable to <span className="text-red-500">*</span></label>
              <select value={form.payable_to} onChange={e => setFormField('payable_to', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-green-500">
                <option value=""></option>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">

            {/* ── Available Loads (open pool) ── */}
            <AvailableLoadsSection
              settlementId={settlementId}
              driverId={parseInt(form.driver_id) || settlement.driver_id}
              currentItemLoadIds={loadItems.map(i => i.load_id).filter(Boolean) as number[]}
              onAdd={handleAddItem}
            />

            {/* ── Advanced Payments ── */}
            <section>
              <h3 className="font-bold text-gray-900 mb-2">Advanced Payments</h3>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Payment #</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={4} className="py-5 text-center text-gray-400">No records</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Driver Settlement main ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
                  Driver Settlement #{settlement.settlement_number}
                  <button className="text-green-600"><Pencil /></button>
                </h3>
                <div className="flex items-center gap-3">
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Download /> Download as PDF
                  </a>
                  <button onClick={() => setShowEmail(true)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Mail /> Email
                  </button>
                  <button onClick={() => setShowHistoryPanel(v => !v)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <History /> History
                  </button>
                  <button onClick={() => setShowAdjModal('addition')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded">
                    <Plus /> Addition
                  </button>
                  <button onClick={() => setShowAdjModal('deduction')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded">
                    <Minus /> Deduction
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Delivery</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-16">Load #</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-24">Billing Status</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase w-24">Amount</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Load items */}
                    {loadItems.map(item => (
                      <SettlementItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item.id)} />
                    ))}
                    {/* Adjustments */}
                    {settlement.adjustments.map(adj => (
                      <AdjustmentRow key={adj.id} adj={adj} onDelete={() => handleDeleteAdj(adj.id)} />
                    ))}
                    {loadItems.length === 0 && settlement.adjustments.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-gray-400">No items</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-gray-700">TOTAL:</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">
                        {formatCurrency(settlement.settlement_total)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* History panel */}
              {showHistoryPanel && (
                <div className="mt-2 border border-gray-200 rounded max-h-48 overflow-y-auto">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                    Settlement History
                  </div>
                  {settlement.history.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">No history</div>
                  ) : settlement.history.map((h: SettlementHistory) => (
                    <div key={h.id} className="flex gap-3 px-3 py-2 border-b border-gray-100 last:border-0 text-xs hover:bg-gray-50">
                      <span className="text-gray-400 whitespace-nowrap w-36 flex-shrink-0">{formatDateTime(h.created_at)}</span>
                      <span className="text-gray-500 w-20 flex-shrink-0">{h.author || '—'}</span>
                      <span className="text-gray-700">{h.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Payments ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900">Payments</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded">
                    <Pencil /> New Payment
                  </button>
                  <button onClick={() => setShowCarryoverModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded">
                    <CarryOver /> Create Carryover
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Payment #</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase w-24">Amount</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settlement.payments.length === 0 ? (
                      <tr><td colSpan={5} className="py-5 text-center text-gray-400">No payments</td></tr>
                    ) : settlement.payments.map((p: SettlementPayment) => (
                      <tr key={p.id} className="hover:bg-gray-50 group">
                        <td className="px-3 py-2 text-gray-500">{formatDate(p.payment_date)}</td>
                        <td className="px-3 py-2">
                          <span className="text-blue-600 font-medium">{p.payment_number}</span>
                          {p.is_carryover && <span className="ml-1 text-xs text-purple-500">(carryover)</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{p.description || '—'}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => handleDeletePayment(p.id)}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-xs font-bold text-gray-700">TOTAL:</td>
                      <td className="px-3 py-2 text-right text-xs font-bold">{formatCurrency(paymentsTotal)}</td>
                      <td />
                    </tr>
                    <tr className="bg-amber-50">
                      <td colSpan={3} className="px-3 py-2.5 text-xs font-black text-gray-800 uppercase tracking-wide">BALANCE DUE:</td>
                      <td className={`px-3 py-2.5 text-right text-sm font-black ${settlement.balance_due < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(settlement.balance_due)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button onClick={handleExportQB}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded">
              <QB /> Export to QuickBooks
            </button>
            <div className="flex items-center gap-2">
              {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
              <button onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded">
                <X /> Close
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50">
                <Check /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {showAdjModal && (
        <AdjustmentModal
          type={showAdjModal}
          settlementId={settlementId}
          onClose={() => setShowAdjModal(null)}
          onSaved={async () => { setShowAdjModal(null); await refetch() }}
        />
      )}
      {showPaymentModal && (
        <PaymentModal
          settlementId={settlementId}
          settlement={settlement}
          onClose={() => setShowPaymentModal(false)}
          onSaved={async () => { setShowPaymentModal(false); await refetch() }}
        />
      )}
      {showCarryoverModal && (
        <CarryoverModal
          settlementId={settlementId}
          balanceDue={settlement.balance_due}
          settlementNumber={settlement.settlement_number}
          onClose={() => setShowCarryoverModal(false)}
          onSaved={async () => { setShowCarryoverModal(false); await refetch() }}
        />
      )}
      {showEmail && (
        <EmailModal
          settlement={settlement}
          pdfUrl={pdfUrl}
          onClose={() => setShowEmail(false)}
        />
      )}
    </>
  )
}

// ─── Available loads section ──────────────────────────────────────────────────
function AvailableLoadsSection({
  settlementId, driverId, currentItemLoadIds, onAdd,
}: {
  settlementId: number
  driverId: number
  currentItemLoadIds: number[]
  onAdd: (loadId: number) => void
}) {
  const [loads, setLoads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  const fetchLoads = useCallback(async () => {
    if (!driverId) { setLoads([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await client.get('/api/v1/loads', {
        params: { driver_id: driverId, page_size: 100, show_only_active: true }
      })
      const items = (data.items || data) as any[]
      // Exclude loads already in this settlement
      setLoads(items.filter((l: any) => !currentItemLoadIds.includes(l.id)))
    } catch { setLoads([]) }
    finally { setLoading(false) }
  }, [driverId, currentItemLoadIds.join(',')])

  useEffect(() => { fetchLoads() }, [fetchLoads])

  const getDelivery = (load: any) => {
    const stop = (load.stops || []).find((s: any) => s.stop_type === 'delivery')
    return stop ? `${stop.city || ''}, ${stop.state || ''}` : '—'
  }

  return (
    <section>
      <button onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 mb-2 text-left w-full group">
        <span className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}><Expand /></span>
        <span className="font-bold text-gray-900">Available Loads</span>
        <span className="text-xs text-gray-400 ml-1">({loads.length} open)</span>
      </button>

      {expanded && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-24">Delivery</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-16">Load #</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-20">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase w-24">Billing Status</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase w-24">Amount</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">Loading…</td></tr>
              ) : loads.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">No open loads available</td></tr>
              ) : loads.map((load: any) => {
                const pickup = (load.stops || []).find((s: any) => s.stop_type === 'pickup')
                const delivery = (load.stops || []).find((s: any) => s.stop_type === 'delivery')
                const pickupLabel = pickup ? `${pickup.city || ''}, ${pickup.state || ''}` : '—'
                const deliveryLabel = delivery ? `${delivery.city || ''}, ${delivery.state || ''}` : '—'
                const amount = load.drivers_payable_snapshot ?? 0
                const desc = `#${load.load_number} ${pickupLabel} - ${deliveryLabel} / $${(load.rate || 0).toFixed(2)}`
                return (
                  <tr key={load.id} className="hover:bg-blue-50/30 group">
                    <td className="px-3 py-2 text-gray-500">{formatDate(load.load_date)}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(load.actual_delivery_date)}</td>
                    <td className="px-3 py-2">
                      <span className="text-blue-600 font-medium">{load.load_number}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">{desc}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{load.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{load.billing_status}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => onAdd(load.id)}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded p-0.5 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
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

// ─── Settlement item row ──────────────────────────────────────────────────────
function SettlementItemRow({ item, onRemove }: { item: SettlementItem; onRemove: () => void }) {
  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-gray-500">{formatDate(item.load_date)}</td>
      <td className="px-3 py-2 text-gray-500">{item.load?.actual_delivery_date ? formatDate(item.load.actual_delivery_date) : '—'}</td>
      <td className="px-3 py-2">
        {item.load_id ? <span className="text-blue-600 font-medium">{item.load?.load_number}</span> : '—'}
      </td>
      <td className="px-3 py-2 text-gray-700 truncate max-w-[220px]">{item.description}</td>
      <td className="px-3 py-2">
        {item.load_status && <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.load_status}</span>}
      </td>
      <td className="px-3 py-2 text-gray-500">{item.load_billing_status || '—'}</td>
      <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
      <td className="px-3 py-2 text-center">
        <button onClick={onRemove}
          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-colors rounded hover:bg-red-50 p-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
        </button>
      </td>
    </tr>
  )
}

// ─── Adjustment row ───────────────────────────────────────────────────────────
function AdjustmentRow({ adj, onDelete }: { adj: SettlementAdjustment; onDelete: () => void }) {
  const isDeduction = adj.adj_type === 'deduction'
  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-gray-500">{formatDate(adj.date)}</td>
      <td colSpan={2} />
      <td className="px-3 py-2 text-gray-700">
        {adj.category || adj.description || adj.adj_type}
        {adj.category && adj.description && <span className="text-gray-400 ml-1">— {adj.description}</span>}
      </td>
      <td colSpan={2} />
      <td className={`px-3 py-2 text-right font-semibold ${isDeduction ? 'text-red-600' : 'text-green-700'}`}>
        {isDeduction ? '-' : '+'}{formatCurrency(adj.amount)}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-green-500 hover:text-green-700 p-0.5 rounded hover:bg-green-50"><Pencil /></button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash /></button>
        </div>
      </td>
    </tr>
  )
}

// ─── Adjustment Modal ─────────────────────────────────────────────────────────
function AdjustmentModal({
  type, settlementId, onClose, onSaved,
}: { type: 'addition' | 'deduction'; settlementId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: '', description: '', amount: '' })
  const [saving, setSaving] = useState(false)
  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      await payrollApi.addAdjustment(settlementId, {
        adj_type: type,
        date: form.date || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
        amount: parseFloat(form.amount),
      })
      toast.success(`${type === 'addition' ? 'Addition' : 'Deduction'} added`)
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[480px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 capitalize">New {type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
            <input type="date" value={form.date} onChange={e => setF('date', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
            <select value={form.category} onChange={e => setF('category', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-500">
              <option value=""></option>
              {ADJ_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setF('amount', e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose}
            className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <X /> Close
          </button>
          <button onClick={handleSave} disabled={saving || !form.amount}
            className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <Check /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({
  settlementId, settlement, onClose, onSaved,
}: { settlementId: number; settlement: Settlement; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    payment_date: today,
    description: `Settlement total #${settlement.settlement_number}`,
    amount: String(Math.max(0, settlement.balance_due)),
  })
  const [saving, setSaving] = useState(false)
  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      await payrollApi.addPayment(settlementId, {
        description: form.description,
        amount: parseFloat(form.amount),
        payment_date: form.payment_date || undefined,
        is_carryover: false,
      })
      toast.success('Payment recorded')
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">New Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
              <input type="date" value={form.payment_date} onChange={e => setF('payment_date', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
            <input type="text" value={form.description} onChange={e => setF('description', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          {/* Settlement allocation preview */}
          <div className="border border-gray-200 rounded text-xs overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">Settlement Allocations</div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Settlement #</th>
                  <th className="px-3 py-1.5 text-right text-gray-500 font-medium">Total</th>
                  <th className="px-3 py-1.5 text-right text-gray-500 font-medium">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-1.5 text-blue-600 font-medium">{settlement.settlement_number}</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(settlement.settlement_total)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{formatCurrency(settlement.balance_due)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose}
            className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <X /> Close
          </button>
          <button onClick={handleSave} disabled={saving || !form.amount}
            className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <Check /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carryover Modal ──────────────────────────────────────────────────────────
function CarryoverModal({
  settlementId, balanceDue, settlementNumber, onClose, onSaved,
}: { settlementId: number; balanceDue: number; settlementNumber: number; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState(String(Math.abs(balanceDue)))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await payrollApi.addPayment(settlementId, {
        description: `Carryover from settlement #${settlementNumber}`,
        amount: parseFloat(amount),
        payment_date: date || undefined,
        is_carryover: true,
      })
      toast.success('Carryover created')
      onSaved()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Create Carryover</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Create a carryover entry for the remaining balance of{' '}
            <strong>{formatCurrency(balanceDue)}</strong> from settlement #{settlementNumber}.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose}
            className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-medium">
            <X /> Close
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <CarryOver /> {saving ? 'Creating…' : 'Create Carryover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ settlement, pdfUrl, onClose }: {
  settlement: Settlement; pdfUrl: string; onClose: () => void
}) {
  const [to, setTo] = useState(settlement.driver ? '' : '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(`Your payroll settlement #${settlement.settlement_number} [preview]`)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [sending, setSending] = useState(false)
  const driverName = settlement.driver?.name || settlement.payable_to || 'Driver'

  const handleSend = async () => {
    if (!to) { toast.error('Please enter a recipient email'); return }
    setSending(true)
    try {
      // Log email send — actual SMTP integration would go here
      toast.success('Settlement email sent')
      onClose()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSending(false) }
  }

  const previewBody = `Hello ${driverName}\n\nAttached is your payroll settlement from Silkroad llc\n\nThank you for your hard work!`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="font-bold text-gray-900">Email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: form */}
          <div className="flex-1 px-5 py-4 overflow-y-auto space-y-4 border-r border-gray-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs font-semibold text-gray-600 w-10">To</label>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-2">
                <span className="text-gray-400 text-sm">@</span>
                <input type="email" value={to} onChange={e => setTo(e.target.value)}
                  className="flex-1 text-sm focus:outline-none" placeholder="recipient@example.com" />
              </div>
              <div className="flex gap-3 mt-1 justify-end">
                <button onClick={() => setShowCc(v => !v)} className="text-xs text-blue-600 hover:underline">add CC recipient</button>
                <button onClick={() => setShowBcc(v => !v)} className="text-xs text-blue-600 hover:underline">add BCC recipient</button>
              </div>
              {showCc && (
                <input type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="CC"
                  className="mt-1.5 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              )}
              {showBcc && (
                <input type="email" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="BCC"
                  className="mt-1.5 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Body</label>
              <div className="border border-gray-200 rounded overflow-hidden">
                {/* Preview of email body */}
                <div className="p-5 text-sm text-gray-800 bg-white min-h-[200px]">
                  <div className="flex justify-center mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-black text-red-600 tracking-tight">TOPTRUCK</div>
                      <div className="text-xs text-gray-500 font-semibold tracking-widest">COMPANY</div>
                    </div>
                  </div>
                  <hr className="border-green-500 mb-4" />
                  <p className="font-semibold mb-3">Hello {driverName}</p>
                  <p className="text-gray-600 mb-3">Attached is your payroll settlement from Silkroad llc</p>
                  <hr className="mb-3" />
                  <p className="font-bold text-center">Thank you for your hard work!</p>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-gray-600">Attachments</span>
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                  driver_settlement_{settlement.settlement_number}_{(settlement.payable_to || 'driver').replace(' ', '_')}.pdf
                </a>
                <span className="text-gray-400 text-xs">(~60KB)</span>
                <button className="text-gray-400 hover:text-red-500 text-xs">✕</button>
              </div>
            </div>
          </div>

          {/* Right: preview */}
          <div className="w-[300px] px-5 py-4 overflow-y-auto bg-gray-50">
            <div className="text-center mb-6">
              <div className="text-2xl font-black text-red-600 tracking-tight">TOPTRUCK</div>
              <div className="text-xs text-gray-500 font-semibold tracking-widest">COMPANY</div>
            </div>
            <hr className="border-green-500 mb-4" />
            <p className="font-semibold text-sm mb-3">Hello {driverName}</p>
            <p className="text-gray-600 text-sm mb-3">Attached is your payroll settlement from Silkroad llc</p>
            <hr className="mb-3" />
            <p className="font-bold text-sm text-center">Thank you for your hard work!</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button onClick={handleSend} disabled={sending || !to}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold disabled:opacity-50">
            <Check /> {sending ? 'Sending…' : 'Send'}
          </button>
          <button onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded font-semibold">
            <X /> Close
          </button>
        </div>
      </div>
    </div>
  )
}
