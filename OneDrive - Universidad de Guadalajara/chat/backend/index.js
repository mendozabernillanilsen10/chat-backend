const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./database.js");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

app.use(cors());
app.use(express.json());

// Crear el directorio de imágenes si no existe
const imageDir = path.join(__dirname, process.env.UPLOADS_DIR || 'imagenes');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir);
}

// Servir archivos estáticos desde la carpeta 'imagenes'
app.use('/imagenes', express.static(imageDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Configuración de multer para manejar la carga de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOADS_DIR || 'imagenes/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// ==============================================
// ENDPOINTS DE USUARIO
// ==============================================
app.get("/api/alumnos", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM alumnos");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error al listar alumnos:", err);
    res.status(500).json({ error: "Error al obtener la lista de alumnos" });
  }
});


app.get("/test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1");
    res.send(rows);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.post("/api/registerAlumno", upload.single("fotoPerfil"), async (req, res) => {
  const { nombre, grado, carrera, gmail, numero, contrasena } = req.body;
  const foto = req.file ? req.file.filename : null;

  if (!nombre || !grado || !carrera || !gmail || !numero || !contrasena || !foto) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    await db.query(
      "INSERT INTO alumnos (Nombre, Grado, Carrera, Gmail, Numero, Contraseña, Foto) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nombre, grado, carrera, gmail, numero, contrasena, foto]
    );
    res.status(200).json({ message: "Registro exitoso" });
  } catch (err) {
    console.error("Error al registrar alumno:", err);
    res.status(500).json({ error: "Error al registrar alumno" });
  }
});

// Servir archivos estáticos desde la carpeta 'guias'
app.use('/guias', express.static(path.join(__dirname, process.env.GUIDES_DIR || 'guias')));

// Endpoint de registro para tutores
app.post("/api/register", upload.single('fotoPerfil'), async (req, res) => {
  console.log("Datos recibidos:", req.body); // Log de los datos enviados
  console.log("Archivo recibido:", req.file); // Log del archivo cargado

  const { tutor, descripcion, numero, gmail, contrasena } = req.body;
  const foto = req.file ? req.file.filename : null;

  if (!tutor || !descripcion || !contrasena || !foto) {
    return res.status(400).json({ error: "Los campos Tutor, Descripcion, Contrasena y Foto son obligatorios" });
  }

  try {
    await db.query(
      "INSERT INTO tutor (Tutor, Descripcion, Numero, Gmail, Contrasena, Foto, Fecha, Activo) VALUES (?, ?, ?, ?, ?, ?, current_timestamp(), 1)",
      [tutor, descripcion, numero, gmail, contrasena, foto]
    );
    res.status(200).json({ message: "Registro exitoso" });
  } catch (err) {
    console.error("Error al registrar tutor:", err);
    res.status(500).json({ error: "Error al registrar tutor" });
  }
});

// Endpoint para obtener resultados del usuario autenticado
app.get("/api/getExamResults/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "El ID del usuario es obligatorio" });
  }

  try {
    console.log("Buscando resultados para el usuario:", userId); // Debug log

    // Verificar si el usuario es un alumno
    const [alumno] = await db.query("SELECT * FROM alumnos WHERE IDalumnos = ?", [userId]);
    if (alumno.length > 0) {
      console.log("El usuario es un alumno. Buscando resultados en la tabla resultados_alumnos."); // Debug log

      // Obtener resultados de la tabla resultados_alumnos
      const [results] = await db.query(
        "SELECT Materia, Correctas, Incorrectas, Fecha FROM resultados_alumnos WHERE ID_alumno = ?",
        [userId]
      );

      console.log("Resultados obtenidos para el alumno:", results); // Debug log
      return res.status(200).json({ success: true, tipo_usuario: "alumno", results });
    }

    // Verificar si el usuario es un tutor
    const [tutor] = await db.query("SELECT * FROM tutor WHERE ID = ?", [userId]);
    if (tutor.length > 0) {
      console.log("El usuario es un tutor. Buscando resultados en la tabla resultados_tutores."); // Debug log

      // Obtener resultados de la tabla resultados_tutores (nombre corregido)
      const [results] = await db.query(
        "SELECT Materia, Correctas, Incorrectas, Fecha FROM resultados_tutores WHERE ID_tutor = ?",
        [userId]
      );

      console.log("Resultados obtenidos para el tutor:", results); // Debug log
      return res.status(200).json({ success: true, tipo_usuario: "tutor", results });
    }

    // Si el usuario no existe ni en alumnos ni en tutores
    console.log("El usuario no existe ni en la tabla alumnos ni en la tabla tutor."); // Debug log
    return res.status(404).json({ error: "El usuario no existe en el sistema." });
  } catch (error) {
    console.error("Error al obtener resultados:", error);
    res.status(500).json({ error: "Error al obtener resultados" });
  }
});

