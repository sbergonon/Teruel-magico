import { GoogleGenAI, Type } from "@google/genai";
import { UserPreferences, ItineraryResult } from "../types";

// Schema definition
const itinerarySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A catchy title for the trip" },
    description: { type: Type.STRING, description: "A brief summary of the experience" },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER },
          title: { type: Type.STRING, description: "Theme of the day" },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING, description: "Time of day (e.g., 10:00 AM)" },
                placeName: { type: Type.STRING, description: "Name of the place, monument, or restaurant" },
                description: { type: Type.STRING, description: "2-3 sentences about what to see/do/eat" },
                priceEstimate: { type: Type.STRING, description: "Estimated price (e.g., 5€, Gratis, 20€/pax)" },
                type: { 
                  type: Type.STRING, 
                  enum: ["VISIT", "FOOD", "LODGING", "TRAVEL"],
                  description: "Category of the activity" 
                },
                address: { type: Type.STRING, description: "Physical address, street and number. Very important for bus stops or meeting points." },
                coordinates: {
                  type: Type.OBJECT,
                  description: "Approximate GPS coordinates for the map",
                  properties: {
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ["lat", "lng"]
                },
                travelTime: { type: Type.STRING, description: "If type is TRAVEL, estimated duration (e.g., '1h 30m')." },
                transportDetails: { type: Type.STRING, description: "If type is TRAVEL, provide bus companies, schedules or route specific info." }
              },
              required: ["time", "placeName", "description", "priceEstimate", "type", "coordinates"],
            },
          },
        },
        required: ["dayNumber", "title", "activities"],
      },
    },
  },
  required: ["title", "description", "days"],
};

export const generateItinerary = async (prefs: UserPreferences): Promise<ItineraryResult> => {
  let apiKey = '';
  
  // Robustly attempt to find the API Key in various environments (Vite, Webpack, Node)
  const candidates = [
    'API_KEY', 
    'VITE_API_KEY', 
    'REACT_APP_API_KEY', 
    'VITE_GEMINI_API_KEY'
  ];

  const getEnvVar = (key: string): string | undefined => {
    // Try import.meta.env (Vite standard)
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        // @ts-ignore
        return import.meta.env[key];
      }
    } catch(e) {}

    // Try process.env (Webpack / Node standard)
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env && process.env[key]) {
        // @ts-ignore
        return process.env[key];
      }
    } catch(e) {}
    
    return undefined;
  };

  for (const key of candidates) {
    const val = getEnvVar(key);
    if (val) {
      apiKey = val;
      break;
    }
  }

  if (!apiKey) {
      console.error("Available env vars check failed. Please ensure API_KEY (or VITE_API_KEY) is set in your build/deployment environment.");
      throw new Error("Configuration Error: API Key not configured. Please ensure 'API_KEY' (or 'VITE_API_KEY') is set in your environment variables.");
  }

  // Initialize client inside function to avoid top-level side effects
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = "gemini-2.5-flash";
  
  const langInstruction = prefs.language === 'en' 
    ? "IMPORTANT: The output MUST be in ENGLISH." 
    : "IMPORTANTE: El output DEBE ser en ESPAÑOL.";

  const prompt = `
    Actúa como un experto guía turístico de la provincia de Teruel, España.
    Crea un itinerario detallado:
    - Ámbito: ${prefs.scope}
    - Ubicación: ${prefs.location}
    - Temática: ${prefs.theme}
    - Duración: ${prefs.days} días
    - Presupuesto: ${prefs.budget}
    - IDIOMA: ${prefs.language === 'en' ? 'INGLÉS' : 'ESPAÑOL'}

    ${langInstruction}

    Requisitos:
    1. Incluye lugares reales, horarios y precios estimados.
    2. Coordenadas GPS aproximadas para cada actividad.
    3. Para 'TRAVEL', incluye 'travelTime' y 'transportDetails'.
    4. Para actividades, incluye 'address' (calle/número).
    
    Responde estrictamente en JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: itinerarySchema,
        temperature: 0.4, 
      },
    });

    if (response.text) {
      const result = JSON.parse(response.text) as ItineraryResult;
      result.language = prefs.language;
      return result;
    }
    throw new Error("No text response generated");
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};