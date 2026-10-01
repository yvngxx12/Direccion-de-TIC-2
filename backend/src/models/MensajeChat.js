class MensajeChat {

    constructor(autor, contenido, timestamp = Date.now()) {
        this.autor = autor;
        this.contenido = contenido;
        this.timestamp = timestamp;
    }

    toJSON() {
        return {
            autor: this.autor,
            contenido: this.contenido,
            timestamp: this.timestamp
        };
    }
}

module.exports = MensajeChat;