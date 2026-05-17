import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const PALETTE = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6']

function shortLabel(text, max = 14) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-gray-200 mb-1">{d.text}</p>
      <p className="text-brand-400"><strong>{d.votes}</strong> votes / <strong>{d.percent}%</strong></p>
    </div>
  )
}

export default function ResultsChart({ options, totalVotes, type = 'bar' }) {
  const data = options.map((o, i) => ({
    text: o.text,
    label: shortLabel(o.text),
    votes: o.votes,
    percent: totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0,
    fill: PALETTE[i % PALETTE.length],
  }))

  if (totalVotes === 0) return (
    <div className="h-28 flex items-center justify-center text-xs text-gray-700 italic">
      No votes yet - chart appears after voting
    </div>
  )

  if (type === 'pie') return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="votes" nameKey="label" cx="50%" cy="50%"
            innerRadius={38} outerRadius={60} paddingAngle={3} strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(v) => <span className="text-[10px] text-gray-400">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top:4, right:4, bottom:0, left:-24 }} barCategoryGap="30%">
          <XAxis dataKey="label" tick={{ fontSize:9, fill:'#555' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize:9, fill:'#444' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="votes" radius={[4,4,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
