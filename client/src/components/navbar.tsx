import { Mail, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import LogoIcon from "../../assets/icon-mail-n.svg?react"; // updated import

export function Navbar() {
  const [location] = useLocation();

  const handleBackNavigation = () => {
    window.history.back();
  };

  return (
    <nav className="bg-white border-b border-gray-200 fixed w-full top-0 z-50">
      <div className="flex items-center justify-between py-[7px] px-4 md:px-8">
        {/* Left: Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 flex items-center justify-center">
            <LogoIcon className="w-10 h-10 text-[#ffa184]" style={{ fill: '#ffa184' }} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Fusion Mail</h1>
        </div>

        {/* Right: Gradient Left Arrow Icon */}
        <div>
          <button
            onClick={handleBackNavigation}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group relative"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="gradient-arrow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffa184" />
                  <stop offset="35%" stopColor="#ffc3a0" />
                  <stop offset="70%" stopColor="#ff6b6b" />
                </linearGradient>
              </defs>
              <path
                stroke="url(#gradient-arrow)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
