# Stocky print Android

APK nativa abierta para conectar dispositivos Android con impresoras termicas Bluetooth clasico ESC/POS.

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
2. Abre Stocky print.
3. Toca Escanear emparejadas.
4. Selecciona la impresora.
5. Elige papel `58mm` o `80mm`.
6. Activa Abrir caja si aplica.
7. Copia el **Token de integracion** que aparece en pantalla.
8. Guarda.
9. Usa Imprimir prueba para verificar que la impresora funciona.

## Integracion con Stocky Web

El APK expone un servidor HTTP en `http://127.0.0.1:41781`.

1. Deja el APK abierto (el servidor se inicia automaticamente al guardar).
2. En Stocky Web, ve a **Configuracion > Impresora termica**.
3. Activa **Usar Stocky Print Bridge**.
4. En **Endpoint del bridge** ingresa `http://127.0.0.1:41781`.
5. Pega el **Token de integracion** que copiaste del APK.
6. Guarda la configuracion y prueba **Verificar conexion**.

### Impresion desde Android

Cuando el recibo se imprima via HTTP:
1. Stocky Web envia `POST /v1/print` con el recibo en JSON.
2. El APK valida el token, convierte el recibo a ESC/POS.
3. El APK envia los comandos a la impresora Bluetooth.
4. La impresora corta el papel automaticamente.

### Impresion nativa (Print dialog)

Desde cualquier app o navegador, toca **Imprimir** y elige **Stocky print**. El APK recibe el documento y lo envia a la impresora Bluetooth.
