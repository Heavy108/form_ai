'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool, Upload, Type, X, RotateCcw, Check, Sparkles, Image as ImageIcon
} from 'lucide-react';
import styles from '@/css/signatureModal.module.css';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, mode: 'draw' | 'upload' | 'text') => void;
  initialDataUrl?: string;
  initialMode?: 'draw' | 'upload' | 'text';
}

const INK_COLORS = [
  { name: 'Classic Black', value: '#000000' },
  { name: 'Signature Navy', value: '#1664D9' },
  { name: 'Charcoal Slate', value: '#334155' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 1.8 },
  { label: 'Medium', value: 2.8 },
  { label: 'Bold', value: 4.2 },
];

const SCRIPT_FONTS = [
  { id: 'dancing', name: 'Dancing Script', font: "'Dancing Script', cursive" },
  { id: 'caveat', name: 'Caveat', font: "'Caveat', cursive" },
  { id: 'great_vibes', name: 'Great Vibes', font: "'Great Vibes', cursive" },
  { id: 'brush', name: 'Brush Script', font: "'Brush Script MT', cursive" },
];

export default function SignatureModal({
  isOpen,
  onClose,
  onSave,
  initialDataUrl,
  initialMode = 'draw',
}: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload' | 'text'>(initialMode);

  // Draw Tab state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [inkColor, setInkColor] = useState(INK_COLORS[0].value); // #000000
  const [strokeWidth, setStrokeWidth] = useState(2.8);
  const strokeHistoryRef = useRef<ImageData[]>([]);

  // Upload Tab state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);

  // Type Tab state
  const [typedName, setTypedName] = useState('John Doe');
  const [selectedFont, setSelectedFont] = useState(SCRIPT_FONTS[0]);

  // Setup Canvas high DPI
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;

    // Save blank state in history
    strokeHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, [inkColor, strokeWidth]);

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, initCanvas]);

  if (!isOpen) return null;

  // Drawing mouse & touch handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.closePath();
    // Save history snapshot for undo
    strokeHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    strokeHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  const undoLastStroke = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (strokeHistoryRef.current.length > 1) {
      strokeHistoryRef.current.pop();
      const prev = strokeHistoryRef.current[strokeHistoryRef.current.length - 1];
      ctx.putImageData(prev, 0, 0);
      if (strokeHistoryRef.current.length === 1) {
        setHasDrawn(false);
      }
    }
  };

  // Upload handler with smart transparency threshold
  const processUploadedImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      if (!removeBg) {
        setUploadedImage(result);
        return;
      }

      // Remove white/light paper background
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) {
          setUploadedImage(result);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Brightness threshold: if pixel is light/whiteish, make it transparent
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0;
          } else {
            // Boost dark signature ink
            const alpha = Math.min(255, 255 - (r + g + b) / 3);
            if (alpha > 40) {
              data[i + 3] = 255;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setUploadedImage(offCanvas.toDataURL('image/png'));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Render Typed signature to PNG
  const renderTypedSignature = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `68px ${selectedFont.font}`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName || 'Signature', canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  };

  const handleSave = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl, 'draw');
      onClose();
    } else if (activeTab === 'upload') {
      if (!uploadedImage) return;
      onSave(uploadedImage, 'upload');
      onClose();
    } else if (activeTab === 'text') {
      const dataUrl = renderTypedSignature();
      onSave(dataUrl, 'text');
      onClose();
    }
  };

  const isSaveDisabled =
    (activeTab === 'draw' && !hasDrawn) ||
    (activeTab === 'upload' && !uploadedImage) ||
    (activeTab === 'text' && !typedName.trim());

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleRow}>
            <div className={styles.headerIconBadge}>
              <PenTool size={18} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>Signature Field</h3>
              <p className={styles.modalSubtitle}>Sign document, upload photo, or type signature</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'draw' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('draw')}
          >
            <PenTool size={15} />
            <span>Draw</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={15} />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'text' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <Type size={15} />
            <span>Type Name</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className={styles.modalBody}>
          {/* 1. DRAW TAB */}
          {activeTab === 'draw' && (
            <>
              <div className={styles.canvasWrapper}>
                <canvas
                  ref={canvasRef}
                  className={styles.signatureCanvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                  <div className={styles.baselineGuide}>
                    <span className={styles.baselineText}>✍️ Draw your signature inside this box</span>
                    <span className={styles.baselineIcon}>✕ ────────────</span>
                  </div>
                )}
              </div>

              <div className={styles.canvasToolbar}>
                {/* Ink Color Picker */}
                <div className={styles.toolGroup}>
                  <span className={styles.toolLabel}>Ink Color:</span>
                  {INK_COLORS.map((c) => (
                    <div
                      key={c.value}
                      className={`${styles.colorDot} ${inkColor === c.value ? styles.colorDotActive : ''}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setInkColor(c.value)}
                      title={c.name}
                    />
                  ))}
                </div>

                {/* Stroke Width */}
                <div className={styles.toolGroup}>
                  <span className={styles.toolLabel}>Thickness:</span>
                  {STROKE_WIDTHS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className={`${styles.strokeWidthBtn} ${strokeWidth === s.value ? styles.strokeWidthBtnActive : ''}`}
                      onClick={() => setStrokeWidth(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Actions: Undo & Clear */}
                <div className={styles.toolGroup}>
                  {strokeHistoryRef.current.length > 1 && (
                    <button
                      type="button"
                      onClick={undoLastStroke}
                      className={styles.strokeWidthBtn}
                      title="Undo stroke"
                    >
                      <RotateCcw size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      Undo
                    </button>
                  )}
                  <button type="button" onClick={clearCanvas} className={styles.clearBtn}>
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 2. UPLOAD TAB */}
          {activeTab === 'upload' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processUploadedImage(f);
                }}
              />

              {!uploadedImage ? (
                <div
                  className={styles.uploadDropzone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) processUploadedImage(f);
                  }}
                >
                  <div className={styles.uploadIconCircle}>
                    <Upload size={22} />
                  </div>
                  <p className={styles.uploadMainText}>Click or drag & drop signature image</p>
                  <p className={styles.uploadSubText}>Supports PNG, JPG, or SVG (white paper background removed automatically)</p>
                </div>
              ) : (
                <div className={styles.uploadedPreviewBox}>
                  <img src={uploadedImage} alt="Uploaded signature" className={styles.uploadedImage} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(e) => setRemoveBg(e.target.checked)}
                      />
                      <span>Make background transparent</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={styles.strokeWidthBtn}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadedImage(null)}
                      className={styles.clearBtn}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 3. TYPE TAB */}
          {activeTab === 'text' && (
            <div className={styles.typeInputGroup}>
              <label className={styles.toolLabel}>Full Name or Initials</label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name..."
                className={styles.typeInput}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span className={styles.toolLabel}>Ink Color:</span>
                {INK_COLORS.map((c) => (
                  <div
                    key={c.value}
                    className={`${styles.colorDot} ${inkColor === c.value ? styles.colorDotActive : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setInkColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>

              <label className={styles.toolLabel} style={{ marginTop: 8 }}>Choose Signature Style</label>
              <div className={styles.fontPickerGrid}>
                {SCRIPT_FONTS.map((font) => (
                  <div
                    key={font.id}
                    className={`${styles.fontOptionCard} ${selectedFont.id === font.id ? styles.fontOptionCardActive : ''}`}
                    onClick={() => setSelectedFont(font)}
                  >
                    <span className={styles.fontSample} style={{ fontFamily: font.font, color: inkColor }}>
                      {typedName || 'Signature'}
                    </span>
                    <span className={styles.fontName}>{font.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={styles.saveBtn}
          >
            <Check size={16} />
            <span>Apply Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
}
