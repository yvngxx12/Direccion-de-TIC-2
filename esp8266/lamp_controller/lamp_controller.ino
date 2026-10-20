#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <math.h>

// ==============================
// CONFIGURACIÓN WIFI
// ==============================

const char* WIFI_SSID = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD";

// ==============================
// PINES LED RGB (PWM NodeMCU ESP8266)
// ==============================

const int PIN_R = D1; // GPIO5
const int PIN_G = D2; // GPIO4
const int PIN_B = D3; // GPIO0

// ==============================
// ESTADO DE LA LÁMPARA
// ==============================

String patronActual = "calmo";   // "calmo" | "neutral" | "agresivo"
String velocidadNivel = "low";   // "low" | "medium" | "high"
int velocidadMatematica = 10;    // 10..100 (Velocidad = min(Mensajes * K, VelocidadMaxima))
String colorActual = "cyan";

int baseR = 0, baseG = 220, baseB = 255;
unsigned long ultimoTick = 0;
float faseAnimacion = 0.0;
bool estadoPulsoAgresivo = false;

// ==============================
// SERVIDOR HTTP
// ==============================

ESP8266WebServer server(80);

String obtenerIP() {
    return WiFi.localIP().toString();
}

// ==============================
// UTILIDADES DE PARSEO JSON LIGERO
// ==============================

String extraerValorString(String json, String clave) {
    String busqueda = "\"" + clave + "\":\"";
    int inicio = json.indexOf(busqueda);
    if (inicio == -1) return "";
    inicio += busqueda.length();
    int fin = json.indexOf("\"", inicio);
    if (fin == -1) return "";
    return json.substring(inicio, fin);
}

int extraerValorInt(String json, String clave, int valorPorDefecto) {
    String busqueda = "\"" + clave + "\":";
    int inicio = json.indexOf(busqueda);
    if (inicio == -1) return valorPorDefecto;
    inicio += busqueda.length();
    int fin = inicio;
    while (fin < (int)json.length() && (isDigit(json[fin]) || json[fin] == '-')) {
        fin++;
    }
    if (fin == inicio) return valorPorDefecto;
    return json.substring(inicio, fin).toInt();
}

void actualizarColorBase(String nombreColor) {
    if (nombreColor == "red") {
        baseR = 255; baseG = 25;  baseB = 45;
    } else if (nombreColor == "green") {
        baseR = 20;  baseG = 255; baseB = 90;
    } else if (nombreColor == "blue") {
        baseR = 30;  baseG = 110; baseB = 255;
    } else if (nombreColor == "yellow") {
        baseR = 255; baseG = 215; baseB = 20;
    } else if (nombreColor == "purple") {
        baseR = 175; baseG = 50;  baseB = 255;
    } else if (nombreColor == "cyan") {
        baseR = 0;   baseG = 225; baseB = 255;
    } else if (nombreColor == "white") {
        baseR = 255; baseG = 255; baseB = 255;
    }
}

void escribirRGB(int r, int g, int b) {
    analogWrite(PIN_R, constrain(r, 0, 255));
    analogWrite(PIN_G, constrain(g, 0, 255));
    analogWrite(PIN_B, constrain(b, 0, 255));
}

// ==============================
// ANIMACIONES SEGÚN PATRÓN Y VELOCIDAD
// ==============================

