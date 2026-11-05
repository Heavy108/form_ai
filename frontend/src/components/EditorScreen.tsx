'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Download, Loader2, ChevronLeft, ChevronRight, ChevronDown,
  Type, CheckSquare, PenTool, Trash2, Calendar, Circle,
  Image as ImageIcon, Edit3, Hand, MousePointer, Sparkles, Check,
  ArrowLeft, Square, CheckCircle2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Minus, Plus
} from 'lucide-react';
import { DetectionResult, DetectedField } from '@/types';
import CalendarDropdown from '@/components/CalendarDropdown';
import SignatureModal from '@/components/SignatureModal';
import styles from '@/css/editorScreen.module.css';

interface EditorScreenProps {
  detectionResult: DetectionResult;
  fields: DetectedField[];
  setFields: React.Dispatch<React.SetStateAction<DetectedField[]>>;
  resetApp: () => void;
  handleDownload: (options?: { flatten?: boolean; docName?: string }) => void;
  isDownloading: boolean;
  initialDocName?: string;
}

const COLOR_PALETTE = [
  '#000000', // Black (Default)
  '#1664D9', // Primary Blue
  '#475569', // Dark Slate
  '#94a3b8', // Silver / Light Grey
  '#38bdf8', // Sky Blue
  '#ef4444', // Red
  '#f59e0b', // Amber / Orange
  '#10b981', // Emerald Green
  '#8b5cf6', // Violet / Purple
];

const FONT_OPTIONS = [
  'Inter', 'Helvetica', 'Arial', 'Times New Roman', 'Georgia',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Roboto', 'Open Sans',
];

const DEFAULT_LABELS: Record<string, string> = {
  TextBox: 'Text Field',
  DateField: 'Date of birth',
  ChoiceButton: 'Types of application',
  RadioButton: 'Select option',
  Signature: 'Signature field',
  ImageUpload: 'Passport photo',
};

const PRESET_PASSPORT_LABELS: Record<number, string> = {
  0: 'Full name',
  1: 'Date of birth',
  2: 'Gender',
  3: 'Passport photo',
  4: 'Address line 1',
  5: 'Address line 2',
  6: 'City',
  7: 'State',
  8: 'ZIP code',
  9: 'Phone number',
  10: 'Email address',
  11: 'Declaration',
  12: 'Signature',
  13: 'Types of application',
  14: 'Place of birth',
  15: 'Nationality',
};

