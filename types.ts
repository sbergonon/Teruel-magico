
export type Language = 'es' | 'en';

export enum TripScope {
  PROVINCE = 'Provincia',
  CITY = 'Ciudad',
}

export enum TripTheme {
  HISTORICAL = 'Histórico / Mudéjar',
  CIVIL_WAR = 'Guerra Civil',
  GEOLOGICAL = 'Geológico / Dinópolis',
  NATURE = 'Naturaleza / Paisajes',
  GASTRONOMIC = 'Gastronómico',
  URBAN = 'Urbano General',
  ROMANTIC = 'Romántico',
}

export interface UserPreferences {
  scope: TripScope;
  location: string; // Specific city or "Provincia de Teruel"
  theme: TripTheme;
  days: number;
  budget: 'Económico' | 'Medio' | 'Lujo';
  language: Language; // Added language preference
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Activity {
  time: string;
  placeName: string;
  description: string;
  priceEstimate: string;
  type: 'VISIT' | 'FOOD' | 'LODGING' | 'TRAVEL';
  address?: string;
  locationUrl?: string;
  coordinates?: Coordinates;
  travelTime?: string;
  transportDetails?: string;
}

export interface DayPlan {
  dayNumber: number;
  title: string;
  activities: Activity[];
}

export interface ItineraryResult {
  title: string;
  description: string;
  days: DayPlan[];
  timestamp?: number;
  language?: Language; // To track which language generated this
  userComments?: Record<string, string>; // Map of activity keys to user notes
}
