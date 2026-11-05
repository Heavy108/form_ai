'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import styles from '@/css/calendarDropdown.module.css';

interface CalendarDropdownProps {
  value: string;
  onChange: (dateStr: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarDropdown({
  value,
  onChange,
  onClose,
  isOpen,
}: CalendarDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const parseInitialDate = (): { year: number; month: number; day: number | null } => {
    const today = new Date();
    if (!value) {
      return { year: today.getFullYear(), month: today.getMonth(), day: null };
    }

    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return {
        year: parseInt(iso[1], 10),
        month: parseInt(iso[2], 10) - 1,
        day: parseInt(iso[3], 10),
      };
    }

    const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
      return {
        year: parseInt(us[3], 10),
        month: parseInt(us[1], 10) - 1,
        day: parseInt(us[2], 10),
      };
    }

    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    }

    return { year: today.getFullYear(), month: today.getMonth(), day: null };
  };

  const initial = parseInitialDate();
  const [viewYear, setViewYear] = useState<number>(initial.year);
  const [viewMonth, setViewMonth] = useState<number>(initial.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(initial.day);

  useEffect(() => {
    const parsed = parseInitialDate();
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    setSelectedDay(parsed.day);
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
      }, 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
  const todayDay = today.getDate();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const formatted = `${viewYear}-${mStr}-${dStr}`;
    setSelectedDay(day);
    onChange(formatted);
    onClose();
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setViewYear(y);
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
    onChange(`${y}-${m}-${d}`);
    onClose();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDay(null);
    onChange('');
    onClose();
  };

  const calendarCells = [];

  // Previous month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    calendarCells.push(
      <button
        key={`prev-${prevDay}`}
        type="button"
        disabled
        className={`${styles.dayBtn} ${styles.dayBtnDisabled}`}
      >
        {prevDay}
      </button>
    );
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = selectedDay === day;
    const isToday = isCurrentMonth && day === todayDay;

    calendarCells.push(
      <button
        key={`current-${day}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSelectDay(day);
        }}
        className={`
          ${styles.dayBtn}
          ${isSelected ? styles.dayBtnSelected : ''}
          ${isToday && !isSelected ? styles.dayBtnToday : ''}
        `}
      >
        {day}
      </button>
    );
  }

  // Next month padding to fill row
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push(
      <button
        key={`next-${i}`}
        type="button"
        disabled
        className={`${styles.dayBtn} ${styles.dayBtnDisabled}`}
      >
        {i}
      </button>
    );
  }

  const currentYear = today.getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 60; y <= currentYear + 25; y++) {
    yearOptions.push(y);
  }

  return (
    <div
      ref={containerRef}
      className={styles.calendarContainer}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header: Month / Year jumpers & arrows */}
      <div className={styles.headerRow}>
        <button
          type="button"
          onClick={handlePrevMonth}
          className={styles.navArrowBtn}
          title="Previous Month"
        >
          <ChevronLeft style={{ width: 14, height: 14 }} />
        </button>

        <div className={styles.selectGroup}>
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
            className={styles.jumperSelect}
          >
            {MONTH_NAMES.map((mName, idx) => (
              <option key={mName} value={idx}>
                {mName}
              </option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
            className={styles.jumperSelect}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className={styles.navArrowBtn}
          title="Next Month"
        >
          <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className={styles.weekdayGrid}>
        {WEEKDAY_NAMES.map(name => (
          <div key={name} className={styles.weekdayLabel}>
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className={styles.daysGrid}>
        {calendarCells}
      </div>

      {/* Footer quick action buttons */}
      <div className={styles.footerRow}>
        <button
          type="button"
          onClick={handleSelectToday}
          className={styles.quickActionBtn}
        >
          Today
        </button>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearBtn}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
