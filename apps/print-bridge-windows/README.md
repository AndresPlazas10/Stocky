# Stocky Print Bridge Windows

Puente local para imprimir desde Stocky en impresoras termicas Bluetooth clasico compatibles con ESC/POS.

## Requisitos

- Windows 10/11.
- Impresora Bluetooth emparejada desde Configuracion de Windows.
- La impresora debe aparecer como puerto COM.
- Node 18+ para desarrollo/build.

## Desarrollo

```bash
cd apps/print-bridge-windows
npm install
npm run dev
```

## Build

```bash
cd apps/print-bridge-windows
npm install
npm run build
```

El instalador queda en:

```txt
apps/print-bridge-windows/release/
```

## Uso

1. Empareja la impresora Bluetooth en Windows.
2. Abre Stocky Print Bridge.
3. Escanea puertos COM.
4. Selecciona la impresora.
5. Elige papel `58mm`, `80mm` o `104mm`.
6. Guarda configuracion.
7. Copia el token en Stocky > Configuracion > Impresora termica.
8. Activa Stocky Print Bridge en Stocky.

## API Local

El bridge escucha en:

```txt
http://127.0.0.1:41780
```

Endpoints:

```txt
GET /v1/status
POST /v1/print
```

`POST /v1/print` requiere:

```txt
X-Stocky-Bridge-Token: <token>
X-Stocky-Origin: <origen>
```

## Notas

- Si `serialport` no esta instalado, la app abre pero no puede listar ni imprimir en puertos COM.
- Algunas impresoras Bluetooth requieren probar `9600`, `19200` o `115200` baud.
- SmartScreen puede mostrar advertencia hasta que el instalador este firmado.
