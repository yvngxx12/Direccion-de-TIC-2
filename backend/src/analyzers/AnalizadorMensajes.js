const ClasificadorPatron = require("./ClasificadorPatron");
const ContadorActividad = require("./ContadorActividad");

class AnalizadorMensajes {

    constructor(intervalo = 10000) {
        this.clasificador = new ClasificadorPatron();
        this.contador = new ContadorActividad(intervalo);

        // Estado actual del Proceso 1 (Tipo de conversación / Patrón)
        this.patronActual = "calmo"; // Inicia en calmo al comienzo de la transmisión (Sección 6.11)
        this.colorExplicito = null;
        this.historialClasificaciones = [];
    }

    /**
     * PROCESO 1 + Registro para PROCESO 2:
     * Analiza un mensaje entrante, actualiza el patrón de conversación
     * y registra el mensaje en el contador de ventana temporal.
     */
    analizar(mensaje) {
        const ahora = Date.now();

        // Registrar el mensaje para el Proceso 2 (ventana de actividad)
        this.contador.registrarMensaje(mensaje);

        // Proceso 1: Clasificar contenido del mensaje
        const detallePatron = this.clasificador.clasificarDetalles(mensaje);
        const colorDetectado = this.clasificador.detectarColor(mensaje);

        if (colorDetectado) {
            this.colorExplicito = colorDetectado;
        }

        this.historialClasificaciones.push({
            patron: detallePatron.patron,
            explicito: detallePatron.explicito,
            timestamp: ahora
        });

        // Limpiar historial fuera de la ventana
        this.historialClasificaciones = this.historialClasificaciones.filter(
            item => ahora - item.timestamp <= this.contador.intervalo
        );

        // Determinar el patrón predominante en la ventana actual
        this.patronActual = this.calcularPatronPredominante(detallePatron);

        const estadisticas = this.contador.obtenerEstadisticas();
        const colorFinal =
            colorDetectado ||
            this.colorExplicito ||
            this.clasificador.obtenerColorPorPatron(this.patronActual);

        return {
            mensaje: mensaje.toJSON ? mensaje.toJSON() : mensaje,
            patron: this.patronActual,
            patronMensaje: detallePatron.patron,
            coincidencias: detallePatron.coincidencias,
            explicito: detallePatron.explicito,
            color: colorFinal,
            velocidad: estadisticas.nivel,
            nivelEspanol: estadisticas.nivelEspanol,
            velocidadMatematica: estadisticas.velocidadMatematica,
            mensajesEnIntervalo: estadisticas.mensajes,
            mensajesPorSegundo: estadisticas.mensajesPorSegundo,
            enInactividad: false
        };
    }

    calcularPatronPredominante(ultimoDetalle) {
        // Si el último mensaje tiene palabras clave explícitas (ej. agresivo o calmo), darle prioridad inmediata
        if (ultimoDetalle && ultimoDetalle.explicito) {
            return ultimoDetalle.patron;
        }

        // Revisar si en la ventana actual hay mensajes con palabras clave explícitas
        const explicitos = this.historialClasificaciones.filter(i => i.explicito);
        if (explicitos.length > 0) {
            const conteo = { agresivo: 0, calmo: 0, neutral: 0 };
            for (const item of explicitos) {
                conteo[item.patron] = (conteo[item.patron] || 0) + 1;
            }
            if (conteo.agresivo >= conteo.calmo && conteo.agresivo > 0) return "agresivo";
            if (conteo.calmo > 0) return "calmo";
        }

        // Si hay conversación normal sin palabras clave específicas, el patrón es neutral (predeterminado)
        return "neutral";
    }

    /**
     * PROCESO 2 (Evaluación periódica de ventana temporal y ausencia de mensajes - Sección 6.9, 6.10 y 6.11)
     */
    evaluarCicloActividad() {
        const ahora = Date.now();
        this.historialClasificaciones = this.historialClasificaciones.filter(
            item => ahora - item.timestamp <= this.contador.intervalo
        );

        const estadisticas = this.contador.obtenerEstadisticas();

        // Sección 6.11: Comportamiento ante ausencia de mensajes
        // Cuando no existen mensajes durante un período determinado, reducir progresivamente la velocidad
        // y llevar el sistema hacia un comportamiento calmo.
        if (estadisticas.enInactividad) {
            this.patronActual = "calmo";
            this.colorExplicito = null;
        } else if (estadisticas.mensajes === 0 && this.patronActual === "agresivo") {
            // Transición gradual: si terminó la ráfaga agresiva y la ventana quedó vacía, pasa primero a neutral
            this.patronActual = "neutral";
        }

        const colorFinal =
            this.colorExplicito ||
            this.clasificador.obtenerColorPorPatron(this.patronActual);

        return {
            patron: this.patronActual,
            color: colorFinal,
            velocidad: estadisticas.nivel,
            nivelEspanol: estadisticas.nivelEspanol,
            velocidadMatematica: estadisticas.velocidadMatematica,
            estadisticas
        };
    }

    obtenerEstadisticas() {
        return {
            ...this.contador.obtenerEstadisticas(),
            patronActual: this.patronActual
        };
    }

    actualizarParametros(params) {
        this.contador.actualizarParametros(params);
        return this.obtenerEstadisticas();
    }
}

module.exports = AnalizadorMensajes;
