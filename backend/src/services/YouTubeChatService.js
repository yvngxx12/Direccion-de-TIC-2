const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { google } = require("googleapis");
const MensajeChat = require("../models/MensajeChat");

const TOKEN_PATH = path.join(__dirname, "../../.oauth-tokens.json");

class YouTubeChatService {

    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY || "";
        this.liveChatId = process.env.YOUTUBE_LIVE_CHAT_ID || "";
        this.videoId = process.env.YOUTUBE_VIDEO_ID || "";

        this.clientId = process.env.GOOGLE_CLIENT_ID || "";
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
        this.redirectUri =
            process.env.GOOGLE_REDIRECT_URI ||
            "http://localhost:3000/oauth2callback";

        this.oauth2Client = null;
        this.oauthAutenticado = false;
        this.inicializarOAuth();

        this.nextPageToken = null;
        this.conectado = false;
        this.primeraCarga = true;
        this.ultimoError = null;
    }

    inicializarOAuth() {
        if (this.clientId && this.clientSecret) {
            this.oauth2Client = new google.auth.OAuth2(
                this.clientId,
                this.clientSecret,
                this.redirectUri
            );

            // Cargar tokens guardados si existen
            if (fs.existsSync(TOKEN_PATH)) {
                try {
                    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
                    this.oauth2Client.setCredentials(tokens);
                    this.oauthAutenticado = true;
                    console.log("Sesión OAuth 2.0 de YouTube cargada desde archivo.");
                } catch (err) {
                    console.error("Error leyendo tokens OAuth guardados:", err.message);
                }
            }

            this.oauth2Client.on("tokens", (tokens) => {
                try {
                    let actuales = {};
                    if (fs.existsSync(TOKEN_PATH)) {
                        actuales = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
                    }
                    const combinados = { ...actuales, ...tokens };
                    fs.writeFileSync(TOKEN_PATH, JSON.stringify(combinados, null, 2));
                } catch (err) {
                    console.error("No se pudieron guardar los tokens OAuth:", err.message);
                }
            });
        }
    }

    obtenerUrlAutorizacion(customRedirectUri = null) {
        if (!this.oauth2Client) {
            throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env");
        }
        if (customRedirectUri) {
            this.redirectUri = customRedirectUri;
            this.oauth2Client = new google.auth.OAuth2(
                this.clientId,
                this.clientSecret,
                this.redirectUri
            );
        }
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: ["https://www.googleapis.com/auth/youtube.readonly"]
        });
    }

    async intercambiarCodigoOAuth(code) {
        if (!this.oauth2Client) {
            throw new Error("Cliente OAuth2 no configurado.");
        }
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        this.oauthAutenticado = true;
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        return tokens;
    }

    cerrarSesionOAuth() {
        this.oauthAutenticado = false;
        if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH);
        }
        if (this.oauth2Client) {
            this.oauth2Client.setCredentials({});
        }
    }

    tieneCredencialesValidas() {
        return Boolean(
            this.oauthAutenticado ||
            (this.apiKey && this.apiKey.startsWith("AIza"))
        );
    }

    extraerVideoId(input) {
        if (!input) return "";
        const str = String(input).trim();
        const match = str.match(
            /(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (match && match[1]) {
            return match[1];
        }
        return str;
    }

    async configurar({ apiKey, liveChatId, videoId }) {
        if (apiKey && apiKey.trim().startsWith("AIza")) {
            this.apiKey = apiKey.trim();
        }

        if (!this.tieneCredencialesValidas()) {
            throw new Error(
                "Primero inicia sesión con Google (OAuth 2.0) o ingresa una API Key válida (AIza...)."
            );
        }

        this.nextPageToken = null;
        this.primeraCarga = true;
        this.ultimoError = null;

        if (liveChatId && liveChatId.trim()) {
            this.liveChatId = liveChatId.trim();
            this.conectado = true;
            return {
                ok: true,
                liveChatId: this.liveChatId
            };
        }

        if (videoId && videoId.trim()) {
            this.videoId = this.extraerVideoId(videoId);
            const idObtenido = await this.obtenerLiveChatIdDesdeVideo(this.videoId);
            if (idObtenido) {
                this.liveChatId = idObtenido;
                this.conectado = true;
                return {
                    ok: true,
                    liveChatId: this.liveChatId,
                    videoId: this.videoId
                };
            }
        }

        throw new Error(
            this.ultimoError ||
            "No se pudo obtener el liveChatId. Verifica que el video esté EN VIVO y tenga chat activo."
        );
    }

    obtenerClienteYouTube() {
        if (this.oauthAutenticado && this.oauth2Client) {
            return google.youtube({
                version: "v3",
                auth: this.oauth2Client
            });
        }
        if (this.apiKey && this.apiKey.startsWith("AIza")) {
            return google.youtube({
                version: "v3",
                auth: this.apiKey
            });
        }
        return null;
    }

    async obtenerLiveChatIdDesdeVideo(videoId) {
        const yt = this.obtenerClienteYouTube();
        if (!yt) {
            this.ultimoError = "Sin autenticación OAuth ni API Key válida.";
            return null;
        }

        try {
            const respuesta = await yt.videos.list({
                part: ["liveStreamingDetails", "snippet"],
                id: [videoId]
            });

            const item = respuesta.data.items?.[0];
            const activeLiveChatId = item?.liveStreamingDetails?.activeLiveChatId;

            if (!activeLiveChatId) {
                this.ultimoError =
                    "El video no existe, no está en vivo actualmente o no tiene chat habilitado.";
                return null;
            }

            return activeLiveChatId;
        } catch (error) {
            this.ultimoError =
                error.response?.data?.error?.message || error.message;
            console.error("Error obteniendo liveChatId desde videoId:", this.ultimoError);
            return null;
        }
    }

    async obtenerMensajes() {
        const yt = this.obtenerClienteYouTube();
        if (!yt || !this.liveChatId) {
            return [];
        }

        try {
            const respuesta = await yt.liveChatMessages.list({
                part: ["snippet", "authorDetails"],
                liveChatId: this.liveChatId,
                maxResults: 50,
                pageToken: this.nextPageToken || undefined
            });

            const eraPrimeraCarga = this.primeraCarga;
            this.primeraCarga = false;
            this.nextPageToken = respuesta.data.nextPageToken;
            this.conectado = true;
            this.ultimoError = null;

            const items = respuesta.data.items || [];
            const itemsAProcesar = eraPrimeraCarga ? items.slice(-3) : items;

            const mensajes = itemsAProcesar.map((item) => {
                const autor = item.authorDetails?.displayName || "Espectador";
                const contenido = item.snippet?.displayMessage || "";
                const timestamp = item.snippet?.publishedAt
                    ? new Date(item.snippet.publishedAt).getTime()
                    : Date.now();

                return new MensajeChat(autor, contenido, timestamp);
            });

            return mensajes;
        } catch (error) {
            this.conectado = false;
            this.ultimoError =
                error.response?.data?.error?.message || error.message;
            console.error("Error obteniendo mensajes de YouTube:", this.ultimoError);
            return [];
        }
    }

    estaConectado() {
        return this.conectado;
    }

    desconectar() {
        this.conectado = false;
        this.nextPageToken = null;
        this.primeraCarga = true;
    }
}

module.exports = YouTubeChatService;
