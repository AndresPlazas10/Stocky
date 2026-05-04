# Stocky Print Bridge Android

APK nativa minima para conectar Stocky con impresoras termicas Bluetooth clasico ESC/POS.

## Build sin Gradle

Este proyecto se puede compilar con Android SDK directamente desde macOS:

```bash
./build-apk.sh
```

APK generado:

```txt
dist/stocky-print-bridge-debug.apk
```

## Instalacion por USB

1. Activa Opciones de desarrollador en Android.
2. Activa Depuracion USB.
3. Conecta el telefono por USB.
4. Ejecuta:

```bash
~/Library/Android/sdk/platform-tools/adb install -r dist/stocky-print-bridge-debug.apk
```

## Uso

1. Empareja la impresora Bluetooth desde ajustes de Android.
2. Abre Stocky Print Bridge.
3. Toca Escanear emparejadas.
4. Selecciona la impresora.
5. Elige papel `58mm`, `80mm` o `104mm`.
6. Guarda.
7. Usa Imprimir prueba.
