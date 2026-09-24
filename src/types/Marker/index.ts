

export interface MarkerData {
  id: number;
  position: [number, number]
  description: string
  title: string
  urgency: string
  category: string
  status: string
  timestamp: string
  address_id: number | null
  address: { [key: string]: string | number | null }
  image_url?: string | null;
}
