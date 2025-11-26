
import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
// CSS is loaded via index.html to avoid import errors in this environment
import { ItineraryResult, Activity } from '../types';
import { useLanguage } from '../context/LanguageContext';

// Fix for Leaflet default icon issues in Webpack/React environments
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Map Style Configuration
type MapStyle = 'standard' | 'satellite' | 'terrain' | 'light';

const MAP_STYLES: Record<MapStyle, { url: string, attribution: string, nameKey: string }> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    nameKey: 'view.layer_standard'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    nameKey: 'view.layer_satellite'
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
    nameKey: 'view.layer_terrain'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const estimateTravelTime = (distanceKm: number) => {
  // Rough estimate: 60km/h average speed
  const hours = distanceKm / 60;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

const suggestTransportDetails = (distanceKm: number) => {
    if (distanceKm < 2) return "Caminar / Walk";
    return "Coche / Car / Bus";
};

const getActivityKey = (act: Activity) => `${act.placeName}-${act.time}`;

const getReservationLink = (placeName: string, type: 'LODGING' | 'FOOD') => {
    return `https://www.google.com/search?q=reserva+${encodeURIComponent(placeName)}+Teruel`;
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({ itinerary, onReset, onSave }) => {
  const { t, language } = useLanguage();
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [filters, setFilters] = useState<Record<string, boolean>>({
      VISIT: true,
      FOOD: true,
      LODGING: true,
      TRAVEL: true
  });
  // Initialize comments from itinerary if available
  const [comments, setComments] = useState<Record<string, string>>(itinerary.userComments || {});
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Map View State
  const [isMapView, setIsMapView] = useState(false);

  // Map State
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>('standard');
  const [showLayerControl, setShowLayerControl] = useState(false);
  
  // Offline State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayer = useRef<L.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Safeguard: Ensure itinerary.days exists and has content
  const days = itinerary.days || [];
  const currentDay = days.find(d => d.dayNumber === dayNumber) || days[0];
  
  // If no currentDay (empty itinerary), render error state to prevent crash
  if (!currentDay) {
      return (
          <div className="flex flex-col h-screen items-center justify-center bg-teruel-stone p-8 text-center">
              <div className="bg-white p-8 rounded-lg shadow-xl border-t-4 border-teruel-red max-w-md">
                  <h3 className="text-xl font-serif font-bold text-teruel-dark mb-4">Error loading itinerary data</h3>
                  <p className="text-gray-600 mb-6">The generated itinerary seems to be empty or incomplete. Please try generating again.</p>
                  <button onClick={onReset} className="px-6 py-2 bg-teruel-ochre text-white font-bold rounded-full hover:bg-yellow-600 transition-colors">
                      {t('view.back')}
                  </button>
              </div>
          </div>
      );
  }

  const activities = currentDay.activities || []; // Default to empty array
  const hasCoordinates = activities.some(a => a.coordinates);

  const fetchedAddresses: Record<string, string> = {}; // Placeholder for geocoding results

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
        setIsOnline(false);
        setShowOfflineBanner(true); // Re-show banner if connection drops
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Reset expansion and search when day changes
  useEffect(() => {
    setExpandedActivities({});
    setSearchQuery('');
  }, [dayNumber]);

  // Sync state if itinerary prop changes (e.g. after save)
  useEffect(() => {
    if (itinerary.userComments) {
      setComments(itinerary.userComments);
    }
  }, [itinerary]);

  // Handle map resizing when view changes
  useEffect(() => {
      const timeout = setTimeout(() => {
          if (mapInstance.current) {
              mapInstance.current.invalidateSize();
          }
      }, 350); // Wait for transition to finish
      return () => clearTimeout(timeout);
  }, [isMapView, mapReady]);

  const onMarkerClick = useCallback((index: number) => {
      // Expand the item in list
      setExpandedActivities(prev => ({ ...prev, [index]: true }));

      // Scroll to the item if list is visible
      const el = document.getElementById(`activity-item-${index}`);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          el.classList.add('ring-2', 'ring-teruel-ochre', 'bg-yellow-50');
          setTimeout(() => el.classList.remove('ring-2', 'ring-teruel-ochre', 'bg-yellow-50'), 2000);
      }
  }, []);

  const toggleExpansion = (index: number) => {
      setExpandedActivities(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const collapseAll = () => {
      setExpandedActivities({});
  };

  const saveComment = useCallback((act: Activity, comment: string) => {
      const key = `day_${dayNumber}_${getActivityKey(act)}`;
      const newComments = { ...comments, [key]: comment };
      setComments(newComments);
      
      // Auto-save the comment to storage by updating the itinerary
      onSave({ ...itinerary, userComments: newComments });
  }, [dayNumber, comments, itinerary, onSave]);

  const handleEmailShare = () => {
      const subject = `${t('view.share_subject') || 'Mi Viaje a Teruel'}: ${itinerary.title}`;
      let body = `${itinerary.title}\n${itinerary.description}\n\n`;

      itinerary.days.forEach(d => {
          body += `--- ${t('view.day').toUpperCase()} ${d.dayNumber}: ${d.title} ---\n\n`;
          (d.activities || []).forEach(a => {
              body += `• ${a.time} - ${a.placeName}\n`;
              body += `  ${a.description}\n`;
              if (a.address) body += `  📍 ${a.address}\n`;
              if (a.priceEstimate) body += `  💰 ${a.priceEstimate}\n`;
              
              const key = `day_${d.dayNumber}_${getActivityKey(a)}`;
              if (comments[key]) {
                  body += `  📝 ${t('view.note')}: ${comments[key]}\n`;
              }
              body += `\n`;
          });
          body += `\n`;
      });
      
      body += `Generated by Teruel Mágica`;
      
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Initialize Map Structure (Containers)
  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
        mapInstance.current = L.map(mapContainer.current).setView([40.345, -1.106], 13);
        
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);
        setMapReady(true);
    }
    
    return () => {
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }
    }
  }, []);

  // Handle Map Tile Layer Changes
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;

    const styleConfig = MAP_STYLES[currentMapStyle];
    
    // Create new layer
    const newLayer = L.tileLayer(styleConfig.url, {
        attribution: styleConfig.attribution
    });

    // Remove old layer if exists
    if (tileLayerRef.current) {
        mapInstance.current.removeLayer(tileLayerRef.current);
    }

    // Add new layer
    newLayer.addTo(mapInstance.current);
    tileLayerRef.current = newLayer;

  }, [currentMapStyle, mapReady]);

  // Marker/Route rendering
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;
    const map = mapInstance.current;
    
    // Safety check for map container visibility updates
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);

    if (markersLayer.current) markersLayer.current.clearLayers();
    
    if (routeLayer.current) {
        try {
           map.removeLayer(routeLayer.current);
        } catch (e) { /* ignore */ }
        routeLayer.current = null;
    }

    // Arrays to collect points for cleaner bounds creation
    const visiblePoints: any[] = [];
    const allPoints: any[] = [];
    let hasVisibleMarkers = false;
    let lastCoords: { lat: number; lng: number } | null = null;

    // Helper for popup icons
    const getPopupIcon = (type: string) => {
      const cls = "w-4 h-4";
      switch (type) {
        case 'FOOD': return `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>`;
        case 'VISIT': return `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-8a2 2 0 012-2h14a2 2 0 012 2v8M15 3h6v4h-6M5 3h6v4H5" /></svg>`;
        case 'LODGING': return `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
        case 'TRAVEL': return `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`;
        default: return '';
      }
    };

    // Iterate through all activities to create markers and build route
    activities.forEach((act, index) => {
        // Strict coordinate validation
        if (!act.coordinates || typeof act.coordinates.lat !== 'number' || typeof act.coordinates.lng !== 'number') return;

        const { lat, lng } = act.coordinates;
        allPoints.push([lat, lng]);

        // Calculate estimated travel time and transport details if missing for TRAVEL type
        let displayTravelTime = act.travelTime;
        let displayTransportDetails = act.transportDetails;
        
        // Use fetched address if original is missing using stable key
        const actKey = getActivityKey(act);
        const displayAddress = act.address || fetchedAddresses[actKey];
        
        // If it's a TRAVEL activity and we have a previous coordinate, calculate distance/time
        if (act.type === 'TRAVEL' && lastCoords) {
            const dist = getDistanceFromLatLonInKm(lastCoords.lat, lastCoords.lng, lat, lng);
            // Only show if distance is significant (> 0.5km) to avoid noise
            if (dist > 0.5) {
                if (!displayTravelTime) {
                    displayTravelTime = estimateTravelTime(dist);
                }
                if (!displayTransportDetails) {
                    displayTransportDetails = suggestTransportDetails(dist);
                }
            }
        }

        const queryLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
                              act.placeName.toLowerCase().includes(queryLower) || 
                              act.description.toLowerCase().includes(queryLower);

        if (filters[act.type] && matchesSearch) {
            visiblePoints.push([lat, lng]);
            hasVisibleMarkers = true;

            const color = act.type === 'VISIT' ? '#2563EB' :
                          act.type === 'FOOD' ? '#F97316' :
                          act.type === 'LODGING' ? '#9333EA' :
                          '#4B5563';

            // Create DOM elements for Popup instead of string to attach events
            const container = document.createElement('div');
            container.style.minWidth = '240px';
            container.style.maxWidth = '300px';
            container.style.fontFamily = "'Lato', sans-serif";

            const toggleId = `popup-toggle-${dayNumber}-${index}`;
            const detailsId = `popup-details-${dayNumber}-${index}`;
            const commentSectionId = `popup-comment-${dayNumber}-${index}`;

            // Enriched Popup Content mirroring ActivityItem details
            const popupHtml = `
              <div class="font-sans text-teruel-dark">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px;">
                  <div style="flex: 1; margin-right: 8px;">
                    <h3 style="font-weight: 700; font-size: 1.1rem; color: #2C241E; margin: 0; line-height: 1.2;">${act.placeName}</h3>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                      <span style="font-size: 0.7rem; font-weight: 700; color: #A63C3C; background: #fff; padding: 2px 8px; border-radius: 9999px; border: 1px solid #D9A441; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${act.time}</span>
                      <span style="font-size: 0.7rem; font-weight: 600; color: #6B7280; background: #F3F4F6; padding: 2px 6px; border-radius: 4px;">${act.priceEstimate}</span>
                    </div>
                  </div>
                  <div style="background: ${color}; color: white; padding: 6px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ${getPopupIcon(act.type)}
                  </div>
                </div>
                
                <div style="font-size: 0.85rem; color: #374151; line-height: 1.5; margin-bottom: 10px; max-height: 150px; overflow-y: auto;">
                  ${act.description}
                </div>

                <!-- Toggle Button -->
                <button id="${toggleId}" style="width: 100%; font-size: 0.75rem; font-weight: bold; color: #D9A441; background: #FFF9E6; border: 1px dashed #D9A441; padding: 6px; margin-bottom: 8px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background 0.2s;">
                   <span>${language === 'es' ? 'Ver opciones y detalles' : 'View options & details'}</span>
                   <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                <!-- Hidden Content -->
                <div id="${detailsId}" style="display: none;">
                    ${displayAddress ? `
                      <div style="display: flex; align-items: flex-start; gap: 6px; font-size: 0.75rem; color: #6B7280; background: #F9FAFB; padding: 6px; border-radius: 4px; margin-bottom: 6px; border: 1px solid #E5E7EB;">
                        <span style="margin-top: 1px;">📍</span>
                        <span>${displayAddress}</span>
                      </div>
                    ` : ''}

                    ${act.type === 'TRAVEL' ? `
                      <div style="background: #F3F4F6; padding: 6px; border-radius: 4px; border-left: 3px solid #9CA3AF; margin-bottom: 6px; font-size: 0.75rem;">
                         ${displayTravelTime ? `<div style="font-weight: 700; color: #4A6C44; margin-bottom: 2px;">⏱ ${displayTravelTime}</div>` : ''}
                         ${displayTransportDetails ? `<div style="color: #4B5563; font-style: italic;">🚌 ${displayTransportDetails}</div>` : ''}
                      </div>
                    ` : ''}

                    ${(act.type === 'LODGING' || act.type === 'FOOD') ? `
                        <div style="text-align: center; margin-bottom: 8px;">
                          <a href="${getReservationLink(act.placeName, act.type)}" target="_blank" rel="noopener noreferrer" 
                             style="display: inline-block; background: #D9A441; color: white; font-size: 0.75rem; font-weight: 700; padding: 6px 16px; border-radius: 9999px; text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                             ${act.type === 'LODGING' ? (t('view.reserve_stay') || 'Reservar') : (t('view.reserve_food') || 'Mesa')}
                             <span style="margin-left: 2px;">↗</span>
                          </a>
                        </div>
                    ` : ''}
                </div>

                <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                   <button id="btn-view-list-${index}" style="font-size: 0.75rem; font-weight: 700; color: #D9A441; background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 2px;">
                      ${t('view.show_details') || 'Ver detalles'} <span style="font-size: 1rem; line-height: 0;">&rarr;</span>
                   </button>
                </div>
                
                <!-- Comment Section Placeholder -->
                <div id="${commentSectionId}" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #E5E7EB;"></div>
              </div>
            `;
            
            container.innerHTML = popupHtml;

            // Wire up toggle button in popup
            const btnToggle = container.querySelector(`#${toggleId}`);
            const divDetails = container.querySelector(`#${detailsId}`) as HTMLElement | null;
            if (btnToggle && divDetails) {
                btnToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = divDetails.style.display === 'none';
                    divDetails.style.display = isHidden ? 'block' : 'none';
                    
                    const btnText = isHidden 
                      ? (language === 'es' ? 'Ocultar' : 'Hide')
                      : (language === 'es' ? 'Ver opciones y detalles' : 'View options & details');
                    const arrowRotation = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    
                    btnToggle.innerHTML = `<span>${btnText}</span><svg style="width: 12px; height: 12px; transform: ${arrowRotation}; transition: transform 0.2s;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
                });
            }

            // Wire up the button to scroll to list
            const btn = container.querySelector(`#btn-view-list-${index}`);
            if(btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isMapView) {
                        setIsMapView(false); // Switch back to list view on mobile
                        setTimeout(() => onMarkerClick(index), 300); // Delay scroll to allow transition
                    } else {
                        onMarkerClick(index);
                    }
                });
            }

            // --- COMMENT SECTION LOGIC ---
            const renderCommentUI = () => {
                const section = container.querySelector(`#${commentSectionId}`);
                if (!section) return;

                const key = `day_${dayNumber}_${getActivityKey(act)}`;
                const currentComment = comments[key] || '';
                
                section.innerHTML = ''; // Clear

                if (currentComment) {
                    // Display Mode
                    const displayDiv = document.createElement('div');
                    displayDiv.style.background = '#FEF3C7'; // yellow-50
                    displayDiv.style.borderLeft = '3px solid #D97706'; // amber-600
                    displayDiv.style.padding = '8px';
                    displayDiv.style.borderRadius = '4px';
                    displayDiv.style.fontSize = '0.75rem';
                    displayDiv.style.color = '#78350F'; // amber-900
                    displayDiv.style.marginBottom = '6px';
                    displayDiv.innerText = currentComment;
                    
                    const editLink = document.createElement('button');
                    editLink.innerText = language === 'es' ? 'Editar nota' : 'Edit note';
                    editLink.style.fontSize = '0.7rem';
                    editLink.style.textDecoration = 'underline';
                    editLink.style.color = '#6B7280';
                    editLink.style.background = 'none';
                    editLink.style.border = 'none';
                    editLink.style.cursor = 'pointer';
                    editLink.style.padding = '0';
                    editLink.onclick = (e) => {
                        e.stopPropagation();
                        renderEditMode();
                    };

                    section.appendChild(displayDiv);
                    section.appendChild(editLink);
                } else {
                    // Empty state -> Show Edit Mode immediately to allow adding
                    renderEditMode();
                }

                function renderEditMode() {
                    section!.innerHTML = '';
                    
                    const textarea = document.createElement('textarea');
                    textarea.placeholder = language === 'es' ? "Añadir nota personal..." : "Add personal note...";
                    textarea.style.width = '100%';
                    textarea.style.fontSize = '0.75rem';
                    textarea.style.padding = '8px';
                    textarea.style.border = '1px solid #D1D5DB';
                    textarea.style.borderRadius = '4px';
                    textarea.style.resize = 'vertical';
                    textarea.style.minHeight = '60px';
                    textarea.style.fontFamily = 'inherit';
                    textarea.style.marginBottom = '6px';
                    textarea.value = currentComment;
                    
                    // Button Container
                    const btnContainer = document.createElement('div');
                    btnContainer.style.display = 'flex';
                    btnContainer.style.justifyContent = 'flex-end';
                    btnContainer.style.gap = '8px';

                    // Cancel Button
                    if (currentComment) {
                        const cancelBtn = document.createElement('button');
                        cancelBtn.innerText = language === 'es' ? 'Cancelar' : 'Cancel';
                        cancelBtn.style.color = '#6B7280';
                        cancelBtn.style.background = 'none';
                        cancelBtn.style.border = 'none';
                        cancelBtn.style.fontSize = '0.7rem';
                        cancelBtn.style.cursor = 'pointer';
                        cancelBtn.onclick = (e) => {
                            e.stopPropagation();
                            renderCommentUI(); // Revert
                        };
                        btnContainer.appendChild(cancelBtn);
                    }

                    // Save Button
                    const saveBtn = document.createElement('button');
                    saveBtn.innerText = language === 'es' ? 'Guardar' : 'Save';
                    saveBtn.style.backgroundColor = '#D9A441'; // Teruel Ochre
                    saveBtn.style.color = 'white';
                    saveBtn.style.border = 'none';
                    saveBtn.style.borderRadius = '4px';
                    saveBtn.style.padding = '4px 12px';
                    saveBtn.style.fontSize = '0.7rem';
                    saveBtn.style.fontWeight = 'bold';
                    saveBtn.style.cursor = 'pointer';
                    saveBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                    
                    saveBtn.onclick = (e) => {
                        e.stopPropagation();
                        saveComment(act, textarea.value);
                    };

                    btnContainer.appendChild(saveBtn);
                    
                    section!.appendChild(textarea);
                    section!.appendChild(btnContainer);
                    
                    // Optional: Focus (careful with map panning)
                    if (!currentComment) {
                        setTimeout(() => textarea.focus(), 100);
                    }
                }
            };

            // Initial render of the comment UI inside popup
            renderCommentUI();

            const marker = L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: color,
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            })
            .addTo(markersLayer.current)
            .bindPopup(container); // Pass DOM element
            
            // Add click listener to marker to scroll list and expand
            marker.on('click', () => {
                // If in full map mode, we stay there to see popup. 
                // But logic remains for sync
            });
        }
        
        // Update lastCoords for next calculation
        lastCoords = { lat, lng };
    });

    if (allPoints.length > 1) {
      routeLayer.current = L.polyline(allPoints, { color: '#4A6C44', weight: 3, dashArray: '5, 10', opacity: 0.6 }).addTo(map);
    }

    try {
        if (hasVisibleMarkers && visiblePoints.length > 0) {
            const bounds = L.latLngBounds(visiblePoints);
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (allPoints.length > 0 && !searchQuery) {
             // If searching and nothing found, don't move. If not searching, show all.
            const bounds = L.latLngBounds(allPoints);
            if (bounds.isValid()) {
               map.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (!hasCoordinates) {
            map.setView([40.345, -1.106], 9);
        }
    } catch (e) {
        console.warn("Bounds error corrected", e);
        map.setView([40.345, -1.106], 9);
    }
    
  }, [activities, filters, isOnline, onMarkerClick, t, fetchedAddresses, comments, dayNumber, saveComment, mapReady, language, searchQuery, currentMapStyle]);

  return (
    <div className="flex flex-col h-full bg-teruel-stone min-h-[80vh]">
        {/* Offline Banner */}
        {!isOnline && showOfflineBanner && (
              <div className="bg-teruel-red text-white p-3 text-center text-sm font-bold flex justify-between items-center animate-fade-in shadow-md relative z-30">
                  <div className="flex items-center gap-2 mx-auto">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /></svg>
                      <span>{t('view.offline_banner')}</span>
                  </div>
                  <button 
                      onClick={() => setShowOfflineBanner(false)}
                      className="text-white hover:text-gray-200 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                      title={t('view.hide_details') || "Dismiss"}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
        )}

        {/* Top Controls */}
        <div className="bg-white p-4 shadow-sm border-b border-gray-200 sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <button onClick={onReset} className="text-teruel-dark hover:text-teruel-red font-bold text-sm flex items-center">
                    &larr; {t('view.back')}
                </button>
                <div className="text-center">
                    <h2 className="font-serif font-bold text-xl text-teruel-dark">{itinerary.title}</h2>
                    <p className="text-xs text-gray-500">{t('view.generated_on')} {new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleEmailShare}
                        className="bg-teruel-green text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-green-700 flex items-center gap-1"
                        title={t('view.email')}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="hidden sm:inline">{t('view.email')}</span>
                    </button>
                    <button onClick={() => onSave({ ...itinerary, userComments: comments })} className="bg-teruel-ochre text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-yellow-600">
                        {t('view.save')}
                    </button>
                </div>
            </div>
        </div>

        {/* Days Navigation */}
        <div className="bg-teruel-dark text-teruel-ochre p-2 overflow-x-auto whitespace-nowrap text-center shadow-inner">
            <div className="inline-flex space-x-2">
                {(itinerary.days || []).map(d => (
                    <button 
                        key={d.dayNumber}
                        onClick={() => setDayNumber(d.dayNumber)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            dayNumber === d.dayNumber ? 'bg-teruel-ochre text-teruel-dark' : 'hover:bg-gray-800'
                        }`}
                    >
                        {t('view.day')} {d.dayNumber}
                    </button>
                ))}
            </div>
        </div>

        {/* Content Grid */}
        <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full relative overflow-hidden">
            
            {/* View Toggle Button (Floating) */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-auto">
                 <button
                    onClick={() => setIsMapView(!isMapView)}
                    className="bg-teruel-dark text-white border-2 border-teruel-ochre px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                 >
                    {isMapView ? (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            <span>{t('view.show_list') || 'Ver Lista'}</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            <span>{t('view.show_map') || 'Ver Mapa'}</span>
                        </>
                    )}
                 </button>
            </div>

            {/* List View */}
            <div className={`
                w-full transition-all duration-300 ease-in-out bg-teruel-stone
                ${isMapView ? 'h-0 overflow-hidden md:h-auto md:w-0 md:opacity-0' : 'h-full md:h-auto md:w-1/2 md:opacity-100'}
                p-4 overflow-y-auto
            `}>
                <div className="mb-4">
                     <div className="flex justify-between items-center mb-2">
                         <h3 className="font-serif font-bold text-2xl text-teruel-red">{currentDay.title}</h3>
                         <button onClick={collapseAll} className="text-xs text-teruel-red underline font-bold hover:text-teruel-dark transition-colors">
                            {t('view.collapse_all')}
                         </button>
                     </div>
                     
                     {/* Search Bar */}
                     <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-teruel-ochre focus:border-teruel-ochre sm:text-sm"
                            placeholder={language === 'es' ? "Buscar actividad..." : "Search activity..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                     </div>

                     {/* Filters */}
                     <div className="flex flex-wrap gap-2 text-xs">
                         {Object.keys(filters).map((k) => (
                             <button 
                                key={k}
                                onClick={() => setFilters(prev => ({...prev, [k as keyof typeof filters]: !prev[k as keyof typeof filters]}))}
                                className={`px-2 py-1 rounded border ${
                                    filters[k as keyof typeof filters] ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-400'
                                }`}
                             >
                                 {t(`view.filter_${k.toLowerCase()}`)}
                             </button>
                         ))}
                     </div>
                </div>

                <div className="space-y-4 pb-20 md:pb-0">
                    {activities.filter(a => {
                        const matchesType = filters[a.type];
                        const searchLower = searchQuery.toLowerCase();
                        const matchesSearch = !searchQuery || 
                                              a.placeName.toLowerCase().includes(searchLower) || 
                                              a.description.toLowerCase().includes(searchLower);
                        return matchesType && matchesSearch;
                    }).map((act, idx) => {
                        const isExpanded = expandedActivities[idx];
                        const actKey = getActivityKey(act);
                        
                        return (
                            <div 
                                key={idx} 
                                id={`activity-item-${idx}`} 
                                className={`bg-white rounded-lg shadow-md p-4 border-l-4 border-teruel-green hover:shadow-lg transition-all cursor-pointer ${isExpanded ? 'ring-2 ring-teruel-ochre' : ''}`}
                                onClick={() => toggleExpansion(idx)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg text-gray-800 leading-tight">{act.placeName}</h4>
                                    <div className="flex flex-col items-end">
                                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono mb-1">{act.time}</span>
                                        <svg 
                                            className={`w-4 h-4 text-teruel-ochre transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-2">{act.description}</p>
                                
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-fade-in">
                                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                            <span className="flex items-center px-2 py-1 bg-yellow-50 rounded text-yellow-800">💰 {act.priceEstimate}</span>
                                            {act.type === 'TRAVEL' && act.travelTime && (
                                                <span className="flex items-center text-blue-800 bg-blue-50 px-2 py-1 rounded">🚗 {act.travelTime}</span>
                                            )}
                                        </div>
                                        
                                        {act.type === 'TRAVEL' && act.transportDetails && (
                                            <div className="text-xs text-blue-600 italic bg-blue-50 p-2 rounded">
                                                🚌 {act.transportDetails}
                                            </div>
                                        )}

                                        {act.address && (
                                            <p className="text-xs text-gray-500 flex items-start p-2 bg-gray-50 rounded">
                                                <span className="mr-1">📍</span>
                                                {act.address}
                                            </p>
                                        )}
                                        
                                        {(act.type === 'LODGING' || act.type === 'FOOD') && (
                                             <div className="flex justify-start">
                                                <a href={getReservationLink(act.placeName, act.type)} target="_blank" rel="noopener noreferrer" 
                                                   onClick={(e) => e.stopPropagation()}
                                                   className="inline-flex items-center text-xs font-bold text-white bg-teruel-ochre hover:bg-yellow-600 px-3 py-1.5 rounded-full transition-colors shadow-sm">
                                                    {act.type === 'LODGING' ? (t('view.reserve_stay') || 'Reservar') : (t('view.reserve_food') || 'Mesa')}
                                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                </a>
                                             </div>
                                        )}
                                    </div>
                                )}

                                {/* Comment inline display */}
                                {comments[`day_${dayNumber}_${actKey}`] && (
                                    <div className="mt-3 p-2 bg-yellow-50 text-xs italic text-yellow-800 border-l-2 border-yellow-400">
                                        📝 {comments[`day_${dayNumber}_${actKey}`]}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Map View */}
            <div className={`
                transition-all duration-300 ease-in-out bg-gray-200 relative group
                ${isMapView ? 'h-[calc(100vh-140px)] md:h-auto w-full' : 'h-0 overflow-hidden md:h-auto md:w-1/2'}
            `}>
                <div ref={mapContainer} className="w-full h-full min-h-[400px]" style={{ zIndex: 1 }}></div>
                
                {/* Map Controls (Layers + WiFi) */}
                <div className="absolute top-4 right-4 z-[500] flex flex-col items-end gap-2">
                    
                    {/* Wi-Fi Indicator */}
                    <div 
                        className={`p-2 rounded shadow-md bg-white border transition-colors ${
                            isOnline ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'
                        }`}
                        title={isOnline ? (language === 'es' ? 'Conexión activa' : 'Online') : (language === 'es' ? 'Sin conexión' : 'Offline')}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                    </div>

                    {/* Layer Control Button */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowLayerControl(!showLayerControl)}
                            className="bg-white p-2 rounded shadow-md hover:bg-gray-100 text-teruel-dark border border-gray-300 transition-colors flex items-center justify-center w-10 h-10"
                            title={t('view.layers_title')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                        </button>
                        
                        {showLayerControl && (
                            <div className="absolute right-0 top-12 bg-white rounded shadow-xl p-1 min-w-[160px] animate-fade-in flex flex-col gap-1 border border-gray-200 z-[600]">
                                <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100 mb-1">
                                    {language === 'es' ? 'Tipo de Mapa' : 'Map Type'}
                                </div>
                                {(Object.keys(MAP_STYLES) as MapStyle[]).map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => {
                                            setCurrentMapStyle(style);
                                            setShowLayerControl(false);
                                        }}
                                        className={`text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 ${
                                            currentMapStyle === style 
                                            ? 'bg-teruel-ochre text-white font-bold' 
                                            : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <div className={`w-3 h-3 rounded-full border border-white ${currentMapStyle === style ? 'bg-white' : 'bg-gray-300'}`}></div>
                                        {t(MAP_STYLES[style].nameKey)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {!hasCoordinates && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10 pointer-events-none">
                        <div className="text-center p-4">
                            <p className="text-teruel-dark font-bold">{t('view.map_offline_title')}</p>
                            <p className="text-sm text-gray-600">{t('view.map_offline_desc')}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
