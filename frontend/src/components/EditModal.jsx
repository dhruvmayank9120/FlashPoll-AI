import { useState, useEffect } from 'react'
import CircularProgress from '@mui/material/CircularProgress'

const CATS = ['General','Strategy','Product','Engineering','Design','Operations','HR','Marketing','Finance']

export default function EditModal({ poll, open, onClose, onSave }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('General')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (poll) {
      setQ(poll.question)
      setCat(poll.category)
    }
    setErr('')
  }, [poll, open])

  const handleSave = async () => {
    if (!q.trim()) { setErr('Question is required.'); return }
    setSaving(true)
    setErr('')
    try {
      await onSave(poll._id, { question: q.trim(), category: cat })
      onClose()
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update poll.')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !poll) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass rounded-2xl w-full max-w-md border border-surface-500 shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-600">
          <div>
            <h2 className="text-base font-bold text-white">Edit Poll</h2>
            <p className="text-xs text-gray-600 mt-0.5">Options and votes cannot be edited</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
                       hover:text-white hover:bg-surface-600 transition-all text-xl">x</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <div className="px-4 py-2.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400">{err}</div>}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Question <span className="text-brand-500">*</span>
            </label>
            <textarea className="input-base resize-none" rows={3} value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATS.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all
                    ${cat === c ? 'bg-brand-500 text-white border-brand-500' : 'text-gray-500 border-surface-500 hover:text-gray-300'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6 border-t border-surface-600 pt-4">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <CircularProgress size={12} sx={{ color:'white', mr:1 }} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
