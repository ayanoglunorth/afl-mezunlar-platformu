'use client';

import { useState, useRef } from 'react';
import { SiteNotice } from '@/components/ui/SiteNotice';

type RegistryType = 'alumni' | 'active-students';

interface AlumniParsedRow {
  sequenceNumber: number;
  studentNumber: string;
  fullName: string;
  fieldOfStudy: string;
  graduationYear: number;
}

interface ActiveStudentParsedRow {
  studentNumber: string;
  schoolNumber: string;
  fullName: string;
  currentGrade: string;
  classSection: string;
  expectedGraduationYear: number;
}

type ParsedRow = AlumniParsedRow | ActiveStudentParsedRow;

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

function isActiveStudentRow(row: ParsedRow): row is ActiveStudentParsedRow {
  return 'schoolNumber' in row;
}

export default function CSVUploadPage() {
  const [registryType, setRegistryType] = useState<RegistryType>('alumni');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(selectedFile: File, selectedRegistryType = registryType) {
    setFile(selectedFile);
    setResult(null);
    setErrors([]);
    setPreview([]);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('action', 'preview');
    formData.append('registryType', selectedRegistryType);

    const res = await fetch('/api/csv/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      setPreview(data.data);
      setErrors(data.errors || []);
    } else {
      setErrors([{ row: 0, message: data.error }]);
    }
  }

  function handleRegistryTypeChange(nextType: RegistryType) {
    setRegistryType(nextType);
    setResult(null);
    setErrors([]);
    setPreview([]);
    setFile(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'upload');
    formData.append('registryType', registryType);

    const res = await fetch('/api/csv/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      setResult(data.result);
      setPreview([]);
      setFile(null);
    } else {
      setErrors([{ row: 0, message: data.error }]);
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">CSV / Excel Yükle</h1>
        <p className="text-surface-500 mt-1">Mezun veya aktif öğrenci kayıt verilerini yükleyin</p>
      </div>

      <div className="inline-flex rounded-lg border border-surface-200 bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => handleRegistryTypeChange('alumni')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${registryType === 'alumni' ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-50'}`}
        >
          Mezun verisi
        </button>
        <button
          type="button"
          onClick={() => handleRegistryTypeChange('active-students')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${registryType === 'active-students' ? 'bg-blue-500 text-white' : 'text-surface-600 hover:bg-surface-50'}`}
        >
          Aktif öğrenci verisi
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`card cursor-pointer text-center py-12 transition-all duration-200 ${
          dragActive ? 'border-brand-500 bg-brand-500/5' : 'hover:border-surface-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.ods"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-sm font-medium text-surface-900 mt-4">
          {file ? file.name : 'Dosyayı sürükle veya tıkla'}
        </p>
        <p className="text-xs text-surface-500 mt-1">CSV, Excel veya ODS formatı desteklenir</p>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-surface-900">Beklenen Format</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-surface-500 border-b border-surface-200">
                {registryType === 'active-students' ? (
                  <>
                    <th className="pb-2 pr-4 font-medium">SINIF</th>
                    <th className="pb-2 pr-4 font-medium">ŞUBE</th>
                    <th className="pb-2 pr-4 font-medium">MEZUN YILI</th>
                    <th className="pb-2 pr-4 font-medium">Öğrenci No</th>
                    <th className="pb-2 pr-4 font-medium">Adı</th>
                    <th className="pb-2 font-medium">Soyadı</th>
                  </>
                ) : (
                  <>
                    <th className="pb-2 pr-4 font-medium">Sıra</th>
                    <th className="pb-2 pr-4 font-medium">Öğr. No</th>
                    <th className="pb-2 pr-4 font-medium">Adı Soyadı</th>
                    <th className="pb-2 font-medium">Alan / Dal</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="text-surface-600">
                {registryType === 'active-students' ? (
                  <>
                    <td className="py-2 pr-4">10</td>
                    <td className="py-2 pr-4">A</td>
                    <td className="py-2 pr-4">2029</td>
                    <td className="py-2 pr-4">11</td>
                    <td className="py-2 pr-4">ADI</td>
                    <td className="py-2">SOYADI</td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-4">4.0</td>
                    <td className="py-2 pr-4">202234.0</td>
                    <td className="py-2 pr-4">KUZEY SINAY</td>
                    <td className="py-2">FEN BİLİMLERİ ALANI (FEN LİS.) / DAL YOK</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {errors.length > 0 && (
        <SiteNotice
          type="error"
          message={errors.map((err) => `${err.row > 0 ? `Satır ${err.row}: ` : ''}${err.message}`).join('\n')}
          onDismiss={() => setErrors([])}
        />
      )}

      {preview.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-surface-900">
              Önizleme <span className="text-surface-500 font-normal">({preview.length} kayıt)</span>
            </h3>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? 'Yükleniyor...' : `${preview.length} Kaydı Yükle`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50">
                <tr className="text-left text-xs text-surface-500 border-b border-surface-200">
                  {registryType === 'active-students' ? (
                    <>
                      <th className="pb-2 pr-4 font-medium">Tam No</th>
                      <th className="pb-2 pr-4 font-medium">Okul No</th>
                      <th className="pb-2 pr-4 font-medium">Ad Soyad</th>
                      <th className="pb-2 pr-4 font-medium">Sınıf</th>
                      <th className="pb-2 pr-4 font-medium">Şube</th>
                      <th className="pb-2 font-medium">Mezuniyet</th>
                    </>
                  ) : (
                    <>
                      <th className="pb-2 pr-4 font-medium">#</th>
                      <th className="pb-2 pr-4 font-medium">Öğr. No</th>
                      <th className="pb-2 pr-4 font-medium">Ad Soyad</th>
                      <th className="pb-2 pr-4 font-medium">Alan</th>
                      <th className="pb-2 font-medium">Mezuniyet</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    {isActiveStudentRow(row) ? (
                      <>
                        <td className="py-2 pr-4 text-surface-700">{row.studentNumber}</td>
                        <td className="py-2 pr-4 text-surface-700">{row.schoolNumber}</td>
                        <td className="py-2 pr-4 text-surface-900 font-medium">{row.fullName}</td>
                        <td className="py-2 pr-4 text-surface-700">{row.currentGrade}</td>
                        <td className="py-2 pr-4 text-surface-700">{row.classSection}</td>
                        <td className="py-2 text-surface-700">{row.expectedGraduationYear}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-4 text-surface-500">{row.sequenceNumber}</td>
                        <td className="py-2 pr-4 text-surface-700">{row.studentNumber}</td>
                        <td className="py-2 pr-4 text-surface-900 font-medium">{row.fullName}</td>
                        <td className="py-2 pr-4 text-surface-500 text-xs max-w-[200px] truncate">{row.fieldOfStudy}</td>
                        <td className="py-2 text-surface-700">{row.graduationYear}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="text-xs text-surface-500 mt-2 text-center">
                ...ve {preview.length - 50} kayıt daha
              </p>
            )}
          </div>
        </div>
      )}

      {result && (
        <SiteNotice
          type={result.errors.length > 0 ? 'warning' : 'success'}
          message={[
            `${result.inserted} kayıt eklendi/güncellendi, ${result.skipped} atlandı.`,
            ...result.errors.map((err) => `Satır ${err.row}: ${err.message}`),
          ].join('\n')}
          onDismiss={() => setResult(null)}
        />
      )}
    </div>
  );
}
