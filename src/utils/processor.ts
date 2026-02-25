import * as XLSX from 'xlsx';

export interface ProcessedData {
  fileName: string;
  serialNumber: string;
  dischargeCapacity: number | string;
  sections: Record<string, { relativeTime: number; capacity: number }[]>;
  error?: string;
}

export async function processExcelFile(file: File): Promise<ProcessedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 1. Extract Serial Number
        let serialNumber = '';
        const templateSheet = workbook.Sheets['Template information'];
        if (templateSheet && templateSheet['A1']) {
          const a1Value = String(templateSheet['A1'].v);
          const match = a1Value.match(/Barcode:\s*([A-Za-z0-9]+)/i);
          if (match && match[1]) {
            serialNumber = match[1];
          } else {
            const parts = a1Value.split(/Barcode:/i);
            if (parts.length > 1) {
              serialNumber = parts[1].trim();
            } else {
              serialNumber = a1Value;
            }
          }
        }

        // Fallback: Extract from filename if serialNumber is blank or 'Unknown'
        // Example: G_COM1__Highstar (Black)100Ah__311218541155988_20260225104342#0#1_1_5
        if (!serialNumber || serialNumber === 'Unknown') {
          const fnMatch = file.name.match(/__([A-Za-z0-9]+)_\d{8}\d{6}#/);
          if (fnMatch && fnMatch[1]) {
            serialNumber = fnMatch[1];
          } else {
            serialNumber = 'Unknown';
          }
        }

        // 2. Extract Discharge Capacity
        let dischargeCapacity: number | string = 'N/A';
        const loopSheet = workbook.Sheets['Loop level'];
        if (loopSheet && loopSheet['H2']) {
          dischargeCapacity = loopSheet['H2'].v;
        }

        // 3. Process Curve Data (Capacity vs Relative Time grouped by Step Mode)
        const recordSheet = workbook.Sheets['Record level'];
        const sections: Record<string, { relativeTime: number; capacity: number }[]> = {};
        
        if (recordSheet) {
          const rows = XLSX.utils.sheet_to_json<any[]>(recordSheet, { header: 1 });
          
          // Use exact indices as specified:
          // Column E (STEP_MODE_NAME) -> 4
          // Column H (RELATIVE_TIME(Sec)) -> 7
          // Column N (CAPACITY(Ah)) -> 13
          const stepModeIdx = 4;
          const relTimeIdx = 7;
          const capacityIdx = 13;

          let currentBlockMode = '';
          let currentBlockData: { relativeTime: number; capacity: number }[] = [];
          const modeCounts: Record<string, number> = {};

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            
            const stepModeRaw = row[stepModeIdx];
            const relTime = parseFloat(row[relTimeIdx]);
            const capacity = parseFloat(row[capacityIdx]);
            
            if (typeof stepModeRaw === 'string' && !isNaN(relTime) && !isNaN(capacity)) {
              const mode = stepModeRaw.trim();
              
              // Omit "Still" sections
              if (mode.toLowerCase().includes('still')) {
                if (currentBlockMode !== '') {
                  const count = (modeCounts[currentBlockMode] || 0) + 1;
                  modeCounts[currentBlockMode] = count;
                  const sectionName = count === 1 ? currentBlockMode : `${currentBlockMode} ${count}`;
                  sections[sectionName] = currentBlockData;
                  
                  currentBlockMode = '';
                  currentBlockData = [];
                }
                continue;
              }

              if (mode !== currentBlockMode) {
                if (currentBlockMode !== '') {
                  const count = (modeCounts[currentBlockMode] || 0) + 1;
                  modeCounts[currentBlockMode] = count;
                  const sectionName = count === 1 ? currentBlockMode : `${currentBlockMode} ${count}`;
                  sections[sectionName] = currentBlockData;
                }
                currentBlockMode = mode;
                currentBlockData = [];
              }

              currentBlockData.push({
                relativeTime: relTime,
                capacity: capacity
              });
            }
          }

          if (currentBlockMode !== '') {
            const count = (modeCounts[currentBlockMode] || 0) + 1;
            modeCounts[currentBlockMode] = count;
            const sectionName = count === 1 ? currentBlockMode : `${currentBlockMode} ${count}`;
            sections[sectionName] = currentBlockData;
          }
        }

        resolve({
          fileName: file.name,
          serialNumber,
          dischargeCapacity,
          sections
        });
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        resolve({
          fileName: file.name,
          serialNumber: 'Error',
          dischargeCapacity: 'Error',
          sections: {},
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
