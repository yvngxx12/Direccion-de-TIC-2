# Proyecto B: Lámpara Dinámica de Interacción por Chat (YouTube Live RGB)

Sistema de iluminación física **LED RGB (NodeMCU ESP8266)** y **Simulador Web Interactivo** que altera su color, patrón dinámico y velocidad de ciclo en tiempo real en función del flujo de mensajes, palabras clave y nivel de interacción en el chat en vivo de **YouTube**.

---

## 🧠 Arquitectura y Funcionamiento

El sistema obtiene los mensajes del chat en vivo mediante la **API de YouTube Data v3** (o desde el simulador integrado) y divide su procesamiento en **dos procesos paralelos e independientes**:

1. **Proceso Paralelo 1 — Análisis de Contenido (Patrón Visual):**
   Evalúa las palabras clave y emojis de los mensajes ([`patterns.json`](./backend/src/config/patterns.json)) para determinar el tipo de conversación:
   - **`calmo`**: Conversación tranquila, saludos, inicio/fin de transmisión o baja interacción. Produce una animación visual suave (*respiración*).
   - **`neutral`**: Conversación normal o comportamiento predeterminado cuando no predominan elementos calmados ni intensos. Produce un ciclo equilibrado.
   - **`agresivo`**: Conversación de alta intensidad o *hype*. Produce cambios rápidos y destellos marcados.
   - *Detección opcional de color:* Reconoce menciones explícitas a colores (`rojo`, `verde`, `azul`, `amarillo`, `violeta`, `cian`, `blanco`) y emojis cromáticos (`🔴`, `🟢`, `🔵`, `🟡`, `🟣`, `⚪`).

2. **Proceso Paralelo 2 — Nivel de Actividad (Velocidad de Ciclo):**
   Cuenta la cantidad de mensajes recibidos dentro de una **ventana temporal deslizante** (por defecto `10 segundos`):
   - **Niveles discretos (ventana de 10 s):**
     - `0–2 mensajes` → Actividad **Baja** (`low`)
     - `3–7 mensajes` → Actividad **Media** (`medium`)
     - `8 o más mensajes` → Actividad **Alta** (`high`)
   - **Relación matemática continua:**
     $$\text{Velocidad} = \min(\text{Mensajes} \times K,\; \text{VelocidadMáxima})$$
   - **Comportamiento ante ausencia de mensajes:** Cuando no se reciben mensajes durante el período de inactividad configurado (por defecto `15 s`), el sistema reduce progresivamente la velocidad y lleva automáticamente la lámpara hacia el patrón **`calmo`**.

---

## 📁 Estructura del Repositorio

```text
Direccion-de-TIC-2/
├── backend/                  # Servidor Node.js + Express + Socket.IO + YouTube API
│   ├── src/
│   │   ├── analyzers/        # AnalizadorMensajes, ClasificadorPatron y ContadorActividad
│   │   ├── config/           # Configuración general (config.js) y palabras clave (patterns.json)
│   │   ├── controllers/      # ControladorIluminacion (generación de comandos RGB)
│   │   ├── models/           # Modelos LamparaRGB y MensajeChat
│   │   ├── services/         # YouTubeChatService (OAuth 2.0 / API Key) y ESP32Service
│   │   └── server.js         # Punto de entrada del backend y procesos paralelos
│   ├── .env.example          # Plantilla de variables de entorno
│   └── package.json
├── frontend/                 # Panel de control y Simulador Web RGB en React
│   ├── src/
│   │   ├── App.jsx           # Interfaz principal, simulador visual y controles
│   │   ├── main.jsx          # Punto de entrada React
│   │   └── style.css         # Estilos y animaciones CSS de los patrones RGB
│   ├── dev-server.js         # Servidor de desarrollo ligero (puerto 5173)
│   └── package.json
└── esp8266/                  # Firmware para el microcontrolador NodeMCU ESP8266
    └── lamp_controller/
        └── lamp_controller.ino
```

---

## ⚙️ Requisitos Previos

- **Node.js** `v18+` y **npm** instalados.
- *(Opcional para pruebas en vivo)* Credenciales de **Google Cloud Console** con **YouTube Data API v3** habilitada (soporta **OAuth 2.0** o **API Key**).
- *(Opcional para hardware físico)* Placa **NodeMCU ESP8266** + LED/Tira RGB y **Arduino IDE**.

---

## 🚀 Instalación y Ejecución Paso a Paso

### 1. Configurar y ejecutar el Backend

1. Abre una terminal y entra a la carpeta `backend`:
   ```bash
   cd backend
   npm install
   ```
