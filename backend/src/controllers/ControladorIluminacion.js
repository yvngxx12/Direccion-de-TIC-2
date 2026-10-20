class ControladorIluminacion {

    constructor() {

        this.colorPorDefecto = "white";
        this.patronPorDefecto = "fixed";
        this.velocidadPorDefecto = "low";
    }

    generarComando(patron, velocidad, color = null) {

        const comando = {

            color: color || this.colorPorDefecto,

            pattern:
                patron || this.patronPorDefecto,

            speed:
                velocidad || this.velocidadPorDefecto
        };

        return comando;
    }
}

module.exports = ControladorIluminacion;