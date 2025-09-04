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
    <header className={`sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ${
      scrolled ? 'shadow-lg' : ''
    }`}>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="group flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors duration-300">
                <span className="text-white font-bold text-sm">TP</span>
              </div>
              <span className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors duration-300">
                Trip Planner
              </span>
            </Link>
          </div>
          
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-1">
              <li>
                <Link href="/map" className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 font-medium">
                  Harita
                </Link>
              </li>
              <li>
                <Link href="/daily-planner" className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 font-medium">
                  Planlayıcı
                </Link>
              </li>
              <li>
                <Link href="/budget" className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 font-medium">
                  Bütçe
                </Link>
              </li>
              <li>
                <Link href="/my-plans" className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 font-medium">
                  Planlarım
                </Link>
              </li>
            </ul>
          </nav>
          
          <div className="hidden md:flex items-center space-x-3">
            <Link href="/travel-mode" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200">
              Yeni Plan
            </Link>
            <UserNav />
          </div>
          
          <div className="md:hidden flex items-center">
            <button 
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Ana menüyü aç/kapat"
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 pt-4 pb-6 space-y-1">
            <Link 
              href="/map" 
              className="block px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Harita
            </Link>
            <Link 
              href="/daily-planner" 
              className="block px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Planlayıcı
            </Link>
            <Link 
              href="/budget" 
              className="block px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Bütçe
            </Link>
            <Link 
              href="/my-plans" 
              className="block px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Planlarım
            </Link>
            
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <Link 
                href="/travel-mode"
                className="block w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-center font-medium hover:bg-blue-700 transition-colors duration-200 mb-4"
                onClick={() => setIsMenuOpen(false)}
              >
                Yeni Plan Oluştur
              </Link>
              
              <div className="flex justify-center space-x-2">
                {!session ? (
                  <>
                    <Link 
                      href="/login"
                      className="flex-1 px-4 py-2 text-blue-600 font-medium text-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Giriş
                    </Link>
                    <Link 
                      href="/register"
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-center font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Kayıt
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/profile"
                      className="flex-1 px-4 py-2 text-blue-600 font-medium text-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Profil
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
