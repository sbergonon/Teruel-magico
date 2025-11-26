import { GoogleGenAI, Type } from "@google/genai";
import { UserPreferences, ItineraryResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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
                transportDetails: { type: Type.STRING, description: "If type is TRAVEL, provide bus companies, schedules (e.g., 'Autobuses Jiménez 10:00, 14:00'), or route specific info." }
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
  const model = "gemini-2.5-flash";
  
  // Language-specific instruction
  const langInstruction = prefs.language === 'en' 
    ? "IMPORTANT: The output MUST be in ENGLISH. Translate place descriptions, titles, and transport details to English. Keep proper names (like 'Plaza del Torico') in Spanish." 
    : "IMPORTANTE: El output DEBE ser en ESPAÑOL.";

  const prompt = `
    Actúa como un experto guía turístico de la provincia de Teruel, España.
    Crea un itinerario detallado basado en las siguientes preferencias:
    
    - Ámbito: ${prefs.scope}
    - Ubicación Específica: ${prefs.location}
    - Temática: ${prefs.theme}
    - Duración: ${prefs.days} días
    - Presupuesto: ${prefs.budget}
    - IDIOMA DE RESPUESTA: ${prefs.language === 'en' ? 'INGLÉS (ENGLISH)' : 'ESPAÑOL'}

    ${langInstruction}

    Requisitos específicos:
    1. Si es 'Guerra Civil', incluye lugares como la Batalla de Teruel, vestigios, trincheras (ej. Museo de la Batalla).
    2. Si es 'Geológico', incluye Dinópolis o Galve, Órganos de Montoro, etc.
    3. Si es 'Gastronómico', recomienda Jamón de Teruel, Trufa negra, y restaurantes específicos.
    4. Incluye horarios aproximados y precios estimados de entradas.
    5. Sugiere lugares reales para comer y dormir (hoteles/restaurantes con nombre).
    6. Asegúrate de que el orden geográfico tenga sentido lógico.
    7. **IMPORTANTE**: Proporciona coordenadas GPS aproximadas (latitud/longitud) para cada actividad para poder situarlas en un mapa.
    8. **MUY IMPORTANTE**: Si hay transporte (TRAVEL) o visitas, incluye la DIRECCIÓN (calle/número) en el campo 'address', especialmente la ubicación exacta de las paradas de autobús si aplica.
    9. **TRANSPORTE**: Para actividades 'TRAVEL', rellena 'travelTime' y 'transportDetails' con información útil de horarios de autobuses (ej. "Salida Estación Teruel", "Autocares Samurai" o "Autobuses Jiménez") o tiempos de conducción.
    
    Responde estrictamente en JSON usando el esquema proporcionado.
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
      result.language = prefs.language; // Tag the result
      return result;
    }
    throw new Error("No text response generated");
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};