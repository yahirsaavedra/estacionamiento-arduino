import express from "express";
import path from "path";
import { WebSocketServer } from "ws";
import chokidar from "chokidar";

import { fileURLToPath } from "url";
import { BluetoothSerialPort } from 'bluetooth-serial-port';
import * as fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.title = "Proyecto de Lenguajes de Interfaz"

const app = express();
const host = "127.0.0.1";
const puerto = "4444";
const puertoSocket = "4445";
const direccionMacHC06 = ''; // Direccion MAC del HC-06

const btSerial = new BluetoothSerialPort();
const wss = new WebSocketServer({ port: puertoSocket });
const watcher = chokidar.watch(__dirname + "/static/temp", {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 300
    }
});

/*
SEÑALES PARA ENVIAR Y RECIBIR AL HC-06
A = Deteccion de objeto en modulo peatonal y encender LED
B = Deteccion de objeto en modulo vehicular 1 y encender LED
C = Deteccion de objeto en modulo vehicular 2 y encender LED
D = Abrir barrera del modulo peatonal
E = Abrir barrera del modulo vehicular 1
F = Abrir barrera del modulo vehicular 2
G = Cerrar barrera del modulo peatonal y apagar LED
H = Cerrar barrera del modulo vehicular 1 y apagar LED
I = Cerrar bandera del modulo vehicular 2 y apagar LED
J = Pitido de error
K = Interfaz de emergencia
*/

watcher.on('add', path => {
    console.log('Nuevo archivo: ' + path);
    wss.clients.forEach(client => {
      client.send(`${path}`);
      console.log("Contenido enviado al websocket: " + path);
    });
});

watcher.on('unlink', path => {
    console.log('Archivo eliminado: ' + path);
    wss.clients.forEach(client => {
      client.send(`${path} DELETE`);
      console.log("Contenido enviado al websocket: " + path + " DELETE");
    });
});

btSerial.findSerialPortChannel(direccionMacHC06, (canal) => {
    btSerial.connect(direccionMacHC06, canal, async () => {
        console.log('Conectado al dispositivo HC-06');

        await server();
    }, () => {
        throw new Error('No se pudo conectar al dispositivo HC-06.');
    });
}, () => {
    throw new Error('No se pudo encontrar el canal del puerto serial del dispositivo HC-06.');
});

btSerial.on('data', async function (buffer) {
    let senal = buffer.toString('utf-8');
    if (senal.match(/^[a-cg-ik]$/g)) {
        try {
            if (senal === "k") {
                await fs.writeFile(__dirname + "/static/temp/admin", 'temporal');
            } else if (senal.match(/^[g-i]$/g)) {
                let existe;
                try {
                    await fs.stat(__dirname + "/static/temp/" + (senal === "g" ? 'peatonal' : (senal === "h" ? 'vehicular-1' : (senal === "i" ? 'vehicular-2' : 'error'))));
                    existe = true;
                } catch (error) {
                    existe = false;
                }
                if (existe) {
                    await fs.unlink(__dirname + "/static/temp/" + (senal === "g" ? 'peatonal' : (senal === "h" ? 'vehicular-1' : (senal === "i" ? 'vehicular-2' : 'error'))));
                    btSerial.write(Buffer.from(senal, 'utf-8'), (err, bitsEscritos) => {
                        if (err) {
                            console.log('No se pudo enviar ' + senal);
                        } else {
                            console.log('Señal ' + senal + " enviada.");
                        }
                    });
                }
            } else {
                await fs.writeFile(__dirname + "/static/temp/" + (senal === "a" ? "peatonal" : (senal === "b" ? "vehicular-1" : (senal === "c" ? "vehicular-2" : "error"))), 'temporal');
                btSerial.write(Buffer.from(senal, 'utf-8'), (err, bitsEscritos) => {
                    if (err) {
                        console.log('No se pudo enviar ' + senal);
                    } else {
                        console.log('Señal ' + senal + " enviada.");
                    }
                });
            }
        } catch (err) {
            btSerial.write(Buffer.from('j', 'utf-8'), (err, bitsEscritos) => {
                if (err) {
                    console.log('No se pudo enviar ' + senal);
                } else {
                    console.log('Señal ' + senal + " enviada.");
                }
            });
            console.log(err);
        }
    }
});

btSerial.on('disconnected', async function () {
    throw new Error('El dispositivo HC-06 ha sido desconectado.');
})

