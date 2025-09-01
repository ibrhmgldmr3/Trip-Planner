"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import UserNav from "./UserNav";
import { useSession } from "next-auth/react";

export default function MobileMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-gray-900 border-b border-gray-800 transition-shadow ${
      scrolled ? 'shadow-md' : ''
    }`}>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-500 hover:text-blue-400 transition-colors">
              Trip Planner
            </Link>
          </div>
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-6">
              <li><Link href="/map" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">Rota Planlayıcı</Link></li>
              <li><Link href="/transportation" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">Ulaşım</Link></li>
              <li><Link href="/accommodation" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">Konaklama</Link></li>
              <li><Link href="/daily-planner" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">Günlük Plan</Link></li>
              <li><Link href="/budget" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">Maliyet</Link></li>
            </ul>
          </nav>
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/travel-mode" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors hover-lift">Planlamaya Başla</Link>
            <UserNav />
          </div>
          <div className="md:hidden flex items-center">
            <button 
              className="p-2 rounded-md text-gray-300 hover:text-blue-400 focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Ana menüyü aç/kapat"
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800">
          <div className="px-4 pt-2 pb-3 space-y-1 fade-in">
            <Link 
              href="/map" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:text-blue-400 hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Rota Planlayıcı
            </Link>
            <Link 
              href="/transportation" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:text-blue-400 hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Ulaşım
            </Link>
            <Link 
              href="/accommodation" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:text-blue-400 hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Konaklama
            </Link>
            <Link 
              href="/daily-planner" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:text-blue-400 hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Günlük Plan
            </Link>
            <Link 
              href="/budget" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:text-blue-400 hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Maliyet
            </Link>
            <div className="pt-2 pb-1">
              <Link 
                href="/travel-mode"
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm text-center hover:bg-blue-700 transition-colors mb-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Planlamaya Başla
              </Link>
              
              <div className="flex justify-center mt-3 border-t border-gray-800 pt-3">
                {!session ? (
                  <>
                    <Link 
                      href="/login"
                      className="px-4 py-2 text-blue-400 font-medium text-sm text-center hover:bg-gray-800 rounded-lg transition-colors mr-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Giriş Yap
                    </Link>
                    <Link 
                      href="/register"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm text-center hover:bg-blue-700 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Kayıt Ol
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/profile"
                      className="px-4 py-2 text-blue-400 font-medium text-sm text-center hover:bg-gray-800 rounded-lg transition-colors mr-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Profilim
                    </Link>
                    <Link 
                      href="/my-plans"
                      className="px-4 py-2 text-blue-400 font-medium text-sm text-center hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Planlarım
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