void actualizarAnimacion() {
    unsigned long ahora = millis();
    if (ahora - ultimoTick < 20) return; // 50 FPS
    ultimoTick = ahora;

    // Factor de velocidad derivado tanto del nivel discreto como de Velocidad = min(M*K, Vmax)
    float multiplicadorVelocidad = map(constrain(velocidadMatematica, 10, 100), 10, 100, 10, 80) / 100.0;

    if (patronActual == "calmo") {
        // Patrón Calmo: Respiración suave y progresiva
        faseAnimacion += 0.03 * multiplicadorVelocidad;
        if (faseAnimacion > TWO_PI) faseAnimacion -= TWO_PI;

        float brillo = 0.25 + 0.75 * (0.5 * (1.0 + sin(faseAnimacion)));
        escribirRGB((int)(baseR * brillo), (int)(baseG * brillo), (int)(baseB * brillo));

    } else if (patronActual == "neutral") {
        // Patrón Neutral: Pulso equilibrado con suave rotación cromática
        faseAnimacion += 0.07 * multiplicadorVelocidad;
        if (faseAnimacion > TWO_PI) faseAnimacion -= TWO_PI;

        float onda = 0.55 + 0.45 * sin(faseAnimacion);
        float mezcla = 0.20 * cos(faseAnimacion * 0.5);
        int r = constrain((int)(baseR * onda + 40 * mezcla), 0, 255);
        int g = constrain((int)(baseG * onda + 25 * (1.0 - mezcla)), 0, 255);
        int b = constrain((int)(baseB * onda), 0, 255);
        escribirRGB(r, g, b);

    } else if (patronActual == "agresivo") {
        // Patrón Agresivo: Cambios rápidos, intensos y marcados
        faseAnimacion += 0.25 * multiplicadorVelocidad;
        if (faseAnimacion >= 1.0) {
            faseAnimacion = 0.0;
            estadoPulsoAgresivo = !estadoPulsoAgresivo;
        }

        if (estadoPulsoAgresivo) {
            escribirRGB(baseR, baseG, baseB);
        } else {
            // Destello secundario contrastante en alta intensidad
            escribirRGB(baseR / 6, baseG / 8, min(255, baseB / 3 + 40));
        }
    }
}

// ==============================
// GET /status
// ==============================

void manejarStatus() {
    String respuesta = "{";
    respuesta += "\"status\":\"online\",";
    respuesta += "\"device\":\"NodeMCU ESP8266\",";
    respuesta += "\"ip\":\"" + obtenerIP() + "\",";
    respuesta += "\"pattern\":\"" + patronActual + "\",";
    respuesta += "\"speed\":\"" + velocidadNivel + "\",";
    respuesta += "\"speedValue\":" + String(velocidadMatematica) + ",";
    respuesta += "\"color\":\"" + colorActual + "\"";
    respuesta += "}";

    server.send(200, "application/json", respuesta);
}

// ==============================
// POST /command
// ==============================

void manejarComando() {
    if (!server.hasArg("plain")) {
        server.send(
            400,
            "application/json",
            "{\"error\":\"No se recibió ningún comando\"}"
        );
        return;
    }

    String cuerpo = server.arg("plain");
    Serial.println("Comando recibido:");
    Serial.println(cuerpo);

    String nuevoPatron = extraerValorString(cuerpo, "pattern");
    String nuevaVelocidad = extraerValorString(cuerpo, "speed");
    String nuevoColor = extraerValorString(cuerpo, "color");
    int nuevoSpeedVal = extraerValorInt(cuerpo, "speedValue", velocidadMatematica);

    if (nuevoPatron.length() > 0) patronActual = nuevoPatron;
    if (nuevaVelocidad.length() > 0) velocidadNivel = nuevaVelocidad;
    if (nuevoColor.length() > 0) {
        colorActual = nuevoColor;
        actualizarColorBase(colorActual);
    }
    velocidadMatematica = nuevoSpeedVal;

    server.send(
        200,
        "application/json",
        "{\"ok\":true,\"message\":\"Comando aplicado en lampara RGB\"}"
    );
}

// ==============================
// SETUP
// ==============================

void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(PIN_R, OUTPUT);
    pinMode(PIN_G, OUTPUT);
    pinMode(PIN_B, OUTPUT);
    analogWriteRange(255);

    actualizarColorBase(colorActual);

    Serial.println();
    Serial.println("===========================================");
    Serial.println("   PROYECTO B: NODEMCU ESP8266 RGB LAMP");
    Serial.println("===========================================");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Conectando al WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi conectado.");
    Serial.print("IP de la ESP8266: ");
    Serial.println(WiFi.localIP());

    server.on("/status", HTTP_GET, manejarStatus);
    server.on("/command", HTTP_POST, manejarComando);
    server.begin();

    Serial.println("Servidor HTTP iniciado.");
}

// ==============================
// LOOP
// ==============================

void loop() {
    server.handleClient();
    actualizarAnimacion();
}
