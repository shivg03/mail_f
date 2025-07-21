import { useLocation } from "wouter";

interface RightSidebarProps {
  collapsed?: boolean;
}

export default function RightSidebar({ collapsed = false }: RightSidebarProps) {
  const [, setLocation] = useLocation();
  return (
    <aside className={`${collapsed ? 'hidden md:flex' : 'flex'} w-16 bg-card border-l flex-col items-center py-4`}>
      <button 
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group relative" 
        title="Back"
        onClick={() => setLocation("/")}
      >
        <svg className="w-5 h-5" fill="none" stroke="url(#gradient)" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffa184" />
              <stop offset="35%" stopColor="#ffc3a0" />
              <stop offset="70%" stopColor="#ff6b6b" />
            </linearGradient>
          </defs>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
    </aside>
  );
}