2. Crea un archivo `.env` dentro de `backend/` copiando la plantilla `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Completa tus variables en `backend/.env`:
   ```env
   PORT=4000

   # Opción A: Autenticación con OAuth 2.0 (Google Cloud)
   GOOGLE_CLIENT_ID=TU_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-TU_CLIENT_SECRET
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

   # Opción B: O bien usando una API Key directa (AIzaSy...)
   YOUTUBE_API_KEY=

   # IP de la placa NodeMCU ESP8266 en tu red local
   ESP8266_IP=192.168.1.100

   # Parámetros de diseño (Sección 6.9 y 6.11)
   ACTIVITY_INTERVAL=10000
   INACTIVITY_DECAY_MS=15000
   SPEED_FACTOR_K=10
   MAX_SPEED=100
   MIN_SPEED=10
   ```
4. Inicia el servidor backend:
   ```bash
   npm start
   ```
   - El servidor principal quedará corriendo en `http://localhost:4000`.
   - El receptor de callback OAuth 2.0 quedará escuchando automáticamente en `http://localhost:3000/oauth2callback`.

---

### 2. Configurar y ejecutar el Frontend (Panel y Simulador)

1. Abre **otra terminal** y entra a la carpeta `frontend`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Abre en tu navegador:
   ```text
   http://localhost:5173
   ```

---

## 🧪 Cómo Usar y Probar el Sistema

### A. Prueba sin Hardware ni YouTube (Modo Simulador)
Desde `http://localhost:5173` puedes probar toda la lógica directamente:
- **Botones de Escenarios Rápidos:**
  - **🌊 Simular Chat Calmo (2 msgs):** Activa el patrón `calmo` con velocidad `baja`.
  - **💬 Simular Chat Neutral (4 msgs - Media):** Activa el patrón `neutral` con velocidad `media`.
  - **🔥 Simular Ráfaga Agresiva (9 msgs - Alta):** Dispara 9 mensajes intensos en la ventana de 10 s, llevando el patrón a `agresivo` y la velocidad a `alta`.
- **Envío de mensajes individuales:** Escribe cualquier mensaje o color en la caja de texto para ver qué palabras clave detecta el clasificador.
- **Prueba de ausencia de mensajes:** Deja de enviar mensajes durante 15 segundos y observa cómo la barra de velocidad disminuye progresivamente y el patrón vuelve a **`calmo`**.
- **Ajuste experimental en vivo:** Modifica el **Factor $K$**, la **Velocidad Máxima** o el **Tiempo de inactividad** en el panel derecho.

### B. Conexión con un Directo de YouTube en Vivo
1. En el panel derecho (**"Conexión YouTube (OAuth 2.0) y ESP8266"**), haz clic en **🔑 Iniciar sesión con Google (OAuth 2.0)** y autoriza con tu cuenta.
2. En **Paso 2: Conectar Transmisión en Vivo**, selecciona **"URL / Video ID en vivo"** y pega el enlace de cualquier transmisión de YouTube que esté **EN VIVO** y tenga el chat habilitado.
3. Haz clic en **Conectar Directo**. El sistema extraerá automáticamente el `liveChatId` y procesará los mensajes reales cada 3 segundos.

### C. Conexión con la Placa Física (NodeMCU ESP8266)
1. Abre [`esp8266/lamp_controller/lamp_controller.ino`](./esp8266/lamp_controller/lamp_controller.ino) en **Arduino IDE**.
2. Configura el nombre y contraseña de tu red WiFi (`WIFI_SSID` y `WIFI_PASSWORD`).
3. Conecta los canales del LED RGB a los pines PWM de la NodeMCU:
   - **Rojo (`PIN_R`):** `D1` (`GPIO5`)
   - **Verde (`PIN_G`):** `D2` (`GPIO4`)
   - **Azul (`PIN_B`):** `D3` (`GPIO0`)
4. Sube el programa a la placa y abre el **Monitor Serie (`115200 baud`)** para ver la dirección IP asignada a la ESP8266.
5. Ingresa esa IP en el panel web (`http://localhost:5173`) y presiona **Conectar ESP**.

---

## 🔌 Endpoints Principales de la API (Backend)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/status` | Devuelve el estado general del sistema, lámpara, conexiones y estadísticas de actividad. |
| `GET` | `/auth/google` | Inicia el flujo de autenticación OAuth 2.0 con Google. |
| `POST` | `/youtube/connect` | Conecta un chat en vivo mediante `{ videoId }` (URL o ID) o `{ liveChatId }`. |
| `POST` | `/youtube/disconnect` | Detiene la lectura del chat de YouTube. |
| `POST` | `/esp8266/connect` | Verifica conexión con la placa física en `{ ip }` y sincroniza el estado actual. |
| `POST` | `/chat/simulate` | Simula un mensaje individual (`{ autor, contenido }`) o una ráfaga (`{ mensajes: [...] }`). |
| `POST` | `/config/parameters` | Actualiza en caliente `factorK`, `velocidadMaxima`, `lowMax`, `mediumMax` o `inactivityTimeoutMs`. |
