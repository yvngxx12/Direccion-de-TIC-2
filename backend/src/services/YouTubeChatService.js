const axios = require("axios");
const MensajeChat = require("../models/MensajeChat");

class YouTubeChatService {

    constructor() {

        this.apiKey = process.env.YOUTUBE_API_KEY;
        this.liveChatId = process.env.YOUTUBE_LIVE_CHAT_ID;

        this.nextPageToken = null;
        this.conectado = false;
    }

    configurar(apiKey, liveChatId) {

        this.apiKey = apiKey;
        this.liveChatId = liveChatId;

    }

    async obtenerMensajes() {

        if (!this.apiKey) {
            throw new Error(
                "No se configuró YOUTUBE_API_KEY."
            );
        }

        if (!this.liveChatId) {
            throw new Error(
                "No se configuró YOUTUBE_LIVE_CHAT_ID."
            );
        }

        try {

            const respuesta = await axios.get(
                "https://www.googleapis.com/youtube/v3/liveChat/messages",
                {
                    params: {
                        part: "snippet,authorDetails",
                        liveChatId: this.liveChatId,
                        maxResults: 200,
                        pageToken: this.nextPageToken,
                        key: this.apiKey
                    },
                    timeout: 5000
                }
            );

            this.nextPageToken =
                respuesta.data.nextPageToken;

            this.conectado = true;

            const mensajes =
                respuesta.data.items.map(item => {

                    const autor =
                        item.authorDetails
                            ?.displayName || "Usuario";

                    const contenido =
                        item.snippet
                            ?.displayMessage || "";

                    const timestamp =
                        item.snippet
                            ?.publishedAt
                            ? new Date(
                                item.snippet.publishedAt
                            ).getTime()
                            : Date.now();

                    return new MensajeChat(
                        autor,
                        contenido,
                        timestamp
                    );
                });

            return mensajes;

        } catch (error) {

            this.conectado = false;

            console.error(
                "Error obteniendo mensajes de YouTube:",
                error.response?.data ||
                error.message
            );

            return [];
        }
    }

    estaConectado() {

        return this.conectado;
    }

    desconectar() {

        this.conectado = false;
        this.nextPageToken = null;

    }
}

module.exports = YouTubeChatService;