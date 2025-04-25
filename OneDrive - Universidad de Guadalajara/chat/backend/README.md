# Chat Backend

Este es el backend de una aplicación de chat desarrollada con tecnologías modernas.

## Tecnologías Utilizadas

- **Node.js** - Entorno de ejecución para JavaScript
- **Express.js** - Framework web para Node.js
- **MySQL** - Sistema de gestión de base de datos
- **Socket.IO** - Biblioteca para comunicación en tiempo real
- **Multer** - Middleware para manejo de archivos
- **CORS** - Middleware para permitir peticiones de diferentes orígenes

## Requisitos Previos

- Node.js (versión 14 o superior)
- MySQL instalado y configurado
- npm (administrador de paquetes de Node.js)

## Instalación

1. Clona este repositorio:
```bash
git clone [URL-del-repositorio]
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura la base de datos:
   - Asegúrate de tener MySQL en ejecución
   - Crea una base de datos para el proyecto
   - Configura las credenciales en el archivo `database.js`

## Iniciar el Servidor

Para iniciar el servidor en modo desarrollo con recarga automática:

```bash
npm start
```

El servidor se iniciará en `http://localhost:[puerto]`

## Estructura del Proyecto

- `index.js` - Punto de entrada de la aplicación
- `database.js` - Configuración de la base de datos
- `guias/` - Directorio para archivos de guías
- `imagenes/` - Directorio para almacenamiento de imágenes

## Características

- Sistema de chat en tiempo real
- Almacenamiento de archivos y imágenes
- API RESTful
- Gestión de base de datos MySQL
- Soporte para CORS
- Manejo de archivos multimedia

## Licencia

ISC