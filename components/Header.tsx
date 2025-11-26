import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const Header: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="bg-teruel-dark text-teruel-stone py-4 px-6 shadow-md sticky top-0 z-50 border-b-4 border-teruel-red">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {/* Stylized Icon resembling Mudejar Star */}
          <svg className="w-8 h-8 text-teruel-ochre" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" />
          </svg>
          <h1 className="text-2xl font-serif font-bold tracking-wider hidden sm:block">TERUEL MÁGICA</h1>
          <h1 className="text-xl font-serif font-bold tracking-wider sm:hidden">TERUEL</h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex space-x-6 text-sm font-semibold uppercase tracking-widest text-teruel-ochre">
            <span className="hover:text-white transition cursor-default">{t('nav.home')}</span>
            <span className="hover:text-white transition cursor-default">{t('nav.history')}</span>
            <span className="hover:text-white transition cursor-default">{t('nav.gastronomy')}</span>
          </nav>
          
          {/* Language Switcher */}
          <div className="flex items-center bg-teruel-stone/10 rounded-full p-1">
             <button 
               onClick={() => setLanguage('es')}
               className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${language === 'es' ? 'bg-teruel-ochre text-teruel-dark' : 'text-teruel-stone hover:text-white'}`}
             >
               ES
             </button>
             <button 
               onClick={() => setLanguage('en')}
               className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${language === 'en' ? 'bg-teruel-ochre text-teruel-dark' : 'text-teruel-stone hover:text-white'}`}
             >
               EN
             </button>
          </div>
        </div>
      </div>
    </header>
  );
};