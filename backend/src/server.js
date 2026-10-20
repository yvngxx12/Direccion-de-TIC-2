const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const config = require("./config/config");
const YouTubeChatService = require("./services/YouTubeChatService");
const ESP32Service = require("./services/ESP32Service");
const AnalizadorMensajes = require("./analyzers/AnalizadorMensajes");
const ControladorIluminacion = require("./controllers/ControladorIluminacion");
const LamparaRGB = require("./models/LamparaRGB");
const MensajeChat = require("./models/MensajeChat");
const patternsConfig = require("./config/patterns.json");

const PORT = config.port;
const ACTIVITY_INTERVAL = config.activity.windowMs;

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
// SERVICIOS Y MODELOS
// ==============================

const youtubeService = new YouTubeChatService();
const espService = new ESP32Service();
const analizador = new AnalizadorMensajes(ACTIVITY_INTERVAL);
const controlador = new ControladorIluminacion();
const lampara = new LamparaRGB();

// ==============================
// ESTADO DEL SISTEMA
// ==============================

let sistemaActivo = false;
let totalMensajes = 0;
let ultimoAnalisis = null;
let ultimoComando = controlador.generarComando("calmo", "low", "cyan", 10);
lampara.actualizar(ultimoComando);

function comandoCambioSignificativamente(anterior, nuevo) {
    if (!anterior) return true;
    return (
        anterior.pattern !== nuevo.pattern ||
        anterior.speed !== nuevo.speed ||
        anterior.color !== nuevo.color ||
        Math.abs((anterior.speedValue || 0) - (nuevo.speedValue || 0)) >= 5
    );
}

async function aplicarYEmitirComando(comando) {
    const cambio = comandoCambioSignificativamente(ultimoComando, comando);
    ultimoComando = comando;
    lampara.actualizar(comando);

    if (cambio && espService.estaConectado()) {
        await espService.enviarComando(comando);
    }

    io.emit("comandoActualizado", comando);
}

function emitirEstadoCompleto() {
    io.emit("estadisticas", analizador.obtenerEstadisticas());
    io.emit("estadoSistema", {
        sistemaActivo,
        youtube: youtubeService.estaConectado(),
        oauthAutenticado: youtubeService.oauthAutenticado,
        oauthRedirectUri: youtubeService.redirectUri,
        esp8266: espService.estaConectado(),
        esp8266Ip: espService.ip,
        totalMensajes,
        ultimoComando,
        lampara: lampara.obtenerEstado()
    });
}

async function procesarMensajeIndividual(mensajeObj) {
    totalMensajes++;

    const resultado = analizador.analizar(mensajeObj);
    ultimoAnalisis = resultado;

    const comando = controlador.generarComando(
        resultado.patron,
        resultado.velocidad,
        resultado.color,
        resultado.velocidadMatematica
    );

    await aplicarYEmitirComando(comando);

    io.emit("mensajeAnalizado", resultado);
    emitirEstadoCompleto();

    return resultado;
}

// ==============================
// RUTAS HTTP Y OAUTH 2.0
// ==============================

app.get("/", async (req, res) => {
    // Si Google redirige a http://localhost:4000/?code=...
    if (req.query.code) {
        try {
            await youtubeService.intercambiarCodigoOAuth(req.query.code);
            emitirEstadoCompleto();
            return res.redirect("http://localhost:5173/?oauth=ok");
        } catch (err) {
            return res.status(400).send(`Error OAuth: ${err.message}`);
        }
    }

    res.json({
        status: "online",
        message: "Proyecto B: Lámpara Dinámica de Interacción por Chat"
    });
});

