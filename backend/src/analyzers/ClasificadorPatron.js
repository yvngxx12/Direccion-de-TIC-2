const patterns = require("../config/patterns.json");

class ClasificadorPatron {

    clasificar(mensaje) {

        const texto = this.normalizar(
            mensaje.contenido
        );

        for (const patron of patterns.patterns) {

            // Buscar palabras
            for (const keyword of patron.keywords) {

                const palabra =
                    this.normalizar(keyword);

                if (texto.includes(palabra)) {
                    return patron.name;
                }
            }

            // Buscar emojis
            for (const emoji of patron.emojis) {

                if (mensaje.contenido.includes(emoji)) {
                    return patron.name;
                }
            }
        }

        return null;
    }

    detectarColor(mensaje) {

        const texto = this.normalizar(
            mensaje.contenido
        );

        const colores = {

            rojo: "red",
            red: "red",
            "🔴": "red",

            verde: "green",
            green: "green",
            "🟢": "green",

            azul: "blue",
            blue: "blue",
            "🔵": "blue",

            amarillo: "yellow",
            yellow: "yellow",
            "🟡": "yellow",

            violeta: "purple",
            morado: "purple",
            purple: "purple",
            "🟣": "purple",

            cian: "cyan",
            cyan: "cyan",

            blanco: "white",
            white: "white",
            "⚪": "white"
        };

        for (const palabra in colores) {

            if (palabra.length === 1) {
                continue;
            }

            if (texto.includes(palabra)) {
                return colores[palabra];
            }
        }

        // Emojis de color
        const contenido = mensaje.contenido;

        if (contenido.includes("🔴")) {
            return "red";
        }

        if (contenido.includes("🟢")) {
            return "green";
        }

        if (contenido.includes("🔵")) {
            return "blue";
        }

        if (contenido.includes("🟡")) {
            return "yellow";
        }

        if (contenido.includes("🟣")) {
            return "purple";
        }

        if (contenido.includes("⚪")) {
            return "white";
        }

        return null;
    }

    normalizar(texto) {

        return texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
}

module.exports = ClasificadorPatron;