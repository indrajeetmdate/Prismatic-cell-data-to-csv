import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to list files in a Google Drive folder
  app.post('/api/drive/list', async (req, res) => {
    try {
      const { folderUrl } = req.body;
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'GOOGLE_DRIVE_API_KEY environment variable is required' });
      }

      // Extract folder ID from URL
      const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/) || folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid Google Drive folder URL.' });
      }
      const folderId = match[1];

      // Fetch file list
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType)`;
      const response = await fetch(listUrl);
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data.error?.message || 'Failed to fetch folder contents.' });
      }

      // Filter for xlsx files
      const files = data.files.filter((f: any) => f.name.endsWith('.xlsx') || f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      res.json({ files });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // API Route to download a specific file from Google Drive
  app.get('/api/drive/download/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'GOOGLE_DRIVE_API_KEY environment variable is required' });
      }

      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: errorData.error?.message || 'Failed to download file.' });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
