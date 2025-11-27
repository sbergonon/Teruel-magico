import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ItineraryResult, Activity } from '../types';
import { useLanguage } from '../context/LanguageContext';

// Map Style Configuration
type MapStyle = 'standard' | 'satellite' | 'terrain' | 'light';

const MAP_STYLES: Record<MapStyle, { url: string, attribution: string, nameKey: string }> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    nameKey: 'view.layer_standard'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    nameKey: 'view.layer_satellite'
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    nameKey: 'view.layer_terrain'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
    nameKey: 'view.layer_light'
  }
};

interface ItineraryViewProps {
  itinerary: ItineraryResult;
  onReset: () => void;
  onSave: (itinerary: ItineraryResult) => void;
}

// Helper functions
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const estimateTravelTime = (distanceKm: number) => {
  const hours = distanceKm / 60;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

const getActivityKey = (act: Activity) => `${act.placeName}-${act.time}`;

const getReservationLink = (placeName: string, type: 'LODGING' | 'FOOD') => {
    return `https://www.google.com/search?q=reserva+${encodeURIComponent(placeName)}+Teruel`;
};

// --- AUDIO GUIDE COMPONENT ---
interface TourOverlayProps {
  dayTitle: string;
  activities: Activity[];
  onClose: () => void;
}

const TourOverlay: React.FC<TourOverlayProps> = ({ dayTitle, activities, onClose }) => {
  const { t, language } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  
  const currentActivity = activities[currentStep];
  const synthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = () => {
    if (synthesis.speaking) {
      synthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const speak = (text: string) => {
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === 'es' ? 'es-ES' : 'en-US';
    u.rate = rate;
    u.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utteranceRef.current = u;
    synthesis.speak(u);
    setIsSpeaking(true);
    setIsPaused(false);
  };

  const handlePlayPause = () => {
    if (isSpeaking && !isPaused) {
      synthesis.pause();
      setIsPaused(true);
    } else if (isPaused) {
      synthesis.resume();
      setIsPaused(false);
    } else {
      speak(`${currentActivity.placeName}. ${currentActivity.description}`);
    }
  };

  const handleNext = () => {
    stopSpeaking();
    if (currentStep < activities.length - 1) setCurrentStep(p => p + 1);
  };

  const handlePrev = () => {
    stopSpeaking();
    if (currentStep > 0) setCurrentStep(p => p - 1);
  };

  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="fixed inset-0 z-[2000] bg-teruel-dark/95 text-white flex flex-col items-center justify-center p-6 animate-fade-in">
      <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <div className="max-w-2xl w-full text-center space-y-6">
        <div>
          <h3 className="text-teruel-ochre text-sm font-bold uppercase tracking-widest mb-2">{dayTitle} &bull; {currentStep + 1} / {activities.length}</h3>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">{currentActivity.placeName}</h2>
          <div className="inline-block bg-teruel-red px-3 py-1 rounded text-sm font-bold">{currentActivity.time}</div>
        </div>
        <p className="text-xl font-light text-gray-200">{currentActivity.description}</p>
        
        <div className="flex flex-col items-center gap-4 bg-white/10 p-6 rounded-xl">
           <div className="flex items-center gap-6">
              <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-teruel-ochre text-teruel-dark flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                {isSpeaking && !isPaused ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                ) : (
                  <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <button onClick={stopSpeaking} className="w-12 h-12 rounded-full border-2 border-gray-400 text-gray-300 flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
              </button>
           </div>
           <div className="flex items-center gap-2 w-full max-w-xs">
              <span className="text-xs text-gray-400">{rate}x</span>
              <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer" />
           </div>
        </div>

        <div className="flex justify-between w-full pt-4 border-t border-gray-700">
          <button onClick={handlePrev} disabled={currentStep === 0} className={`text-lg font-bold ${currentStep === 0 ? 'text-gray-600' : 'text-white'}`}>&larr; {t('tour.prev')}</button>
          <button onClick={handleNext} disabled={currentStep === activities.length - 1} className={`text-lg font-bold ${currentStep === activities.length - 1 ? 'text-gray-600' : 'text-white'}`}>{t('tour.next')} &rarr;</button>
        </div>
      </div>
    </div>
  );
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({ itinerary, onReset, onSave }) => {
  const { t, language } = useLanguage();
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [filters, setFilters] = useState<Record<string, boolean>>({ VISIT: true, FOOD: true, LODGING: true, TRAVEL: true });
  const [comments, setComments] = useState<Record<string, string>>(itinerary.userComments || {});
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isMapView, setIsMapView] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>('standard');
  const [showLayerControl, setShowLayerControl] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);
  const [isTourActive, setIsTourActive] = useState(false);
  const [fetchingBusStops, setFetchingBusStops] = useState(false);
  const [fetchedAddresses, setFetchedAddresses] = useState<Record<string, string>>({});
  const [description, setDescription] = useState(itinerary.description);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  
  const days = itinerary.days || [];
  const currentDay = days.find(d => d.dayNumber === dayNumber) || days[0];
  
  if (!currentDay) return <div className="p-8 text-center"><button onClick={onReset} className="bg-red-500 text-white px-4 py-2 rounded">Error loading data. Reset.</button></div>;

  const activities = currentDay.activities || [];
  const hasCoordinates = activities.some(a => a.coordinates);

  useEffect(() => {
    const handleStatus = () => { setIsOnline(navigator.onLine); if(!navigator.onLine) setShowOfflineBanner(true); };
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => { window.removeEventListener('online', handleStatus); window.removeEventListener('offline', handleStatus); };
  }, []);

  useEffect(() => { setExpandedActivities({}); setSearchQuery(''); }, [dayNumber]);
  useEffect(() => { if (itinerary.userComments) setComments(itinerary.userComments); }, [itinerary]);
  useEffect(() => { const t = setTimeout(() => mapInstance.current?.invalidateSize(), 350); return () => clearTimeout(t); }, [isMapView, mapReady]);

  const onMarkerClick = useCallback((index: number) => {
      setExpandedActivities(p => ({ ...p, [index]: true }));
      const el = document.getElementById(`activity-item-${index}`);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-teruel-ochre');
          setTimeout(() => el.classList.remove('ring-2', 'ring-teruel-ochre'), 2000);
      }
  }, []);

  const saveComment = useCallback((act: Activity, comment: string) => {
      const key = `day_${dayNumber}_${getActivityKey(act)}`;
      const newComments = { ...comments, [key]: comment };
      setComments(newComments);
      onSave({ ...itinerary, description, userComments: newComments });
  }, [dayNumber, comments, itinerary, description, onSave]);

  const handleFetchBusStops = async () => {
    setFetchingBusStops(true);
    const newAddresses = { ...fetchedAddresses };
    const targets = activities.filter(a => a.type === 'TRAVEL' && a.coordinates && !a.address);
    for (const act of targets) {
        if (!act.coordinates) continue;
        try {
            const query = `[out:json];node["highway"="bus_stop"](around:500,${act.coordinates.lat},${act.coordinates.lng});out body;`;
            const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.elements?.[0]) {
                newAddresses[getActivityKey(act)] = `${data.elements[0].tags.name || 'Bus Stop'} (Detected)`;
            }
        } catch (e) { console.error(e); }
    }
    setFetchedAddresses(newAddresses);
    setFetchingBusStops(false);
  };

  const optimizeRoute = () => {
    if (activities.length < 3) return;
    const sorted = [...activities];
    const first = sorted.shift();
    if (!first) return;
    const result = [first];
    let current = first;
    while(sorted.length > 0) {
        let nearestIdx = -1, minDist = Infinity;
        sorted.forEach((act, idx) => {
            if (current.coordinates && act.coordinates) {
                const dist = getDistanceFromLatLonInKm(current.coordinates.lat, current.coordinates.lng, act.coordinates.lat, act.coordinates.lng);
                if (dist < minDist) { minDist = dist; nearestIdx = idx; }
            }
        });
        if (nearestIdx !== -1) {
            current = sorted[nearestIdx];
            result.push(current);
            sorted.splice(nearestIdx, 1);
        } else { result.push(...sorted); break; }
    }
    const newDays = itinerary.days.map(d => d.dayNumber === dayNumber ? { ...currentDay, activities: result } : d);
    onSave({ ...itinerary, description, days: newDays });
  };

  const handleEmailShare = () => {
      const subject = `${t('view.share_subject')}: ${itinerary.title}`;
      let body = `${itinerary.title}\n${description}\n\n`;
      itinerary.days.forEach(d => {
          body += `--- ${d.title} ---\n`;
          d.activities.forEach(a => {
             body += `• ${a.time} ${a.placeName}\n  ${a.description}\n`;
             if(comments[`day_${d.dayNumber}_${getActivityKey(a)}`]) body += `  NOTE: ${comments[`day_${d.dayNumber}_${getActivityKey(a)}`]}\n`;
             body += '\n';
          });
      });
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handlePdfExport = () => {
    const element = document.getElementById('itinerary-content');
    if ((window as any).html2pdf) {
        (window as any).html2pdf().set({ margin: 10, filename: 'Teruel_Trip.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, ignoreElements: (e: any) => e.hasAttribute('data-html2canvas-ignore') }, jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['avoid-all', 'css'] } }).from(element).save();
    } else {
        alert("PDF library not loaded.");
    }
  };

  const shareText = encodeURIComponent(`${itinerary.title}\n${description}`);
  const currentUrl = encodeURIComponent(window.location.href);

  // Map Init
  useEffect(() => {
    const L = (window as any).L;
    if (mapContainer.current && !mapInstance.current && L) {
        mapInstance.current = L.map(mapContainer.current).setView([40.345, -1.106], 13);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);
        setMapReady(true);
    }
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  // Layers
  useEffect(() => {
    const L = (window as any).L;
    if (!mapInstance.current || !mapReady || !L) return;
    if (tileLayerRef.current) mapInstance.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(MAP_STYLES[currentMapStyle].url, { attribution: MAP_STYLES[currentMapStyle].attribution, crossOrigin: true }).addTo(mapInstance.current);
  }, [currentMapStyle, mapReady]);

  // Markers
  useEffect(() => {
    const L = (window as any).L;
    if (!mapInstance.current || !mapReady || !L) return;
    const map = mapInstance.current;
    setTimeout(() => map.invalidateSize(), 100);
    markersLayer.current.clearLayers();
    if (routeLayer.current) map.removeLayer(routeLayer.current);

    const points: any[] = [];
    let lastCoords: any = null;

    activities.forEach((act, index) => {
        if (!act.coordinates) return;
        const { lat, lng } = act.coordinates;
        points.push([lat, lng]);

        const queryLower = searchQuery.toLowerCase();
        if (filters[act.type] && (!searchQuery || act.placeName.toLowerCase().includes(queryLower))) {
            const color = act.type === 'VISIT' ? '#2563EB' : act.type === 'FOOD' ? '#F97316' : act.type === 'LODGING' ? '#9333EA' : '#4B5563';
            
            const container = document.createElement('div');
            container.style.width = '260px';
            
            // Minimal Popup HTML logic
            container.innerHTML = `
              <div class="text-teruel-dark font-sans text-sm">
                <h3 class="font-bold text-base mb-1">${act.placeName}</h3>
                <div class="text-xs text-gray-500 mb-2">${act.time} • ${act.priceEstimate}</div>
                <p class="mb-2 text-gray-700">${act.description.substring(0, 100)}...</p>
                <div id="comment-area-${index}" class="mt-2 border-t pt-2"></div>
                <div id="details-toggle-${index}" class="mt-2 text-right">
                    <button class="text-teruel-ochre text-xs font-bold underline">Show Details</button>
                </div>
                <div id="details-content-${index}" class="hidden mt-2 bg-gray-50 p-2 rounded text-xs">
                     ${act.address ? `<p><strong>📍</strong> ${act.address}</p>` : ''}
                     ${fetchedAddresses[getActivityKey(act)] ? `<p><strong>🚌</strong> ${fetchedAddresses[getActivityKey(act)]}</p>` : ''}
                     ${act.type === 'TRAVEL' && act.transportDetails ? `<p><strong>🚌</strong> ${act.transportDetails}</p>` : ''}
                     <button class="w-full mt-2 bg-teruel-green text-white py-1 rounded">View in List</button>
                </div>
              </div>
            `;

            // Comment Logic
            const renderComments = () => {
                const area = container.querySelector(`#comment-area-${index}`);
                if (!area) return;
                const key = `day_${dayNumber}_${getActivityKey(act)}`;
                const comment = comments[key] || '';
                
                area.innerHTML = `
                    <textarea class="w-full text-xs p-1 border rounded mb-1" placeholder="Add note...">${comment}</textarea>
                    <button class="bg-teruel-ochre text-white text-xs px-2 py-1 rounded w-full font-bold">Save Note</button>
                `;
                const btn = area.querySelector('button');
                const txt = area.querySelector('textarea');
                if (btn && txt) {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        saveComment(act, txt.value);
                        btn.innerText = "Saved!";
                        setTimeout(() => btn.innerText = "Save Note", 1000);
                    };
                }
            };
            renderComments();
            
            // Detail Toggle
            const toggleBtn = container.querySelector(`#details-toggle-${index} button`);
            const detailsDiv = container.querySelector(`#details-content-${index}`);
            const listBtn = container.querySelector(`#details-content-${index} button`);
            if (toggleBtn && detailsDiv) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    detailsDiv.classList.toggle('hidden');
                    toggleBtn.textContent = detailsDiv.classList.contains('hidden') ? 'Show Details' : 'Hide Details';
                });
            }
            if (listBtn) {
                 listBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onMarkerClick(index);
                 });
            }

            const marker = L.circleMarker([lat, lng], { radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(markersLayer.current);
            marker.bindPopup(container);
            // Click marker to open popup, don't auto scroll to list to prevent disorienting jumps
            marker.on('click', () => { marker.openPopup(); });
        }
        lastCoords = { lat, lng };
    });

    if (points.length > 1) routeLayer.current = L.polyline(points, { color: '#4A6C44', weight: 3, dashArray: '5, 10' }).addTo(map);
    
    if (points.length > 0 && !searchQuery) {
       try { map.fitBounds(L.latLngBounds(points), { padding: [50, 50] }); } catch(e) {}
    } else if (!hasCoordinates) {
       map.setView([40.345, -1.106], 9);
    }
  }, [activities, filters, mapReady, currentMapStyle, dayNumber, comments, saveComment, searchQuery, fetchedAddresses, onMarkerClick]);

  return (
    <div className="flex flex-col h-full bg-teruel-stone min-h-[80vh]" id="itinerary-view-root">
        {isTourActive && <TourOverlay dayTitle={currentDay.title} activities={activities.filter(a => filters[a.type])} onClose={() => setIsTourActive(false)} />}
        {!isOnline && showOfflineBanner && (
              <div className="bg-teruel-red text-white p-2 text-center text-sm font-bold flex justify-between z-30">
                  <span>{t('view.offline_banner')}</span>
                  <button onClick={() => setShowOfflineBanner(false)}>✕</button>
              </div>
        )}

        <div className="bg-white p-4 shadow border-b sticky top-0 z-20 flex flex-wrap gap-4 justify-between items-center" data-html2canvas-ignore="true">
            <div className="flex items-center gap-2">
                <button onClick={onReset} className="font-bold text-teruel-dark">&larr; {t('view.back')}</button>
                <h2 className="font-serif font-bold text-lg hidden md:block">{itinerary.title}</h2>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap justify-end">
                {/* Socials */}
                <button onClick={() => window.open(`https://wa.me/?text=${shareText}`, '_blank')} className="bg-[#25D366] text-white p-1.5 rounded shadow hover:opacity-80 transition" title="Share on WhatsApp"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.232-.298.347-.497.115-.198.058-.372-.029-.545-.087-.173-.781-1.882-1.07-2.576-.282-.676-.57-.584-.781-.595-.2-.012-.429-.014-.657-.014-.228 0-.598.086-.911.428-.313.342-1.198 1.171-1.198 2.856 0 1.685 1.226 3.313 1.396 3.543.17.23 2.413 3.684 5.847 5.167 2.224.961 2.677.77 3.655.678.978-.092 2.112-.864 2.409-1.698.297-.834.297-1.549.208-1.698-.089-.149-.328-.239-.625-.388zM12 21.75c-1.776 0-3.444-.46-4.912-1.268l-.352-.208-3.654.958.975-3.564-.229-.364A9.718 9.718 0 012.25 12C2.25 6.626 6.626 2.25 12 2.25S21.75 6.626 21.75 12 17.374 21.75 12 21.75z"/></svg></button>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank')} className="bg-black text-white p-1.5 rounded shadow hover:opacity-80 transition" title="Share on X"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></button>
                <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`, '_blank')} className="bg-[#1877F2] text-white p-1.5 rounded shadow hover:opacity-80 transition" title="Share on Facebook"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></button>
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                {/* Actions */}
                <button onClick={handlePdfExport} className="bg-gray-800 text-white px-3 py-1 rounded text-sm font-bold">PDF</button>
                <button onClick={handleEmailShare} className="bg-teruel-green text-white px-3 py-1 rounded text-sm font-bold">Email</button>
                <button onClick={() => onSave({ ...itinerary, description, userComments: comments })} className="bg-teruel-ochre text-white px-3 py-1 rounded text-sm font-bold">{t('view.save')}</button>
            </div>
        </div>

        <div className="bg-teruel-dark p-2 overflow-x-auto whitespace-nowrap text-center">
            {days.map(d => (
                <button key={d.dayNumber} onClick={() => setDayNumber(d.dayNumber)} className={`px-4 py-1 mx-1 rounded font-bold ${dayNumber === d.dayNumber ? 'bg-teruel-ochre text-teruel-dark' : 'text-gray-400'}`}>{t('view.day')} {d.dayNumber}</button>
            ))}
        </div>

        <div id="itinerary-content" className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full relative">
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000]" data-html2canvas-ignore="true">
                 <button onClick={() => setIsMapView(!isMapView)} className="bg-teruel-dark text-white border-2 border-teruel-ochre px-6 py-2 rounded-full shadow-xl font-bold md:hidden">
                    {isMapView ? t('view.show_list') : t('view.show_map')}
                 </button>
            </div>

            <div className={`w-full bg-teruel-stone p-4 overflow-y-auto ${isMapView ? 'hidden md:block md:w-0' : 'block md:w-1/2'}`}>
                 <div className="mb-4">
                     <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        className="w-full bg-transparent text-gray-700 text-sm italic border-b border-gray-300 focus:border-teruel-ochre focus:outline-none resize-none"
                        rows={2}
                     />
                 </div>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-serif font-bold text-2xl text-teruel-red">{currentDay.title}</h3>
                     <button onClick={() => setIsTourActive(true)} className="bg-teruel-red text-white px-3 py-1 rounded-full text-xs font-bold" data-html2canvas-ignore="true">{t('view.start_tour')}</button>
                 </div>
                 
                 <input type="text" className="w-full p-2 border rounded mb-3" placeholder={language === 'es' ? "Buscar..." : "Search..."} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 
                 <div className="flex gap-2 mb-4 text-xs" data-html2canvas-ignore="true">
                     {Object.keys(filters).map(k => (
                         <button key={k} onClick={() => setFilters(p => ({...p, [k]: !p[k as any]}))} className={`px-2 py-1 rounded border ${filters[k as any] ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}>{k}</button>
                     ))}
                 </div>

                 <div className="space-y-4">
                    {activities.filter(a => filters[a.type] && (!searchQuery || a.placeName.toLowerCase().includes(searchQuery.toLowerCase()))).map((act, idx) => (
                        <div key={idx} id={`activity-item-${idx}`} onClick={() => setExpandedActivities(p => ({...p, [idx]: !p[idx]}))} className="bg-white rounded shadow p-4 border-l-4 border-teruel-green cursor-pointer break-inside-avoid">
                            <div className="flex justify-between"><h4 className="font-bold">{act.placeName}</h4><span className="text-xs bg-gray-100 px-2 rounded">{act.time}</span></div>
                            <p className="text-sm text-gray-600 mt-1">{act.description}</p>
                            {expandedActivities[idx] && (
                                <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                                    <p>💰 {act.priceEstimate}</p>
                                    {act.address && <p>📍 {act.address}</p>}
                                    {act.type === 'TRAVEL' && <p className="text-blue-600">🚌 {act.transportDetails || 'Transport'}</p>}
                                    {(act.type === 'FOOD' || act.type === 'LODGING') && <a href={getReservationLink(act.placeName, act.type)} target="_blank" className="text-teruel-ochre font-bold block mt-1" data-html2canvas-ignore="true">Book Now ↗</a>}
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
            </div>

            <div className={`w-full bg-gray-200 relative ${!isMapView ? 'hidden md:block md:w-1/2' : 'block h-[80vh]'}`}>
                <div ref={mapContainer} className="w-full h-full" style={{ zIndex: 1 }}></div>
                <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2" data-html2canvas-ignore="true">
                    <button onClick={optimizeRoute} className="bg-white p-2 rounded shadow text-teruel-dark" title="Optimize Route">⚡</button>
                    <button onClick={handleFetchBusStops} className={`bg-white p-2 rounded shadow text-blue-600 ${fetchingBusStops ? 'animate-pulse' : ''}`} title="Find Bus Stops">🚌</button>
                    <div className="relative group">
                        <button onClick={() => setShowLayerControl(!showLayerControl)} className="bg-white p-2 rounded shadow">🗺️</button>
                        {showLayerControl && (
                            <div className="absolute right-0 top-10 bg-white shadow rounded p-2 min-w-[120px]">
                                {Object.keys(MAP_STYLES).map(s => <button key={s} onClick={() => { setCurrentMapStyle(s as any); setShowLayerControl(false); }} className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100">{s}</button>)}
                            </div>
                        )}
                    </div>
                </div>
                {!hasCoordinates && <div className="absolute inset-0 flex items-center justify-center bg-white/80"><p>{t('view.map_offline_title')}</p></div>}
            </div>
        </div>
    </div>
  );
};