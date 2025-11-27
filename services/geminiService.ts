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

  // 1. Try Vite standard (Most likely for React on Render)
  // Vite requires variables to start with VITE_ to be exposed to import.meta.env
  try {
     // @ts-ignore
     if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.API_KEY;
     }
  } catch(e) {}

  // 2. Try Node/Webpack standard (Fallback)
  if (!apiKey) {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
           // @ts-ignore
           apiKey = process.env.VITE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.REACT_APP_API_KEY;
        }
      } catch(e) {}
  }

  if (!apiKey) {
      console.error("API Key check failed. Ensure variables are set in Render/Vite as VITE_API_KEY.");
      throw new Error("Configuration Error: API Key not configured. Please set 'VITE_API_KEY' in your environment variables.");
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