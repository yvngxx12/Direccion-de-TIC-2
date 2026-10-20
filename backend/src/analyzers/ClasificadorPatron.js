const patternsData = require("../config/patterns.json");

class ClasificadorPatron {

    constructor() {
        this.patterns = patternsData.patterns;
    }

    /**
     * Analiza un mensaje y determina el patrón ("calmo", "neutral", "agresivo")
     * además de las palabras clave o emojis que coincidieron.
     */
    clasificarDetalles(mensaje) {
        const contenidoOriginal = mensaje?.contenido || "";
        const texto = this.normalizar(contenidoOriginal);

        const coincidencias = {
            agresivo: [],
            calmo: [],
            neutral: []
        };

        for (const patron of this.patterns) {
            // Buscar palabras clave
            for (const keyword of patron.keywords) {
                const palabra = this.normalizar(keyword);
                // Coincidencia por palabra o subcadena relevante
                const regex = new RegExp(`\\b${palabra}\\b`, "i");
                if (regex.test(texto) || texto.includes(palabra)) {
                    coincidencias[patron.name].push(keyword);
                }
            }

            // Buscar emojis
            for (const emoji of patron.emojis) {
                if (contenidoOriginal.includes(emoji)) {
                    coincidencias[patron.name].push(emoji);
                }
            }
        }

        // Heurística adicional de intensidad (mayúsculas sostenidas o múltiples signos '!')
        if ((contenidoOriginal.match(/!/g) || []).length >= 3) {
            coincidencias.agresivo.push("!!!");
        }

        if (coincidencias.agresivo.length > 0 && coincidencias.agresivo.length >= coincidencias.calmo.length) {
            return {
                patron: "agresivo",
                explicito: true,
                coincidencias: coincidencias.agresivo
            };
        }

        if (coincidencias.calmo.length > 0) {
            return {
                patron: "calmo",
                explicito: true,
                coincidencias: coincidencias.calmo
            };
        }

        if (coincidencias.neutral.length > 0) {
            return {
                patron: "neutral",
                explicito: true,
                coincidencias: coincidencias.neutral
            };
        }

        // Si no se detectan elementos calmados ni agresivos, el patrón es neutral por defecto
        return {
            patron: "neutral",
            explicito: false,
            coincidencias: []
        };
    }

    clasificar(mensaje) {
        return this.clasificarDetalles(mensaje).patron;
    }

    detectarColor(mensaje) {
        const contenidoOriginal = mensaje?.contenido || "";
        const texto = this.normalizar(contenidoOriginal);

        const colores = {
            rojo: "red",
            red: "red",
            verde: "green",
            green: "green",
            azul: "blue",
            blue: "blue",
            amarillo: "yellow",
            yellow: "yellow",
            violeta: "purple",
            morado: "purple",
            purple: "purple",
            cian: "cyan",
            celeste: "cyan",
            cyan: "cyan",
            blanco: "white",
            white: "white"
        };

        for (const palabra in colores) {
            const regex = new RegExp(`\\b${palabra}\\b`, "i");
            if (regex.test(texto)) {
                return colores[palabra];
            }
        }

        // Emojis de color
        if (contenidoOriginal.includes("🔴")) return "red";
        if (contenidoOriginal.includes("🟢")) return "green";
        if (contenidoOriginal.includes("🔵")) return "blue";
        if (contenidoOriginal.includes("🟡")) return "yellow";
        if (contenidoOriginal.includes("🟣")) return "purple";
        if (contenidoOriginal.includes("⚪")) return "white";

        return null;
    }

    obtenerColorPorPatron(patron) {
        const encontrado = this.patterns.find(p => p.name === patron);
        return encontrado ? encontrado.defaultColor : "purple";
    }

    normalizar(texto) {
        return String(texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
}

module.exports = ClasificadorPatron;
