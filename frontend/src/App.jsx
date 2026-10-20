import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = "http://localhost:4000";
const socket = io(BACKEND_URL, { autoConnect: true });

const COLOR_MAP = {
  cyan: { hex: "#00e5ff", label: "Cian (Calmo)" },
  purple: { hex: "#a855f7", label: "Violeta (Neutral)" },
  red: { hex: "#ff2a4b", label: "Rojo (Agresivo)" },
  green: { hex: "#22c55e", label: "Verde" },
  blue: { hex: "#3b82f6", label: "Azul" },
  yellow: { hex: "#eab308", label: "Amarillo" },
  white: { hex: "#f8fafc", label: "Blanco" }
};

const PATTERN_INFO = {
  calmo: {
    titulo: "Patrón Calmo",
    subtitulo: "Animación suave (Respiración)",
    descripcion:
      "Conversación tranquila, inicio/fin de transmisión o baja interacción."
  },
  neutral: {
    titulo: "Patrón Neutral",
    subtitulo: "Ciclo equilibrado (Predeterminado)",
    descripcion:
      "Conversación normal cuando no predominan elementos calmados ni intensos."
  },
  agresivo: {
    titulo: "Patrón Agresivo",
    subtitulo: "Destellos rápidos y marcados",
    descripcion:
      "Conversación de alta intensidad activada por palabras clave o emojis intensos."
  }
};

