'use client';

import React, { useRef, useState } from 'react';
import {
  FileText, CheckCircle2, Settings, ChevronDown, ChevronUp,
  Sliders, Sparkles, ArrowRight
} from 'lucide-react';
import styles from '@/css/uploadScreen.module.css';

interface UploadScreenProps {
  file: File | null;
  setFile: (file: File | null) => void;
  onDetect: () => void;
  model: string; setModel: (v: string) => void;
  keepExistingFields: boolean; setKeepExistingFields: (v: boolean) => void;
  useSignatureFields: boolean; setUseSignatureFields: (v: boolean) => void;
  imageSize: number; setImageSize: (v: number) => void;
  confidence: number; setConfidence: (v: number) => void;
  fast: boolean; setFast: (v: boolean) => void;
  device: string; setDevice: (v: string) => void;
  onLoadSample?: () => void;
}

export default function UploadScreen({
  file, setFile, onDetect,
  model, setModel, keepExistingFields, setKeepExistingFields,
  useSignatureFields, setUseSignatureFields, imageSize, setImageSize,
  confidence, setConfidence, fast, setFast, device, setDevice,
  onLoadSample
}: UploadScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type.startsWith('image/'))) {
      setFile(droppedFile);
    } else {
      alert("Please upload a valid PDF or Image file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.type.startsWith('image/'))) {
      setFile(selectedFile);
    }
  };

  return (
    <div className={styles.uploadCard}>
      {/* 3D-styled Folder & Document Illustration */}
      <div className={styles.illustrationWrapper}>
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          {/* Subtle glow shadow */}
          <ellipse cx="60" cy="100" rx="36" ry="7" fill="#2563eb" fillOpacity="0.18" />

          {/* Sparkles / Stars above */}
          <path d="M72 16L74 21L79 23L74 25L72 30L70 25L65 23L70 21L72 16Z" fill="#38bdf8" />
          <path d="M88 28L89 31L92 32L89 33L88 36L87 33L84 32L87 31L88 28Z" fill="#60a5fa" />
          <path d="M40 22L41 24.5L43.5 25.5L41 26.5L40 29L39 26.5L36.5 25.5L39 24.5L40 22Z" fill="#38bdf8" />

          {/* Back Folder Flap */}
          <path
            d="M26 44C26 40.6863 28.6863 38 32 38H50L56 44H90C93.3137 44 96 46.6863 96 50V88C96 91.3137 93.3137 94 90 94H26V44Z"
            fill="#1d4ed8"
          />

          {/* Document Sheet Rising Out */}
          <g filter="drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.08))">
            <rect x="42" y="24" width="38" height="52" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
            {/* Document Lines */}
            <rect x="48" y="34" width="26" height="3" rx="1.5" fill="#93c5fd" />
            <rect x="48" y="41" width="22" height="2.5" rx="1.25" fill="#cbd5e1" />
            <rect x="48" y="47" width="24" height="2.5" rx="1.25" fill="#cbd5e1" />
            <rect x="48" y="53" width="16" height="2.5" rx="1.25" fill="#cbd5e1" />
          </g>

          {/* Front Folder Body with Gradient */}
          <path
            d="M24 55C24 51.6863 26.6863 49 30 49H92C95.3137 49 98 51.6863 98 55V88C98 92.4183 94.4183 96 90 96H28C24.6863 96 24 93.3137 24 88V55Z"
            fill="url(#folderGradient)"
          />

          {/* Upload Arrow Badge on Folder Front */}
          <circle cx="61" cy="74" r="10" fill="#ffffff" fillOpacity="0.9" filter="drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.12))" />
          <path
            d="M61 68L57 73H59.5V79H62.5V73H65L61 68Z"
            fill="#2563eb"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="folderGradient" x1="24" y1="49" x2="98" y2="96" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.4" stopColor="#2563eb" />
              <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Main Title & Subtitle */}
      <h1 className={styles.cardTitle}>Fill any form, even if it isn&apos;t fillable.</h1>
      <p className={styles.cardSubtitle}>
        Upload a PDF, image, or scanned form. We&apos;ll detect the fields so you can fill, sign, and download it easily.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!file) fileInputRef.current?.click();
        }}
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept=".pdf, image/*"
          className={styles.fileInput}
          title=""
        />

        {!file ? (
          <>
            {/* Center File Icon with plus */}
            <div className={styles.fileIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>

            <p className={styles.dropTitle}>Drag and drop your file here</p>
            <p className={styles.dropSubtitle}>or browse from your device.</p>

            <button
              type="button"
              className={styles.chooseFileButton}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose File
            </button>

            {onLoadSample && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}
                style={{
                  marginTop: 10,
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                }}
              >
                <span>✨ Try Sample Passport Application Form</span>
              </button>
            )}

            {/* Decorative PDF Badge on bottom right */}
            <div className={styles.floatingPdfBadge}>
              <div className={styles.pdfCardIcon}>
                <div className={styles.pdfRedTag}>PDF</div>
              </div>
              <svg className={styles.pdfCursor} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 2.5L10 20L13.5 13.5L20 10L4.5 2.5Z" />
              </svg>
            </div>
          </>
        ) : (
          <div className={styles.fileSelectedBox}>
            <div className={styles.fileMeta}>
              <CheckCircle2 style={{ width: 24, height: 24, color: '#10b981', flexShrink: 0 }} />
              <div>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileSize}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className={styles.changeFileBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                Change file
              </button>

              <button
                type="button"
                className={styles.detectButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onDetect();
                }}
              >
                <span>Detect Fields</span>
                <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Inference Settings */}
      <div className={styles.settingsAccordion}>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={styles.settingsToggleBtn}
        >
          <Sliders style={{ width: 13, height: 13 }} />
          <span>Inference Settings</span>
          {showSettings ? (
            <ChevronUp style={{ width: 14, height: 14 }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14 }} />
          )}
        </button>

        {showSettings && (
          <div className={styles.settingsContent}>
            {/* Model */}
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={styles.settingSelect}
              >
                <option value="FFDNet-L">FFDNet-L (Default, High accuracy)</option>
                <option value="FFDNet-S">FFDNet-S (Fast)</option>
              </select>
            </div>

            {/* Device */}
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Device</label>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className={styles.settingSelect}
              >
                <option value="cpu">CPU</option>
                <option value="cuda">CUDA (GPU)</option>
                <option value="mps">MPS (Apple Silicon)</option>
              </select>
            </div>

            {/* Image Size */}
            <div className={styles.settingGroup}>
              <div className={styles.settingSliderHeader}>
                <label className={styles.settingLabel}>Image Size</label>
                <span className={styles.settingSliderVal}>{imageSize}px</span>
              </div>
              <input
                type="range"
                min="800" max="2400" step="16"
                value={imageSize}
                onChange={(e) => setImageSize(parseInt(e.target.value, 10))}
                className={styles.settingSlider}
              />
            </div>

            {/* Confidence */}
            <div className={styles.settingGroup}>
              <div className={styles.settingSliderHeader}>
                <label className={styles.settingLabel}>Confidence</label>
                <span className={styles.settingSliderVal}>{confidence}</span>
              </div>
              <input
                type="range"
                min="0.1" max="0.9" step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className={styles.settingSlider}
              />
            </div>

            {/* Switches */}
            <div
              className={styles.switchRow}
              onClick={() => setKeepExistingFields(!keepExistingFields)}
            >
              <span className={styles.switchLabel}>Keep Existing Fields</span>
              <div className={`${styles.switchTrack} ${keepExistingFields ? styles.switchTrackActive : ''}`}>
                <div className={`${styles.switchThumb} ${keepExistingFields ? styles.switchThumbActive : ''}`} />
              </div>
            </div>

            <div
              className={styles.switchRow}
              onClick={() => setUseSignatureFields(!useSignatureFields)}
            >
              <span className={styles.switchLabel}>Signature Fields</span>
              <div className={`${styles.switchTrack} ${useSignatureFields ? styles.switchTrackActive : ''}`}>
                <div className={`${styles.switchThumb} ${useSignatureFields ? styles.switchThumbActive : ''}`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
