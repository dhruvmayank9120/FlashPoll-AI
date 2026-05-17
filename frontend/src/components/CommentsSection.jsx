import { useState } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444']
function avatarColor(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function CommentsSection({ poll, onPost, onDelete }) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  const comments = poll.comments || []

  const handlePost = async () => {
    if (!text.trim()) { setErr('Write something first.'); return }
    setPosting(true)
    setErr('')
    try {
      await onPost(poll._id, text.trim(), author.trim() || 'Anonymous')
      setText('')
      setAuthor('')
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to post comment.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mt-4 border-t border-surface-600 pt-4">
      <button
        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-300 transition-colors w-full"
        onClick={() => setOpen(o => !o)}
      >
        <span>Comments</span>
        <span>{comments.length}</span>
        <span className="ml-auto text-gray-700">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-up">
          {comments.length === 0 && (
            <p className="text-xs text-gray-700 italic text-center py-2">No comments yet - be the first.</p>
          )}
          {comments.map(c => (
            <div key={c._id} className="flex gap-2.5 group">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: avatarColor(c.author) }}>
                {c.author[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-300">{c.author}</span>
                  <span className="text-[10px] text-gray-700">{timeAgo(c.createdAt)}</span>
                  <Tooltip title="Delete comment">
                    <button
                      onClick={() => onDelete(poll._id, c._id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-gray-700
                                 hover:text-red-400 transition-all text-xs leading-none"
                    >x</button>
                  </Tooltip>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed break-words">{c.text}</p>
              </div>
            </div>
          ))}

          <div className="mt-3 space-y-2 pt-3 border-t border-surface-700">
            <div className="flex gap-2">
              <input
                className="input-base text-xs py-2 w-28 flex-shrink-0"
                placeholder="Your name"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                maxLength={40}
              />
              <input
                className="input-base text-xs py-2 flex-1"
                placeholder="Add a comment..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
                maxLength={500}
              />
              <button
                className="btn-primary text-xs px-3 flex-shrink-0 flex items-center gap-1"
                onClick={handlePost}
                disabled={posting}
              >
                {posting ? <CircularProgress size={10} sx={{ color:'white' }} /> : 'Post'}
              </button>
            </div>
            {err && <p className="text-[11px] text-red-400">{err}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
