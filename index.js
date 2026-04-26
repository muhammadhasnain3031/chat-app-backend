 const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const http      = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);  // http server banao

// Socket.io initialize karo — express ke saath
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));

// ==============================
// SOCKET.IO — Real-Time Logic
// ==============================

const onlineUsers = new Map(); // userId → socketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User login hone pe apna ID send karta hai
  socket.on('user_online', (userId) => {
    onlineUsers.set(userId, socket.id);
    // Sare users ko batao yeh online aa gaya
    io.emit('online_users', Array.from(onlineUsers.keys()));
    console.log('Online users:', onlineUsers.size);
  });

  // Message bhejne pe
  socket.on('send_message', async (data) => {
    const { senderId, receiverId, text } = data;

    // MongoDB mein save karo
    const Message = require('./models/Message');
    const message = await Message.create({
      sender:   senderId,
      receiver: receiverId,
      text,
    });

    // Receiver online hai toh usse seedha bhejo
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', {
        _id:       message._id,
        sender:    senderId,
        receiver:  receiverId,
        text,
        createdAt: message.createdAt,
      });
    }

    // Sender ko bhi confirm karo (apna message screen pe aaye)
    socket.emit('message_sent', {
      _id:       message._id,
      sender:    senderId,
      receiver:  receiverId,
      text,
      createdAt: message.createdAt,
    });
  });

  // Typing indicator
  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { senderId });
    }
  });

  socket.on('stop_typing', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stop_typing', { senderId });
    }
  });

  // Disconnect pe online list se hataو
  socket.on('disconnect', () => {
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
      }
    });
    io.emit('online_users', Array.from(onlineUsers.keys()));
    console.log('User disconnected:', socket.id);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(5000, () => console.log('🚀 Server on port 5000'));
  })
  .catch(err => console.log('❌ Error:', err.message));
