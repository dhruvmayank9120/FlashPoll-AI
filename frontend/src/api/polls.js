import axios from 'axios'

const http = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } })

export const getPolls          = (params = {})       => http.get('/polls', { params }).then(r => r.data)
export const getPoll           = id                   => http.get(`/polls/${id}`).then(r => r.data)
export const createPoll        = body                 => http.post('/polls', body).then(r => r.data)
export const updatePoll        = (id, body)           => http.patch(`/polls/${id}`, body).then(r => r.data)
export const votePoll          = (id, optionId)       => http.patch(`/polls/${id}/vote`, { optionId }).then(r => r.data)
export const deletePoll        = id                   => http.delete(`/polls/${id}`).then(r => r.data)
export const saveInsight       = (id, insight)        => http.patch(`/polls/${id}/insight`, { insight }).then(r => r.data)
export const addComment        = (id, text, author)   => http.post(`/polls/${id}/comments`, { text, author }).then(r => r.data)
export const deleteComment     = (id, commentId)      => http.delete(`/polls/${id}/comments/${commentId}`).then(r => r.data)
export const getStats          = ()                   => http.get('/polls/stats').then(r => r.data)
export const exportCsv         = ()                   => { window.open('/api/polls/export.csv', '_blank') }

export const aiGeneratePoll    = topic    => http.post('/ai/generate-poll',    { topic }).then(r => r.data)
export const aiImproveQuestion = question => http.post('/ai/improve-question', { question }).then(r => r.data)
export const aiSuggestCategory = question => http.post('/ai/suggest-category', { question }).then(r => r.data)
export const aiGetInsight      = (q, opts)=> http.post('/ai/insight', { question: q, options: opts }).then(r => r.data)
export const aiSuggestOptions  = (q, ex)  => http.post('/ai/suggest-options', { question: q, existing: ex }).then(r => r.data)
export const checkHealth       = ()       => http.get('/health').then(r => r.data)
