class ContadorActividad {

    constructor(intervalo = 10000) {

        this.intervalo = intervalo;

        this.mensajes = [];
    }

    registrarMensaje(mensaje) {

        this.mensajes.push(mensaje);

        this.limpiarMensajes();
    }

    limpiarMensajes() {

        const ahora = Date.now();

        this.mensajes =
            this.mensajes.filter(
                mensaje =>
                    ahora - mensaje.timestamp <= this.intervalo
            );
    }

    contarMensajes() {

        this.limpiarMensajes();

        return this.mensajes.length;
    }

    calcularVelocidad() {

        this.limpiarMensajes();

        const cantidad =
            this.mensajes.length;

        const segundos =
            this.intervalo / 1000;

        if (segundos <= 0) {
            return 0;
        }

        return cantidad / segundos;
    }

    obtenerNivel() {

        const velocidad =
            this.calcularVelocidad();

        if (velocidad >= 1) {
            return "high";
        }

        if (velocidad >= 0.3) {
            return "medium";
        }

        return "low";
    }

    obtenerEstadisticas() {

        return {
            mensajes: this.contarMensajes(),
            mensajesPorSegundo:
                this.calcularVelocidad(),
            nivel:
                this.obtenerNivel()
        };
    }
}

module.exports = ContadorActividad;