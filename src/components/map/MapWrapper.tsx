'use client'
import dynamic from 'next/dynamic';
import { useMarkers } from '../../contexts/MarkersContext'

const DynamicMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});

// Falling back to [0, 0] puts the viewport on Null Island, whose ocean tiles are blank,
// making an empty marker list indistinguishable from a broken map.
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832]

export default function MapWrapper() {
  const { markers } = useMarkers();

  const default_position: [number, number] = markers.length ? markers[0].position : DEFAULT_CENTER
  return (
    <DynamicMap markers={markers} center={default_position}/>
  )
}

