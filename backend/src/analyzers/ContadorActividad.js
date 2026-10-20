const config = require("../config/config");

class ContadorActividad {

    constructor(intervalo = config.activity.windowMs) {
        this.intervalo = intervalo;
        this.lowMax = config.activity.thresholds.lowMax;       // 2 mensajes (0-2 = baja)
        this.mediumMax = config.activity.thresholds.mediumMax; // 7 mensajes (3-7 = media, 8+ = alta)
        this.factorK = config.activity.factorK;                // Factor K
        this.velocidadMaxima = config.activity.maxSpeed;       // VelocidadMáxima
        this.velocidadMinima = config.activity.minSpeed;       // Velocidad base mínima
        this.inactivityTimeoutMs = config.activity.inactivityTimeoutMs;
        this.decayStep = config.activity.decayStep;

        this.mensajes = [];
        this.ultimoMensajeTimestamp = Date.now();
        this.velocidadActual = this.velocidadMinima;
    }

    registrarMensaje(mensaje) {
        const ahora = Date.now();
        const msgConTiempo = {
            ...mensaje,
            registeredAt: ahora,
            timestamp: mensaje.timestamp || ahora
        };

        this.mensajes.push(msgConTiempo);
        this.ultimoMensajeTimestamp = ahora;
        this.limpiarMensajes();
        this.actualizarVelocidadMatematica();
    }

    limpiarMensajes() {
        const ahora = Date.now();
        this.mensajes = this.mensajes.filter(
            mensaje => ahora - (mensaje.registeredAt || mensaje.timestamp) <= this.intervalo
        );
    }

    contarMensajes() {
        this.limpiarMensajes();
        return this.mensajes.length;
    }

    calcularMensajesPorSegundo() {
        const cantidad = this.contarMensajes();
        const segundos = this.intervalo / 1000;
        if (segundos <= 0) return 0;
        return Number((cantidad / segundos).toFixed(2));
    }

    /**
     * Sección 6.9: Relación matemática Velocidad = min(Mensajes × K, VelocidadMáxima)
     * Y Sección 6.11: Reducción progresiva ante ausencia de mensajes.
     */
    actualizarVelocidadMatematica() {
        const cantidad = this.contarMensajes();
        const calculada = Math.min(cantidad * this.factorK, this.velocidadMaxima);

        if (cantidad > 0) {
            this.velocidadActual = Math.max(this.velocidadMinima, calculada);
        } else if (this.estaEnInactividad()) {
            // Reducción progresiva de la velocidad (Sección 6.11)
            this.velocidadActual = Math.max(
                this.velocidadMinima,
                this.velocidadActual - this.decayStep
            );
        } else {
            this.velocidadActual = Math.max(
                this.velocidadMinima,
                this.velocidadActual - Math.ceil(this.decayStep / 2)
            );
        }

        return this.velocidadActual;
    }

    /**
     * Sección 6.9: En una ventana de 10s:
     * 0–2 mensajes: actividad baja ("low")
     * 3–7 mensajes: actividad media ("medium")
     * 8 o más mensajes: actividad alta ("high")
     */
    obtenerNivel() {
        const cantidad = this.contarMensajes();

        if (cantidad > this.mediumMax) {
            return "high";
        }

        if (cantidad > this.lowMax) {
            return "medium";
        }

        return "low";
    }

    obtenerNivelEspanol() {
        const nivel = this.obtenerNivel();
        if (nivel === "high") return "alta";
        if (nivel === "medium") return "media";
        return "baja";
    }

    tiempoSinMensajesMs() {
        return Date.now() - this.ultimoMensajeTimestamp;
    }

    estaEnInactividad() {
        return this.tiempoSinMensajesMs() >= this.inactivityTimeoutMs;
    }

    actualizarParametros(nuevosParams = {}) {
        if (nuevosParams.intervalo !== undefined) {
            this.intervalo = Math.max(1000, Number(nuevosParams.intervalo));
        }
        if (nuevosParams.lowMax !== undefined) {
            this.lowMax = Math.max(0, Number(nuevosParams.lowMax));
        }
        if (nuevosParams.mediumMax !== undefined) {
            this.mediumMax = Math.max(this.lowMax + 1, Number(nuevosParams.mediumMax));
        }
        if (nuevosParams.factorK !== undefined) {
            this.factorK = Math.max(1, Number(nuevosParams.factorK));
        }
        if (nuevosParams.velocidadMaxima !== undefined) {
            this.velocidadMaxima = Math.max(10, Number(nuevosParams.velocidadMaxima));
        }
        if (nuevosParams.inactivityTimeoutMs !== undefined) {
            this.inactivityTimeoutMs = Math.max(3000, Number(nuevosParams.inactivityTimeoutMs));
        }
    }

    obtenerParametros() {
        return {
            intervalo: this.intervalo,
            lowMax: this.lowMax,
            mediumMax: this.mediumMax,
            factorK: this.factorK,
            velocidadMaxima: this.velocidadMaxima,
            velocidadMinima: this.velocidadMinima,
            inactivityTimeoutMs: this.inactivityTimeoutMs
        };
    }

    obtenerEstadisticas() {
        const mensajes = this.contarMensajes();
        const velocidadMatematica = this.actualizarVelocidadMatematica();
        const nivel = this.obtenerNivel();
        const tiempoInactivoMs = this.tiempoSinMensajesMs();
        const enInactividad = this.estaEnInactividad();

        return {
            mensajes,
            mensajesPorSegundo: this.calcularMensajesPorSegundo(),
            nivel,
            nivelEspanol: this.obtenerNivelEspanol(),
            velocidadMatematica,
            formulaTexto: `min(${mensajes} × ${this.factorK}, ${this.velocidadMaxima}) = ${ Math.min(mensajes * this.factorK, this.velocidadMaxima) }`,
            tiempoSinMensajesSegundos: Math.floor(tiempoInactivoMs / 1000),
            enInactividad,
            parametros: this.obtenerParametros()
        };
    }
}

module.exports = ContadorActividad;
