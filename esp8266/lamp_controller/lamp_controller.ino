#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// ==============================
// CONFIGURACIÓN WIFI
// ==============================

const char* WIFI_SSID = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD";

// ==============================
// SERVIDOR
// ==============================

ESP8266WebServer server(80);


// ==============================
// INFORMACIÓN DEL DISPOSITIVO
// ==============================

String obtenerIP() {
    return WiFi.localIP().toString();
}


// ==============================
// GET /status
// ==============================

void manejarStatus() {

    String respuesta = "{";

    respuesta += "\"status\":\"online\",";
    respuesta += "\"device\":\"NodeMCU ESP8266\",";
    respuesta += "\"ip\":\"";
    respuesta += obtenerIP();
    respuesta += "\"";

    respuesta += "}";

    server.send(
        200,
        "application/json",
        respuesta
    );
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

    String cuerpo =
        server.arg("plain");

    Serial.println(
        "Comando recibido:"
    );

    Serial.println(cuerpo);

    server.send(
        200,
        "application/json",
        "{\"ok\":true,\"message\":\"Comando recibido\"}"
    );
}


// ==============================
// SETUP
// ==============================

void setup() {

    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println(
        "================================"
    );
    Serial.println(
        "   NODEMCU ESP8266 RGB LAMP"
    );
    Serial.println(
        "================================"
    );

    // Conectar WiFi

    WiFi.mode(WIFI_STA);

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );

    Serial.print(
        "Conectando al WiFi"
    );

    while (
        WiFi.status() != WL_CONNECTED
    ) {

        delay(500);

        Serial.print(".");
    }

    Serial.println();
    Serial.println(
        "WiFi conectado."
    );

    Serial.print(
        "IP de la ESP8266: "
    );

    Serial.println(
        WiFi.localIP()
    );


    // Rutas HTTP

    server.on(
        "/status",
        HTTP_GET,
        manejarStatus
    );

    server.on(
        "/command",
        HTTP_POST,
        manejarComando
    );


    server.begin();

    Serial.println(
        "Servidor HTTP iniciado."
    );
}


// ==============================
// LOOP
// ==============================

void loop() {

    server.handleClient();

}