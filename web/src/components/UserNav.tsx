"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function UserNav() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="relative">
      {status === "authenticated" ? (
        <>
          <button
            onClick={toggleDropdown}
            className="flex items-center space-x-2 focus:outline-none"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
              {session.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden md:inline text-gray-200">{session.user?.name || "Kullanıcı"}</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-700">
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                Profilim
              </Link>
              <Link
                href="/my-trips"
                className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                Seyahatlerim
              </Link>
              <button
                onClick={() => {
                  signOut({ callbackUrl: "/" });
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                Çıkış Yap
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex space-x-4">
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Kayıt Ol
          </Link>
        </div>
      )}
    </div>
  );
}