async function server() {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(__dirname + "/static"));
    app.set("views", __dirname + "/views");
    app.set("view engine", "ejs");

    app.get("/senal/:senal", async function (request, response) {
        btSerial.write(Buffer.from(request.params.senal, 'utf-8'), async (err, bitsEscritos) => {
            if (err) {
                await response.status(500).redirect("/");
                btSerial.write(Buffer.from('j', 'utf-8'), (err, bitsEscritos) => {
                    if (err) {
                        console.log('No se pudo enviar ' + senal);
                    } else {
                        console.log('Señal ' + senal + " enviada.");
                    }
                });
                throw err;
            } else {
                if (request.params.senal.match(/^[d-f]$/g)) {
                    await response.sendFile(__dirname + "/static/senal.html");
                }
                if (request.params.senal.match(/^[g-i]$/g)) {
                    await response.redirect("/");
                }
                console.log('Señal ' + request.params.senal +  ' enviada.');
            }
        });
    });

    app.get("/admin/:modulo?", async function (request, response) {
        let permiso;
        let temporal = __dirname + "/static/temp/admin";
        try {
            await fs.stat(temporal);
            permiso = true;
        } catch (error) {
            permiso = false;
        }
        
        if (!permiso) {
            await response.status(403).send(`<script>alert('Lo sentimos, no cuenta con permisos para 
acceder a la interfaz de emergencia.\n\nPara obtener acceso, presione el botón dentro del circuito 
durante al menos cinco segundos.');</script>`)
            btSerial.write(Buffer.from('j', 'utf-8'), (err, bitsEscritos) => {
                if (err) {
                    console.log('No se pudo enviar ' + senal);
                } else {
                    console.log('Señal ' + senal + " enviada.");
                }
            });
        } else {
            await fs.unlink(temporal);
            await response.sendFile(__dirname + "/static/admin.html");
        }
    })

    app.get("/:modulo/:control?", async function (request, response) {
        if (!request.params.modulo.match(/vehicular-(1|2)|peatonal/g))
            await response.status(404).redirect("/");
        else {
            let activo;
            let temporal = __dirname + "/static/temp/" + request.params.modulo;
            try {
                await fs.stat(temporal);
                activo = true;
            } catch (error) {
                activo = false;
            }
            if (!activo) {
                await response.render("infoModulo", {
                    modulo: request.params.modulo,
                    ip: "ws://" + host + ":" + puertoSocket
                });
            } else {
                if (request.params.control) {
                    let regex = /^([B-EM])?\d{2}(0[1-9]|[1-9]\d|(1\d{2})|(2([0-4]\d|5[0-4])))(0{3}[1-9]|0{2}[1-9]\d|0[1-9]\d{2}|[1-9]\d{3})$/g;
                    let senal = (request.params.modulo === "peatonal" ? 'd' : (request.params.modulo === "vehicular-1" ? 'e' : (request.params.modulo === "vehicular-2" ? 'f' : 'j')));
                    if (request.params.control.match(regex)) {
                        btSerial.write(Buffer.from(senal, 'utf-8'), (err, bitsEscritos) => {
                            if (err) {
                                throw err;
                            } else {
                                console.log('Señal ' + senal + ' enviada.');
                            }
                        });
                        await response.render("mensaje", {
                            tipo: "success",
                            modulo: request.params.modulo,
                            ip: "ws://" + host + ":" + puertoSocket,
                            mensaje: "Escaneo exitoso. Muchas gracias."
                        });
                    } else {
                        btSerial.write(Buffer.from('j', 'utf-8'), (err, bitsEscritos) => {
                            if (err) {
                                console.log('No se pudo enviar ' + senal);
                            } else {
                                console.log('Señal ' + senal + " enviada.");
                            }
                        });
                        await response.render("mensaje", {
                            tipo: "error",
                            modulo: request.params.modulo,
                            ip: "ws://" + host + ":" + puertoSocket,
                            mensaje: "Lo sentimos, no tiene acceso autorizado. Por favor, acuda con el guardia de seguridad."
                        });
                    }
                } else {
                    await response.render("codigo", {
                        modulo: request.params.modulo,
                        ip: "ws://" + host + ":" + puertoSocket
                    });
                }
            }
        }
    });

    app.get("/", async function (request, response) {
        await response.render("instrucciones", {
            modulo: request.params.modulo,
            ip: "ws://" + host + ":" + puertoSocket
        });
    });

    app.get("*", async function (request, response) {
        await response.status(404).redirect("/");
    });

    app.on("error", async function (err) {
        btSerial.write(Buffer.from('j', 'utf-8'), (err, bitsEscritos) => {
            if (err) {
                console.log('No se pudo enviar ' + senal);
            } else {
                console.log('Señal ' + senal + " enviada.");
            }
        });
	    throw err;
    });

    app.listen(puerto, host, function () {
        console.log("Servidor web iniciando en " + host + ":" + puerto);
    });
}