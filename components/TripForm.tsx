import React, { useState } from 'react';
import { UserPreferences, TripScope, TripTheme } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TripFormProps {
  isLoading: boolean;
  onSubmit: (prefs: UserPreferences) => void;
}

const locationsByScope = {
  [TripScope.PROVINCE]: ['Toda la Provincia', 'Sierra de Albarracín', 'Maestrazgo', 'Bajo Aragón', 'Gúdar-Javalambre'],
  [TripScope.CITY]: ['Teruel Capital', 'Albarracín', 'Alcañiz', 'Mora de Rubielos', 'Valderrobres', 'Calanda', 'Alcorisa']
};

export const TripForm: React.FC<TripFormProps> = ({ isLoading, onSubmit }) => {
  const { t, language } = useLanguage();
  const [scope, setScope] = useState<TripScope>(TripScope.CITY);
  const [location, setLocation] = useState<string>('Teruel Capital');
  const [theme, setTheme] = useState<TripTheme>(TripTheme.HISTORICAL);
  const [days, setDays] = useState<number>(2);
  const [budget, setBudget] = useState<'Económico' | 'Medio' | 'Lujo'>('Medio');

  const handleScopeChange = (newScope: TripScope) => {
    setScope(newScope);
    // Reset location to first item of new scope
    setLocation(locationsByScope[newScope][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ scope, location, theme, days, budget, language });
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 max-w-2xl mx-auto -mt-10 relative z-10 border-t-8 border-teruel-ochre">
      <h2 className="text-2xl font-serif font-bold text-teruel-dark mb-6 text-center">
        {t('form.title')}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Scope and Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">{t('form.scope')}</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {Object.values(TripScope).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleScopeChange(s)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                    scope === s ? 'bg-teruel-red text-white shadow-md' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {s === TripScope.PROVINCE ? t('scope.Provincia') : t('scope.Ciudad')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">{t('form.destination')}</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teruel-ochre focus:border-teruel-ochre"
            >
              {locationsByScope[scope].map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Theme and Days */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">{t('form.theme')}</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as TripTheme)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teruel-ochre focus:border-teruel-ochre"
            >
              {Object.values(TripTheme).map(tVal => (
                <option key={tVal} value={tVal}>{t(`theme.${tVal}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              {t('form.duration')}: <span className="text-teruel-red">{days} {t('form.days')}</span>
            </label>
            <input
              type="range"
              min="1"
              max="7"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teruel-red"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{t('form.day_1')}</span>
              <span>{t('form.day_7')}</span>
            </div>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">{t('form.budget')}</label>
          <div className="flex gap-4">
            {['Económico', 'Medio', 'Lujo'].map((b) => (
              <label key={b} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="budget"
                  value={b}
                  checked={budget === b}
                  onChange={() => setBudget(b as any)}
                  className="w-4 h-4 text-teruel-red focus:ring-teruel-red border-gray-300 focus:ring-2"
                />
                <span className="ml-2 text-sm text-gray-700">{t(`budget.${b}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-lg text-white font-bold text-lg uppercase tracking-wider shadow-lg transition-all transform hover:-translate-y-1 ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-teruel-green hover:bg-green-800'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('form.generating')}
            </span>
          ) : t('form.generate')}
        </button>
      </form>
    </div>
  );
};