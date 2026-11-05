'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/css/loadingScreen.module.css';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Realistic smooth progress simulation while AI is processing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 40) return prev + Math.floor(Math.random() * 8) + 4;
        if (prev < 68) return prev + Math.floor(Math.random() * 6) + 3;
        if (prev < 88) return prev + Math.floor(Math.random() * 4) + 1;
        if (prev < 96) return prev + 1;
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.loadingContainer}>
      {/* Scanner Viewfinder Area */}
      <div className={styles.scannerWrapper}>
        {/* Four Corner Viewfinder Brackets */}
        <div className={styles.cornerTopLeft} />
        <div className={styles.cornerTopRight} />
        <div className={styles.cornerBottomLeft} />
        <div className={styles.cornerBottomRight} />

        {/* Ambient radial glow behind document */}
        <div className={styles.scannerGlow} />

        {/* Animated Scanning Laser Beam */}
        <div className={styles.scannerBeam} />

        {/* 3D Document Sheet */}
        <div className={styles.documentSheet}>
          {/* Folded Top-Right Corner */}
          <div className={styles.dogEar} />
          <div className={styles.dogEarFold} />

          {/* Placeholder Lines */}
          <div className={styles.docLineLong} />
          <div className={styles.docLineMedium} />
          <div className={styles.docLineShort} />

          {/* Bottom Split Section: Thumbnail + Sub Lines */}
          <div className={styles.docSplit}>
            <div className={styles.docThumbnail}>
              <svg width="22" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="2.5" fill="#93c5fd" />
                <path d="M4 18L10 11L14 15L17 12L21 18H4Z" fill="#3b82f6" />
              </svg>
            </div>
            <div className={styles.docSubLines}>
              <div className={styles.docSubLine} />
              <div className={styles.docSubLine} />
              <div className={styles.docSubLineShort} />
            </div>
          </div>
        </div>
      </div>

      {/* Title & Subtitle */}
      <h2 className={styles.scanTitle}>Scanning your form</h2>
      <p className={styles.scanSubtitle}>We&apos;re detecting fields and preparing your form.</p>

      {/* Horizontal Progress Bar Row */}
      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={styles.progressPercent}>{progress}%</span>
      </div>
    </div>
  );
}
