class LamparaRGB {

    constructor() {
        this.color = "off";
        this.patron = "fixed";
        this.velocidad = "medium";
    }

    actualizar(comando) {

        if (comando.color) {
            this.color = comando.color;
        }

        if (comando.pattern) {
            this.patron = comando.pattern;
        }

        if (comando.speed) {
            this.velocidad = comando.speed;
        }
    }

    obtenerEstado() {

        return {
            color: this.color,
            pattern: this.patron,
            speed: this.velocidad
        };
    }
}

module.exports = LamparaRGB;