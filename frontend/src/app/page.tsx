'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import UploadScreen from '@/components/UploadScreen';
import LoadingScreen from '@/components/LoadingScreen';
import EditorScreen from '@/components/EditorScreen';
import { DetectionResult, DetectedField } from '@/types';
import styles from '@/css/page.module.css';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Detection results
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);

  // Form options
  const [model, setModel] = useState('FFDNet-L');
  const [keepExistingFields, setKeepExistingFields] = useState(false);
  const [useSignatureFields, setUseSignatureFields] = useState(false);
  const [imageSize, setImageSize] = useState(1600);
  const [confidence, setConfidence] = useState(0.3);
  const [fast, setFast] = useState(false);
  const [device, setDevice] = useState('cpu');

  const resetApp = () => {
    setFile(null);
    setDetectionResult(null);
    setFields([]);
  };

  const handleLoadSample = useCallback(() => {
    const passportSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130" width="800" height="1130" fill="#ffffff">
      <rect width="800" height="1130" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      <g transform="translate(250, 40)">
        <circle cx="20" cy="20" r="14" fill="#334155" opacity="0.2"/>
        <text x="45" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">Government of India</text>
        <text x="45" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#475569">Ministry of External Affairs</text>
      </g>
      <text x="730" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="bold" text-anchor="end" fill="#0f172a">Form No. X</text>
      <text x="730" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="9" text-anchor="end" fill="#64748b">(See rule 4)</text>
      <text x="400" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a" letter-spacing="1">APPLICATION FOR PASSPORT</text>
      <text x="400" y="132" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="500" text-anchor="middle" fill="#475569">(For fresh issue / Re-issue)</text>
      <text x="400" y="148" font-family="system-ui, -apple-system, sans-serif" font-size="10" text-anchor="middle" fill="#64748b">Please fill in the details in BLOCK LETTERS only.</text>
      <rect x="50" y="170" width="700" height="20" fill="#f1f5f9" rx="3"/>
      <text x="60" y="184" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#0f172a">1. Personal Details</text>
      <text x="60" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Full Name (As per existing passport or legal documents)</text>
      <text x="60" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Date of Birth (DD/MM/YYYY)</text>
      <text x="320" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Gender</text>
      <text x="60" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Place of Birth (City, State)</text>
      <text x="320" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Nationality</text>
      <rect x="580" y="210" width="160" height="150" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
      <text x="660" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#94a3b8">Upload Photo</text>
      <text x="660" y="318" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" text-anchor="middle" fill="#cbd5e1">JPG or PNG Max 500 KB</text>
      <rect x="50" y="380" width="700" height="20" fill="#f1f5f9" rx="3"/>
      <text x="60" y="394" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#0f172a">2. Address Details</text>
      <text x="60" y="420" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Address Line 1</text>
      <text x="60" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Address Line 2 (Optional)</text>
      <text x="60" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">City</text>
      <text x="300" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">State</text>
      <text x="520" y="530" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">ZIP / Postal Code</text>
      <rect x="50" y="580" width="700" height="20" fill="#f1f5f9" rx="3"/>
      <text x="60" y="594" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#0f172a">3. Contact Details</text>
      <text x="60" y="620" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Phone Number</text>
      <text x="400" y="620" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Email Address</text>
      <rect x="50" y="675" width="700" height="20" fill="#f1f5f9" rx="3"/>
      <text x="60" y="689" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#0f172a">4. Document Details</text>
      <text x="60" y="715" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Type of Application</text>
      <text x="95" y="742" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" fill="#334155">Fresh Issue</text>
      <text x="195" y="742" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" fill="#334155">Re-issue</text>
      <text x="280" y="742" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" fill="#334155">Tatkaal</text>
      <rect x="50" y="775" width="700" height="20" fill="#f1f5f9" rx="3"/>
      <text x="60" y="789" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#0f172a">5. Declaration</text>
      <text x="60" y="815" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" fill="#475569">I hereby declare that all information given above is true and complete to the best of my knowledge.</text>
      <text x="95" y="845" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" fill="#334155">I agree to the declaration</text>
      <text x="500" y="845" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="600" fill="#334155">Signature</text>
    </svg>`;

    const sampleResult: DetectionResult = {
      request_id: 'sample_passport_demo',
      pages: [
        {
          width: 800,
          height: 1130,
          data_url: 'data:image/svg+xml;utf8,' + encodeURIComponent(passportSvg),
        },
      ],
      fields: [
        { id: 'f1', type: 'TextBox', page: 0, x0: 0.075, y0: 0.194, x1: 0.68, y1: 0.23, label: 'Full name', color: '#000000', fontSize: 12, value: '' },
        { id: 'f2', type: 'DateField', page: 0, x0: 0.075, y0: 0.258, x1: 0.36, y1: 0.292, label: 'Date of birth', color: '#000000', fontSize: 12, value: '' },
        { id: 'f3', type: 'TextBox', page: 0, x0: 0.395, y0: 0.258, x1: 0.68, y1: 0.292, label: 'Gender', color: '#000000', fontSize: 12, value: '' },
        { id: 'f4', type: 'ImageUpload', page: 0, x0: 0.725, y0: 0.186, x1: 0.925, y1: 0.32, label: 'Passport photo', color: '#000000' },
        { id: 'f5', type: 'TextBox', page: 0, x0: 0.075, y0: 0.380, x1: 0.925, y1: 0.414, label: 'Address line 1', color: '#000000', fontSize: 12, value: '' },
        { id: 'f6', type: 'TextBox', page: 0, x0: 0.075, y0: 0.430, x1: 0.925, y1: 0.464, label: 'Address line 2', color: '#000000', fontSize: 12, value: '' },
        { id: 'f7', type: 'TextBox', page: 0, x0: 0.075, y0: 0.480, x1: 0.34, y1: 0.514, label: 'City', color: '#000000', fontSize: 12, value: '' },
        { id: 'f8', type: 'TextBox', page: 0, x0: 0.37, y0: 0.480, x1: 0.62, y1: 0.514, label: 'State', color: '#000000', fontSize: 12, value: '' },
        { id: 'f9', type: 'TextBox', page: 0, x0: 0.645, y0: 0.480, x1: 0.925, y1: 0.514, label: 'ZIP code', color: '#000000', fontSize: 12, value: '' },
        { id: 'f10', type: 'TextBox', page: 0, x0: 0.075, y0: 0.558, x1: 0.48, y1: 0.592, label: 'Phone number', color: '#000000', fontSize: 12, value: '' },
        { id: 'f11', type: 'TextBox', page: 0, x0: 0.50, y0: 0.558, x1: 0.925, y1: 0.592, label: 'Email address', color: '#000000', fontSize: 12, value: '' },
        { id: 'f12', type: 'ChoiceButton', page: 0, x0: 0.075, y0: 0.650, x1: 0.105, y1: 0.666, label: 'Types of application', color: '#000000', checked: true },
        { id: 'f13', type: 'Signature', page: 0, x0: 0.62, y0: 0.738, x1: 0.925, y1: 0.776, label: 'Signature', color: '#000000', fontSize: 14 },
        { id: 'f14', type: 'ChoiceButton', page: 0, x0: 0.075, y0: 0.742, x1: 0.105, y1: 0.758, label: 'Declaration', color: '#000000', checked: false },
        { id: 'f15', type: 'TextBox', page: 0, x0: 0.075, y0: 0.312, x1: 0.36, y1: 0.346, label: 'Place of birth', color: '#000000', fontSize: 12, value: '' },
      ],
    };
    setDetectionResult(sampleResult);
    setFields(sampleResult.fields);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sample') === 'true' || params.get('demo') === 'true') {
        handleLoadSample();
      }
    }
  }, [handleLoadSample]);

  const handleDetect = async () => {
    if (!file) return;

    setIsProcessing(true);
    setDetectionResult(null);
    setFields([]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);
    formData.append('image_size', imageSize.toString());
    formData.append('confidence', confidence.toString());
    formData.append('fast', fast.toString());
    formData.append('device', device);

    try {
      const response = await fetch('http://localhost:8000/detect-fields', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = response.statusText;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.detail) detail = errJson.detail;
        } catch (e) {}
        throw new Error(`Detection failed: ${detail}`);
      }

      const data: DetectionResult = await response.json();
      const normalizedFields = (data.fields || []).map((f) => ({
        ...f,
        color: f.color || '#000000',
        fontSize: f.fontSize || 12,
      }));
      setDetectionResult({ ...data, fields: normalizedFields });
      setFields(normalizedFields);
    } catch (error: any) {
      console.error("Error detecting fields:", error);
      alert(`Failed to detect fields: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

function svgDataUrlToBlob(svgDataUrl: string, width = 800, height = 1130): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUrl;
  });
}

  const handleDownload = async (options?: { flatten?: boolean; docName?: string }) => {
    if (!detectionResult) return;

    setIsDownloading(true);

    const formData = new FormData();
    formData.append('request_id', detectionResult.request_id);
    formData.append('fields_json', JSON.stringify(fields));
    formData.append('keep_existing_fields', keepExistingFields.toString());
    formData.append('use_signature_fields', useSignatureFields.toString());
    // Default to true (clean flattened PDF without blue boxes)
    const shouldFlatten = options?.flatten !== undefined ? options.flatten : true;
    formData.append('flatten', shouldFlatten.toString());

    // 1. Pass the original uploaded file directly so backend can always recreate the document
    if (file) {
      formData.append('original_file', file);
    }

    // 2. Also provide page image fallback (for demo mode or when recovering)
    if (detectionResult.pages && detectionResult.pages.length > 0) {
      const pageImg = detectionResult.pages[0]?.data_url || '';
      if (pageImg.startsWith('data:image/svg+xml')) {
        try {
          const blob = await svgDataUrlToBlob(
            pageImg,
            detectionResult.pages[0]?.width || 800,
            detectionResult.pages[0]?.height || 1130
          );
          if (blob) {
            formData.append('page_image_file', blob, 'fallback_page.jpg');
          }
        } catch (e) {
          console.warn("Could not convert SVG to Blob:", e);
        }
      } else if (pageImg.startsWith('data:image/')) {
        try {
          const res = await fetch(pageImg);
          const blob = await res.blob();
          formData.append('page_image_file', blob, 'fallback_page.jpg');
        } catch (e) {
          formData.append('page_image', pageImg);
        }
      }
    }

    try {
      const response = await fetch('http://localhost:8000/build-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = response.statusText;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.detail) detail = errJson.detail;
        } catch (e) {}
        throw new Error(`Build failed: ${detail}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const downloadFilename = options?.docName
        ? `${options.docName.replace(/\.[^/.]+$/, "")}.pdf`
        : `processed_${file?.name.replace(/\.[^/.]+$/, "") || 'document'}.pdf`;
      a.download = downloadFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error building PDF:", error);
      alert(`Failed to build PDF: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // If fields are detected and ready to edit, show the full-screen Studio Editor
  if (detectionResult) {
    return (
      <EditorScreen
        detectionResult={detectionResult}
        fields={fields}
        setFields={setFields}
        resetApp={resetApp}
        handleDownload={handleDownload}
        isDownloading={isDownloading}
        initialDocName={file?.name.replace(/\.[^/.]+$/, "") || "Passport Application Form"}
      />
    );
  }

  // Otherwise, show Marketing Navbar + UploadScreen / LoadingScreen
  return (
    <div className={styles.pageWrapper}>
      <Navbar onUploadClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

      <main className={styles.mainContent}>
        {isProcessing ? (
          <LoadingScreen />
        ) : (
          <UploadScreen
            file={file}
            setFile={setFile}
            onDetect={handleDetect}
            model={model}
            setModel={setModel}
            keepExistingFields={keepExistingFields}
            setKeepExistingFields={setKeepExistingFields}
            useSignatureFields={useSignatureFields}
            setUseSignatureFields={setUseSignatureFields}
            imageSize={imageSize}
            setImageSize={setImageSize}
            confidence={confidence}
            setConfidence={setConfidence}
            fast={fast}
            setFast={setFast}
            device={device}
            setDevice={setDevice}
            onLoadSample={handleLoadSample}
          />
        )}
      </main>
    </div>
  );
}
