require("dotenv").config();

const express = require("express");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 4000;

const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY
});

app.get("/chat", async (req, res) => {
    try {
        // ID de un video que esté actualmente EN VIVO
        const VIDEO_PUBLICO_ID = "92IaqdAkYO0";

        // Obtener información de la transmisión
        const videoResponse = await youtube.videos.list({
            part: ["liveStreamingDetails"],
            id: [VIDEO_PUBLICO_ID]
        });

        const videoDetails = videoResponse.data.items[0];

        if (
            !videoDetails ||
            !videoDetails.liveStreamingDetails ||
            !videoDetails.liveStreamingDetails.activeLiveChatId
        ) {
            return res.status(404).send(
                "El video no existe, no está en vivo o tiene el chat desactivado."
            );
        }

        const liveChatId =
            videoDetails.liveStreamingDetails.activeLiveChatId;

        console.log(`Leyendo chat público. ID: ${liveChatId}`);

        // Obtener mensajes
        const chatResponse = await youtube.liveChatMessages.list({
            liveChatId: liveChatId,
            part: ["snippet", "authorDetails"],
            maxResults: 50
        });

        res.json({
            chatId: liveChatId,
            mensajes: chatResponse.data.items
        });

    } catch (error) {
        console.error(
            "Error:",
            error.response?.data || error.message
        );

        res.status(500).send("Error al consultar la API");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});