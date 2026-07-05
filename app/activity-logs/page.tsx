'use client';

import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Clock, 
  User, 
  MapPin 
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface LogItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  branchCode: string;
  details: string;
}

export default function ActivityLogsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear } = useAppStore();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Load Logs
  useEffect(() => {
    async function loadLogs() {
      if (!currentBranch) return;
      setLoading(true);

      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*, profiles(name, role)')
          .order('created_at', { ascending: false });

        let mappedLogs: LogItem[] = (data || []).map((l: any) => ({
          id: l.id,
          timestamp: new Date(l.created_at).toLocaleString(),
          actorName: l.profiles?.name || 'System Auto',
          actorRole: l.profiles?.role || 'System',
          action: l.action,
          branchCode: currentBranch.code,
          details: JSON.stringify(l.details)
        }));



        setLogs(mappedLogs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, [currentBranch]);

  // Filters mapping
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch = branchFilter === 'All' || log.branchCode === branchFilter;

    return matchesSearch && matchesBranch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header Filters Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px' 
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '400px' }}>
          <Search size={18} style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-disabled)' 
          }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search action logs, staff members, audit descriptions..."
            style={{ paddingLeft: '38px', minHeight: '40px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Branch Filter dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="caption">Filter by Branch:</span>
          <select 
            className="form-control"
            style={{ width: '130px', padding: '6px 12px', minHeight: '36px' }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="All">All Branches</option>
            <option value="BGP">Baguipara</option>
            <option value="PUB">Pubali</option>
            <option value="CHP">Chinar Park</option>
          </select>
        </div>
      </div>

      {/* 2. Audit Trail timeline */}
      {loading ? (
        <div className="skeleton" style={{ height: '300px', width: '100%' }} />
      ) : filteredLogs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Activity size={40} style={{ color: 'var(--text-disabled)', marginBottom: '12px' }} />
          <p className="secondary-text">No audit entries found matching filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLogs.map(log => (
            <div key={log.id} className="card" style={{ 
              margin: 0, 
              padding: '16px 24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}>
              
              {/* Top row log context */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '8px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary-orange)' }}>
                    {log.action}
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '10px', backgroundColor: 'var(--surface-secondary)', color: 'var(--primary-orange)' }}>
                    {log.branchCode}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }} className="caption">
                  <Clock size={14} />
                  <span>{log.timestamp}</span>
                </div>
              </div>

              {/* Lower row log details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <p className="body-text" style={{ fontSize: '13px', lineHeight: '18px', flex: 1 }}>
                  {log.details}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="caption">
                  <User size={14} />
                  <span>{log.actorName} ({log.actorRole})</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