export default function EditorScreen({
  detectionResult,
  fields,
  setFields,
  resetApp,
  handleDownload,
  isDownloading,
  initialDocName = 'Passport Application Form',
}: EditorScreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeCalendarFieldId, setActiveCalendarFieldId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'pages' | 'fields'>('fields');

  // Signature modal & Image upload state
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);
  const [pendingImageFieldId, setPendingImageFieldId] = useState<string | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  const triggerImageUpload = (fieldId: string) => {
    setPendingImageFieldId(fieldId);
    imageUploadInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && pendingImageFieldId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          setFields(prev =>
            prev.map(field => field.id === pendingImageFieldId ? { ...field, imageData: dataUrl } : field)
          );
        }
      };
      reader.readAsDataURL(f);
    }
    if (e.target) e.target.value = '';
  };

  // Document meta
  const [docName, setDocName] = useState(initialDocName);
  const [language, setLanguage] = useState('English');
  const [pageSize, setPageSize] = useState('A4 (210 * 297 mm)');
  const docNameInputRef = useRef<HTMLInputElement>(null);

  // Canvas zoom, pan & tool state
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const centerWorkspaceRef = useRef<HTMLDivElement>(null);

  // Dragging & Resizing state
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    fieldId: string;
    handle?: string;
    startX: number;
    startY: number;
    origField: DetectedField;
  } | null>(null);

  // Drawing new field state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [newFieldType, setNewFieldType] = useState<DetectedField['type']>('TextBox');

  const canvasRef = useRef<HTMLDivElement>(null);

  const deleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    if (activeCalendarFieldId === fieldId) setActiveCalendarFieldId(null);
  };

  const changeFieldType = (fieldId: string, newType: DetectedField['type']) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const updated: DetectedField = {
          ...f,
          type: newType,
        };
        if (newType === 'ChoiceButton' || newType === 'RadioButton') {
          if (updated.checked === undefined) updated.checked = false;
        }
        if (newType === 'Signature' && !updated.signatureMode) {
          updated.signatureMode = 'draw';
        }
        return updated;
      })
    );
  };

  const updateFieldProperty = (fieldId: string, prop: keyof DetectedField, value: any) => {
    setFields(prev =>
      prev.map(f => (f.id === fieldId ? { ...f, [prop]: value } : f))
    );
  };

  const getFieldLabel = (field: DetectedField, index: number): string => {
    if (field.label) return field.label;
    if (PRESET_PASSPORT_LABELS[index]) return PRESET_PASSPORT_LABELS[index];
    return DEFAULT_LABELS[field.type] || `Field ${index + 1}`;
  };

  const currentPageFields = fields.filter(f => f.page === currentPage);
  const totalPages = detectionResult.pages.length;
  const currentPageImage = detectionResult.pages[currentPage];
  const selectedField = fields.find(f => f.id === selectedFieldId);

  // Option / checkbox to use the same color for all fields
  const [useSameColorForAll, setUseSameColorForAll] = useState(false);

  const handleToggleSameColor = (checked: boolean) => {
    setUseSameColorForAll(checked);
    if (checked) {
      const activeColor = selectedField?.color || '#000000';
      setFields(prev => prev.map(f => ({ ...f, color: activeColor })));
    }
  };

  const handleColorChange = (newColor: string) => {
    if (useSameColorForAll) {
      setFields(prev => prev.map(f => ({ ...f, color: newColor })));
    } else if (selectedField) {
      updateFieldProperty(selectedField.id, 'color', newColor);
    }
  };

  const getRelativePos = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isDrawing) {
      const pos = getRelativePos(e);
      if (pos) {
        setDrawStart(pos);
        setDrawCurrent(pos);
      }
      return;
    }
    setSelectedFieldId(null);
    setActiveCalendarFieldId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDrawing && drawStart) {
      const pos = getRelativePos(e);
      if (pos) setDrawCurrent(pos);
      return;
    }

    if (dragState) {
      const pos = getRelativePos(e);
      if (!pos) return;

      const dx = pos.x - dragState.startX;
      const dy = pos.y - dragState.startY;
      const orig = dragState.origField;

      if (dragState.type === 'move') {
        const w = orig.x1 - orig.x0;
        const h = orig.y1 - orig.y0;
        setFields(prev =>
          prev.map(f =>
            f.id === dragState.fieldId
              ? {
                  ...f,
                  x0: Math.max(0, Math.min(1 - w, orig.x0 + dx)),
                  y0: Math.max(0, Math.min(1 - h, orig.y0 + dy)),
                  x1: Math.max(w, Math.min(1, orig.x1 + dx)),
                  y1: Math.max(h, Math.min(1, orig.y1 + dy)),
                }
              : f
          )
        );
      } else if (dragState.type === 'resize') {
        const handle = dragState.handle!;
        setFields(prev =>
          prev.map(f => {
            if (f.id !== dragState.fieldId) return f;
            const updated = { ...f };
            if (handle.includes('e')) updated.x1 = Math.max(orig.x0 + 0.01, Math.min(1, orig.x1 + dx));
            if (handle.includes('w')) updated.x0 = Math.max(0, Math.min(orig.x1 - 0.01, orig.x0 + dx));
            if (handle.includes('s')) updated.y1 = Math.max(orig.y0 + 0.01, Math.min(1, orig.y1 + dy));
            if (handle.includes('n')) updated.y0 = Math.max(0, Math.min(orig.y1 - 0.01, orig.y0 + dy));
            return updated;
          })
        );
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && drawStart && drawCurrent) {
      const x0 = Math.min(drawStart.x, drawCurrent.x);
      const y0 = Math.min(drawStart.y, drawCurrent.y);
      const x1 = Math.max(drawStart.x, drawCurrent.x);
      const y1 = Math.max(drawStart.y, drawCurrent.y);

      if (x1 - x0 > 0.005 && y1 - y0 > 0.005) {
        const newField: DetectedField = {
          id: `field_${Date.now().toString().slice(-4)}`,
          type: newFieldType,
          page: currentPage,
          x0,
          y0,
          x1,
          y1,
          color: useSameColorForAll && selectedField?.color ? selectedField.color : '#000000',
          fontSize: 12,
          label: DEFAULT_LABELS[newFieldType] || 'New Field',
        };
        setFields(prev => [...prev, newField]);
        setSelectedFieldId(newField.id);
      }

      setDrawStart(null);
      setDrawCurrent(null);
      setIsDrawing(false);
      return;
    }

    setDragState(null);
  };

  const startDrag = (e: React.MouseEvent, fieldId: string, type: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = getRelativePos(e);
    if (!pos) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    setSelectedFieldId(fieldId);
    setDragState({
      type,
      fieldId,
      handle,
      startX: pos.x,
      startY: pos.y,
      origField: { ...field },
    });
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState) setDragState(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState]);

  const isPanningMode = activeTool === 'pan' || isSpacePressed;

  // Reset pan when page changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [currentPage]);

  // Spacebar (hold to pan), H (Hand), V (Select), Delete, Escape, Ctrl+0 shortcuts (Figma style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Delete' && selectedFieldId) {
        deleteField(selectedFieldId);
      }
      if (e.key === 'Escape') {
        setSelectedFieldId(null);
        setActiveCalendarFieldId(null);
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('pan');
      }
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoomLevel(100);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedFieldId]);

  // Trackpad 2-finger pan, mouse wheel scroll, and Ctrl + wheel zoom (Figma style)
  useEffect(() => {
    const container = centerWorkspaceRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // Don't intercept wheel if inside calendar dropdown
      if ((e.target as HTMLElement)?.closest(`.${styles.calendarDropdownCard}`)) return;

      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom smoothly centered
        const delta = e.deltaY < 0 ? 8 : -8;
        setZoomLevel(z => Math.max(40, Math.min(250, z + delta)));
      } else {
        // Pan smoothly in 2D
        setPanOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Handle workspace mouse down for panning
  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    // Pan on middle mouse button (button 1) OR left click (button 0) when pan mode is active or Space held
    if (e.button === 1 || (e.button === 0 && isPanningMode)) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: panOffset.x,
        origY: panOffset.y,
      };
    }
  };

  // Window-level mouse move and mouse up for flawless pan tracking
  useEffect(() => {
    if (!isPanning) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPanOffset({
        x: panStartRef.current.origX + dx,
        y: panStartRef.current.origY + dy,
      });
    };

    const onMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning]);

  return (
    <div className={styles.editorContainer}>
      {/* --- Top Header Bar --- */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            onClick={resetApp}
            className={styles.backBtn}
            title="Back to Upload"
          >
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>

          <div className={styles.docIconBadge}>
            <div className={styles.docIconBarLong} />
            <div className={styles.docIconBarLong} />
            <div className={styles.docIconBarMed} />
          </div>

          <div className={styles.docTitleGroup}>
            <input
              ref={docNameInputRef}
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className={styles.docTitleInput}
            />
            <span
              className={styles.docEditPencil}
              onClick={() => docNameInputRef.current?.focus()}
              title="Edit document name"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Edit3 size={14} />
            </span>
          </div>
        </div>

        <div className={styles.topBarRight}>
          <button
            type="button"
            onClick={() => handleDownload({ flatten: true, docName })}
            disabled={isDownloading || fields.length === 0}
            className={styles.downloadPrimaryBtn}
            title="Download clean PDF"
          >
            {isDownloading ? (
              <>
                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download style={{ width: 16, height: 16 }} />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* --- Main 3-Column Workspace --- */}
      <div className={styles.editorWorkspace}>
        {/* === Left Sidebar: Pages / Fields Tabs === */}
        <aside className={styles.leftSidebar}>
          <div className={styles.tabsHeader}>
            <button
              type="button"
              onClick={() => setLeftTab('pages')}
              className={`${styles.tabBtn} ${leftTab === 'pages' ? styles.tabBtnActive : ''}`}
            >
              Pages
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('fields')}
              className={`${styles.tabBtn} ${leftTab === 'fields' ? styles.tabBtnActive : ''}`}
            >
              Fields
            </button>
          </div>

          {leftTab === 'pages' ? (
            <div className={styles.thumbnailsScroll}>
              {detectionResult.pages.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={styles.thumbnailItem}
                >
                  <div
                    className={`
                      ${styles.thumbnailCard}
                      ${currentPage === idx ? styles.thumbnailCardActive : ''}
                    `}
                  >
                    <img
                      src={p.data_url}
                      alt={`Page ${idx + 1}`}
                      className={styles.thumbnailImg}
                    />
                  </div>
                  <span
                    className={`
                      ${styles.pageNumberBadge}
                      ${currentPage === idx ? styles.pageNumberBadgeActive : ''}
                    `}
                  >
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.fieldsTabScroll}>
              <div className={styles.fieldsCountHeader}>
                {currentPageFields.length} fields detected
              </div>

              {currentPageFields.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8', padding: 12, textAlign: 'center' }}>
                  No fields on Page {currentPage + 1}
                </p>
              ) : (
                currentPageFields.map((f, index) => {
                  const label = getFieldLabel(f, index);
                  const isSelected = selectedFieldId === f.id;

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`
                        ${styles.detectedFieldCard}
                        ${isSelected ? styles.detectedFieldCardActive : ''}
                      `}
                    >
                      <div className={styles.fieldIndexBadge}>
                        {index + 1}
                      </div>

                      <div className={styles.fieldInfo}>
                        <div className={styles.fieldNameText}>{label}</div>
                        <div className={styles.fieldTypeSub}>
                          {f.type === 'TextBox' && <Type style={{ width: 12, height: 12 }} />}
                          {f.type === 'DateField' && <Calendar style={{ width: 12, height: 12 }} />}
                          {f.type === 'ChoiceButton' && <CheckSquare style={{ width: 12, height: 12 }} />}
                          {f.type === 'RadioButton' && <Circle style={{ width: 12, height: 12 }} />}
                          {f.type === 'Signature' && <PenTool style={{ width: 12, height: 12 }} />}
                          {f.type === 'ImageUpload' && <ImageIcon style={{ width: 12, height: 12 }} />}
                          <span>
                            {f.type === 'ChoiceButton'
                              ? 'Checkbox'
                              : f.type === 'TextBox'
                              ? 'Text Field'
                              : f.type === 'Signature'
                              ? 'Signature field'
                              : f.type === 'ImageUpload'
                              ? 'Image upload'
                              : f.type === 'DateField'
                              ? 'Date Field'
                              : f.type === 'RadioButton'
                              ? 'Radio button'
                              : f.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </aside>

        {/* === Center Workspace: Document Paper & Floating Bar === */}
        <main
          ref={centerWorkspaceRef}
          className={styles.centerWorkspace}
          style={{
            cursor: isPanning
              ? 'grabbing'
              : isPanningMode
              ? 'grab'
              : isDrawing
              ? 'crosshair'
              : 'default',
          }}
          onMouseDown={handleWorkspaceMouseDown}
        >
          {/* Floating Canvas Toolbar */}
          <div className={styles.canvasFloatingBar}>
            {/* Page Navigation */}
            <div className={styles.toolGroup}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className={styles.iconToolBtn}
                title="Previous Page"
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </button>
              <span className={styles.toolText}>
                {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className={styles.iconToolBtn}
                title="Next Page"
              >
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div className={styles.toolDivider} />

            {/* Zoom Controls */}
            <div className={styles.toolGroup}>
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.min(250, z + 10))}
                className={styles.iconToolBtn}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(100);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className={styles.toolTextBtn}
                title="Click to reset zoom & pan (100%)"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.max(40, z - 10))}
                className={styles.iconToolBtn}
                title="Zoom Out"
              >
                -
              </button>
            </div>

            <div className={styles.toolDivider} />

            {/* Interaction Modes: Pan & Select */}
            <div className={styles.toolGroup}>
              <button
                type="button"
                onClick={() => setActiveTool('pan')}
                onDoubleClick={() => setPanOffset({ x: 0, y: 0 })}
                className={`
                  ${styles.iconToolBtn}
                  ${activeTool === 'pan' ? styles.iconToolBtnActive : ''}
                `}
                title="Pan Mode (H or hold Spacebar, double-click to center)"
              >
                <Hand style={{ width: 15, height: 15 }} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                className={`
                  ${styles.iconToolBtn}
                  ${activeTool === 'select' ? styles.iconToolBtnActive : ''}
                `}
                title="Select Mode (V)"
              >
                <MousePointer style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>

          {/* Document Paper Container */}
          <div
            className={styles.paperContainer}
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel / 100})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.12s ease-out',
              pointerEvents: isPanningMode ? 'none' : 'auto',
            }}
          >
            {currentPageImage && (
              <div
                ref={canvasRef}
                className={styles.documentPaper}
                style={{
                  width: `${Math.min(760, currentPageImage.width)}px`,
                  aspectRatio: `${currentPageImage.width} / ${currentPageImage.height}`,
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              >
                {/* Background Image of Document */}
                <img
                  src={currentPageImage.data_url}
                  alt={`Page ${currentPage + 1}`}
                  className={styles.pageImage}
                  draggable={false}
                />

                {/* Detected Fields on Current Page */}
                {currentPageFields.map(field => {
                  const isSelected = selectedFieldId === field.id;
                  const fieldColor = field.color || '#000000';

                  return (
                    <div
                      key={field.id}
                      className={`
                        ${styles.fieldBox}
                        ${isSelected ? styles.fieldBoxSelected : ''}
                      `}
                      style={{
                        left: `${field.x0 * 100}%`,
                        top: `${field.y0 * 100}%`,
                        width: `${(field.x1 - field.x0) * 100}%`,
                        height: `${(field.y1 - field.y0) * 100}%`,
                        backgroundColor: isSelected ? 'rgba(191, 219, 254, 0.75)' : 'rgba(219, 234, 254, 0.45)',
                        borderColor: isSelected ? '#1d4ed8' : '#2563eb',
                        borderWidth: isSelected ? '2px' : '1px',
                        borderStyle: 'solid',
                        boxShadow: isSelected ? '0 0 12px rgba(37, 99, 235, 0.35)' : 'none',
                      }}
                      onMouseDown={(e) => {
                        if (isDrawing) return;
                        setSelectedFieldId(field.id);
                        if (field.type === 'ChoiceButton' || field.type === 'RadioButton') {
                          setFields(prev => prev.map(f => f.id === field.id ? { ...f, checked: !f.checked } : f));
                          return;
                        }
                        if (field.type === 'DateField') {
                          return;
                        }
                        e.stopPropagation();
                        startDrag(e, field.id, 'move');
                      }}
                    >
                      {/* Date Field Content with Calendar Dropdown Trigger */}
                      {field.type === 'DateField' && (
                        <div
                          className={styles.fieldDateContent}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFieldId(field.id);
                            setActiveCalendarFieldId(prev => prev === field.id ? null : field.id);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedFieldId(field.id);
                          }}
                        >
                          <span style={{ color: field.value ? fieldColor : '#94a3b8', fontSize: `${field.fontSize || 12}px`, fontFamily: field.fontFamily || 'Inter', fontWeight: field.bold ? 700 : 400, fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none' }}>
                            {field.value || 'DD / MM / YYYY'}
                          </span>
                          <Calendar style={{ width: 13, height: 13, color: fieldColor }} />
                        </div>
                      )}

                      {/* Calendar Dropdown Popover */}
                      {field.type === 'DateField' && activeCalendarFieldId === field.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: field.y1 > 0.65 ? 'auto' : 'calc(100% + 4px)',
                            bottom: field.y1 > 0.65 ? 'calc(100% + 4px)' : 'auto',
                            left: field.x0 > 0.6 ? 'auto' : 0,
                            right: field.x0 > 0.6 ? 0 : 'auto',
                            zIndex: 100,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CalendarDropdown
                            value={field.value || ''}
                            isOpen={activeCalendarFieldId === field.id}
                            onClose={() => setActiveCalendarFieldId(null)}
                            onChange={(dateStr) => {
                              setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: dateStr } : f));
                              setActiveCalendarFieldId(null);
                            }}
                          />
                        </div>
                      )}

                      {/* Text Field Content */}
                      {field.type === 'TextBox' && (
                        (field.y1 - field.y0) > 0.045 ? (
                          <textarea
                            value={field.value || ''}
                            placeholder="Enter text..."
                            className={styles.fieldInnerInput}
                            style={{ color: fieldColor, fontSize: `${field.fontSize || 12}px`, fontFamily: field.fontFamily || 'Inter', fontWeight: field.bold ? 700 : 400, fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', textAlign: (field.textAlign || 'left') as any }}
                            onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                            onMouseDown={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                            onFocus={() => setSelectedFieldId(field.id)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: val } : f));
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={field.value || ''}
                            placeholder="Enter text..."
                            className={styles.fieldInnerInputSingle}
                            style={{ color: fieldColor, fontSize: `${field.fontSize || 12}px`, fontFamily: field.fontFamily || 'Inter', fontWeight: field.bold ? 700 : 400, fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', textAlign: (field.textAlign || 'left') as any }}
                            onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                            onMouseDown={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                            onFocus={() => setSelectedFieldId(field.id)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: val } : f));
                            }}
                          />
                        )
                      )}

                      {/* Checkbox / Radio Content */}
                      {(field.type === 'ChoiceButton' || field.type === 'RadioButton') && (
                        <div className={styles.fieldCheckboxContent}>
                          {field.checked && (
                            field.type === 'ChoiceButton' ? (
                              <Check style={{ width: 14, height: 14, color: fieldColor }} />
                            ) : (
                              <div style={{ width: 8, height: 8, backgroundColor: fieldColor, borderRadius: '50%' }} />
                            )
                          )}
                        </div>
                      )}

                      {/* Signature Content */}
                      {field.type === 'Signature' && (
                        field.imageData ? (
                          <div className={styles.fieldImageContent}>
                            <img
                              src={field.imageData}
                              alt="Signature"
                              style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                            />
                            <div className={styles.fieldActionOverlay}>
                              <button
                                type="button"
                                className={styles.fieldActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSignatureFieldId(field.id);
                                }}
                              >
                                <PenTool size={11} /> Re-sign
                              </button>
                              <button
                                type="button"
                                className={styles.fieldActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateFieldProperty(field.id, 'imageData', undefined);
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={styles.fieldSignatureContent}
                            style={{ color: fieldColor, cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldId(field.id);
                              setActiveSignatureFieldId(field.id);
                            }}
                          >
                            <PenTool style={{ width: 13, height: 13, marginRight: 4 }} />
                            <span>Click to sign</span>
                          </div>
                        )
                      )}

                      {/* Image Upload Content */}
                      {field.type === 'ImageUpload' && (
                        field.imageData ? (
                          <div className={styles.fieldImageContent}>
                            <img
                              src={field.imageData}
                              alt="Uploaded photo"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', borderRadius: 2 }}
                            />
                            <div className={styles.fieldActionOverlay}>
                              <button
                                type="button"
                                className={styles.fieldActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerImageUpload(field.id);
                                }}
                              >
                                <ImageIcon size={11} /> Change
                              </button>
                              <button
                                type="button"
                                className={styles.fieldActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateFieldProperty(field.id, 'imageData', undefined);
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={styles.fieldSignatureContent}
                            style={{ color: fieldColor, cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldId(field.id);
                              triggerImageUpload(field.id);
                            }}
                          >
                            <ImageIcon style={{ width: 13, height: 13, marginRight: 4 }} />
                            <span>Click to upload photo</span>
                          </div>
                        )
                      )}

                      {/* Resize Dots & Delete on selection */}
                      {isSelected && !isDrawing && (
                        <>
                          <div
                            className={`${styles.resizeDot} ${styles.dotNW}`}
                            style={{ backgroundColor: fieldColor }}
                            onMouseDown={(e) => startDrag(e, field.id, 'resize', 'nw')}
                          />
                          <div
                            className={`${styles.resizeDot} ${styles.dotNE}`}
                            style={{ backgroundColor: fieldColor }}
                            onMouseDown={(e) => startDrag(e, field.id, 'resize', 'ne')}
                          />
                          <div
                            className={`${styles.resizeDot} ${styles.dotSW}`}
                            style={{ backgroundColor: fieldColor }}
                            onMouseDown={(e) => startDrag(e, field.id, 'resize', 'sw')}
                          />
                          <div
                            className={`${styles.resizeDot} ${styles.dotSE}`}
                            style={{ backgroundColor: fieldColor }}
                            onMouseDown={(e) => startDrag(e, field.id, 'resize', 'se')}
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Drawing Box Preview */}
                {isDrawing && drawStart && drawCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      border: '2px dashed #2563eb',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                      top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        {/* === Right Sidebar: Document Settings OR Field Settings Sidebar === */}
        <aside className={styles.rightSidebar}>
          {/* Base Sidebar: Form Options (Document Settings & Add Form Field) */}
          <div className={styles.formOptionsSidebar}>
            {/* Section 1: Document settings */}
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionHeading}>Document settings</h3>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Document name</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className={styles.textInput}
                />
              </div>

              {/* Language: No dropdown, clean text input as requested */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={styles.textInput}
                  placeholder="English"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Page size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="A4 (210 * 297 mm)">A4 (210 * 297 mm)</option>
                  <option value="Letter (8.5 * 11 in)">Letter (8.5 * 11 in)</option>
                  <option value="Legal (8.5 * 14 in)">Legal (8.5 * 14 in)</option>
                </select>
              </div>
            </div>

            <hr className={styles.dashedDivider} />

            {/* Section 2: Add form field (2x3 Grid) */}
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionHeading}>Add form field</h3>

              <div className={styles.addFieldsGrid}>
                {/* Text Field */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('TextBox');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'TextBox' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <Type className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Text field</span>
                </button>

                {/* Date Field */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('DateField');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'DateField' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <Calendar className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Date Field</span>
                </button>

                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('ChoiceButton');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'ChoiceButton' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <CheckSquare className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Checkbox</span>
                </button>

                {/* Radio Button */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('RadioButton');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'RadioButton' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <Circle className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Radio button</span>
                </button>

                {/* Image Upload */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('ImageUpload');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'ImageUpload' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <ImageIcon className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Image upload</span>
                </button>

                {/* Signature */}
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldType('Signature');
                    setIsDrawing(true);
                  }}
                  className={`
                    ${styles.fieldGridBtn}
                    ${isDrawing && newFieldType === 'Signature' ? styles.fieldGridBtnActive : ''}
                  `}
                >
                  <PenTool className={styles.fieldGridIcon} />
                  <span className={styles.fieldGridLabel}>Signature</span>
                </button>
              </div>
            </div>

            {/* Section 3: How to add fields? Guide Card */}
            <div className={styles.helpCard}>
              <div className={styles.helpHeader}>
                <Sparkles style={{ width: 15, height: 15, color: '#2563eb' }} />
                <span>How to add fields?</span>
              </div>
              <ol className={styles.helpList}>
                <li>Select a field type from above</li>
                <li>Click on the document where you want to add it</li>
                <li>Adjust the size and position</li>
                <li>Configure field settings (auto-opens when a field is selected)</li>
              </ol>
            </div>
          </div>

          {/* Overlay Sidebar: Field Settings (opens OVER the current one when any field is selected) */}
          {selectedField && (
            <div className={styles.fieldSettingsOverlaySidebar}>
              {/* Back to Form Options Button */}
              <button
                type="button"
                onClick={() => setSelectedFieldId(null)}
                className={styles.backToFormOptionsBtn}
              >
                <ArrowLeft style={{ width: 16, height: 16 }} />
                <span>Form Options</span>
              </button>

              {/* Field Settings Section */}
              <div className={styles.sidebarSection}>
                <h3 className={styles.sectionHeading}>Field settings</h3>

                {/* Field Type */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Field Type</label>
                  <div className={styles.fieldTypeRow}>
                    <div className={styles.selectWrapper}>
                      <div className={styles.selectIconPrefix}>
                        {selectedField.type === 'ChoiceButton' && <CheckSquare style={{ width: 16, height: 16, color: '#1664D9' }} />}
                        {selectedField.type === 'TextBox' && <Type style={{ width: 16, height: 16, color: '#1664D9' }} />}
                        {selectedField.type === 'DateField' && <Calendar style={{ width: 16, height: 16, color: '#1664D9' }} />}
                        {selectedField.type === 'RadioButton' && <Circle style={{ width: 16, height: 16, color: '#1664D9' }} />}
                        {selectedField.type === 'Signature' && <PenTool style={{ width: 16, height: 16, color: '#1664D9' }} />}
                        {selectedField.type === 'ImageUpload' && <ImageIcon style={{ width: 16, height: 16, color: '#1664D9' }} />}
                      </div>
                      <select
                        value={selectedField.type}
                        onChange={(e) => changeFieldType(selectedField.id, e.target.value as DetectedField['type'])}
                        className={styles.selectInputWithIcon}
                      >
                        <option value="ChoiceButton">Checkbox</option>
                        <option value="TextBox">Text field</option>
                        <option value="DateField">Date Field</option>
                        <option value="RadioButton">Radio button</option>
                        <option value="Signature">Signature</option>
                        <option value="ImageUpload">Image upload</option>
                      </select>
                      <ChevronDown className={styles.selectChevron} />
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteField(selectedField.id)}
                      className={styles.deleteFieldIconBtn}
                      title="Delete Field"
                    >
                      <Trash2 style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                </div>

                {/* Field label */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Field label</label>
                  <input
                    type="text"
                    value={selectedField.label || getFieldLabel(selectedField, currentPageFields.findIndex(f => f.id === selectedField.id))}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'label', e.target.value)}
                    className={styles.textInput}
                    placeholder="Enter field label"
                  />
                </div>

                {/* Choice / Radio Button Icon Selection Cards */}
                {(selectedField.type === 'ChoiceButton' || selectedField.type === 'RadioButton') && (
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>Add Radio Button Icon</label>
                    <div className={styles.iconOptionCards}>
                      <div
                        onClick={() => updateFieldProperty(selectedField.id, 'checked', false)}
                        className={`
                          ${styles.iconOptionCard}
                          ${!selectedField.checked ? styles.iconOptionCardActive : ''}
                        `}
                      >
                        <Square style={{ width: 22, height: 22, color: !selectedField.checked ? '#1664D9' : '#94a3b8' }} />
                        <span>Empty</span>
                      </div>

                      <div
                        onClick={() => updateFieldProperty(selectedField.id, 'checked', true)}
                        className={`
                          ${styles.iconOptionCard}
                          ${selectedField.checked ? styles.iconOptionCardActive : ''}
                        `}
                      >
                        <CheckSquare style={{ width: 22, height: 22, color: selectedField.checked ? '#1664D9' : '#94a3b8' }} />
                        <span>Selected</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Picker for Date Field */}
                {selectedField.type === 'DateField' && (
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>Selected Date</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="date"
                        value={selectedField.value || ''}
                        onChange={(e) => updateFieldProperty(selectedField.id, 'value', e.target.value)}
                        className={styles.textInput}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = String(now.getMonth() + 1).padStart(2, '0');
                          const d = String(now.getDate()).padStart(2, '0');
                          updateFieldProperty(selectedField.id, 'value', `${y}-${m}-${d}`);
                        }}
                        className={styles.todayBtn}
                      >
                        Today
                      </button>
                    </div>
                  </div>
                )}

                {/* Default text for TextBox */}
                {selectedField.type === 'TextBox' && (
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>Default Text</label>
                    <textarea
                      value={selectedField.value || ''}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'value', e.target.value)}
                      className={styles.textInput}
                      placeholder="Enter text..."
                      style={{ minHeight: 68 }}
                    />
                  </div>
                )}

                {/* Signature Field Controls */}
                {selectedField.type === 'Signature' && (
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>Signature</label>
                    {selectedField.imageData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 8,
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: 64,
                        }}>
                          <img
                            src={selectedField.imageData}
                            alt="Signature preview"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setActiveSignatureFieldId(selectedField.id)}
                            className={styles.todayBtn}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <PenTool size={13} />
                            <span>Re-sign / Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateFieldProperty(selectedField.id, 'imageData', undefined)}
                            className={styles.deleteFieldIconBtn}
                            title="Clear signature"
                          >
                            <Trash2 style={{ width: 15, height: 15 }} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSignatureFieldId(selectedField.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 14px',
                          borderRadius: 8,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          fontSize: 13.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <PenTool style={{ width: 15, height: 15 }} />
                        <span>Sign Document</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Image Upload Field Controls */}
                {selectedField.type === 'ImageUpload' && (
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>Passport Photo / Image</label>
                    {selectedField.imageData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          overflow: 'hidden',
                          height: 96,
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <img
                            src={selectedField.imageData}
                            alt="Photo preview"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => triggerImageUpload(selectedField.id)}
                            className={styles.todayBtn}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <ImageIcon size={13} />
                            <span>Replace Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateFieldProperty(selectedField.id, 'imageData', undefined)}
                            className={styles.deleteFieldIconBtn}
                            title="Remove photo"
                          >
                            <Trash2 style={{ width: 15, height: 15 }} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerImageUpload(selectedField.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 14px',
                          borderRadius: 8,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          fontSize: 13.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <ImageIcon style={{ width: 15, height: 15 }} />
                        <span>Upload Photo</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <hr className={styles.dashedDivider} />

              {/* Field Properties: Font, Size, Formatting, Color */}
              <div className={styles.sidebarSection}>
                <h3 className={styles.sectionHeading}>Field properties</h3>

                {/* Font + Size row (only for text-capable fields) */}
                {(selectedField.type === 'TextBox' || selectedField.type === 'DateField' || selectedField.type === 'Signature') && (
                  <>
                    <div className={styles.fpFontSizeRow}>
                      {/* Font dropdown */}
                      <div className={styles.fpColFlex}>
                        <span className={styles.fpColLabel}>Font</span>
                        <select
                          className={styles.fpFontSelect}
                          value={selectedField.fontFamily || 'Inter'}
                          onChange={(e) => updateFieldProperty(selectedField.id, 'fontFamily', e.target.value)}
                          style={{ fontFamily: selectedField.fontFamily || 'Inter' }}
                        >
                          {FONT_OPTIONS.map(font => (
                            <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                          ))}
                        </select>
                      </div>

                      {/* Size stepper */}
                      <div className={styles.fpCol}>
                        <span className={styles.fpColLabel}>Size</span>
                        <div className={styles.fpSizeStepper}>
                          <button
                            type="button"
                            className={styles.fpSizeBtn}
                            onClick={() => {
                              const current = selectedField.fontSize || 12;
                              const next = Math.min(72, current + 1);
                              updateFieldProperty(selectedField.id, 'fontSize', next);
                            }}
                          >
                            <Plus size={13} />
                          </button>
                          <input
                            type="number"
                            className={styles.fpSizeInput}
                            value={selectedField.fontSize || 12}
                            min={6}
                            max={72}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 6 && val <= 72) {
                                updateFieldProperty(selectedField.id, 'fontSize', val);
                              } else if (e.target.value === '') {
                                updateFieldProperty(selectedField.id, 'fontSize', 12);
                              }
                            }}
                          />
                          <span className={styles.fpSizeUnit}>px</span>
                          <button
                            type="button"
                            className={styles.fpSizeBtn}
                            onClick={() => {
                              const current = selectedField.fontSize || 12;
                              const next = Math.max(6, current - 1);
                              updateFieldProperty(selectedField.id, 'fontSize', next);
                            }}
                          >
                            <Minus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Text Formatting */}
                    <div className={styles.fpFormattingLabel}>Text Formatting</div>
                    <div className={styles.fpFormattingRow}>
                      {/* Alignment group */}
                      <div className={styles.fpFormatGroup}>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${(selectedField.textAlign || 'left') === 'left' ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'textAlign', 'left')}
                          title="Align left"
                        >
                          <AlignLeft size={15} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${selectedField.textAlign === 'center' ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'textAlign', 'center')}
                          title="Align center"
                        >
                          <AlignCenter size={15} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${selectedField.textAlign === 'right' ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'textAlign', 'right')}
                          title="Align right"
                        >
                          <AlignRight size={15} />
                        </button>
                      </div>

                      <div className={styles.fpFormatDivider} />

                      {/* Bold / Italic / Underline group */}
                      <div className={styles.fpFormatGroup}>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${selectedField.bold ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'bold', !selectedField.bold)}
                          title="Bold"
                        >
                          <Bold size={15} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${selectedField.italic ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'italic', !selectedField.italic)}
                          title="Italic"
                        >
                          <Italic size={15} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.fpFormatBtn} ${selectedField.underline ? styles.fpFormatBtnActive : ''}`}
                          onClick={() => updateFieldProperty(selectedField.id, 'underline', !selectedField.underline)}
                          title="Underline"
                        >
                          <Underline size={15} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Color */}
                <div className={styles.fpColorLabel}>Color</div>
                <div className={styles.formGroup}>
                  <div className={styles.colorPickerBox}>
                    <label
                      className={styles.colorPickerLeft}
                      style={{ cursor: 'pointer', position: 'relative' }}
                      title="Click to choose custom color"
                    >
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: selectedField.color || '#000000' }}
                      />
                      <span className={styles.colorHexText}>
                        {(selectedField.color || '#000000').toUpperCase()}
                      </span>
                      <input
                        type="color"
                        value={selectedField.color || '#000000'}
                        onChange={(e) => handleColorChange(e.target.value)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                      />
                    </label>
                    <span className={styles.colorOpacityText}>100%</span>
                  </div>

                  {/* Swatches palette */}
                  <div className={styles.colorPaletteRow}>
                    {COLOR_PALETTE.map(c => {
                      const isCurrentColor = (selectedField.color || '#000000').toLowerCase() === c.toLowerCase();
                      return (
                        <div
                          key={c}
                          onClick={() => handleColorChange(c)}
                          className={`
                            ${styles.colorPaletteDot}
                            ${isCurrentColor ? styles.colorPaletteDotActive : ''}
                          `}
                          style={{
                            backgroundColor: c,
                            border: c.toLowerCase() === '#000000' ? '1px solid #94a3b8' : undefined,
                          }}
                          title={c}
                        />
                      );
                    })}
                  </div>

                  {/* Option / checkbox: Use same color for all fields */}
                  <label className={styles.sameColorCheckboxRow}>
                    <input
                      type="checkbox"
                      checked={useSameColorForAll}
                      onChange={(e) => handleToggleSameColor(e.target.checked)}
                      className={styles.sameColorCheckbox}
                    />
                    <span className={styles.sameColorLabel}>Use same color for all fields</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Hidden File Input for Image Upload Field */}
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />

      {/* Signature Modal for Drawing, Uploading, or Typing Signature */}
      <SignatureModal
        isOpen={activeSignatureFieldId !== null}
        onClose={() => setActiveSignatureFieldId(null)}
        initialDataUrl={fields.find((f) => f.id === activeSignatureFieldId)?.imageData}
        initialMode={fields.find((f) => f.id === activeSignatureFieldId)?.signatureMode || 'draw'}
        onSave={(dataUrl, mode) => {
          if (activeSignatureFieldId) {
            setFields((prev) =>
              prev.map((f) =>
                f.id === activeSignatureFieldId
                  ? { ...f, imageData: dataUrl, signatureMode: mode }
                  : f
              )
            );
          }
        }}
      />
    </div>
  );
}
