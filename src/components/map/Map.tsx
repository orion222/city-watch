'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MarkerData } from '../../types/Marker'
import { useMarkers } from '../../contexts/MarkersContext'
import PopupDetail from './PopupDetail'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})



interface MapProps {
  markers: MarkerData[]
  center: [number, number]
}

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null)

  const map = useMapEvents({
    click() {
      map.locate()
    },
    locationfound(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
      map.flyTo(e.latlng, map.getZoom())
    },
  })

  return position === null ? null : (
    <Marker position={position}>
      <Popup>You are here</Popup>
    </Marker>
  )
}

const basemapURL = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
export default function Map({ markers, center }: MapProps) {
  const { setActiveMarker } = useMarkers();
  return (
    <MapContainer
      center={center}
      zoom={15}
      className='h-96 w-full left-0 border-b border-t border-border shadow-medium'
      style={{ height: '100%', width: '120vw', marginLeft: '-10vw', zIndex: '30'}}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={basemapURL}
      />
      {
      markers.map(function(marker, idx) {
        return (
          <Marker
            key={marker.id}
            position={marker.position }
            eventHandlers={{
              click: (e) => {
                setActiveMarker(marker);
                console.log('Marker clicked:', marker);
              },
              add: (e) => {
                if (idx === 0) e.target.openPopup(); // conditionally open
              },
            }}
          >
            <Popup>
              <PopupDetail data={marker}/>
            </Popup>
          </Marker>
        )
      })
      }
      <LocationMarker />
    </MapContainer>
  )
}