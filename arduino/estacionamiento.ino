#include <Servo.h> // Librería para controlar servomotores
#include <SoftwareSerial.h>

/* Definicion de los modulos disponibles
Elemento 0 - Módulo de cruce peatonal
Elemento 1 - Módulo de cruce vehicular, carril izquierdo
Elemento 2 - Módulo de cruce vehicular, carril derecho
*/

const int trigPins[] = {8, 9, 10}; 
const int echoPins[] = {11, 12, 13};
const int modulos = 3;

const int buzzerPin = 7;

const int servoPins[] = {4, 5, 6};

const int ledPins[] = {A0, A1, A2};

const int bluetoothPinTX = 2;
const int bluetoothPinRX = 3;

const int botonEmergenciaPin = A3;

const int maximo = 30;

int estadoBotonEmergenciaInicial = LOW;
int estadoBotonEmergenciaFinal = LOW;

int temporizadorBoton = 0;
int modulosOcupados[] = {0, 0, 0};

SoftwareSerial bluetooth(bluetoothPinTX, bluetoothPinRX);

Servo servos[modulos];

void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);
  for (int i = 0; i < modulos; i++) {
    tone(buzzerPin, 550, 200);
    delay(200);
    tone(buzzerPin, 680, 200);
    delay(200);
    tone(buzzerPin, 820, 200);
    delay(600);
  }
  
  for (int i = 0; i < modulos; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(trigPins[i], LOW);
    servos[i].attach(servoPins[i]);
    servos[i].write(0);
  }

  pinMode(buzzerPin, OUTPUT);
  pinMode(botonEmergenciaPin, INPUT);
}

void loop() {
  if (bluetooth.available()) {
    char senal = bluetooth.read();
    
    if (senal == 'a') {
      digitalWrite(ledPins[0], HIGH);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'b') {
      digitalWrite(ledPins[1], HIGH);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'c') {
      digitalWrite(ledPins[2], HIGH);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'd') {
      digitalWrite(ledPins[0], HIGH);
      servos[0].write(90);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'e') {
      digitalWrite(ledPins[1], HIGH);
      servos[1].write(90);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'f') {
      digitalWrite(ledPins[2], HIGH);
      servos[2].write(90);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'g') {
      digitalWrite(ledPins[0], LOW);
      servos[0].write(0);
      tone(buzzerPin, 820, 50);
      delay(50);
    }

    if (senal == 'h') {
      digitalWrite(ledPins[1], LOW);
      servos[1].write(0);
    }

    if (senal == 'i') {
      digitalWrite(ledPins[2], LOW);
      servos[2].write(0);
    }

    if (senal == 'j') {
      tone(buzzerPin, 550, 750);
      delay(750);
    }
  }

  for (int i = 0; i < modulos; i++) {
    digitalWrite(trigPins[i], HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPins[i], LOW);

    // Realizar una medición de distancia
    long anchoPulso = pulseIn(echoPins[i], HIGH);
    long distancia = anchoPulso / 59;
    
    if (distancia > 0 && distancia < 30) {
      switch (i) {
        case 0:
          if (modulosOcupados[i] == 0) {
            bluetooth.write('a');
            modulosOcupados[i] = 1;
          }
          break;
        case 1:
          if (modulosOcupados[i] == 0) {
            bluetooth.write('b');
            modulosOcupados[i] = 1;
          }
          break;
        case 2:
          if (modulosOcupados[i] == 0) {
            bluetooth.write('c');
            modulosOcupados[i] = 1;
          }
          break;
        default:
          break;
      }
    } else {
      switch (i) {
        case 0:
          if (modulosOcupados[i] == 1) {
            bluetooth.write('g');
            modulosOcupados[i] = 0;
          }
          break;
        case 1:
          if (modulosOcupados[i] == 1) {
            bluetooth.write('h');
            modulosOcupados[i] = 0;
          }
          break;
        case 2:
          if (modulosOcupados[i] == 1) {
            bluetooth.write('i');
            modulosOcupados[i] = 0;
          }
          break;
        default:
          break;
      }
    }
    delay(200);
  }

  estadoBotonEmergenciaInicial = digitalRead(botonEmergenciaPin);
  if (estadoBotonEmergenciaInicial != estadoBotonEmergenciaFinal) {
    if (estadoBotonEmergenciaInicial == LOW) {
      temporizadorBoton = millis();
    } else { 
      if (millis() - temporizadorBoton >= 5000) {
        bluetooth.write('k');
        for (int i = 0; i < modulos; i++) {
          tone(buzzerPin, 1100, 200);
          delay(200);
          tone(buzzerPin, 540, 200);
          delay(600);
        }
      }
    }
  }

  estadoBotonEmergenciaFinal = estadoBotonEmergenciaInicial;
}