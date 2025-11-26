
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  es: {
    // Header
    'nav.home': 'Inicio',
    'nav.history': 'Historia',
    'nav.gastronomy': 'Gastronomía',
    
    // Hero
    'hero.title': 'Descubre el Alma de Teruel',
    'hero.subtitle': 'Desde la arquitectura Mudéjar hasta los secretos de los dinosaurios. Crea tu ruta perfecta en segundos.',
    
    // Form
    'form.title': 'Diseña tu Experiencia en Teruel',
    'form.scope': 'Ámbito',
    'form.destination': 'Destino',
    'form.theme': 'Interés Principal',
    'form.duration': 'Duración',
    'form.days': 'días',
    'form.day_1': '1 día',
    'form.day_7': '7 días',
    'form.budget': 'Presupuesto',
    'form.generate': 'Crear Itinerario',
    'form.generating': 'Generando Ruta...',
    
    // Form Options (Mapping logic handles keys, these are display labels)
    'scope.Provincia': 'Toda la Provincia',
    'scope.Ciudad': 'Ciudad Específica',
    'budget.Económico': 'Económico',
    'budget.Medio': 'Medio',
    'budget.Lujo': 'Lujo',
    
    // Themes
    'theme.Histórico / Mudéjar': 'Histórico / Mudéjar',
    'theme.Guerra Civil': 'Guerra Civil',
    'theme.Geológico / Dinópolis': 'Geológico / Dinópolis',
    'theme.Naturaleza / Paisajes': 'Naturaleza / Paisajes',
    'theme.Gastronómico': 'Gastronómico',
    'theme.Urbano General': 'Urbano General',
    'theme.Romántico': 'Romántico',

    // Itinerary View
    'view.back': 'Volver',
    'view.generated_on': 'Generado el',
    'view.create_new': 'Crear Nuevo',
    'view.save': 'Guardar',
    'view.saved': '¡Guardado!',
    'view.share': 'Compartir',
    'view.share_subject': 'Mi Viaje a Teruel',
    'view.copy': 'Copiar',
    'view.copied': 'Copiado',
    'view.email': 'Enviar Email',
    'view.pdf': 'Descargar PDF',
    'view.generating_pdf': 'Generando PDF...',
    'view.day': 'Día',
    'view.note': 'Nota',
    'view.note_text': 'Los horarios y precios son estimados por IA y pueden haber cambiado. Verifica siempre las fuentes oficiales antes de viajar.',
    'view.show_details': 'Ver dirección y transporte',
    'view.hide_details': 'Ocultar detalles',
    'view.duration': 'Duración estimada',
    'view.reserve_stay': 'Reservar Alojamiento',
    'view.reserve_food': 'Reservar Mesa',
    'view.filters': 'Filtros',
    'view.filter_visit': 'Visitas',
    'view.filter_food': 'Comida',
    'view.filter_lodging': 'Alojamiento',
    'view.filter_travel': 'Transporte',
    'view.map_google': 'Ver ruta completa en Google Maps',
    'view.map_offline': 'Mapa general (Ubicaciones exactas no disponibles)',
    'view.map_offline_title': 'Mapa No Disponible',
    'view.map_offline_desc': 'Sin conexión y sin datos de ubicación. Disfruta de la vista histórica.',
    'view.offline_banner': 'Modo Offline Activado - Funcionalidad Limitada',
    'view.start_tour': 'Iniciar Modo Guía',
    'view.collapse_all': 'Contraer Todo',
    'view.layers_title': 'Capas',
    'view.layer_standard': 'Estándar',
    'view.layer_satellite': 'Satélite',
    'view.layer_light': 'Claro',
    'view.layer_terrain': 'Terreno',
    'view.show_map': 'Ver Mapa',
    'view.show_list': 'Ver Lista',

    // Tour Mode
    'tour.step': 'Paso',
    'tour.of': 'of',
    'tour.listen': 'Escuchar Guía',
    'tour.stop_audio': 'Detener Audio',
    'tour.next': 'Siguiente',
    'tour.prev': 'Anterior',
    'tour.close': 'Salir del Tour',
    'tour.finished': '¡Día Completado!',
    'tour.finished_desc': 'Has terminado todas las actividades de hoy. ¡Esperamos que hayas disfrutado de Teruel!',
    'tour.play': 'Reproducir',
    'tour.pause': 'Pausar',
    'tour.resume': 'Continuar',
    'tour.stop': 'Detener',
    'tour.speed': 'Velocidad',

    // Features
    'feat.history.title': 'Patrimonio Histórico',
    'feat.history.desc': 'Rutas por el arte Mudéjar, castillos medievales y la historia de los Amantes.',
    'feat.nature.title': 'Naturaleza y Ciencia',
    'feat.nature.desc': 'Desde Dinópolis hasta rutas geológicas y el Maestrazgo.',
    'feat.food.title': 'Sabor Auténtico',
    'feat.food.desc': 'Jamón de Teruel, trufa negra y la mejor gastronomía local.',

    // Saved & Errors
    'saved.title': 'Rutas Guardadas (Offline)',
    'saved.clear': 'Borrar Historial',
    'saved.view': 'Ver Itinerario',
    'saved.confirm_clear': '¿Estás seguro de que quieres borrar todo el historial?',
    'error.generate': 'Lo sentimos, hubo un error generando tu itinerario. Por favor revisa tu conexión.',
    
    // Footer
    'footer.rights': 'Teruel Mágica.',
    'footer.disclaimer': 'Esta aplicación utiliza inteligencia artificial (Gemini) para sugerir itinerarios. Verifica siempre horarios y disponibilidad oficial.'
  },
  en: {
    // Header
    'nav.home': 'Home',
    'nav.history': 'History',
    'nav.gastronomy': 'Gastronomy',
    
    // Hero
    'hero.title': 'Discover the Soul of Teruel',
    'hero.subtitle': 'From Mudejar architecture to dinosaur secrets. Create your perfect route in seconds.',
    
    // Form
    'form.title': 'Design Your Teruel Experience',
    'form.scope': 'Scope',
    'form.destination': 'Destination',
    'form.theme': 'Main Interest',
    'form.duration': 'Duration',
    'form.days': 'days',
    'form.day_1': '1 day',
    'form.day_7': '7 days',
    'form.budget': 'Budget',
    'form.generate': 'Create Itinerary',
    'form.generating': 'Generating Route...',
    
    // Form Options
    'scope.Provincia': 'Whole Province',
    'scope.Ciudad': 'Specific City',
    'budget.Económico': 'Budget / Economy',
    'budget.Medio': 'Standard',
    'budget.Lujo': 'Luxury',

    // Themes
    'theme.Histórico / Mudéjar': 'Historical / Mudejar',
    'theme.Guerra Civil': 'Civil War',
    'theme.Geológico / Dinópolis': 'Geological / Dinopolis',
    'theme.Naturaleza / Paisajes': 'Nature / Landscapes',
    'theme.Gastronomy': 'Gastronomy',
    'theme.Urbano General': 'Urban Highlights',
    'theme.Romántico': 'Romantic',

    // Itinerary View
    'view.back': 'Back',
    'view.generated_on': 'Generated on',
    'view.create_new': 'Create New',
    'view.save': 'Save',
    'view.saved': 'Saved!',
    'view.share': 'Share',
    'view.share_subject': 'My Trip to Teruel',
    'view.copy': 'Copy',
    'view.copied': 'Copied',
    'view.email': 'Send Email',
    'view.pdf': 'Export PDF',
    'view.generating_pdf': 'Creating PDF...',
    'view.day': 'Day',
    'view.note': 'Note',
    'view.note_text': 'Schedules and prices are AI estimates and may have changed. Always verify official sources before traveling.',
    'view.show_details': 'Show address & transport',
    'view.hide_details': 'Hide details',
    'view.duration': 'Est. duration',
    'view.reserve_stay': 'Book Stay',
    'view.reserve_food': 'Book Table',
    'view.filters': 'Filters',
    'view.filter_visit': 'Visits',
    'view.filter_food': 'Food',
    'view.filter_lodging': 'Lodging',
    'view.filter_travel': 'Travel',
    'view.map_google': 'See full route on Google Maps',
    'view.map_offline': 'General Map (Exact locations unavailable)',
    'view.map_offline_title': 'Map Unavailable',
    'view.map_offline_desc': 'Offline and no location data. Enjoy the historical view.',
    'view.offline_banner': 'Offline Mode Active - Limited Functionality',
    'view.start_tour': 'Start Tour Guide',
    'view.collapse_all': 'Collapse All',
    'view.layers_title': 'Layers',
    'view.layer_standard': 'Standard',
    'view.layer_satellite': 'Satellite',
    'view.layer_light': 'Light',
    'view.layer_terrain': 'Terrain',
    'view.show_map': 'Show Map',
    'view.show_list': 'Show List',

    // Tour Mode
    'tour.step': 'Step',
    'tour.of': 'of',
    'tour.listen': 'Listen',
    'tour.stop_audio': 'Stop Audio',
    'tour.next': 'Next Stop',
    'tour.prev': 'Previous',
    'tour.close': 'Exit Tour',
    'tour.finished': 'Day Completed!',
    'tour.finished_desc': 'You have finished all activities for today. We hope you enjoyed Teruel!',
    'tour.play': 'Play',
    'tour.pause': 'Pause',
    'tour.resume': 'Resume',
    'tour.stop': 'Stop',
    'tour.speed': 'Speed',

    // Features
    'feat.history.title': 'Historical Heritage',
    'feat.history.desc': 'Routes through Mudejar art, medieval castles, and the Lovers history.',
    'feat.nature.title': 'Nature & Science',
    'feat.nature.desc': 'From Dinopolis to geological routes and the Maestrazgo.',
    'feat.food.title': 'Authentic Flavor',
    'feat.food.desc': 'Teruel Ham, black truffle, and the best local gastronomy.',

    // Saved & Errors
    'saved.title': 'Saved Routes (Offline)',
    'saved.clear': 'Clear History',
    'saved.view': 'View Itinerary',
    'saved.confirm_clear': 'Are you sure you want to clear all history?',
    'error.generate': 'Sorry, there was an error generating your itinerary. Please check your connection.',

    // Footer
    'footer.rights': 'Teruel Magic.',
    'footer.disclaimer': 'This application uses artificial intelligence (Gemini) to suggest itineraries. Always verify official schedules and availability.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('es');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
