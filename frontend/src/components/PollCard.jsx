import { useState } from 'react'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import { aiGetInsight } from '../api/polls'
import CommentsSection from './CommentsSection.jsx'
import ResultsChart from './ResultsChart.jsx'
import { useCountdown } from '../hooks/usePolls.js'

const CAT_COLORS = {
  General: '#94a3b8',
  Strategy: '#a78bfa',
  Product: '#60a5fa',
  Engineering: '#4ade80',
  Design: '#fbbf24',
  Operations: '#c084fc',
  HR: '#f472b6',
  Marketing: '#fb923c',
  Finance: '#34d399',
}

const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' })

export default function PollCard({ poll, voted, onVote, onDelete, onInsightSaved, onEdit, onComment, onDeleteComment }) {
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showInsight, setShowInsight] = useState(false)
  const [chartType, setChartType] = useState('bar')
  const countdown = useCountdown(poll.expiresAt)

  const total = poll.totalVotes || 0
  const hasVoted = !!voted
  const myOptId = voted
  const dotColor = CAT_COLORS[poll.category] || '#94a3b8'
  const isExpired = poll.isExpired || (countdown === 'Expired')
  const canVote = !hasVoted && !isExpired

  const handleDelete = async () => {
    if (!confirm('Delete this poll and all its votes?')) return
    setDeleting(true)
    try {
      await onDelete(poll._id)
    } catch {
      setDeleting(false)
    }
  }

  const handleGetInsight = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const { insight } = await aiGetInsight(poll.question, poll.options)
      await onInsightSaved(poll._id, insight)
      setShowInsight(true)
    } catch (e) {
      setAiError(e.response?.data?.error || 'AI unavailable - check your ANTHROPIC_API_KEY')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <article className="card group flex flex-col gap-0">
      {poll.expiresAt && (
        <div className={`-mx-6 -mt-6 mb-5 px-4 py-1.5 rounded-t-2xl text-[10px] font-bold text-center tracking-wider
          ${isExpired
            ? 'bg-red-950/60 text-red-400 border-b border-red-900/40'
            : countdown && countdown.includes('m') && !countdown.includes('d') && !countdown.includes('h')
              ? 'bg-amber-950/60 text-amber-400 border-b border-amber-900/40 animate-pulse-slow'
              : 'bg-surface-700 text-gray-600 border-b border-surface-600'}`}>
          {isExpired ? 'CLOSED' : `${countdown} remaining`}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label={poll.category} size="small" sx={{
            background: `${dotColor}18`,
            color: dotColor,
            border: `1px solid ${dotColor}40`,
            fontSize:'0.65rem',
            fontWeight:700,
            letterSpacing:'0.8px',
            textTransform:'uppercase',
            height:22,
          }} />
          {poll.aiGenerated && (
            <Tooltip title="Created with AI">
              <span className="badge-cat text-violet-400 border-violet-800 bg-violet-950/40">AI</span>
            </Tooltip>
          )}
          <span className="text-[11px] text-gray-600">{fmt(poll.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip title="Edit poll">
            <button onClick={() => onEdit(poll)}
              className="w-10 h-7 flex items-center justify-center rounded-lg text-gray-600
                         hover:text-brand-400 hover:bg-brand-900/20 transition-all text-xs">
              Edit
            </button>
          </Tooltip>
          <Tooltip title="Delete poll">
            <button onClick={handleDelete} disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600
                         hover:text-red-400 hover:bg-red-950/30 transition-all text-lg leading-none">
              {deleting ? <CircularProgress size={11}/> : 'x'}
            </button>
          </Tooltip>
        </div>
      </div>

      <h3 className="text-[15px] font-semibold text-gray-100 mb-5 leading-relaxed tracking-tight">
        {poll.question}
      </h3>

      <div className="space-y-2.5 mb-4">
        {poll.options.map(opt => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
          const mine = myOptId === opt._id
          return (
            <div key={opt._id}>
              <button
                disabled={!canVote}
                onClick={() => canVote && onVote(poll._id, opt._id)}
                className={hasVoted ? (mine ? 'option-mine' : 'option-voted') : (isExpired ? 'option-voted opacity-60' : 'option-idle')}
              >
                <span className="flex items-center gap-2">
                  {mine && <span className="text-brand-400">Selected</span>}
                  {opt.text}
                </span>
                {total > 0 && (
                  <span className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                    <span className={mine ? 'text-brand-400 font-bold' : 'text-gray-600'}>{pct}%</span>
                    <span className="text-gray-700">{opt.votes}v</span>
                  </span>
                )}
              </button>
              {total > 0 && (
                <div className="mt-1.5 px-1">
                  <LinearProgress variant="determinate" value={pct} sx={{
                    backgroundColor:'#1a1a24',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: mine ? '#6366f1' : '#2e2e3e',
                      transition:'transform 0.8s cubic-bezier(0.4,0,0.2,1)',
                    }
                  }}/>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {total > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Results</span>
            <div className="flex rounded-lg border border-surface-500 overflow-hidden text-[10px]">
              {['bar','pie'].map(t => (
                <button key={t} onClick={() => setChartType(ct => ct === t ? null : t)}
                  className={`px-2.5 py-1 font-semibold transition-colors
                    ${chartType === t ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-300'}`}>
                  {t === 'bar' ? 'Bar' : 'Pie'}
                </button>
              ))}
            </div>
          </div>
          {chartType && <ResultsChart options={poll.options} totalVotes={total} type={chartType} />}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-surface-600">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{total} vote{total!==1?'s':''}</span>
          {hasVoted
            ? <span className="text-xs text-brand-500 font-semibold">Voted</span>
            : isExpired
              ? <span className="text-xs text-red-500 font-semibold">Closed</span>
              : <span className="text-xs text-gray-700 italic">Cast your vote</span>}
        </div>

        <div className="flex items-center gap-2">
          {poll.insight && (
            <button onClick={() => setShowInsight(s => !s)}
              className="text-xs text-violet-500 hover:text-violet-300 transition-colors">
              {showInsight ? 'Hide' : 'Show'} insight
            </button>
          )}
          {total > 0 && (
            <Tooltip title={aiLoading ? 'Analysing...' : 'Get AI insight on these results'}>
              <button className="btn-ai" onClick={handleGetInsight} disabled={aiLoading}>
                {aiLoading ? <CircularProgress size={10} sx={{ color:'#a78bfa' }}/> : 'AI'}
                <span>{aiLoading ? '...' : 'Analyse'}</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {aiError && (
        <div className="mt-3 px-3 py-2 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-400">
          {aiError}
        </div>
      )}

      {showInsight && poll.insight && (
        <div className="mt-3 px-4 py-3 bg-violet-950/30 border border-violet-800/40 rounded-xl text-xs text-violet-200 leading-relaxed animate-fade-up">
          <div className="text-[10px] text-violet-400 font-bold uppercase tracking-wider mb-1.5">AI Analysis</div>
          {poll.insight}
        </div>
      )}

      <CommentsSection poll={poll} onPost={onComment} onDelete={onDeleteComment} />
    </article>
  )
}
