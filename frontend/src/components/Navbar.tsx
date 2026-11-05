'use client';

import React from 'react';
import styles from '@/css/navbar.module.css';

interface NavbarProps {
  onUploadClick?: () => void;
}

export default function Navbar({ onUploadClick }: NavbarProps) {
  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Brand */}
        <div className={styles.brandGroup} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className={styles.logoIcon}>
            <div className={styles.logoBarLong} />
            <div className={styles.logoBarLong} />
            <div className={styles.logoBarMedium} />
          </div>
          <span className={styles.brandName}>FormaAi</span>
        </div>

        {/* Right side navigation */}
        <div className={styles.navRight}>
          <nav>
            <ul className={styles.navLinks}>
              <li>
                <a href="#how-it-works" className={styles.navLink} onClick={(e) => e.preventDefault()}>
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className={styles.navLink} onClick={(e) => e.preventDefault()}>
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className={styles.navLink} onClick={(e) => e.preventDefault()}>
                  Pricing
                </a>
              </li>
            </ul>
          </nav>

          <button
            type="button"
            className={styles.ctaButton}
            onClick={onUploadClick || (() => window.scrollTo({ top: 0, behavior: 'smooth' }))}
          >
            <span>Upload Form</span>
            <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      </div>
    </header>
  );
}
