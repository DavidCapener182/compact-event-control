'use client'

import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  currentEventId: string | null
}

export default function VenueOccupancy({ currentEventId }: Props) {
  const [currentCount, setCurrentCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [venueCapacity, setVenueCapacity] = useState<number>(3500)
  const subscriptionRef = useRef<RealtimeChannel | null>(null)

  // Cleanup function to handle unsubscribe
  const cleanup = () => {
    if (subscriptionRef.current) {
      console.log('Cleaning up subscription');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  };

  useEffect(() => {
    if (!currentEventId) {
      console.log('No currentEventId provided');
      cleanup();
      return;
    }

    console.log('Setting up venue occupancy for event:', currentEventId);

    // Fetch initial occupancy and venue capacity
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get venue capacity from events table
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('venue_capacity')
          .eq('id', currentEventId)
          .single();

        if (eventError) throw eventError;
        if (eventData?.venue_capacity) {
          setVenueCapacity(parseInt(eventData.venue_capacity));
        }

        // Get latest attendance count
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('count')
          .eq('event_id', currentEventId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (attendanceError && attendanceError.code !== 'PGRST116') {
          throw attendanceError;
        }

        if (attendanceData) {
          setCurrentCount(attendanceData.count);
        } else {
          setCurrentCount(0);
        }
      } catch (err) {
        console.error('Error fetching occupancy data:', err);
        setCurrentCount(0);
        setVenueCapacity(3500);
      } finally {
        setLoading(false);
      }
    };

    // Clean up any existing subscription before creating a new one
    cleanup();

    // Set up real-time subscription
    subscriptionRef.current = supabase
      .channel(`attendance_changes_${currentEventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `event_id=eq.${currentEventId}`
        },
        (payload) => {
          console.log('Attendance INSERT received:', payload);
          const newRecord = payload.new as { count: number };
          if (newRecord && typeof newRecord.count === 'number') {
            setCurrentCount(newRecord.count);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_records',
          filter: `event_id=eq.${currentEventId}`
        },
        (payload) => {
          console.log('Attendance UPDATE received:', payload);
          const updatedRecord = payload.new as { count: number };
          if (updatedRecord && typeof updatedRecord.count === 'number') {
            setCurrentCount(updatedRecord.count);
          }
        }
      )
      .subscribe();

    fetchData();

    // Cleanup on unmount or when currentEventId changes
    return cleanup;
  }, [currentEventId]);

  console.log('Render state:', { loading, currentCount, venueCapacity });

  if (loading) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  // Add a debug div that will show even if other parts fail
  if (!currentEventId) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="p-4">
          <p className="text-sm text-gray-500">No event selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="p-4">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="text-[#2A3990] w-8 h-8">
            <BuildingOffice2Icon className="w-full h-full" />
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900">
              {currentCount.toLocaleString()}
              <span className="text-lg text-gray-500 ml-1">/ {venueCapacity.toLocaleString()}</span>
            </p>
            <p className="text-sm font-medium text-gray-500 mt-0.5">
              Venue Occupancy
            </p>
          </div>
          {venueCapacity > 0 && (
            <div className="w-full space-y-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium" style={{ 
                  color: currentCount > venueCapacity ? '#ef4444' : 
                         currentCount >= venueCapacity * 0.9 ? '#f97316' : 
                         '#2A3990'
                }}>
                  {Math.round((currentCount / venueCapacity) * 100)}%
                </span>
                {currentCount > venueCapacity && (
                  <span className="text-xs font-medium text-red-500">
                    Over Capacity
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${Math.min(Math.round((currentCount / venueCapacity) * 100), 100)}%`,
                    backgroundColor: currentCount > venueCapacity ? '#ef4444' : 
                                   currentCount >= venueCapacity * 0.9 ? '#f97316' : 
                                   '#2A3990'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
