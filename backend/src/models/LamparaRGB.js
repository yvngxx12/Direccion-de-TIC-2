class LamparaRGB {

    constructor() {
        this.color = "cyan";
        this.patron = "calmo";
        this.velocidad = "low";
        this.velocidadMatematica = 10;
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
        if (comando.speedValue !== undefined) {
            this.velocidadMatematica = comando.speedValue;
        }
    }

    obtenerEstado() {
        return {
            color: this.color,
            pattern: this.patron,
            speed: this.velocidad,
            speedValue: this.velocidadMatematica
        };
    }
}

module.exports = LamparaRGB;
