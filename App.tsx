import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TripForm } from './components/TripForm';
import { ItineraryView } from './components/ItineraryView';
import { UserPreferences, ItineraryResult } from './types';
import { generateItinerary } from './services/geminiService';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

const STORAGE_KEY = 'teruel_saved_itineraries';

// Inner App Component that consumes Context
const AppContent: React.FC = () => {
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<ItineraryResult[]>([]);
  
  const { t, language } = useLanguage();

  // Load saved itineraries from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedItineraries(parsed);
        }
      } catch (e) {
        console.error("Failed to load saved itineraries", e);
      }
    }
  }, []);

  const saveItineraryToHistory = (newItinerary: ItineraryResult) => {
    // If it has a timestamp, check if it exists in history
    const existingIndex = newItinerary.timestamp 
      ? savedItineraries.findIndex(i => i.timestamp === newItinerary.timestamp)
      : -1;

    let updatedHistory;
    let itineraryWithDate;

    if (existingIndex >= 0) {
      // Update existing
      itineraryWithDate = { ...newItinerary }; // Keep existing timestamp
      updatedHistory = [...savedItineraries];
      updatedHistory[existingIndex] = itineraryWithDate;
      // Move to top
      updatedHistory.splice(existingIndex, 1);
      updatedHistory.unshift(itineraryWithDate);
    } else {
      // Create new
      itineraryWithDate = { ...newItinerary, timestamp: Date.now() };
      updatedHistory = [itineraryWithDate, ...savedItineraries].slice(0, 10); // Keep last 10
    }

    setSavedItineraries(updatedHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return itineraryWithDate;
  };

  const clearHistory = () => {
    if (window.confirm(t('saved.confirm_clear'))) {
      setSavedItineraries([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleGenerate = async (prefs: UserPreferences) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateItinerary(prefs);
      setItinerary(result);
    } catch (e) {
      console.error("Generation error caught in App:", e);
      // Determine if it's a config error or a generic one
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      if (errorMessage.includes("API Key") || errorMessage.includes("configured")) {
          // Show specific config error
          setError(`Configuration Error: ${errorMessage}`);
      } else {
          // Show generic user friendly error
          setError(t('error.generate'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Modified to accept an optional updated version of the itinerary
  const handleSave = (updatedItinerary?: ItineraryResult) => {
    const itineraryToSave = updatedItinerary || itinerary;
    if (itineraryToSave) {
      const saved = saveItineraryToHistory(itineraryToSave);
      setItinerary(saved);
    }
  };

  const handleReset = () => {
    setItinerary(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow">
        {!itinerary ? (
          <>
            {/* Hero Section */}
            <div className="relative bg-teruel-dark h-[400px] flex items-center justify-center overflow-hidden">
               {/* Overlay Image - Using a generic landscape that looks like Teruel (mountains, stone) */}
              <div 
                className="absolute inset-0 z-0 opacity-50 bg-cover bg-center"
                style={{ backgroundImage: `url('https://picsum.photos/seed/teruel_spain_mountains/1920/1080')` }}
              ></div>
              <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-teruel-stone/90"></div>
              
              <div className="relative z-10 text-center px-4 max-w-3xl pb-20">
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 drop-shadow-md">
                  {t('hero.title')}
                </h2>
                <p className="text-lg md:text-xl text-gray-200 font-light">
                  {t('hero.subtitle')}
                </p>
              </div>
            </div>

            {/* Form Section */}
            <div className="px-4 pb-20 bg-teruel-stone">
              <TripForm isLoading={loading} onSubmit={handleGenerate} />
              
              {error && (
                <div className="max-w-2xl mx-auto mt-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded text-center shadow-sm">
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
              )}

              {/* Saved Itineraries List */}
              {savedItineraries.length > 0 && (
                <div className="max-w-4xl mx-auto mt-16 animate-fade-in">
                  <div className="flex justify-between items-end mb-6 border-b border-gray-300 pb-2">
                    <h3 className="text-2xl font-serif font-bold text-teruel-dark">{t('saved.title')}</h3>
                    <button 
                      onClick={clearHistory}
                      className="text-xs text-red-500 hover:text-red-700 uppercase tracking-widest font-bold"
                    >
                      {t('saved.clear')}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {savedItineraries.map((trip, idx) => (
                      <div 
                        key={trip.timestamp || idx} 
                        onClick={() => setItinerary(trip)}
                        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-teruel-ochre overflow-hidden group"
                      >
                        <div className="p-5">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-lg text-teruel-dark group-hover:text-teruel-red transition-colors line-clamp-1">
                              {trip.title}
                            </h4>
                            <div className="flex items-center">
                              {/* Language Badge */}
                              <span className="text-[10px] bg-teruel-ochre text-white font-bold px-1.5 py-0.5 rounded mr-2">
                                {trip.language?.toUpperCase() || 'ES'}
                              </span>
                              {trip.timestamp && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full whitespace-nowrap">
                                  {new Date(trip.timestamp).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{trip.description}</p>
                          <div className="mt-4 flex items-center text-xs font-bold text-teruel-green uppercase tracking-wide">
                            <span>{t('saved.view')}</span>
                            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Features Grid */}
            <div className="py-16 bg-white px-4">
              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="p-6">
                  <div className="w-16 h-16 bg-teruel-red text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🏛️</div>
                  <h3 className="text-xl font-bold mb-2 text-teruel-dark">{t('feat.history.title')}</h3>
                  <p className="text-gray-600">{t('feat.history.desc')}</p>
                </div>
                <div className="p-6">
                  <div className="w-16 h-16 bg-teruel-green text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🦕</div>
                  <h3 className="text-xl font-bold mb-2 text-teruel-dark">{t('feat.nature.title')}</h3>
                  <p className="text-gray-600">{t('feat.nature.desc')}</p>
                </div>
                <div className="p-6">
                  <div className="w-16 h-16 bg-teruel-ochre text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🍖</div>
                  <h3 className="text-xl font-bold mb-2 text-teruel-dark">{t('feat.food.title')}</h3>
                  <p className="text-gray-600">{t('feat.food.desc')}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-teruel-stone min-h-screen pb-20">
             <ItineraryView itinerary={itinerary} onReset={handleReset} onSave={handleSave} />
          </div>
        )}
      </main>

      <footer className="bg-teruel-dark text-gray-400 py-8 px-4 text-center border-t border-gray-700">
        <p className="mb-2">© {new Date().getFullYear()} {t('footer.rights')}</p>
        <p className="text-xs">
          {t('footer.disclaimer')}
        </p>
      </footer>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;