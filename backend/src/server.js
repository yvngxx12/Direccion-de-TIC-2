const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const YouTubeChatService = require("./services/YouTubeChatService");
const ESP32Service = require("./services/ESP32Service");
const AnalizadorMensajes = require("./analyzers/AnalizadorMensajes");
const ControladorIluminacion = require("./controllers/ControladorIluminacion");

const PORT = process.env.PORT || 4000;
const ACTIVITY_INTERVAL =
    Number(process.env.ACTIVITY_INTERVAL) || 10000;

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// ==============================
// SERVICIOS
// ==============================

const youtubeService =
    new YouTubeChatService();

const espService =
    new ESP32Service();

const analizador =
    new AnalizadorMensajes(
        ACTIVITY_INTERVAL
    );

const controlador =
    new ControladorIluminacion();


// ==============================
// ESTADO DEL SISTEMA
// ==============================

let sistemaActivo = false;

let totalMensajes = 0;

let ultimoAnalisis = null;

let ultimoComando = null;


// ==============================
// RUTA PRINCIPAL
// ==============================

app.get("/", (req, res) => {

    res.json({
        status: "online",
        message: "YouTube RGB Lamp System"
    });

});


// ==============================
// ESTADO DEL SISTEMA
// ==============================

app.get("/status", (req, res) => {

    res.json({

        sistemaActivo,

        youtube: {
            conectado:
                youtubeService.estaConectado()
        },

        esp8266: {
            conectado:
                espService.estaConectado()
        },

        totalMensajes,

        ultimoAnalisis,

        ultimoComando
    });

});


// ==============================
// ACTIVAR YOUTUBE
// ==============================

app.post("/youtube/connect", (req, res) => {

    const {
        apiKey,
        liveChatId
    } = req.body;

    if (!apiKey || !liveChatId) {

        return res.status(400).json({
            error:
                "Faltan apiKey o liveChatId."
        });

    }

    youtubeService.configurar(
        apiKey,
        liveChatId
    );

    sistemaActivo = true;

    console.log(
        "YouTube configurado correctamente."
    );

    res.json({
        ok: true,
        message:
            "YouTube configurado."
    });

});


// ==============================
// DESCONECTAR YOUTUBE
// ==============================

app.post("/youtube/disconnect", (req, res) => {

    youtubeService.desconectar();

    sistemaActivo = false;

    res.json({
        ok: true,
        message:
            "YouTube desconectado."
    });

});


// ==============================
// CONECTAR ESP8266
// ==============================

app.post("/esp8266/connect", async (req, res) => {

    const resultado =
        await espService.conectar();

    if (!resultado) {

        return res.status(503).json({
            ok: false,
            message:
                "No se pudo conectar con la ESP8266."
        });

    }

    res.json({
        ok: true,
        message:
            "ESP8266 conectada.",
        data: resultado
    });

});


// ==============================
// DESCONECTAR ESP8266
// ==============================

app.post("/esp8266/disconnect", (req, res) => {

    espService.desconectar();

    res.json({
        ok: true,
        message:
            "ESP8266 desconectada."
    });

});


// ==============================
// PROCESAR CHAT
// ==============================

async function procesarChat() {

    if (!sistemaActivo) {
        return;
    }

    const mensajes =
        await youtubeService.obtenerMensajes();

    if (!mensajes.length) {
        return;
    }

    for (const mensaje of mensajes) {

        totalMensajes++;

        const resultado =
            analizador.analizar(
                mensaje
            );

        ultimoAnalisis =
            resultado;

        console.log(
            "Mensaje analizado:",
            resultado
        );

        // Solo generamos comando
        // cuando se detecta patrón o color.

        if (
            resultado.patron ||
            resultado.color
        ) {

            const comando =
                controlador.generarComando(
                    resultado.patron,
                    resultado.velocidad,
                    resultado.color
                );

            ultimoComando =
                comando;

            console.log(
                "Comando generado:",
                comando
            );

            await espService.enviarComando(
                comando
            );
        }

        // Enviar información al frontend
        io.emit(
            "mensajeAnalizado",
            resultado
        );

        io.emit(
            "estadisticas",
            analizador.obtenerEstadisticas()
        );

        io.emit(
            "estadoSistema",
            {
                youtube:
                    youtubeService.estaConectado(),

                esp8266:
                    espService.estaConectado(),

                totalMensajes,

                ultimoComando
            }
        );
    }
}


// ==============================
// PROCESAMIENTO AUTOMÁTICO
// ==============================

setInterval(
    procesarChat,
    3000
);


// ==============================
// SOCKET.IO
// ==============================

io.on("connection", (socket) => {

    console.log(
        `Cliente conectado: ${socket.id}`
    );

    socket.emit(
        "estadoSistema",
        {
            youtube:
                youtubeService.estaConectado(),

            esp8266:
                espService.estaConectado(),

            totalMensajes,

            ultimoComando
        }
    );

    socket.on("disconnect", () => {

        console.log(
            `Cliente desconectado: ${socket.id}`
        );

    });

});


// ==============================
// SERVIDOR
// ==============================

server.listen(PORT, () => {

    console.log("");
    console.log(
        "================================"
    );
    console.log(
        "   YOUTUBE RGB LAMP SYSTEM"
    );
    console.log(
        "================================"
    );
    console.log("");

    console.log(
        `Servidor iniciado en http://localhost:${PORT}`
    );

    console.log(
        `Intervalo de actividad: ${ACTIVITY_INTERVAL} ms`
    );

    console.log("");

});