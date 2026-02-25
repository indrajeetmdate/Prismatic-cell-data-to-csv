export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { folderName } = req.body;
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_DRIVE_API_KEY environment variable is required' });
    }

    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    // Traverse the path: # #Test reports > Cells > Prismatic > [folderName]
    const path = ['# #Test reports', 'Cells', 'Prismatic', folderName];
    let currentParentId = null;

    for (const folder of path) {
      const safeFolderName = folder.replace(/'/g, "\\'");
      let q = `name='${safeFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (currentParentId) {
        q += ` and '${currentParentId}' in parents`;
      }

      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${apiKey}&fields=files(id,name)`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        return res.status(searchRes.status).json({ error: searchData.error?.message || `Failed to search for folder: ${folder}` });
      }

      if (!searchData.files || searchData.files.length === 0) {
        const extraHelp = !currentParentId ? " (Make sure the folder is shared so the API key can access it)" : "";
        return res.status(404).json({ error: `Could not find folder named "${folder}"${extraHelp}.` });
      }

      currentParentId = searchData.files[0].id;
    }

    const targetFolderId = currentParentId;

    // Fetch file list in the target folder
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${targetFolderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType)`;
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
