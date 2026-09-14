"use client"

import { MarkerData } from '../../types/Marker'
import { Badge } from "@/components/ui/badge";

interface PopupDetailProps {
  data: MarkerData
}

export default function PopupDetail({ data }: PopupDetailProps) {
  const timestamp = new Date(data.timestamp);
  return (
    <div className="flex flex-col space-y-2 p-2 min-w-[200px]">
      {data.image_url && (
        <div className="w-full h-28 overflow-hidden rounded-md bg-black/5 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image_url}
            alt={data.title || "Incident image"}
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">Report ID</span>
        <span className="text-sm text-gray-900">{data.id}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">Title</span>
        <span className="text-sm text-gray-900 capitalize">{data.title}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">Position</span>
        <span className="text-sm text-gray-900">
          {data.position[0].toFixed(4)}, {data.position[1].toFixed(4)}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">Report Time</span>
        <span className="text-sm text-gray-900">{timestamp.toLocaleString()}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">Status</span>
        <span className={`text-sm font-medium py-1 rounded-full`}>
          <Badge variant={data.status === "Resolved" ? "success" : (data.status === 'Pending' ? "warning": "secondary")}>
            {data.status}
          </Badge>
        </span>
      </div>
    </div>
  )
}