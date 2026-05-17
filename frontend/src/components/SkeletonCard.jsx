export default function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-surface-600 rounded-full"/>
          <div className="h-5 w-14 bg-surface-700 rounded-full"/>
        </div>
        <div className="h-5 w-5 bg-surface-700 rounded"/>
      </div>
      <div className="h-4 bg-surface-600 rounded w-full mb-2"/>
      <div className="h-4 bg-surface-600 rounded w-4/5 mb-6"/>
      <div className="space-y-2.5">
        {[1,2,3].map(i => (
          <div key={i} className="h-11 bg-surface-700 rounded-xl" style={{ opacity: 1 - i*0.15 }}/>
        ))}
      </div>
      <div className="flex justify-between mt-5 pt-4 border-t border-surface-600">
        <div className="h-3 w-16 bg-surface-700 rounded"/>
        <div className="h-3 w-20 bg-surface-700 rounded"/>
      </div>
    </div>
  )
}
