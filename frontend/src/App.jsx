import { useState } from 'react'
import Snackbar  from '@mui/material/Snackbar'
import Alert     from '@mui/material/Alert'
import Header       from './components/Header.jsx'
import PollCard     from './components/PollCard.jsx'
import CreateModal  from './components/CreateModal.jsx'
import EditModal    from './components/EditModal.jsx'
import StatsPanel   from './components/StatsPanel.jsx'
import SkeletonCard from './components/SkeletonCard.jsx'
import { usePolls, useVoted } from './hooks/usePolls.js'

export default function App() {
  const {
    polls, loading, error, filters, setFilters,
    addPoll, editPoll, vote, removePoll, updateInsight,
    postComment, removeComment,
  } = usePolls()

  const [voted, markVoted]   = useVoted()
  const [showCreate, setShowCreate] = useState(false)
  const [editPollData, setEditPollData] = useState(null)
  const [toast, setToast]    = useState({ open:false, msg:'', sev:'success' })

  const notify = (msg, sev = 'success') => setToast({ open:true, msg, sev })

  const handleVote = async (pollId, optionId) => {
    if (voted[pollId]) return
    try {
      await vote(pollId, optionId)
      markVoted(pollId, optionId)
      notify('Vote recorded')
    } catch (e) {
      notify(e.response?.data?.error || 'Vote failed', 'error')
    }
  }

  const handleCreate = async (data) => {
    await addPoll(data)
    notify(data.aiGenerated ? 'AI poll created' : 'Poll created')
  }

  const handleEdit = async (id, data) => {
    await editPoll(id, data)
    notify('Poll updated')
  }

  const handleDelete = async (id) => {
    await removePoll(id)
    notify('Poll deleted')
  }

  const stats = { polls: polls.length, votes: polls.reduce((s,p) => s + p.totalVotes, 0) }

  return (
    <div className="min-h-screen bg-surface-900">
      <Header filters={filters} setFilters={setFilters} onNew={() => setShowCreate(true)} stats={stats} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <SkeletonCard key={i}/>)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
            <div className="text-5xl font-bold text-amber-500">!</div>
            <p className="text-gray-400 font-semibold text-lg">Could not reach the server</p>
            <p className="text-sm text-gray-600 max-w-sm">{error}</p>
            <div className="mt-2 px-4 py-3 bg-surface-800 border border-surface-600 rounded-xl text-xs text-gray-600 font-mono">
              cd backend && npm run dev
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {polls.length > 0 && <StatsPanel polls={polls} />}

            {/* Empty state */}
            {polls.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
                <div className="relative">
                  <div className="text-5xl font-bold text-brand-500">FP</div>
                </div>
                <h2 className="text-2xl font-bold text-gray-500 mt-2">No polls yet</h2>
                <p className="text-gray-700 max-w-sm leading-relaxed">
                  Create your first poll manually, or type a topic and let AI build one for you in seconds.
                </p>
                <button className="btn-primary mt-2 text-base px-6 py-3" onClick={() => setShowCreate(true)}>
                  + Create first poll
                </button>
              </div>
            )}

            {/* Poll grid */}
            {polls.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {polls.map((poll, i) => (
                  <div key={poll._id} style={{ animationDelay:`${Math.min(i*40, 300)}ms` }}>
                    <PollCard
                      poll={poll}
                      voted={voted[poll._id]}
                      onVote={handleVote}
                      onDelete={handleDelete}
                      onEdit={setEditPollData}
                      onInsightSaved={updateInsight}
                      onComment={postComment}
                      onDeleteComment={removeComment}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      <EditModal   poll={editPollData} open={!!editPollData} onClose={() => setEditPollData(null)} onSave={handleEdit} />

      <Snackbar open={toast.open} autoHideDuration={3000}
        onClose={() => setToast(t => ({ ...t, open:false }))}
        anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert severity={toast.sev} variant="filled" sx={{ fontFamily:'inherit', fontSize:'0.8rem' }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  )
}
