'use client';

import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface EventItem {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps?: any;
}

interface ScheduleCalendarProps {
  events: EventItem[];
  onEventClick?: (info: any) => void;
}

export default function ScheduleCalendar({ events, onEventClick }: ScheduleCalendarProps) {
  return (
    <div style={{ 
      height: '650px', 
      backgroundColor: 'var(--surface-card)', 
      padding: '20px', 
      borderRadius: 'var(--radius-card)', 
      border: '1px solid var(--border-color)', 
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden'
    }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay'
        }}
        slotMinTime="08:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        events={events}
        eventClick={onEventClick}
        height="100%"
        themeSystem="standard"
        expandRows={true}
        slotEventOverlap={false}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
      />
    </div>
  );
}
