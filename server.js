require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { Server } = require('socket.io');
const connectDatabase = require('./src/config/db');
const { connectRedis } = require('./src/config/redis');
const { configureCloudinary } = require('./src/config/cloudinary');
const initializeSockets = require('./src/sockets');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const rateLimit = require('./src/middleware/rateLimit');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Copy .env.example to .env and set a strong secret.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) : true;
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } });
app.set('io', io);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigins }));
app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', rateLimit({ prefix: 'teamconnect:api', windowSeconds: 60, max: 300 }));

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/teams', require('./src/routes/teamRoutes'));
app.use('/api/tasks', require('./src/routes/taskRoutes'));
app.use('/api/messages', require('./src/routes/messageRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));
app.use('/api/uploads', require('./src/routes/uploadRoutes'));
app.use('/', require('./src/routes/pageRoutes'));
app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDatabase();
  await connectRedis();
  configureCloudinary();
  await initializeSockets(io);
  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`TeamConnect is running on port ${port}.`));
}

start().catch((error) => {
  console.error('Unable to start TeamConnect:', error.message);
  process.exit(1);
});

module.exports = { app, server };