app.post("/api/saveExamResults", async (req, res) => {
  const { ID_usuario, Tipo_usuario, Materia, Semestre, Correctas, Incorrectas } = req.body;

  console.log("Datos recibidos para guardar resultados:", req.body);

  // Validar que todos los campos requeridos están presentes
  if (!ID_usuario || !Tipo_usuario || !Materia || !Semestre || Correctas === undefined || Incorrectas === undefined) {
    console.error("Error: Faltan datos obligatorios");
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    if (Tipo_usuario === "alumno") {
      // Verificar si el usuario existe en la tabla alumnos
      const [alumno] = await db.query("SELECT * FROM alumnos WHERE IDalumnos = ?", [ID_usuario]);
      if (alumno.length === 0) {
        return res.status(400).json({ error: "El ID del alumno no existe en la tabla alumnos." });
      }

      // Guardar los resultados en la tabla resultados_alumnos
      const [result] = await db.query(
        "INSERT INTO resultados_alumnos (ID_alumno, Materia, Semestre, Correctas, Incorrectas, Fecha) VALUES (?, ?, ?, ?, ?, NOW())",
        [ID_usuario, Materia, Semestre, Correctas, Incorrectas]
      );

      console.log("Inserción exitosa en la tabla resultados_alumnos:", result);
      return res.status(201).json({ success: true, message: "Resultados guardados exitosamente en alumnos.", ID_resultado: result.insertId });

    } else if (Tipo_usuario === "tutor") {
      // Verificar si el usuario existe en la tabla tutor
      const [tutor] = await db.query("SELECT * FROM tutor WHERE ID = ?", [ID_usuario]);
      if (tutor.length === 0) {
        return res.status(400).json({ error: "El ID del tutor no existe en la tabla tutor." });
      }

      // Guardar los resultados en la tabla resultados_tutor
      const [result] = await db.query(
        "INSERT INTO resultados_tutores (ID_tutor, Materia, Semestre, Correctas, Incorrectas, Fecha) VALUES (?, ?, ?, ?, ?, NOW())",
        [ID_usuario, Materia, Semestre, Correctas, Incorrectas]
      );

      console.log("Inserción exitosa en la tabla resultados_tutor:", result);
      return res.status(201).json({ success: true, message: "Resultados guardados exitosamente en tutores.", ID_resultado: result.insertId });
    } else {
      return res.status(400).json({ error: "Tipo de usuario no válido. Debe ser 'alumno' o 'tutor'." });
    }
  } catch (error) {
    console.error("Error al guardar resultados en la base de datos:", error);
    res.status(500).json({ error: "Error al guardar resultados" });
  }
});

