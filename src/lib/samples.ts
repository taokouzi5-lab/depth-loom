export type SampleId = 'landscape' | 'street' | 'portrait'

export interface SampleImage {
  id: SampleId
  src: string
  thumbnail: string
  fileName: string
}

const base = import.meta.env.BASE_URL

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'landscape',
    src: `${base}samples/landscape.jpg`,
    thumbnail: `${base}samples/thumbs/landscape.jpg`,
    fileName: 'landscape.jpg',
  },
  {
    id: 'street',
    src: `${base}samples/street.jpg`,
    thumbnail: `${base}samples/thumbs/street.jpg`,
    fileName: 'street.jpg',
  },
  {
    id: 'portrait',
    src: `${base}samples/portrait.jpg`,
    thumbnail: `${base}samples/thumbs/portrait.jpg`,
    fileName: 'portrait.jpg',
  },
]
