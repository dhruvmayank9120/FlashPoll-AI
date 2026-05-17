import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CAT_COLORS = {
  General:'#94a3b8', Strategy:'#a78bfa', Product:'#60a5fa', Engineering:'#4ade80',
  Design:'#fbbf24', Operations:'#c084fc', HR:'#f472b6', Marketing:'#fb923c', Finance:'#34d399',
}

export default function StatsPanel({ polls }) {
  const totalVotes = polls.reduce((s,p) => s + p.totalVotes, 0)
  const aiCount    = polls.filter(p => p.aiGenerated).length
  const withVotes  = polls.filter(p => p.totalVotes > 0).length
  const expired    = polls.filter(p => p.isExpired).length

  const byCategory = polls.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {})

  const catData = Object.entries(byCategory).map(([cat, count]) => ({
    cat, count, fill: CAT_COLORS[cat] || '#6366f1',
  }))

  const trending = [...polls]
    .filter(p => p.totalVotes > 0)
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 3)

  const kpis = [
    { label:'Active Polls', value: polls.length, icon:'P', color:'#6366f1' },
    { label:'Total Votes', value: totalVotes, icon:'V', color:'#4ade80' },
    { label:'AI Generated', value: aiCount, icon:'AI', color:'#a78bfa' },
    { label:'With Votes', value: withVotes, icon:'OK', color:'#60a5fa' },
  ]

  return (
    <div className="mb-6 space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface-800 border border-surface-600 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{k.icon}</span>
              {k.label === 'Active Polls' && expired > 0 && (
                <span className="text-[10px] text-red-500 font-bold ml-auto">{expired} expired</span>
              )}
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Category bar chart + trending */}
      {catData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface-800 border border-surface-600 rounded-xl p-4">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-3">Polls by Category</div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ top:0,right:0,bottom:0,left:-28 }} barCategoryGap="25%">
                  <XAxis dataKey="cat" tick={{ fontSize:8, fill:'#555' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background:'#13131a', border:'1px solid #2e2e3e', borderRadius:8, fontSize:11 }}
                    cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="count" radius={[3,3,0,0]}>
                    {catData.map((d,i) => <Cell key={i} fill={d.fill}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {trending.length > 0 && (
            <div className="bg-surface-800 border border-surface-600 rounded-xl p-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-3">Trending Polls</div>
              <div className="space-y-2">
                {trending.map((p, i) => (
                  <div key={p._id} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-700 w-4">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-300 truncate">{p.question}</div>
                      <div className="text-[10px] text-gray-600">{p.totalVotes} votes</div>
                    </div>
                    <div className="w-1.5 h-8 rounded-full" style={{
                      background: '#6366f1',
                      opacity: 0.3 + (0.7 * (i === 0 ? 1 : i === 1 ? 0.65 : 0.35))
                    }}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
