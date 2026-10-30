import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      !process.env.CORS_ORIGIN ||
      origin === process.env.CORS_ORIGIN ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, origin);
    }
    return callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
}));

// Body Parsers & Cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'StockSphere API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    details: null,
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
