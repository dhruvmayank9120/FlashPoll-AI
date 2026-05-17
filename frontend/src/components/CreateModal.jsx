import { useState, useRef, useEffect } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import { aiGeneratePoll, aiImproveQuestion, aiSuggestCategory, aiSuggestOptions } from '../api/polls'

const CATS = ['General','Strategy','Product','Engineering','Design','Operations','HR','Marketing','Finance']

const EXPIRY_OPTS = [
  { label: 'No expiry', value: null },
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: '1 week', value: 168 },
]

export default function CreateModal({ open, onClose, onCreate }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('General')
  const [opts, setOpts] = useState(['',''])
  const [expiry, setExpiry] = useState(null)
  const [fErr, setFErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiGen, setAiGen] = useState(false)
  const [aiImprove, setAiImprove] = useState(false)
  const [aiCat, setAiCat] = useState(false)
  const [aiOpts, setAiOpts] = useState(false)
  const [aiMark, setAiMark] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 80)
  }, [open])

  const reset = () => {
    setQ('')
    setCat('General')
    setOpts(['',''])
    setExpiry(null)
    setFErr('')
    setAiTopic('')
    setAiMark(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleCreate = async () => {
    const cleanOpts = opts.map(o => o.trim()).filter(Boolean)
    if (!q.trim()) { setFErr('Question is required.'); return }
    if (cleanOpts.length < 2) { setFErr('Add at least 2 options.'); return }
    if (new Set(cleanOpts.map(o => o.toLowerCase())).size !== cleanOpts.length) {
      setFErr('Options must be distinct.')
      return
    }

    setSaving(true)
    setFErr('')
    try {
      const expiresAt = expiry ? new Date(Date.now() + expiry * 3600000).toISOString() : null
      await onCreate({ question: q.trim(), category: cat, options: cleanOpts, aiGenerated: aiMark, expiresAt })
      handleClose()
    } catch (e) {
      setFErr(e.response?.data?.error || 'Failed to create poll.')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!aiTopic.trim()) { setFErr('Enter a topic first.'); return }
    setAiGen(true)
    setFErr('')
    try {
      const data = await aiGeneratePoll(aiTopic)
      setQ(data.question || '')
      setCat(CATS.includes(data.category) ? data.category : 'General')
      setOpts((data.options || []).map(o => typeof o === 'string' ? o : o.text || ''))
      if (data.expiresHours) setExpiry(data.expiresHours)
      setAiMark(true)
    } catch (e) {
      setFErr(e.response?.data?.error || 'AI unavailable - check ANTHROPIC_API_KEY')
    } finally {
      setAiGen(false)
    }
  }

  const handleImprove = async () => {
    if (!q.trim()) { setFErr('Write a question first.'); return }
    setAiImprove(true)
    setFErr('')
    try {
      const { improved } = await aiImproveQuestion(q)
      setQ(improved)
    } catch (e) {
      setFErr(e.response?.data?.error || 'AI unavailable')
    } finally {
      setAiImprove(false)
    }
  }

  const handleSuggestCat = async () => {
    if (!q.trim()) return
    setAiCat(true)
    try {
      const { category } = await aiSuggestCategory(q)
      if (CATS.includes(category)) setCat(category)
    } catch {
    } finally {
      setAiCat(false)
    }
  }

  const handleSuggestOpts = async () => {
    if (!q.trim()) { setFErr('Write the question first.'); return }
    setAiOpts(true)
    setFErr('')
    try {
      const existing = opts.filter(Boolean)
      const { options } = await aiSuggestOptions(q, existing)
      setOpts(prev => {
        const combined = [...prev.filter(Boolean), ...options].slice(0, 6)
        return combined.length < 2 ? [...combined, ''] : combined
      })
    } catch (e) {
      setFErr(e.response?.data?.error || 'AI unavailable')
    } finally {
      setAiOpts(false)
    }
  }

  const addOpt = () => opts.length < 6 && setOpts(o => [...o, ''])
  const remOpt = i => opts.length > 2 && setOpts(o => o.filter((_, j) => j !== i))
  const updOpt = (i, v) => setOpts(o => {
    const n = [...o]
    n[i] = v
    return n
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.78)', backdropFilter:'blur(5px)' }}
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="glass rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-surface-500 shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-600 sticky top-0 glass z-10">
          <div>
            <h2 className="text-lg font-bold text-white">New Poll</h2>
            <p className="text-xs text-gray-600 mt-0.5">Build manually or let AI do it</p>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-surface-600 transition-all text-xl">
            x
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-800/30">
            <div className="flex items-center gap-1.5 mb-3 text-violet-400 text-xs font-bold uppercase tracking-wider">AI Generator</div>
            <div className="flex gap-2">
              <input className="input-base flex-1 text-xs py-2"
                placeholder='"remote work policy", "tech stack", "design review"'
                value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
              <button className="btn-ai px-3 flex-shrink-0" onClick={handleGenerate} disabled={aiGen}>
                {aiGen ? <CircularProgress size={12} sx={{ color:'#a78bfa' }}/> : 'AI'}
                <span>{aiGen ? '...' : 'Build'}</span>
              </button>
            </div>
            <p className="text-[10px] text-violet-800 mt-2">Generates question, options, category, and suggests an expiry if relevant.</p>
          </div>

          {fErr && <div className="px-4 py-2.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400">{fErr}</div>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Question <span className="text-brand-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <Tooltip title="AI: improve wording">
                  <button className="btn-ai py-1 text-[10px]" onClick={handleImprove} disabled={aiImprove}>
                    {aiImprove ? <CircularProgress size={10} sx={{ color:'#a78bfa' }}/> : 'AI'} Improve
                  </button>
                </Tooltip>
                <Tooltip title="AI: auto-detect category">
                  <button className="btn-ai py-1 text-[10px]" onClick={handleSuggestCat} disabled={aiCat || !q}>
                    {aiCat ? <CircularProgress size={10} sx={{ color:'#a78bfa' }}/> : 'Tag'}
                  </button>
                </Tooltip>
              </div>
            </div>
            <textarea ref={ref} className="input-base resize-none" rows={3}
              placeholder="What should the team decide?"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATS.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all
                    ${cat === c ? 'bg-brand-500 text-white border-brand-500' : 'text-gray-500 border-surface-500 hover:text-gray-300'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Options <span className="text-brand-500">*</span>
                <span className="font-normal text-gray-700 ml-1 normal-case tracking-normal">min 2 / max 6</span>
              </label>
              <Tooltip title="AI: suggest 2 more options">
                <button className="btn-ai py-1 text-[10px]" onClick={handleSuggestOpts} disabled={aiOpts || !q || opts.length >= 6}>
                  {aiOpts ? <CircularProgress size={10} sx={{ color:'#a78bfa' }}/> : 'AI'} Suggest
                </button>
              </Tooltip>
            </div>
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input-base" placeholder={`Option ${i+1}`}
                    value={o} onChange={e => updOpt(i, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOpt()} />
                  {opts.length > 2 && (
                    <button onClick={() => remOpt(i)}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl
                                 border border-surface-500 text-gray-600 hover:border-red-800 hover:text-red-400 transition-all text-lg">
                      x
                    </button>
                  )}
                </div>
              ))}
              {opts.length < 6 && (
                <button onClick={addOpt}
                  className="w-full py-2 rounded-xl border border-dashed border-surface-500
                             text-xs text-gray-600 hover:text-gray-400 hover:border-surface-400 transition-all">
                  + Add option
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Poll Expiry</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_OPTS.map(opt => (
                <button key={opt.label} onClick={() => setExpiry(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all
                    ${expiry === opt.value ? 'bg-amber-600/30 text-amber-300 border-amber-700' : 'text-gray-500 border-surface-500 hover:text-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {expiry && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Poll closes {new Date(Date.now() + expiry * 3600000).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-surface-600 sticky bottom-0 glass">
          <button className="btn-ghost" onClick={handleClose}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleCreate} disabled={saving}>
            {saving && <CircularProgress size={14} sx={{ color:'white' }}/>}
            {saving ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </div>
    </div>
  )
}
