import express from 'express';
import cors from 'cors';
import virtualTryOnRoutes from './routes/virtualTryOnRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/virtual-tryon', virtualTryOnRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ 
        success: false, 
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    });
});

export default app;