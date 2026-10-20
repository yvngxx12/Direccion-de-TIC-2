const ClasificadorPatron = require("./ClasificadorPatron");
const ContadorActividad = require("./ContadorActividad");

class AnalizadorMensajes {

    constructor(intervalo = 10000) {

        this.clasificador = new ClasificadorPatron();

        this.contador = new ContadorActividad(
            intervalo
        );
    }

    analizar(mensaje) {

        // Registrar el mensaje para calcular la actividad
        this.contador.registrarMensaje(mensaje);

        // Detectar patrón
        const patron =
            this.clasificador.clasificar(mensaje);

        // Detectar color
        const color =
            this.clasificador.detectarColor(mensaje);

        // Obtener velocidad de actividad
        const velocidad =
            this.contador.obtenerNivel();

        // Obtener estadísticas
        const estadisticas =
            this.contador.obtenerEstadisticas();

        return {
            mensaje: mensaje.toJSON
                ? mensaje.toJSON()
                : mensaje,

            patron: patron,

            color: color,

            velocidad: velocidad,

            mensajesEnIntervalo:
                estadisticas.mensajes,

            mensajesPorSegundo:
                estadisticas.mensajesPorSegundo
        };
    }

    obtenerEstadisticas() {

        return this.contador.obtenerEstadisticas();
    }
}

module.exports = AnalizadorMensajes;