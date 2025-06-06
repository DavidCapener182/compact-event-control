'use client'

import React, { useState, useEffect, useRef } from 'react'
import IncidentTable from './IncidentTable'
import CurrentEvent from './CurrentEvent'
import EventCreationModal from './EventCreationModal'
import IncidentCreationModal from './IncidentCreationModal'
import VenueOccupancy from './VenueOccupancy'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import {
  UsersIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  UserGroupIcon,
  HeartIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline'
import WeatherCard from './WeatherCard'

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  color?: string
  isSelected?: boolean
  onClick?: () => void
  isFilterable?: boolean
}

interface EventTiming {
  title: string
  time: string
  isNext?: boolean
}

const TimeCard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString('en-GB'));
  const [eventTimings, setEventTimings] = useState<EventTiming[]>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [nextEvent, setNextEvent] = useState<EventTiming | null>(null);
  const [artistName, setArtistName] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!nextEvent) return;

    const calculateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = nextEvent.time.split(':').map(Number);
      const eventTime = new Date(now);
      eventTime.setHours(hours, minutes, 0);

      if (eventTime < now) {
        eventTime.setDate(eventTime.getDate() + 1);
      }

      const diff = eventTime.getTime() - now.getTime();
      const hours_remaining = Math.floor(diff / (1000 * 60 * 60));
      const minutes_remaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds_remaining = Math.floor((diff % (1000 * 60)) / 1000);

      return `${hours_remaining}h ${minutes_remaining}m ${seconds_remaining}s`;
    };

    const countdownTimer = setInterval(() => {
      setCountdown(calculateCountdown());
    }, 1000);

    setCountdown(calculateCountdown());

    return () => clearInterval(countdownTimer);
  }, [nextEvent]);

  useEffect(() => {
    const fetchEventTimings = async () => {
      const { data: event } = await supabase
        .from('events')
        .select(`
          security_call_time,
          main_act_start_time,
          show_down_time,
          show_stop_meeting_time,
          doors_open_time,
          curfew_time,
          event_name
        `)
        .eq('is_current', true)
        .single();

      if (event) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeNumber = currentHours * 60 + currentMinutes;

        setArtistName(event.event_name);

        const timings: EventTiming[] = [
          { title: 'Security Call', time: event.security_call_time },
          { title: 'Doors Open', time: event.doors_open_time },
          { title: event.event_name, time: event.main_act_start_time },
          { title: 'Show Stop Meeting', time: event.show_stop_meeting_time },
          { title: 'Show Down', time: event.show_down_time },
          { title: 'Curfew', time: event.curfew_time }
        ].filter(timing => timing.time); // Only show timings that have been set

        // Convert times to minutes since midnight for comparison
        const timingsWithMinutes = timings.map(timing => {
          const [hours, minutes] = timing.time.split(':').map(Number);
          const timeInMinutes = hours * 60 + minutes;
          return {
            ...timing,
            minutesSinceMidnight: timeInMinutes
          };
        });

        // Filter to only future events and sort by time
        const futureTimings = timingsWithMinutes
          .filter(t => t.minutesSinceMidnight > currentTimeNumber)
          .sort((a, b) => a.minutesSinceMidnight - b.minutesSinceMidnight);

        // Take only the next 3 events and mark the nearest one
        const nextThreeTimings = futureTimings.slice(0, 3).map((timing, index) => ({
          title: timing.title,
          time: timing.time,
          isNext: index === 0
        }));

        setEventTimings(nextThreeTimings);
        setNextEvent(nextThreeTimings[0] || null);
      }
    };

    fetchEventTimings();
    // Refresh timings every minute
    const refreshTimer = setInterval(fetchEventTimings, 60000);
    return () => clearInterval(refreshTimer);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Current Time</h2>
          <p className="text-3xl font-bold text-gray-900 mb-4">{currentTime}</p>
          {nextEvent && (
            <div className="mt-2">
              <h3 className="text-sm font-medium text-gray-500">Time until {nextEvent.title}</h3>
              <p className="text-lg font-bold text-blue-600">{countdown}</p>
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Event Schedule</h2>
          <div className="space-y-2">
            {eventTimings.map((timing, index) => (
              <div 
                key={index} 
                className={`flex justify-between items-center p-2 rounded ${
                  timing.isNext ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <span className={`text-sm font-medium ${timing.isNext ? 'text-blue-600' : 'text-gray-500'}`}>
                  {timing.title}
                </span>
                <span className={`text-sm font-bold ${timing.isNext ? 'text-blue-700' : 'text-gray-900'}`}>
                  {timing.time}
                </span>
              </div>
            ))}
            {eventTimings.length === 0 && (
              <p className="text-sm text-gray-500">No upcoming event timings</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  color = 'blue', 
  isSelected, 
  onClick, 
  isFilterable = false 
}) => {
  const colorClasses = {
    blue: 'text-blue-500',
    red: 'text-red-500',
    yellow: 'text-yellow-500',
    green: 'text-green-500',
  }

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 
        ${isFilterable ? 'cursor-pointer' : ''} 
        ${isFilterable && isSelected ? 'border-2 border-red-500' : 'border border-gray-100'}`}
      onClick={isFilterable ? onClick : undefined}
    >
      <div className="flex flex-col items-center justify-center space-y-1">
        <div className={`${colorClasses[color as keyof typeof colorClasses]} w-8 h-8`}>
          {icon}
        </div>
        <p className="text-4xl font-bold text-gray-900">{value}</p>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false)
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false)
  const [currentEventId, setCurrentEventId] = useState<string | null>(null)
  const [incidentStats, setIncidentStats] = useState({
    total: 0,
    high: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    logged: 0,
    avgResolution: 0,
    refusals: 0,
    ejections: 0,
    medical: 0
  })
  const subscriptionRef = useRef<RealtimeChannel | null>(null)

  // Default coordinates for London (you can update these based on the event location)
  const eventLocation = {
    lat: 51.5074,
    lon: -0.1278
  };

  const checkCurrentEvent = async () => {
    try {
      const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('is_current', true)
        .single()

      setCurrentEventId(event?.id || null)
      setHasCurrentEvent(!!event)
    } catch (error) {
      console.error('Error checking current event:', error)
    }
  }

  const fetchIncidentStats = async () => {
    try {
      // Get current event first
      const { data: currentEvent } = await supabase
        .from('events')
        .select('id')
        .eq('is_current', true)
        .single()

      if (!currentEvent) return

      // Get all incidents for current event
      const { data: incidents } = await supabase
        .from('incident_logs')
        .select('*')
        .eq('event_id', currentEvent.id)

      if (!incidents) return

      const nonSitRepIncidents = incidents.filter(i => i.incident_type !== 'Sit Rep')
      const sitRepIncidents = incidents.filter(i => i.incident_type === 'Sit Rep')

      setIncidentStats({
        total: incidents.length,
        high: incidents.filter(i => ['Ejection', 'Code Green', 'Code Black', 'Code Pink'].includes(i.incident_type)).length,
        open: nonSitRepIncidents.filter(i => !i.is_closed).length,
        inProgress: nonSitRepIncidents.filter(i => !i.is_closed && i.action_taken).length,
        closed: nonSitRepIncidents.filter(i => i.is_closed).length,
        logged: sitRepIncidents.length,
        avgResolution: 0,
        refusals: incidents.filter(i => i.incident_type === 'Refusal').length,
        ejections: incidents.filter(i => i.incident_type === 'Ejection').length,
        medical: incidents.filter(i => ['Code Green', 'Code Purple'].includes(i.incident_type)).length
      })
    } catch (err) {
      console.error('Error fetching incident stats:', err)
    }
  }

  // Cleanup function to handle unsubscribe
  const cleanup = () => {
    if (subscriptionRef.current) {
      console.log('Cleaning up dashboard subscription');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  };

  useEffect(() => {
    checkCurrentEvent();
    fetchIncidentStats();

    // Clean up any existing subscription
    cleanup();

    // Set up new subscription
    subscriptionRef.current = supabase
      .channel(`dashboard_incident_changes_${Date.now()}`)
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'incident_logs'
        }, 
        () => {
          fetchIncidentStats();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return cleanup;
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Incidents</h1>
        {!hasCurrentEvent && (
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Create Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <CurrentEvent />
        <TimeCard />
      </div>
      
      {/* Incident Dashboard */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Incident Dashboard</h2>
          <button 
            onClick={() => setIsIncidentModalOpen(true)}
            disabled={!hasCurrentEvent}
            className={`px-4 py-2 rounded-md ${
              hasCurrentEvent 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            New Incident
          </button>
        </div>
        <p className="text-gray-600 mb-6">Track and manage security incidents in real-time</p>
        
        {/* Stats Grid - First Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Total Incidents"
            value={incidentStats.total}
            icon={<ClipboardDocumentCheckIcon />}
            isFilterable={false}
          />
          <StatCard
            title="High Priority"
            value={incidentStats.high}
            icon={<ExclamationTriangleIcon />}
            color="red"
            isFilterable={true}
            isSelected={selectedFilter === 'high'}
            onClick={() => setSelectedFilter(selectedFilter === 'high' ? null : 'high')}
          />
          <StatCard
            title="Open"
            value={incidentStats.open}
            icon={<FolderOpenIcon />}
            color="yellow"
            isFilterable={true}
            isSelected={selectedFilter === 'open'}
            onClick={() => setSelectedFilter(selectedFilter === 'open' ? null : 'open')}
          />
          <StatCard
            title="Closed"
            value={incidentStats.closed}
            icon={<CheckCircleIcon />}
            color="green"
            isFilterable={true}
            isSelected={selectedFilter === 'closed'}
            onClick={() => setSelectedFilter(selectedFilter === 'closed' ? null : 'closed')}
          />
          <StatCard
            title="Refusals"
            value={incidentStats.refusals}
            icon={<UsersIcon />}
            color="red"
            isFilterable={true}
            isSelected={selectedFilter === 'refusals'}
            onClick={() => setSelectedFilter(selectedFilter === 'refusals' ? null : 'refusals')}
          />
          <StatCard
            title="Ejections"
            value={incidentStats.ejections}
            icon={<UsersIcon />}
            color="red"
            isFilterable={true}
            isSelected={selectedFilter === 'ejections'}
            onClick={() => setSelectedFilter(selectedFilter === 'ejections' ? null : 'ejections')}
          />
        </div>

        {/* Stats Grid - Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-24">
          <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 h-[120px] border border-gray-100">
            <h3 className="text-gray-500 text-sm mb-2">Venue Occupancy</h3>
            <div className="flex items-center">
              <span className="text-2xl font-bold">3,500</span>
              <span className="text-gray-500 ml-2">/ 3,500</span>
            </div>
            <div className="mt-2">
              <div className="bg-orange-100 rounded-full h-1">
                <div className="bg-orange-500 h-1 rounded-full w-full"></div>
              </div>
            </div>
          </div>
          <div className="rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
            <WeatherCard 
              lat={53.4084} 
              lon={-2.9916}
              locationName="O2 Academy Liverpool"
            />
          </div>
        </div>

        {/* Incident Table */}
        <IncidentTable />
      </div>

      <EventCreationModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onEventCreated={async () => {
          setIsEventModalOpen(false)
          await checkCurrentEvent()
        }}
      />

      <IncidentCreationModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onIncidentCreated={async () => {
          await fetchIncidentStats()
        }}
      />
    </div>
  )
} 