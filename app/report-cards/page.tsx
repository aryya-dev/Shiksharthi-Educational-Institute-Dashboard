'use client';

import React from 'react';
import { FileText, Clock, CheckCircle2, Circle, Sparkles } from 'lucide-react';

const milestones = [
  { label: 'Data model & storage', done: true },
  { label: 'Monthly attendance aggregation', done: true },
  { label: 'Mentor remarks workflow', done: false },
  { label: 'Director approval pipeline', done: false },
  { label: 'PDF generation & download', done: false },
];

export default function ReportCardsPage() {
  return (
    <>
      {/* Scoped keyframe animations */}
      <style>{`
        @keyframes rc-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes rc-pulse-ring {
          0%   { transform: scale(0.85); opacity: 0.6; }
          50%  { transform: scale(1.15); opacity: 0.15; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
        @keyframes rc-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes rc-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '40px 24px',
      }}>
        <div style={{
          position: 'relative',
          maxWidth: '520px',
          width: '100%',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '56px 40px 48px',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
          animation: 'rc-fade-up 0.6s ease-out both',
        }}>

          {/* Decorative gradient ring behind icon */}
          <div style={{
            position: 'absolute',
            top: '-38px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B, #F97316)',
            animation: 'rc-pulse-ring 3s ease-in-out infinite',
          }} />

          {/* Floating icon */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B, #F97316)',
            marginTop: '-38px',
            marginBottom: '28px',
            animation: 'rc-float 4s ease-in-out infinite',
            boxShadow: '0 6px 24px rgba(249, 115, 22, 0.35)',
          }}>
            <FileText size={34} color="#fff" strokeWidth={1.8} />
          </div>

          {/* Heading */}
          <h2 style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            letterSpacing: '-0.3px',
          }}>
            Report Cards
          </h2>

          {/* Shimmer badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 16px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: '#92400E',
            background: 'linear-gradient(90deg, #FEF3C7 0%, #FDE68A 50%, #FEF3C7 100%)',
            backgroundSize: '200% auto',
            animation: 'rc-shimmer 3s linear infinite',
            marginBottom: '20px',
          }}>
            <Sparkles size={14} />
            Coming Soon
          </span>

          {/* Description */}
          <p style={{
            fontSize: '14px',
            lineHeight: '22px',
            color: 'var(--text-secondary)',
            maxWidth: '380px',
            margin: '0 auto 32px',
          }}>
            Monthly student report cards with attendance analytics, mentor remarks,
            director approval workflow, and downloadable PDF reports are being built
            and will be available shortly.
          </p>

          {/* Divider */}
          <div style={{
            width: '48px',
            height: '3px',
            borderRadius: '3px',
            background: 'linear-gradient(90deg, #F59E0B, #F97316)',
            margin: '0 auto 24px',
          }} />

          {/* Milestone checklist */}
          <div style={{
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            padding: '0 8px',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              color: 'var(--text-disabled)',
              marginBottom: '2px',
            }}>
              Development Progress
            </span>

            {milestones.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: `rc-fade-up 0.5s ease-out ${0.15 + i * 0.08}s both`,
              }}>
                {m.done ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                ) : (
                  <Circle size={18} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: '13.5px',
                  fontWeight: m.done ? 500 : 400,
                  color: m.done ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textDecoration: m.done ? 'line-through' : 'none',
                  opacity: m.done ? 0.7 : 1,
                }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* Footer timestamp */}
          <div style={{
            marginTop: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '11.5px',
            color: 'var(--text-disabled)',
          }}>
            <Clock size={13} />
            <span>Estimated availability: August 2026</span>
          </div>
        </div>
      </div>
    </>
  );
}
