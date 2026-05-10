'use client'

export default function MiniBarGraph() {
  return (
    <div className="flex items-end justify-center gap-1.5 h-8">
      {[0, 1, 2, 3, 4, 5].map((idx) => (
        <div
          key={idx}
          className="w-1.5 bg-emerald-500/80 rounded-sm animate-pillar"
          style={{
            animationDelay: `${idx * 150}ms`,
            animationDuration: `${800 + idx * 100}ms`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes pillar-bounce {
          0%, 100% {
            height: 20%;
          }
          50% {
            height: 85%;
          }
        }

        .animate-pillar {
          animation: pillar-bounce ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-pillar {
            animation: none;
            height: 50%;
          }
        }
      `}</style>
    </div>
  )
}