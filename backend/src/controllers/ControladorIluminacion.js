class ControladorIluminacion {

    constructor() {
        this.colorPorDefecto = "cyan";
        this.patronPorDefecto = "calmo";
        this.velocidadPorDefecto = "low";
        this.velocidadMatematicaPorDefecto = 10;
    }

    /**
     * Genera el comando para la lámpara física (ESP8266) y el simulador web.
     * Separa explícitamente el patrón (comportamiento visual: calmo, neutral, agresivo)
     * y la velocidad (nivel de actividad: low/medium/high + valor matemático).
     */
    generarComando(patron, velocidad, color = null, velocidadMatematica = null) {
        const patronFinal = patron || this.patronPorDefecto;

        // Mapeo de compatibilidad de color predeterminado según patrón si no se especificó color
        const coloresPorPatron = {
            calmo: "cyan",
            neutral: "purple",
            agresivo: "red"
        };

        const colorFinal = color || coloresPorPatron[patronFinal] || this.colorPorDefecto;

        return {
            pattern: patronFinal,
            speed: velocidad || this.velocidadPorDefecto,
            speedValue: velocidadMatematica !== null
                ? velocidadMatematica
                : this.velocidadMatematicaPorDefecto,
            color: colorFinal,
            timestamp: Date.now()
        };
    }
}

module.exports = ControladorIluminacion;