// Endpoint de login
app.post("/api/login", async (req, res) => {
  const { usuario, contrasena } = req.body;

  try {
    // Buscar en la tabla de tutores
    const [tutor] = await db.query('SELECT * FROM tutor WHERE Tutor = ? AND Contrasena = ?', [usuario, contrasena]);
    if (tutor.length > 0) {
      // Obtener las salas a las que el tutor está unido
      const [rooms] = await db.query(`
        SELECT chat_rooms.*
        FROM chat_rooms
        JOIN chat_room_users ON chat_rooms.id = chat_room_users.room_id
        WHERE chat_room_users.user_id = ? AND chat_room_users.role = 'tutor'
      `, [tutor[0].ID]);
      res.json({ success: true, userId: tutor[0].ID, username: tutor[0].Tutor, role: 'tutor', rooms });
      return;
    }

    // Buscar en la tabla de alumnos
    const [alumno] = await db.query('SELECT * FROM alumnos WHERE Gmail = ? AND Contraseña = ?', [usuario, contrasena]);
    if (alumno.length > 0) {
      // Obtener las salas a las que el alumno está unido
      const [rooms] = await db.query(`
        SELECT chat_rooms.*
        FROM chat_rooms
        JOIN chat_room_users ON chat_rooms.id = chat_room_users.room_id
        WHERE chat_room_users.user_id = ? AND chat_room_users.role = 'alumno'
      `, [alumno[0].IDalumnos]);
      res.json({ success: true, userId: alumno[0].IDalumnos, username: alumno[0].Nombre, role: 'alumno', rooms });
      return;
    }

    // Si no se encuentra en ninguna tabla
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en login' });
  }
});

