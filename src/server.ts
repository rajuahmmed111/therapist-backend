import mongoose from 'mongoose';
import config from './config';
import app from './app';
import http from 'http';
import { Server } from 'socket.io';
import configSocket from './app/socket/config.socket';
import cron from 'node-cron';
import appointmentService from './app/modules/appointmentModule/appointment.service';
import { sendNotificationBefore1Hour } from './app/modules/appointmentModule/appointment.utils';

const server: http.Server = http.createServer(app);

// Socket.io setup
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Initialize socket configuration safely
try {
  configSocket(io);
  console.log('✅ Socket.io configured successfully');
} catch (error) {
  console.error('❌ Error configuring Socket.io:', error);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  server.close(() => process.exit(1));
});

// Run every 15 minutes to update missed appointments & send notifications
cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('⏰ Running scheduled job...');
    await appointmentService.updateAllPastAppointments();
    console.log('✅ Missed appointments updated.');
    await sendNotificationBefore1Hour();
    console.log('📩 Notifications sent successfully.');
  } catch (error) {
    console.error('❌ Error in scheduled job:', error);
  }
});

const startServer = async () => {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(config.database_url as string);
    console.log('✅ Database connected successfully');

    server.listen(config.server_port || 5002, () => {
      console.log(
        `🚀 Server is listening at ${'http://10.10.20.19'}:${config.server_port}`
      );
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => process.exit(1));
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM signal received. Closing server...');
  server.close(() => console.log('✅ Server closed.'));
});

startServer();
