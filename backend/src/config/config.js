require("dotenv").config();

module.exports = {
    port: Number(process.env.PORT) || 4000,
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY || "",
        liveChatId: process.env.YOUTUBE_LIVE_CHAT_ID || "",
        videoId: process.env.YOUTUBE_VIDEO_ID || "",
        pollIntervalMs: Number(process.env.YOUTUBE_POLL_INTERVAL) || 3000
    },
    esp8266: {
        ip: process.env.ESP8266_IP || "192.168.1.100"
    },
    activity: {
        // Ventana temporal en milisegundos (por defecto 10 segundos - Sección 6.9)
        windowMs: Number(process.env.ACTIVITY_INTERVAL) || 10000,
        // Umbrales discretos en la ventana de 10s:
        // 0-2: baja, 3-7: media, 8+: alta
        thresholds: {
            lowMax: 2,
            mediumMax: 7
        },
        // Relación matemática: Velocidad = min(Mensajes * K, VelocidadMaxima)
        factorK: Number(process.env.SPEED_FACTOR_K) || 10,
        maxSpeed: Number(process.env.MAX_SPEED) || 100,
        minSpeed: Number(process.env.MIN_SPEED) || 10,
        // Tiempo sin mensajes para iniciar transición progresiva a calmo (Sección 6.11)
        inactivityTimeoutMs: Number(process.env.INACTIVITY_DECAY_MS) || 15000,
        decayStep: 5
    }
};