app.get("/auth/google", (req, res) => {
    try {
        const redirectUri = req.query.redirectUri || null;
        const url = youtubeService.obtenerUrlAutorizacion(redirectUri);
        res.redirect(url);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function manejarCallbackOAuth(req, res) {
    const { code, error } = req.query;
    if (error) {
        return res.status(400).send(`Cancelado o error en Google OAuth: ${error}`);
    }
    if (!code) {
        return res.status(400).send("No se recibió el código de autorización.");
    }
    try {
        await youtubeService.intercambiarCodigoOAuth(code);
        emitirEstadoCompleto();
        res.redirect("http://localhost:5173/?oauth=ok");
    } catch (err) {
        res.status(400).send(`Error al intercambiar código OAuth: ${err.message}`);
    }
}

app.get("/auth/google/callback", manejarCallbackOAuth);
app.get("/oauth2callback", manejarCallbackOAuth);

app.post("/auth/google/code", async (req, res) => {
    try {
        let { codeOrUrl, redirectUri } = req.body;
        if (!codeOrUrl) {
            return res.status(400).json({ error: "Falta el código o URL de autorización." });
        }
        if (redirectUri) {
            youtubeService.obtenerUrlAutorizacion(redirectUri);
        }
        // Si pegó la URL completa (ej: http://localhost:3000/?code=4/0A...), extraemos el parámetro code
        let code = codeOrUrl.trim();
        if (code.includes("code=")) {
            const urlObj = new URL(code.startsWith("http") ? code : `http://localhost/${code}`);
            code = urlObj.searchParams.get("code") || code;
        }
        await youtubeService.intercambiarCodigoOAuth(code);
        emitirEstadoCompleto();
        res.json({ ok: true, message: "Autenticación OAuth 2.0 completada con éxito." });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

app.post("/auth/google/logout", (req, res) => {
    youtubeService.cerrarSesionOAuth();
    emitirEstadoCompleto();
    res.json({ ok: true, message: "Sesión OAuth cerrada." });
});

app.get("/status", (req, res) => {
    res.json({
        sistemaActivo,
        youtube: {
            conectado: youtubeService.estaConectado(),
            oauthAutenticado: youtubeService.oauthAutenticado,
            oauthRedirectUri: youtubeService.redirectUri,
            liveChatId: youtubeService.liveChatId,
            videoId: youtubeService.videoId
        },
        esp8266: {
            conectado: espService.estaConectado(),
            ip: espService.ip
        },
        totalMensajes,
        ultimoAnalisis,
        ultimoComando,
        lampara: lampara.obtenerEstado(),
        estadisticas: analizador.obtenerEstadisticas(),
        patterns: patternsConfig.patterns
    });
});

// ==============================
// ACTIVAR / DESCONECTAR YOUTUBE
// ==============================

app.post("/youtube/connect", async (req, res) => {
    const { apiKey, liveChatId, videoId } = req.body;

    if (!liveChatId && !videoId) {
        return res.status(400).json({
            ok: false,
            error: "Debes proporcionar un Video ID / URL en vivo o un LiveChat ID."
        });
    }

    try {
        const info = await youtubeService.configurar({
            apiKey: apiKey || process.env.YOUTUBE_API_KEY,
            liveChatId,
            videoId
        });

        sistemaActivo = true;
        emitirEstadoCompleto();

        res.json({
            ok: true,
            message: "YouTube conectado correctamente.",
            liveChatId: info.liveChatId,
            videoId: info.videoId
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            error: error.message
        });
    }
});

app.post("/youtube/disconnect", (req, res) => {
    youtubeService.desconectar();
    sistemaActivo = false;
    emitirEstadoCompleto();

    res.json({
        ok: true,
        message: "YouTube desconectado."
    });
});

// ==============================
// CONECTAR / DESCONECTAR ESP8266
// ==============================

app.post("/esp8266/connect", async (req, res) => {
    const { ip } = req.body || {};
    const resultado = await espService.conectar(ip);

    if (!resultado) {
        emitirEstadoCompleto();
        return res.status(503).json({
            ok: false,
            message: `No se pudo conectar con la ESP8266 en ${espService.ip}.`
        });
    }

    await espService.enviarComando(ultimoComando);
    emitirEstadoCompleto();

    res.json({
        ok: true,
        message: "ESP8266 conectada.",
        data: resultado
    });
});

app.post("/esp8266/disconnect", (req, res) => {
    espService.desconectar();
    emitirEstadoCompleto();

    res.json({
        ok: true,
        message: "ESP8266 desconectada."
    });
});

// ==============================
// SIMULADOR DE MENSAJES Y PRUEBAS
// ==============================

app.post("/chat/simulate", async (req, res) => {
    const { autor = "Espectador", contenido = "", mensajes = null } = req.body;

    if (Array.isArray(mensajes) && mensajes.length > 0) {
        const resultados = [];
        for (const m of mensajes) {
            const msg = new MensajeChat(
                m.autor || "ChatUser",
                m.contenido || "",
                Date.now()
            );
            const r = await procesarMensajeIndividual(msg);
            resultados.push(r);
        }
        return res.json({ ok: true, procesados: resultados.length, resultados });
    }

    if (!contenido.trim()) {
        return res.status(400).json({ error: "El contenido del mensaje está vacío." });
    }

    const msg = new MensajeChat(autor, contenido, Date.now());
    const resultado = await procesarMensajeIndividual(msg);

    res.json({
        ok: true,
        resultado
    });
});

// ==============================
// AJUSTE DE PARÁMETROS (SECCIÓN 6.9)
// ==============================

app.post("/config/parameters", (req, res) => {
    const estadisticas = analizador.actualizarParametros(req.body);
    emitirEstadoCompleto();
    res.json({
        ok: true,
        estadisticas
    });
});

// ==============================
// PROCESO PARALELO 1: POLLING DE YOUTUBE CHAT
// ==============================

async function procesarChat() {
    if (!sistemaActivo) {
        return;
    }

    const mensajes = await youtubeService.obtenerMensajes();

    if (!mensajes.length) {
        return;
    }

    for (const mensaje of mensajes) {
        await procesarMensajeIndividual(mensaje);
    }
}

setInterval(procesarChat, config.youtube.pollIntervalMs);

// ==============================
// PROCESO PARALELO 2: VENTANA TEMPORAL Y AUSENCIA DE MENSAJES (SECCIÓN 6.9, 6.10, 6.11)
// ==============================

async function evaluarActividadYDecaimiento() {
    const estadoCiclo = analizador.evaluarCicloActividad();

    const nuevoComando = controlador.generarComando(
        estadoCiclo.patron,
        estadoCiclo.velocidad,
        estadoCiclo.color,
        estadoCiclo.velocidadMatematica
    );

    if (comandoCambioSignificativamente(ultimoComando, nuevoComando)) {
        await aplicarYEmitirComando(nuevoComando);
    }

    emitirEstadoCompleto();
}

setInterval(evaluarActividadYDecaimiento, 1000);

// ==============================
// SOCKET.IO
// ==============================

io.on("connection", (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    socket.emit("estadoSistema", {
        sistemaActivo,
        youtube: youtubeService.estaConectado(),
        oauthAutenticado: youtubeService.oauthAutenticado,
        oauthRedirectUri: youtubeService.redirectUri,
        esp8266: espService.estaConectado(),
        esp8266Ip: espService.ip,
        totalMensajes,
        ultimoComando,
        lampara: lampara.obtenerEstado()
    });

    socket.emit("estadisticas", analizador.obtenerEstadisticas());

    socket.on("simularMensaje", async (data) => {
        if (data && data.contenido) {
            const msg = new MensajeChat(
                data.autor || "UsuarioSimulado",
                data.contenido,
                Date.now()
            );
            await procesarMensajeIndividual(msg);
        }
    });

    socket.on("disconnect", () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

// ==============================
// SERVIDOR
// ==============================

server.listen(PORT, () => {
    console.log("");
    console.log("================================================");
    console.log("   PROYECTO B: LÁMPARA DINÁMICA POR CHAT RGB");
    console.log("================================================");
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    console.log(`Ventana temporal de actividad: ${ACTIVITY_INTERVAL} ms`);
    console.log("");
});

// Escuchar también en el puerto 3000 para recibir el callback OAuth (http://localhost:3000/oauth2callback)
if (Number(PORT) !== 3000) {
    const oauthServer = http.createServer(app);
    oauthServer.on("error", (err) => {
        console.warn("Aviso puerto 3000:", err.message);
    });
    oauthServer.listen(3000, () => {
        console.log("Receptor OAuth 2.0 activo en http://localhost:3000/oauth2callback");
    });
}
