'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, UploadCloud, FileSpreadsheet, Trash2, AlertCircle, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { processExcelFile, ProcessedData } from '../utils/processor';

export default function Page() {
  const [processedFiles, setProcessedFiles] = useState<ProcessedData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [visibleSerials, setVisibleSerials] = useState<Set<string>>(new Set());

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
    const element = document.getElementById('report-content');
    if (!element) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#000000',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('DC_Energy_Cell_Report.pdf');
    } catch (error) {
      console.error('Failed to export PDF', error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadCSV = () => {
    if (processedFiles.length === 0) return;

    const headers = ['File Name', 'Serial Number', 'Discharge Capacity (Ah)'];
    const csvContent = [
      headers.join(','),
      ...processedFiles.map(file => 
        `"${file.fileName}","${file.serialNumber}","${file.dischargeCapacity}"`
      )
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
            <div className="w-8 h-8 rounded bg-[#65913B] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">DC Energy <span className="text-[#7CAC3F]">|</span> Prismatic Cell Processor</h1>
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
          {isProcessing && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-[#7CAC3F]">
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
              
              <div className="flex-1 min-h-[500px] w-full">
                {selectedSection ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {filteredFiles.map((file, index) => {
                        const data = file.sections[selectedSection];
                        if (!data || data.length === 0) return null;
                        const color = serialNumberColors[file.serialNumber] || colors[0];
                        return (
                          <Line
                            key={file.fileName}
                            data={data}
                            type="monotone"
                            dataKey="capacity"
                            name={file.serialNumber !== 'Unknown' ? file.serialNumber : file.fileName}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, fill: color, stroke: '#000' }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[#6b7280]">
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
                      <th className="px-4 py-3 font-medium">Capacity (Ah)</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#414142]">
                    {filteredFiles.map((file, index) => (
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
                    ))}
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
