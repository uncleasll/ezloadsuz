import { useState, useEffect } from 'react'
import { trucksApi } from '@/api/entities'
import type { Truck } from '@/types'
import toast from 'react-hot-toast'

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ unit_number: '', make: '', model: '', year: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try { setTrucks(await trucksApi.list()) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.unit_number.trim()) return toast.error('Unit number is required')
    setSaving(true)
    try {
      await trucksApi.create({ unit_number: form.unit_number, make: form.make || undefined, model: form.model || undefined, year: form.year ? parseInt(form.year) : undefined, is_active: true })
      toast.success('Truck created')
      setShowForm(false)
      setForm({ unit_number: '', make: '', model: '', year: '' })
      load()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Trucks</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New Truck</button>
      </div>
      {showForm && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[{ key: 'unit_number', label: 'Unit # *', ph: 'TRK001' }, { key: 'make', label: 'Make', ph: 'Freightliner' }, { key: 'model', label: 'Model', ph: 'Cascadia' }, { key: 'year', label: 'Year', ph: '2023' }].map(({ key, label, ph }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="input-base text-sm" placeholder={ph} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>{['Unit #', 'Make', 'Model', 'Year', 'Status'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={5} className="py-16 text-center text-gray-400">Loading...</td></tr>
              : trucks.length === 0 ? <tr><td colSpan={5} className="py-16 text-center text-gray-400">No trucks</td></tr>
              : trucks.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{t.unit_number}</td>
                  <td className="table-td text-gray-600">{t.make || '—'}</td>
                  <td className="table-td text-gray-600">{t.model || '—'}</td>
                  <td className="table-td text-gray-600">{t.year || '—'}</td>
                  <td className="table-td"><span className={`badge ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
