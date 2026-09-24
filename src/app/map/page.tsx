'use client'
import MapInfoPanel from "@/components/MarkInfo";
import StatsOverview from "@/components/StatsOverview";
import RecentActivity from "@/components/RecentActivity";
import QuickActions from "@/components/QuickActions";
import MapWrapper from '../../components/map/MapWrapper'
import { useEffect, useState } from 'react'
import { MarkersProvider, useMarkers } from '../../contexts/MarkersContext'
import { BACKEND_URL } from '../../lib/constants'

export function MapPage() {
    const { markers, setMarkers, setAllMarkers, setActiveMarker, activeMarker } = useMarkers()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
      const fetchMarkers = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/marker`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              "ngrok-skip-browser-warning": "true",
            }
          })
          const data = await response.json()
          setMarkers(data?.markers || [])
          setAllMarkers(data?.markers || []);
          setActiveMarker(data?.markers[0] ?? activeMarker)
        } catch (error) {
          console.error('Error fetching markers:', error)
          setMarkers([])
        } finally {
          setMounted(true)
        }
      }

      fetchMarkers()
    }, [])

    if (!mounted || !markers) {
      return (
        <div className={`flex items-center justify-center bg-gray-100 h-96 w-full`}>
          <div className="text-gray-500">Loading interactive map...</div>
        </div>
      )
    }


  return (
    <div className="font-sans bg-background min-h-screen overflow-x-hidden">
      <main>
        <section className="relative overflow-hidden">
          {/* Map-themed background pattern */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Grid pattern */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(to right, var(--primary) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--primary) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                opacity: 0.08
              }}
            ></div>
            {/* Gradient overlays for depth */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-primary/15 to-transparent blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-accent/15 to-transparent blur-3xl"></div>
            {/* Pin marker accent */}
            <div className="absolute top-10 right-20 text-primary/25 text-6xl">📍</div>
            <div className="absolute bottom-20 left-32 text-primary/20 text-5xl">🗺️</div>
          </div>

          <div className="max-w-7xl mx-auto px-8 py-8 relative z-10">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Live Map</h1>
              <p className="text-muted-foreground">Track and monitor real-time reports</p>
            </div>
          </div>
        </section>

        <div className="h-[500px] w-full relative overflow-x-hidden">
          <MapWrapper/>
          <MapInfoPanel />
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <StatsOverview />
              <RecentActivity />
            </div>
            <div className="space-y-6">
              <QuickActions />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MapPageWrapper() {
  return (
    <MarkersProvider>
      <MapPage />
    </MarkersProvider>
  )
}