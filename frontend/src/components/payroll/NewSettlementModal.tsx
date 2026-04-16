import { useState, useEffect, useCallback } from 'react'
import { payrollApi } from '@/api/payroll'
import type { OpenBalance } from '@/api/payroll'
import { formatCurrency, formatDate } from '@/utils'
import type { Driver } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  drivers: Driver[]
  onClose: () => void
  onSaved: (newId?: number) => void
}

const X = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
const Check = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>

export default function NewSettlementModal({ drivers, onClose, onSaved }: Props) {
  const [driverId, setDriverId] = useState('')
  const [payableTo, setPayableTo] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateType, setDateType] = useState<'pickup' | 'delivery'>('pickup')
  const [balances, setBalances] = useState<OpenBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<number | null>(null)  // driver_id being created

  const fetchBalances = useCallback(async () => {
    setLoading(true)
    try {
      const params: Parameters<typeof payrollApi.getOpenBalances>[0] = { date_type: dateType }
      if (driverId) params.driver_id = parseInt(driverId)
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const data = await payrollApi.getOpenBalances(params)
      setBalances(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [driverId, dateFrom, dateTo, dateType])

  useEffect(() => { fetchBalances() }, [])  // initial load

  const handleApply = () => { fetchBalances() }

  const handleCreate = async (b: OpenBalance) => {
    setCreating(b.driver_id)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const s = await payrollApi.create({
        driver_id: b.driver_id,
        payable_to: b.payable_to,
        status: 'Preparing',
        date: today,
      })
      toast.success(`Settlement #${s.settlement_number} created for ${b.payable_to}`)
      onSaved(s.id)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setCreating(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div className="w-[1000px] bg-white flex flex-col h-full shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Settlement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Info banner */}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-purple-50 border border-purple-100 rounded-lg mb-5">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-sm text-gray-600">
              Need Help? Watch our quick video tutorial on{' '}
              <a href="#" className="text-brand-600 font-medium hover:underline">
                How to create and manage driver payroll settlements.
              </a>
            </p>
          </div>

          {/* Driver + Payable to */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Driver</label>
              <select value={driverId}
                onChange={e => {
                  setDriverId(e.target.value)
                  const d = drivers.find(x => String(x.id) === e.target.value)
                  if (d) setPayableTo(d.name)
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
                <option value=""></option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name} [{d.driver_type}]</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Payable to <span className="text-red-500">*</span>
              </label>
              <select value={payableTo} onChange={e => setPayableTo(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
                <option value=""></option>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Open Balance section */}
          <div>
            {/* Section header with filters */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 flex-shrink-0">Open Balance</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Date Range: From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-500" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Date Range: To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-500" />
              </div>
              <div className="flex flex-col gap-0.5">
                {[{v:'pickup',l:'by Pickup Date'},{v:'delivery',l:'by Delivery Date'}].map(o => (
                  <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="date_type_new" value={o.v}
                      checked={dateType === o.v}
                      onChange={() => setDateType(o.v as 'pickup'|'delivery')}
                      className="accent-brand-600 w-3.5 h-3.5" />
                    <span className="text-xs text-gray-600">{o.l}</span>
                  </label>
                ))}
              </div>
              <button onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded transition-colors flex-shrink-0">
                <Check /> Apply
              </button>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['DRIVER','PAYABLE TO','BALANCE','UPDATED','ACTIONS'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h} {h !== 'ACTIONS' && <span className="text-gray-300">⇅</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">Loading open balances…</td></tr>
                  ) : balances.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">No open balances found</td></tr>
                  ) : balances.map(b => (
                    <tr key={b.driver_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{b.driver_name} [{b.driver_type}]</td>
                      <td className="px-4 py-3 text-gray-600">{b.payable_to}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(b.balance)}</td>
                      <td className="px-4 py-3 text-gray-500">{b.last_load_date ? formatDate(b.last_load_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          disabled={creating === b.driver_id}
                          onClick={() => handleCreate(b)}
                          className="text-brand-600 font-medium text-sm hover:underline disabled:opacity-50">
                          {creating === b.driver_id ? 'Creating…' : 'Create Settlement'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900">
            <X /> Close
          </button>
          <button disabled
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-400 text-white text-sm font-medium rounded opacity-50 cursor-not-allowed">
            <Check /> Save
          </button>
        </div>
      </div>
    </div>
  )
}
