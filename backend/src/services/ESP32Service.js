const axios = require("axios");

class ESP32Service {

    constructor(ip = null) {

        this.ip = ip || process.env.ESP8266_IP;

        this.conectado = false;
    }

    obtenerURL() {

        if (!this.ip) {
            throw new Error(
                "No se configuró la IP de la ESP8266."
            );
        }

        return `http://${this.ip}`;
    }

    async conectar() {

        try {

            const url =
                `${this.obtenerURL()}/status`;

            const respuesta =
                await axios.get(url, {
                    timeout: 3000
                });

            this.conectado = true;

            console.log(
                "ESP8266 conectada:",
                respuesta.data
            );

            return respuesta.data;

        } catch (error) {

            this.conectado = false;

            console.error(
                "Error conectando con la ESP8266:",
                error.message
            );

            return null;
        }
    }

    async enviarComando(comando) {

        try {

            const url =
                `${this.obtenerURL()}/command`;

            const respuesta =
                await axios.post(
                    url,
                    comando,
                    {
                        timeout: 3000,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            this.conectado = true;

            console.log(
                "Comando enviado a ESP8266:",
                comando
            );

            return respuesta.data;

        } catch (error) {

            this.conectado = false;

            console.error(
                "Error enviando comando a ESP8266:",
                error.message
            );

            return null;
        }
    }

    estaConectado() {

        return this.conectado;
    }

    desconectar() {

        this.conectado = false;

        console.log(
            "ESP8266 marcada como desconectada."
        );
    }
}

module.exports = ESP32Service;