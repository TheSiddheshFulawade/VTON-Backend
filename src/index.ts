import express from 'express';
import cors from 'cors';
import virtualTryOnRoutes from './routes/virtualTryOnRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/virtual-tryon', virtualTryOnRoutes);

export default app;
