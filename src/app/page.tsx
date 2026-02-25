'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, UploadCloud, FileSpreadsheet, Trash2, AlertCircle, FileText, Link as LinkIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { processExcelFile, ProcessedData } from '../utils/processor';

const parseFilename = (filename: string) => {
  let dateStr = "N/A";
  let channelStr = "N/A";
  const dateMatch = filename.match(/_(\d{8})\d{6}#/);
  if (dateMatch) {
    const rawDate = dateMatch[1];
    dateStr = `${rawDate.substring(6,8)}/${rawDate.substring(4,6)}/${rawDate.substring(0,4)}`;
  }
  const channelMatch = filename.match(/#\d+#(\d+_\d+_\d+)/) || filename.match(/#(\d+_\d+_\d+)/);
  if (channelMatch) {
    const rawChannel = channelMatch[1];
    const parts = rawChannel.split('_');
    if (parts.length >= 3) {
      channelStr = `${parts[0]}_${parts[2]}`;
    } else {
      channelStr = rawChannel;
    }
  }
  return { dateStr, channelStr };
};

export default function Page() {
  const [processedFiles, setProcessedFiles] = useState<ProcessedData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [visibleSerials, setVisibleSerials] = useState<Set<string>>(new Set());
  
  const [driveInput, setDriveInput] = useState('');
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    const newProcessedFiles: ProcessedData[] = [];
    
    for (const file of acceptedFiles) {
      if (file.name.endsWith('.xlsx')) {
        const data = await processExcelFile(file);
        newProcessedFiles.push(data);
      }
    }
    
    setProcessedFiles(prev => [...prev, ...newProcessedFiles]);
    setIsProcessing(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop as any,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  } as any);

  const removeFile = (index: number) => {
    setProcessedFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    setVisibleSerials(prev => {
      const newSet = new Set(prev);
      processedFiles.forEach(f => newSet.add(f.serialNumber));
      return newSet;
    });
  }, [processedFiles]);

  const toggleSerial = (serial: string) => {
    setVisibleSerials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serial)) {
        newSet.delete(serial);
      } else {
        newSet.add(serial);
      }
      return newSet;
    });
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // 1. Fetch and add Logo
      const logoUrl = "https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy_white_bg.png";
      let logoBase64 = '';
      try {
        const res = await fetch(logoUrl);
        const blob = await res.blob();
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn("Could not load logo for PDF", e);
      }

      let currentY = 10;
      if (logoBase64) {
        const imgProps = doc.getImageProperties(logoBase64);
        const logoWidth = 40;
        const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
        doc.addImage(logoBase64, 'PNG', 14, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 10;
      } else {
        currentY += 15;
      }

      // 2. Headings
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text("Cell Batch report", 14, currentY);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Folder: ${driveInput || 'Manual Upload'}`, 14, currentY + 7);

      // 3. Generate QR Codes
      const qrCodes = await Promise.all(filteredFiles.map(f => {
        const serial = f.serialNumber && f.serialNumber !== 'Unknown' ? f.serialNumber : 'N/A';
        return QRCode.toDataURL(serial, { margin: 1 });
      }));

      // 4. Draw Table
      autoTable(doc, {
        startY: currentY + 15,
        theme: 'grid',
        head: [['Serial Number', 'Date', 'Channel', 'Barcode', 'Capacity (Ah)']],
        body: filteredFiles.map((f) => {
          const { dateStr, channelStr } = parseFilename(f.fileName);
          return [
            f.serialNumber,
            dateStr,
            channelStr,
            '', // Placeholder for barcode
            typeof f.dischargeCapacity === 'number' ? f.dischargeCapacity.toFixed(4) : f.dischargeCapacity
          ];
        }),
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const qr = qrCodes[data.row.index];
            if (qr) {
              const dim = data.cell.height - 4;
              doc.addImage(qr, 'PNG', data.cell.x + 2, data.cell.y + 2, dim, dim);
            }
          }
        },
        rowPageBreak: 'avoid',
        styles: { 
          minCellHeight: 14, 
          valign: 'middle',
          textColor: '#000000',
          lineColor: '#d1d5db',
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: '#404041', 
          textColor: '#ffffff' 
        },
        columnStyles: {
          0: { fillColor: '#d3e5bd' }
        }
      });

      // 5. Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("www.cnergy.co.in", pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      // 6. Trigger download
      doc.save('Cell_Batch_Report.pdf');
    } catch (error) {
      console.error('Failed to export PDF', error);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadCSV = () => {
    if (processedFiles.length === 0) return;

    const headers = ['File Name', 'Serial Number', 'Date', 'Channel', 'Discharge Capacity (Ah)'];
    const csvContent = [
      headers.join(','),
      ...processedFiles.map(file => {
        const { dateStr, channelStr } = parseFilename(file.fileName);
        return `"${file.fileName}","${file.serialNumber}","${dateStr}","${channelStr}","${file.dischargeCapacity}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'batch_summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDriveImport = async () => {
    if (!driveInput) return;
    setIsImportingDrive(true);
    setImportProgress(`Searching for folder...`);
    try {
      const listRes = await fetch('/api/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderInput: driveInput })
      });
      const listData = await listRes.json();
      
      if (!listRes.ok) throw new Error(listData.error || 'Failed to fetch folder');
      
      const files = listData.files;
      if (!files || files.length === 0) {
        throw new Error('No .xlsx files found in this folder');
      }

      const downloadedFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        setImportProgress(`Downloading ${files[i].name} (${i + 1}/${files.length})...`);
        const dlRes = await fetch(`/api/drive/download/${files[i].id}`);
        if (!dlRes.ok) {
          console.error(`Failed to download ${files[i].name}`);
          continue;
        }
        const blob = await dlRes.blob();
        const file = new File([blob], files[i].name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadedFiles.push(file);
      }
      
      setImportProgress('Processing files...');
      await onDrop(downloadedFiles);
      setDriveInput('');
    } catch (err: any) {
      alert(err.message || 'An error occurred during import');
    } finally {
      setIsImportingDrive(false);
      setImportProgress('');
    }
  };

  const allSections = useMemo(() => {
    const sections = new Set<string>();
    processedFiles.forEach(file => {
      Object.keys(file.sections || {}).forEach(s => sections.add(s));
    });
    return Array.from(sections).sort();
  }, [processedFiles]);

  useEffect(() => {
    if (allSections.length > 0 && !allSections.includes(selectedSection)) {
      if (allSections.includes('CC Discharge')) {
        setSelectedSection('CC Discharge');
      } else {
        setSelectedSection(allSections[0]);
      }
    }
  }, [allSections, selectedSection]);

  const colors = [
    '#65913B', // DC Energy Green
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#FFFFFF', // White
  ];

  const serialNumberColors = useMemo(() => {
    const uniqueSerials = Array.from(new Set(processedFiles.map(f => f.serialNumber)));
    const map: Record<string, string> = {};
    uniqueSerials.forEach((serial, idx) => {
      map[serial] = colors[idx % colors.length];
    });
    return map;
  }, [processedFiles]);

  const uniqueSerials = useMemo(() => {
    return Array.from(new Set(processedFiles.map(f => f.serialNumber))).sort();
  }, [processedFiles]);

  const filteredFiles = useMemo(() => {
    return processedFiles.filter(f => visibleSerials.has(f.serialNumber));
  }, [processedFiles, visibleSerials]);

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-[#65913B] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#414142] bg-[#000000] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energyfull_black_bg_.png" 
              alt="DC Energy Logo" 
              className="h-8 object-contain" 
              referrerPolicy="no-referrer" 
            />
            <h1 className="text-xl font-semibold tracking-tight"><span className="text-[#7CAC3F]">|</span> Prismatic Cell Processor</h1>
          </div>
          {processedFiles.length > 0 && (
            <div className="flex items-center space-x-3">
              <button
                onClick={downloadCSV}
                className="flex items-center space-x-2 bg-[#414142] hover:bg-[#65913B] transition-colors px-4 py-2 rounded-md text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={exportPDF}
                disabled={isExporting}
                className="flex items-center space-x-2 bg-[#65913B] hover:bg-[#7CAC3F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4 py-2 rounded-md text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Upload Section */}
        <section>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ease-in-out
              ${isDragActive ? 'border-[#7CAC3F] bg-[#65913B]/10' : 'border-[#414142] hover:border-[#65913B] hover:bg-[#414142]/30'}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`p-4 rounded-full ${isDragActive ? 'bg-[#65913B]/20 text-[#7CAC3F]' : 'bg-[#414142] text-[#9ca3af]'}`}>
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop files here...' : 'Drag & drop .xlsx files here'}
                </p>
                <p className="text-sm text-[#9ca3af] mt-1">
                  or click to select files (supports batch upload)
                </p>
              </div>
            </div>
          </div>

          {/* Google Drive Import */}
          <div className="mt-6 border border-[#414142] rounded-xl p-6 bg-[#0a0a0a]">
            <h3 className="text-sm font-medium text-[#9ca3af] mb-3 uppercase tracking-wider flex items-center">
              <LinkIcon className="w-4 h-4 mr-2" />
              Import from Google Drive
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Enter folder name (e.g., Batch_01) or paste Drive link..."
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                className="flex-1 bg-[#1a1a1a] border border-[#414142] rounded-md px-4 py-2 text-sm focus:outline-none focus:border-[#65913B] transition-colors"
              />
              <button
                onClick={handleDriveImport}
                disabled={isImportingDrive || !driveInput}
                className="bg-[#414142] hover:bg-[#65913B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-6 py-2 rounded-md text-sm font-medium whitespace-nowrap"
              >
                {isImportingDrive ? 'Importing...' : 'Fetch Files'}
              </button>
            </div>
            {importProgress && (
              <div className="mt-3 flex items-center space-x-2 text-[#7CAC3F]">
                <div className="w-3 h-3 border-2 border-[#7CAC3F] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-medium">{importProgress}</p>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-6 flex items-center justify-center space-x-2 text-[#7CAC3F]">
              <div className="w-4 h-4 border-2 border-[#7CAC3F] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Processing files...</span>
            </div>
          )}
        </section>

        {processedFiles.length > 0 && (
          <div id="report-content" className="space-y-8">
            
            {/* Filter Section */}
            {uniqueSerials.length > 0 && (
              <section className="bg-[#0a0a0a] border border-[#414142] rounded-xl p-4 shadow-2xl">
                <h3 className="text-sm font-medium text-[#9ca3af] mb-3 uppercase tracking-wider">Filter by Serial Number</h3>
                <div className="flex flex-wrap gap-2">
                  {uniqueSerials.map(serial => {
                    const isVisible = visibleSerials.has(serial);
                    const color = serialNumberColors[serial];
                    return (
                      <button
                        key={serial}
                        onClick={() => toggleSerial(serial)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center space-x-2`}
                        style={{ 
                          borderColor: isVisible ? color : '#414142',
                          backgroundColor: isVisible ? `${color}20` : 'transparent',
                          color: isVisible ? '#fff' : '#808080'
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isVisible ? color : '#414142' }}></span>
                        <span>{serial}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Chart Section */}
            <section className="lg:col-span-2 bg-[#0a0a0a] border border-[#414142] rounded-xl p-6 shadow-2xl flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <span className="w-2 h-6 bg-[#65913B] rounded-sm mr-3"></span>
                  Capacity vs Relative Time
                </h2>
                
                {allSections.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allSections.map(section => (
                      <button
                        key={section}
                        onClick={() => setSelectedSection(section)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          selectedSection === section 
                            ? 'bg-[#65913B] text-white' 
                            : 'bg-[#414142]/50 text-[#d1d5db] hover:bg-[#414142]'
                        }`}
                      >
                        {section}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex-1 w-full overflow-y-auto max-h-[600px] pr-2 space-y-6">
                {selectedSection ? (
                  filteredFiles.map((file, index) => {
                    const data = file.sections[selectedSection];
                    if (!data || data.length === 0) return null;
                    const color = serialNumberColors[file.serialNumber] || colors[0];
                    return (
                      <div key={file.fileName} className="h-[250px] w-full border border-[#414142] rounded-lg p-4 bg-[#141414]">
                        <h4 className="text-sm font-medium text-[#d1d5db] mb-2">
                          {file.serialNumber} <span className="text-[#6b7280] text-xs">({file.fileName})</span>
                        </h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#414142" vertical={false} />
                            <XAxis 
                              dataKey="relativeTime" 
                              type="number" 
                              domain={['auto', 'auto']} 
                              stroke="#808080"
                              tick={{ fill: '#808080' }}
                              label={{ value: 'Relative Time (Sec)', position: 'insideBottom', offset: -10, fill: '#808080' }}
                            />
                            <YAxis 
                              dataKey="capacity" 
                              type="number" 
                              domain={['auto', 'auto']} 
                              stroke="#808080"
                              tick={{ fill: '#808080' }}
                              label={{ value: 'Capacity (Ah)', angle: -90, position: 'insideLeft', fill: '#808080' }}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#000000', borderColor: '#414142', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                              labelFormatter={(value) => `Time: ${Number(value).toFixed(1)} s`}
                              formatter={(value: number) => [value.toFixed(4) + ' Ah', 'Capacity']}
                            />
                            <Line
                              type="monotone"
                              dataKey="capacity"
                              name={file.serialNumber !== 'Unknown' ? file.serialNumber : file.fileName}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, fill: color, stroke: '#000' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full min-h-[300px] flex items-center justify-center text-[#6b7280]">
                    No section data available
                  </div>
                )}
              </div>
            </section>

            {/* Summary Table Section */}
            <section className="bg-[#0a0a0a] border border-[#414142] rounded-xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-[#414142]">
                <h2 className="text-lg font-semibold flex items-center">
                  <span className="w-2 h-6 bg-[#7CAC3F] rounded-sm mr-3"></span>
                  Batch Summary
                </h2>
              </div>
              <div className="overflow-y-auto flex-1 max-h-[500px]">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-[#9ca3af] uppercase bg-[#414142]/20 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-medium">Serial Number</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Capacity (Ah)</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#414142]">
                    {filteredFiles.map((file, index) => {
                      const { dateStr, channelStr } = parseFilename(file.fileName);
                      return (
                      <tr key={index} className="hover:bg-[#414142]/10 transition-colors group">
                        <td className="px-4 py-3 font-mono text-xs">
                          {file.error ? (
                            <span className="text-[#f87171] flex items-center" title={file.error}>
                              <AlertCircle className="w-3 h-3 mr-1" /> Error
                            </span>
                          ) : (
                            file.serialNumber
                          )}
                          <div className="text-[10px] text-[#6b7280] truncate max-w-[120px]" title={file.fileName}>
                            {file.fileName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#d1d5db]">{dateStr}</td>
                        <td className="px-4 py-3 text-xs text-[#d1d5db]">{channelStr}</td>
                        <td className="px-4 py-3 font-mono text-[#7CAC3F]">
                          {typeof file.dischargeCapacity === 'number' 
                            ? file.dischargeCapacity.toFixed(4) 
                            : file.dischargeCapacity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => removeFile(index)}
                            className="text-[#6b7280] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </section>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
