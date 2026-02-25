export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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

    res.status(200).json({ files });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}
