const axios = require("axios");

class ESP32Service {

    constructor(ip = null) {
        this.ip = ip || process.env.ESP8266_IP || "192.168.1.100";
        this.conectado = false;
    }

    configurarIP(ip) {
        if (ip && ip.trim()) {
            this.ip = ip.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
        }
    }

    obtenerURL() {
        if (!this.ip) {
            throw new Error("No se configuró la IP de la ESP8266.");
        }
        return `http://${this.ip}`;
    }

    async conectar(ip = null) {
        if (ip) {
            this.configurarIP(ip);
        }

        try {
            const url = `${this.obtenerURL()}/status`;
            const respuesta = await axios.get(url, { timeout: 2500 });

            this.conectado = true;
            console.log("ESP8266 conectada:", respuesta.data);
            return respuesta.data;
        } catch (error) {
            this.conectado = false;
            console.error("Error conectando con la ESP8266:", error.message);
            return null;
        }
    }

    async enviarComando(comando) {
        if (!this.conectado) {
            return null;
        }

        try {
            const url = `${this.obtenerURL()}/command`;
            const respuesta = await axios.post(url, comando, {
                timeout: 2500,
                headers: {
                    "Content-Type": "application/json"
                }
            });

            this.conectado = true;
            console.log("Comando enviado a ESP8266:", comando);
            return respuesta.data;
        } catch (error) {
            this.conectado = false;
            console.error("Error enviando comando a ESP8266:", error.message);
            return null;
        }
    }

    estaConectado() {
        return this.conectado;
    }

    desconectar() {
        this.conectado = false;
        console.log("ESP8266 marcada como desconectada.");
    }
}

module.exports = ESP32Service;