export default function App() {
  const [conectadoBackend, setConectadoBackend] = useState(false);
  const [estadoSistema, setEstadoSistema] = useState({
    sistemaActivo: false,
    youtube: false,
    oauthAutenticado: false,
    oauthRedirectUri: "http://localhost:4000/auth/google/callback",
    esp8266: false,
    esp8266Ip: "192.168.1.100",
    totalMensajes: 0,
    ultimoComando: {
      pattern: "calmo",
      speed: "low",
      speedValue: 10,
      color: "cyan"
    }
  });

  const [estadisticas, setEstadisticas] = useState({
    mensajes: 0,
    mensajesPorSegundo: 0,
    nivel: "low",
    nivelEspanol: "baja",
    velocidadMatematica: 10,
    formulaTexto: "min(0 × 10, 100) = 0",
    tiempoSinMensajesSegundos: 0,
    enInactividad: false,
    parametros: {
      intervalo: 10000,
      lowMax: 2,
      mediumMax: 7,
      factorK: 10,
      velocidadMaxima: 100,
      inactivityTimeoutMs: 15000
    }
  });

  const [mensajesRecientes, setMensajesRecientes] = useState([]);

  // Formularios de conexión
  const [apiKey, setApiKey] = useState("");
  const [videoOrChatId, setVideoOrChatId] = useState("");
  const [modoIdYoutube, setModoIdYoutube] = useState("videoId");
  const [espIp, setEspIp] = useState("192.168.1.100");
  const [estadoAlerta, setEstadoAlerta] = useState("");

  // Simulador de chat
  const [autorSimulado, setAutorSimulado] = useState("Espectador_YT");
  const [textoSimulado, setTextoSimulado] = useState("");

  // Parámetros experimentales (Sección 6.9)
  const [factorKInput, setFactorKInput] = useState(10);
  const [velMaxInput, setVelMaxInput] = useState(100);
  const [inactividadSegInput, setInactividadSegInput] = useState(15);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "ok") {
      setEstadoAlerta("✅ Sesión OAuth 2.0 de Google iniciada correctamente. Ahora pega el link del directo en vivo.");
      window.history.replaceState({}, "", "/");
    }

    fetch(`${BACKEND_URL}/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.estadisticas) {
          setEstadisticas(data.estadisticas);
          if (data.estadisticas.parametros) {
            setFactorKInput(data.estadisticas.parametros.factorK);
            setVelMaxInput(data.estadisticas.parametros.velocidadMaxima);
            setInactividadSegInput(
              Math.round(data.estadisticas.parametros.inactivityTimeoutMs / 1000)
            );
          }
        }
        if (data.youtube) {
          setEstadoSistema((prev) => ({
            ...prev,
            youtube: data.youtube.conectado,
            oauthAutenticado: data.youtube.oauthAutenticado,
            oauthRedirectUri: data.youtube.oauthRedirectUri
          }));
        }
        if (data.esp8266?.ip) setEspIp(data.esp8266.ip);
      })
      .catch(() => {});

    socket.on("connect", () => setConectadoBackend(true));
    socket.on("disconnect", () => setConectadoBackend(false));

    socket.on("estadoSistema", (data) => {
      setEstadoSistema((prev) => ({ ...prev, ...data }));
    });

    socket.on("estadisticas", (data) => {
      setEstadisticas((prev) => ({ ...prev, ...data }));
    });

    socket.on("mensajeAnalizado", (item) => {
      setMensajesRecientes((prev) => [item, ...prev.slice(0, 29)]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("estadoSistema");
      socket.off("estadisticas");
      socket.off("mensajeAnalizado");
    };
  }, []);

  const comando = estadoSistema.ultimoComando || {
    pattern: "calmo",
    speed: "low",
    speedValue: 10,
    color: "cyan"
  };

  const colorInfo = COLOR_MAP[comando.color] || COLOR_MAP.cyan;
  const infoPatron = PATTERN_INFO[comando.pattern] || PATTERN_INFO.neutral;

  const speedVal = Math.max(10, Math.min(100, comando.speedValue || 10));
  const duracionSegundos = Math.max(0.22, (3.8 - (speedVal / 100) * 3.4)).toFixed(2);

  function iniciarOAuthGoogle() {
    window.location.href = `${BACKEND_URL}/auth/google`;
  }

  async function cerrarOAuthGoogle() {
    await fetch(`${BACKEND_URL}/auth/google/logout`, { method: "POST" });
    setEstadoAlerta("Sesión OAuth 2.0 cerrada.");
  }

  async function conectarYouTube(e) {
    e.preventDefault();
    setEstadoAlerta("Conectando con YouTube API...");
    try {
      const payload = {
        apiKey,
        ...(modoIdYoutube === "videoId"
          ? { videoId: videoOrChatId }
          : { liveChatId: videoOrChatId })
      };
      const res = await fetch(`${BACKEND_URL}/youtube/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setEstadoAlerta(`Error YouTube: ${data.error || "No se pudo conectar"}`);
      } else {
        setEstadoAlerta(`✅ YouTube conectado en vivo (Chat ID: ${data.liveChatId})`);
      }
    } catch (err) {
      setEstadoAlerta(`Error de red: ${err.message}`);
    }
  }

  async function desconectarYouTube() {
    await fetch(`${BACKEND_URL}/youtube/disconnect`, { method: "POST" });
    setEstadoAlerta("YouTube desconectado.");
  }

  async function conectarESP(e) {
    e.preventDefault();
    setEstadoAlerta(`Conectando con ESP8266 en ${espIp}...`);
    try {
      const res = await fetch(`${BACKEND_URL}/esp8266/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: espIp })
      });
      const data = await res.json();
      setEstadoAlerta(data.message || "Respuesta recibida de ESP8266");
    } catch (err) {
      setEstadoAlerta(`Error conectando ESP8266: ${err.message}`);
    }
  }

  async function enviarMensajeSimulado(e) {
    e.preventDefault();
    if (!textoSimulado.trim()) return;
    await fetch(`${BACKEND_URL}/chat/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autor: autorSimulado || "Espectador",
        contenido: textoSimulado
      })
    });
    setTextoSimulado("");
  }

  async function dispararEscenario(tipo) {
    let lote = [];
    if (tipo === "calmo") {
      lote = [
        { autor: "Sofi_YT", contenido: "Hola buenas noches a todos, qué paz este stream 🌊✨" },
        { autor: "Lucas", contenido: "Saludos, todo muy tranquilo y relax 😌" }
      ];
    } else if (tipo === "neutral") {
      lote = [
        { autor: "Martín", contenido: "Claro, entiendo cómo funciona el sistema 👍" },
        { autor: "Carla", contenido: "Tengo una pregunta sobre la conexión normal" },
        { autor: "Diego", contenido: "Bien explicado, todo estable por ahora 💬" },
        { autor: "Elena", contenido: "Ok perfecto, sigamos viendo el proyecto" }
      ];
    } else if (tipo === "agresivo") {
      lote = [
        { autor: "NitroGamer", contenido: "VAMOS QUE EPICO ESTO 🔥🔥🔥" },
        { autor: "Valen", contenido: "LOCURA TOTAL EXPLOTO TODO ⚡💥" },
        { autor: "Fede", contenido: "SIII GOLAZO INCREIBLE HYPE 🚀🔥" },
        { autor: "Mica", contenido: "OMG QUE INTENSO ALERTA ROJA 🚨🔥" },
        { autor: "Tomi", contenido: "GG VAMOSSS 🔥⚡" },
        { autor: "Juani", contenido: "EPICO INCREIBLE BOMBA 💥🔥" },
        { autor: "Santi", contenido: "LOCURA RAPIDO 🔥🔥🔥" },
        { autor: "Agus", contenido: "VAMOS HYPE MAXIMO ⚡🚀" },
        { autor: "Leo", contenido: "FUEGO EN EL CHAT 🔥🚨" }
      ];
    }

    await fetch(`${BACKEND_URL}/chat/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes: lote })
    });
  }

  async function guardarParametros(e) {
    e.preventDefault();
    const res = await fetch(`${BACKEND_URL}/config/parameters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factorK: Number(factorKInput),
        velocidadMaxima: Number(velMaxInput),
        inactivityTimeoutMs: Number(inactividadSegInput) * 1000
      })
    });
    if (res.ok) {
      setEstadoAlerta("Parámetros de diseño (Sección 6.9 y 6.11) actualizados.");
    }
  }

  return (
    <div className="app-container">
      {/* CABECERA */}
      <header className="header">
        <div>
          <span className="badge-project">PROYECTO B</span>
          <h1>Lámpara Dinámica de Interacción por Chat</h1>
          <p className="subtitle">
            Control físico y simulación RGB mediante análisis paralelo de patrón y actividad en YouTube Live
          </p>
        </div>
        <div className="status-pills">
          <span className={`pill ${conectadoBackend ? "online" : "offline"}`}>
            Backend: {conectadoBackend ? "Conectado" : "Desconectado"}
          </span>
          <span className={`pill ${estadoSistema.oauthAutenticado ? "online" : "offline"}`}>
            OAuth 2.0: {estadoSistema.oauthAutenticado ? "Autenticado" : "Pendiente"}
          </span>
          <span className={`pill ${estadoSistema.youtube ? "online" : "neutral"}`}>
            YouTube Chat: {estadoSistema.youtube ? "En Vivo" : "Modo Simulador"}
          </span>
          <span className={`pill ${estadoSistema.esp8266 ? "online" : "offline"}`}>
            ESP8266: {estadoSistema.esp8266 ? `Online (${espIp})` : "Sin Hardware"}
          </span>
        </div>
      </header>

      {estadoAlerta && (
        <div className="alert-banner">
          <span>{estadoAlerta}</span>
          <button onClick={() => setEstadoAlerta("")}>✕</button>
        </div>
      )}

      {/* FILA PRINCIPAL: LÁMPARA + 2 PROCESOS PARALELOS */}
      <section className="main-grid">
        {/* SIMULADOR DE LÁMPARA FÍSICA */}
        <div className="card lamp-card">
          <div className="card-header">
            <h2>Simulador de Lámpara RGB</h2>
            <span className={`pattern-tag tag-${comando.pattern}`}>
              {comando.pattern.toUpperCase()}
            </span>
          </div>

          <div className="lamp-stage">
            <div
              className={`lamp-orb pattern-${comando.pattern}`}
              style={{
                "--lamp-color": colorInfo.hex,
                "--cycle-duration": `${duracionSegundos}s`
              }}
            >
              <div className="lamp-core" />
            </div>
            <div className="lamp-base" />
          </div>

          <div className="lamp-Readout">
            <div className="readout-item">
              <span className="label">Patrón Visual</span>
              <strong>{infoPatron.titulo}</strong>
              <small>{infoPatron.subtitulo}</small>
            </div>
            <div className="readout-item">
              <span className="label">Velocidad de Ciclo</span>
              <strong>
                Nivel {(estadisticas.nivelEspanol || "baja").toUpperCase()} ({speedVal}%)
              </strong>
              <small>Ciclo cada {duracionSegundos}s</small>
            </div>
            <div className="readout-item">
              <span className="label">Color Activo</span>
              <strong style={{ color: colorInfo.hex }}>{colorInfo.label}</strong>
              <small>Comando JSON → ESP8266</small>
            </div>
          </div>
        </div>

        {/* LOS DOS PROCESOS PARALELOS (ESPECIFICACIÓN) */}
        <div className="parallel-processes">
          {/* PROCESO 1: TIPO DE CONVERSACIÓN (PATRÓN) */}
          <div className="card process-card">
            <div className="card-header">
              <div>
                <span className="process-badge">PROCESO PARALELO 1</span>
                <h2>Análisis de Contenido → Patrón</h2>
              </div>
            </div>
            <p className="process-desc">{infoPatron.descripcion}</p>

            <div className="pattern-selector-display">
              {["calmo", "neutral", "agresivo"].map((p) => (
                <div
                  key={p}
                  className={`pattern-box ${comando.pattern === p ? `active-${p}` : ""}`}
                >
                  <div className="p-title">{p.toUpperCase()}</div>
                  <div className="p-sub">
                    {p === "calmo" && "Suave / Respiración"}
                    {p === "neutral" && "Normal / Predeterminado"}
                    {p === "agresivo" && "Intenso / Cambios marcados"}
                  </div>
                </div>
              ))}
            </div>

            {estadisticas.enInactividad && (
              <div className="inactivity-notice">
                🌙 <strong>Sección 6.11 Activa (Ausencia de mensajes):</strong> Sin mensajes por{" "}
                {estadisticas.tiempoSinMensajesSegundos}s. Velocidad reduciéndose progresivamente hacia patrón{" "}
                <strong>calmo</strong>.
              </div>
            )}
          </div>

          {/* PROCESO 2: NIVEL DE ACTIVIDAD (VELOCIDAD) */}
          <div className="card process-card">
            <div className="card-header">
              <div>
                <span className="process-badge">PROCESO PARALELO 2</span>
                <h2>Cálculo de Actividad → Velocidad (Sección 6.9)</h2>
              </div>
            </div>

            <div className="metrics-row">
              <div className="metric-box">
                <span className="metric-value">{estadisticas.mensajes}</span>
                <span className="metric-label">
                  Mensajes en ventana ({ (estadisticas.parametros?.intervalo || 10000) / 1000 }s)
                </span>
              </div>
              <div className="metric-box">
                <span className={`metric-value level-${estadisticas.nivel}`}>
                  {(estadisticas.nivelEspanol || "baja").toUpperCase()}
                </span>
                <span className="metric-label">
                  0–2 Baja | 3–7 Media | 8+ Alta
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-value">{estadisticas.velocidadMatematica}</span>
                <span className="metric-label">
                  Velocidad = min(M × K, Vmáx)
                </span>
              </div>
            </div>

            <div className="speed-bar-wrapper">
              <div className="speed-bar-labels">
                <span>Fórmula en vivo: <code>{estadisticas.formulaTexto}</code></span>
                <span>Tiempo sin mensajes: {estadisticas.tiempoSinMensajesSegundos}s</span>
              </div>
              <div className="speed-bar-track">
                <div
                  className={`speed-bar-fill level-bg-${estadisticas.nivel}`}
                  style={{
                    width: `${Math.min(
                      100,
                      (estadisticas.velocidadMatematica /
                        (estadisticas.parametros?.velocidadMaxima || 100)) *
                        100
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEGUNDA FILA: SIMULADOR DE CHAT + FLUJO DE MENSAJES + CONEXIONES */}
      <section className="bottom-grid">
        {/* SIMULADOR INTERACTIVO DE CHAT */}
        <div className="card">
          <h2>Simulador de Interacción del Chat</h2>
          <p className="helper-text">
            Prueba la separación entre <strong>Patrón</strong> (palabras clave) y <strong>Velocidad</strong> (cantidad de mensajes en 10s):
          </p>

          <div className="preset-buttons">
            <button
              type="button"
              className="btn-preset btn-calmo"
              onClick={() => dispararEscenario("calmo")}
            >
              🌊 Simular Chat Calmo (2 msgs)
            </button>
            <button
              type="button"
              className="btn-preset btn-neutral"
              onClick={() => dispararEscenario("neutral")}
            >
              💬 Simular Chat Neutral (4 msgs - Media)
            </button>
            <button
              type="button"
              className="btn-preset btn-agresivo"
              onClick={() => dispararEscenario("agresivo")}
            >
              🔥 Simular Ráfaga Agresiva (9 msgs - Alta)
            </button>
          </div>

          <form onSubmit={enviarMensajeSimulado} className="chat-form">
            <div className="form-row">
              <input
                type="text"
                placeholder="Autor"
                value={autorSimulado}
                onChange={(e) => setAutorSimulado(e.target.value)}
                className="input-small"
              />
              <input
                type="text"
                placeholder="Escribe un mensaje (ej: 'hola que paz 🌊', 'vamos increible 🔥', 'rojo', 'azul')..."
                value={textoSimulado}
                onChange={(e) => setTextoSimulado(e.target.value)}
                className="input-flex"
              />
              <button type="submit" className="btn-primary">
                Enviar
              </button>
            </div>
          </form>

          <div className="chat-log">
            <h3>Últimos Mensajes Procesados ({estadoSistema.totalMensajes} totales)</h3>
            {mensajesRecientes.length === 0 ? (
              <p className="empty-chat">
                No hay mensajes aún. Usa los botones de simulación arriba o conecta un stream de YouTube.
              </p>
            ) : (
              <ul>
                {mensajesRecientes.map((item, idx) => (
                  <li key={idx} className="chat-item">
                    <div className="chat-msg-main">
                      <strong>{item.mensaje?.autor}:</strong>{" "}
                      <span>{item.mensaje?.contenido}</span>
                    </div>
                    <div className="chat-msg-badges">
                      <span className={`mini-badge tag-${item.patron}`}>
                        Patrón: {item.patron}
                      </span>
                      <span className="mini-badge">
                        Actividad: {item.nivelEspanol} ({item.mensajesEnIntervalo} en 10s)
                      </span>
                      {item.coincidencias?.length > 0 && (
                        <span className="mini-badge badge-kw">
                          Clave: {item.coincidencias.join(", ")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* PANEL DE CONEXIÓN HARDWARE Y PARÁMETROS (6.9) */}
        <div className="side-panels">
          <div className="card">
            <h2>Conexión YouTube (OAuth 2.0) y ESP8266</h2>

            <div className="config-form">
              <label>Paso 1: Autenticación OAuth 2.0 de Google</label>
              {estadoSistema.oauthAutenticado ? (
                <div className="btn-row">
                  <span className="pill online" style={{ flex: 1, textAlign: "center" }}>
                    ✅ Cuenta Google Autenticada
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={cerrarOAuthGoogle}
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary full-width"
                  onClick={iniciarOAuthGoogle}
                >
                  🔑 Iniciar sesión con Google (OAuth 2.0)
                </button>
              )}
            </div>

            <form onSubmit={conectarYouTube} className="config-form">
              <label style={{ marginTop: "0.4rem" }}>
                Paso 2: Conectar Transmisión en Vivo
              </label>

              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    checked={modoIdYoutube === "videoId"}
                    onChange={() => setModoIdYoutube("videoId")}
                  />
                  URL / Video ID en vivo
                </label>
                <label>
                  <input
                    type="radio"
                    checked={modoIdYoutube === "liveChatId"}
                    onChange={() => setModoIdYoutube("liveChatId")}
                  />
                  LiveChat ID directo
                </label>
              </div>

              <input
                type="text"
                placeholder={
                  modoIdYoutube === "videoId"
                    ? "Ej: https://youtube.com/watch?v=jfKfPfyJRdk"
                    : "Ej: Cg0KC..."
                }
                value={videoOrChatId}
                onChange={(e) => setVideoOrChatId(e.target.value)}
              />

              <div className="btn-row">
                <button type="submit" className="btn-primary">
                  Conectar Directo
                </button>
                {estadoSistema.youtube && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={desconectarYouTube}
                  >
                    Desconectar
                  </button>
                )}
              </div>
            </form>

            <hr className="divider" />

            <form onSubmit={conectarESP} className="config-form">
              <label>Dirección IP del NodeMCU ESP8266</label>
              <div className="btn-row">
                <input
                  type="text"
                  value={espIp}
                  onChange={(e) => setEspIp(e.target.value)}
                  placeholder="192.168.1.100"
                />
                <button type="submit" className="btn-primary">
                  Conectar ESP
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Parámetros Experimentales (Sección 6.9)</h2>
            <form onSubmit={guardarParametros} className="config-form">
              <div className="param-grid">
                <div>
                  <label>Factor K</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={factorKInput}
                    onChange={(e) => setFactorKInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Velocidad Máxima</label>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={velMaxInput}
                    onChange={(e) => setVelMaxInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Inactividad a Calmo (seg)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={inactividadSegInput}
                    onChange={(e) => setInactividadSegInput(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn-secondary full-width">
                Aplicar Parámetros
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