// Obtener perfil de usuario
app.get("/api/profile/:userId/:role", async (req, res) => {
  const { userId, role } = req.params;
  console.log(`Buscando perfil del usuario con ID: ${userId} y rol: ${role}`);

  try {
    if (role === "tutor") {
      const [tutor] = await db.query("SELECT * FROM tutor WHERE ID = ?", [userId]);
      if (tutor.length > 0) {
        console.log("Datos del tutor:", tutor[0]);
        res.json(tutor[0]);
      } else {
        res.status(404).json({ error: "Tutor no encontrado" });
      }
    } else if (role === "alumno") {
      const [alumno] = await db.query("SELECT * FROM alumnos WHERE IDalumnos = ?", [userId]);
      if (alumno.length > 0) {
        console.log("Datos del alumno:", alumno[0]);
        res.json(alumno[0]);
      } else {
        res.status(404).json({ error: "Alumno no encontrado" });
      }
    } else {
      res.status(400).json({ error: "Rol no válido" });
    }
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// ==============================================
// ENDPOINTS DE SALAS DE CHAT
// ==============================================

// Crear una nueva sala de chat
app.post("/createRoom", upload.single('fotoSala'), async (req, res) => {
  const { name, description, isPrivate, password, userId, role } = req.body;
  const imageUrl = req.file ? req.file.filename : null;

  if (!name || !imageUrl) {
    return res.status(400).json({ error: "El nombre de la sala y la foto son obligatorios" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO chat_rooms (name, description, image_url, is_private, password, average_rating) VALUES (?, ?, ?, ?, ?, 0)",
      [name, description, imageUrl, isPrivate ? 1 : 0, password]
    );

    const roomId = result.insertId;

    // Agregar el usuario como miembro de la sala
    const roleTable = role === 'tutor' ? 'tutor' : 'alumnos';
    const userIdColumn = role === 'tutor' ? 'ID' : 'IDalumnos';
    const [user] = await db.query(`SELECT ${userIdColumn} FROM ${roleTable} WHERE ${userIdColumn} = ?`, [userId]);

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await db.query(
      "INSERT INTO chat_room_users (user_id, room_id, role) VALUES (?, ?, ?)",
      [userId, roomId, role]
    );

    res.json({ room: { id: roomId, name, description, image_url: imageUrl, is_private: isPrivate, password } });
  } catch (err) {
    console.error("Error al crear sala:", err);
    res.status(500).json({ error: "Error al crear sala" });
  }
});

// Obtener todas las salas de chat
app.get("/api/rooms", async (req, res) => {
  try {
    const [rooms] = await db.query(
      `SELECT id, name, description, CONCAT('${process.env.BASE_URL}/imagenes/', image_url) AS image_url, is_private, average_rating FROM chat_rooms`
    );
    res.json(rooms);
  } catch (err) {
    console.error("Error al obtener salas:", err);
    res.status(500).json({ error: "Error al obtener salas" });
  }
});

// Obtener salas del usuario
app.get("/userRooms/:userId/:role", async (req, res) => {
  const { userId, role } = req.params;

  try {
    console.log(`Obteniendo salas para el usuario con ID: ${userId} y rol: ${role}`);

    const [rooms] = await db.query(`
      SELECT chat_rooms.*
      FROM chat_rooms
      JOIN chat_room_users ON chat_rooms.id = chat_room_users.room_id
      WHERE chat_room_users.user_id = ? AND chat_room_users.role = ?
    `, [userId, role]);

    if (rooms.length === 0) {
      console.warn(`No se encontraron salas para el usuario con ID: ${userId}`);
      return res.json([]);
    }

    console.log(`Salas obtenidas para el usuario con ID: ${userId}:`, rooms);
    res.json(rooms);
  } catch (err) {
    console.error("Error al obtener las salas del usuario:", err.message);
    res.status(500).json({ error: "Error al obtener las salas del usuario" });
  }
});

// Unirse a una sala
app.post("/joinRoom", async (req, res) => {
  const { roomId, password, userId, role } = req.body;

  try {
    // Verificar si la sala existe
    const [room] = await db.query("SELECT * FROM chat_rooms WHERE id = ?", [roomId]);
    if (room.length === 0) {
      return res.status(404).json({ error: "Sala no encontrada" });
    }

    // Comparar la contraseña si la sala es privada
    if (room[0].is_private) {
      const inputPassword = password.trim();
      const storedPassword = room[0].password.trim();

      if (inputPassword !== storedPassword) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }
    }

    // Determinar la tabla y columna según el rol
    const roleTable = role === 'tutor' ? 'tutor' : 'alumnos';
    const userIdColumn = role === 'tutor' ? 'ID' : 'IDalumnos';

    // Verificar si el usuario existe en la tabla correspondiente
    const [user] = await db.query(
      `SELECT ${userIdColumn} FROM ${roleTable} WHERE ${userIdColumn} = ?`,
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar si el usuario ya es miembro de la sala
    const [existingMembership] = await db.query(
      "SELECT * FROM chat_room_users WHERE user_id = ? AND room_id = ? AND role = ?",
      [userId, roomId, role]
    );

    if (existingMembership.length === 0) {
      // Agregar el usuario como miembro de la sala
      await db.query(
        "INSERT INTO chat_room_users (user_id, room_id, role) VALUES (?, ?, ?)",
        [userId, roomId, role]
      );
    }

    res.json({
      room: {
        id: roomId,
        name: room[0].name,
        description: room[0].description,
        image_url: room[0].image_url,
        is_private: room[0].is_private,
        password: room[0].password,
        average_rating: room[0].average_rating
      },
    });
  } catch (err) {
    console.error("Error al unirse a la sala:", err);
    res.status(500).json({ error: "Error al unirse a la sala" });
  }
});

// Obtener detalles de una sala
app.get("/getRoomDetails/:roomId", async (req, res) => {
  const { roomId } = req.params;

  // Validar que roomId es un número
  if (isNaN(roomId)) {
    console.warn("El ID de la sala no es un número válido:", roomId);
    return res.status(400).json({ error: "ID de sala inválido" });
  }

  try {
    console.log(`Buscando detalles de la sala con ID: ${roomId}`);

    const [roomDetails] = await db.query("SELECT * FROM chat_rooms WHERE id = ?", [roomId]);

    if (!roomDetails || roomDetails.length === 0) {
      console.warn(`Sala con ID ${roomId} no encontrada`);
      return res.status(404).json({ message: "Sala no encontrada" });
    }

    console.log("Detalles de la sala obtenidos:", roomDetails[0]);
    res.json(roomDetails[0]);

  } catch (err) {
    console.error("Error al obtener detalles de la sala:", err.message);
    res.status(500).json({ error: "Error interno al obtener detalles de la sala" });
  }
});

// ==============================================
// ENDPOINTS DE MENSAJES
// ==============================================

// Obtener mensajes de una sala (historial)
app.get("/historial/:roomId", async (req, res) => {
  const { roomId } = req.params;
  try {
    const [messages] = await db.query(
      "SELECT sender_id, username, role, message, created_at FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC",
      [roomId]
    );
    if (messages.length > 0) {
      res.json(messages);
    } else {
      res.status(404).json({ message: "No se encontraron mensajes" });
    }
  } catch (err) {
    console.error("Error al obtener mensajes:", err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

// Guardar mensaje
app.post("/saveMessage", async (req, res) => {
  const { roomId, senderId, message, username, role } = req.body;

  if (!roomId || !senderId || !message || !username || !role) {
    return res.status(400).json({ message: "Faltan campos obligatorios" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO chat_messages (room_id, sender_id, username, role, message, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [roomId, senderId, username, role, message]
    );
    res.json({ messageId: result.insertId });
  } catch (err) {
    console.error("Error al guardar mensaje:", err);
    res.status(500).json({ error: "Error al guardar mensaje" });
  }
});

app.get("/api/messages/:roomId", async (req, res) => {
  const { roomId } = req.params;

  try {
    const [messages] = await db.query(
      "SELECT sender_id AS senderId, username, role, message, created_at FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC",
      [roomId]
    );
    res.json(messages);
  } catch (err) {
    console.error("Error al obtener mensajes:", err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

// ==============================================
// ENDPOINTS DE CALIFICACIONES (RATINGS)
// ==============================================

// Obtener calificaciones de una sala
app.get("/api/ratings", async (req, res) => {
  try {
    const [ratings] = await db.query(`
      SELECT r.*, 
        CASE 
          WHEN u.role = 'tutor' THEN t.Foto 
          ELSE 'default.jpg' 
        END as user_photo
      FROM room_ratings r
      LEFT JOIN chat_room_users u ON r.user_id = u.user_id AND u.room_id = r.room_id
      LEFT JOIN tutor t ON u.role = 'tutor' AND t.ID = r.user_id
      ORDER BY r.created_at DESC
    `);
    
    // Formatear la URL de la foto
    const formattedRatings = ratings.map(rating => ({
      ...rating,
      user_photo: rating.user_photo 
        ? `${process.env.BASE_URL}/imagenes/${rating.user_photo}`
        : `${process.env.BASE_URL}/imagenes/default.jpg`
    }));
    
    res.json(formattedRatings);
  } catch (err) {
    console.error("Error fetching ratings:", err);
    res.status(500).json({ error: "Error fetching ratings" });
  }
});

// Enviar una calificación
// Endpoint para enviar calificaciones (versión mejorada con logging)
app.post("/api/ratings", async (req, res) => {
  console.log("Datos recibidos para rating:", req.body); // Log de los datos recibidos
  
  const { roomId, userId, username, rating, comment, role } = req.body;

  // Validaciones mejoradas
  if (!roomId || !userId || !username || rating === undefined || !comment || !role) {
    console.error("Faltan campos obligatorios");
    return res.status(400).json({ 
      error: "Todos los campos son obligatorios",
      details: {
        received: req.body,
        required: ["roomId", "userId", "username", "rating", "comment", "role"]
      }
    });
  }

  if (isNaN(rating) || rating < 1 || rating > 5) {
    console.error("Rating inválido:", rating);
    return res.status(400).json({ 
      error: "La calificación debe ser un número entre 1 y 5",
      received: rating
    });
  }

  try {
    // Verificar si la sala existe
    const [room] = await db.query("SELECT id FROM chat_rooms WHERE id = ?", [roomId]);
    if (room.length === 0) {
      console.error("Sala no encontrada:", roomId);
      return res.status(404).json({ error: "Sala no encontrada" });
    }

    // Verificar si el usuario ya calificó esta sala
    const [existingRating] = await db.query(
      "SELECT id FROM room_ratings WHERE room_id = ? AND user_id = ?",
      [roomId, userId]
    );
    
    if (existingRating.length > 0) {
      console.error("El usuario ya calificó esta sala:", userId, roomId);
      return res.status(400).json({ error: "Ya has calificado esta sala" });
    }

    // Insertar la calificación
    console.log("Insertando nueva calificación...");
    const [result] = await db.query(
      "INSERT INTO room_ratings (room_id, user_id, username, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [roomId, userId, username, rating, comment]
    );

    // Obtener la calificación recién creada
    const [newRating] = await db.query(`
      SELECT r.*, 
        CASE 
          WHEN u.role = 'tutor' THEN t.Foto 
          ELSE 'default.jpg' 
        END as user_photo
      FROM room_ratings r
      LEFT JOIN chat_room_users u ON r.user_id = u.user_id AND u.room_id = r.room_id
      LEFT JOIN tutor t ON u.role = 'tutor' AND t.ID = r.user_id
      WHERE r.id = ?
    `, [result.insertId]);

    console.log("Calificación creada exitosamente:", newRating[0]);
    
    res.status(201).json({
      message: "Calificación enviada",
      rating: {
        ...newRating[0],
        user_photo: newRating[0].user_photo 
          ? `${process.env.BASE_URL}/imagenes/${newRating[0].user_photo}`
          : `${process.env.BASE_URL}/imagenes/default.jpg`
      }
    });

  } catch (err) {
    console.error("Error en la base de datos:", err);
    res.status(500).json({ 
      error: "Error interno al procesar la calificación",
      details: err.message 
    });
  }
});

// ==============================================
// SOCKET.IO CONFIGURATION
// ==============================================

io.on("connection", (socket) => {
  console.log("Nuevo usuario conectado:", socket.id);

  // Unirse a una sala de chat
  socket.on("join_room", (room) => {
    if (!room) {
      console.error("Sala no especificada");
      return;
    }

    console.log("Intentando unirse a la sala:", room);
    socket.join(room);
    console.log(`Usuario unido a la sala: ${room}`);
  });

  // Unirse a una sala de ratings
  socket.on("join_rating_room", (roomId) => {
    socket.join(`ratings_${roomId}`);
    console.log(`Usuario unido a sala de ratings para room: ${roomId}`);
  });

  // Enviar mensaje
  socket.on("send_message", async (data) => {
    try {
      const { room, senderId, message, username, role } = data;
      if (!room || !senderId || !message || !username || !role) {
        console.error("Datos del mensaje incompletos:", data);
        return;
      }
  
      const roomId = room.split("_")[1];
      const timestamp = new Date().toISOString();
  
      // Verificar si el mensaje ya existe (para evitar duplicados)
      const [existing] = await db.query(
        "SELECT id FROM chat_messages WHERE room_id = ? AND sender_id = ? AND message = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 SECOND)",
        [roomId, senderId, message]
      );
  
      if (existing.length === 0) {
        // Solo guardar si el mensaje no existe en los últimos 5 segundos
        const [result] = await db.query(
          "INSERT INTO chat_messages (room_id, sender_id, username, role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [roomId, senderId, username, role, message, timestamp]
        );
        const messageId = result.insertId;
  
        // Emitir el mensaje a todos en la sala
        socket.to(room).emit("receive_message", {
          messageId,
          senderId,
          username,
          role,
          message,
          timestamp,
          room,
        });
      }
    } catch (err) {
      console.error("Error al manejar el mensaje:", err);
    }
  });

  // Desconexión
  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================

const PORT = process.env.SERVER_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});