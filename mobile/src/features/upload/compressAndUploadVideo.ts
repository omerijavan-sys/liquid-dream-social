import * as FileSystem from 'expo-file-system/legacy'
import { Video } from 'react-native-compressor'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
const MAX_BITRATE = 10_000_000
const MAX_DIMENSION = 1280

type UploadProgress = (progress: number) => void

export async function compressAndUploadVideo(
  inputUri: string,
  userId: string,
  supabase: SupabaseClient,
  onProgress?: UploadProgress,
): Promise<{ path: string; publicUrl: string }> {
  const compressedUri = await Video.compress(
    inputUri,
    {
      compressionMethod: 'auto',
      maxSize: MAX_DIMENSION,
      bitrate: MAX_BITRATE,
      minimumFileSizeForCompress: 0,
    },
    progress => onProgress?.(Math.max(0, Math.min(1, progress))),
  )

  const info = await FileSystem.getInfoAsync(compressedUri)
  if (!info.exists || !info.size) throw new Error('Compressed video is unavailable')
  if (info.size > MAX_UPLOAD_BYTES) {
    throw new Error('Compressed video exceeds the 30 MB upload limit')
  }

  const response = await fetch(compressedUri)
  if (!response.ok) throw new Error('Unable to read compressed video')
  const video = await response.arrayBuffer()
  const path = `${userId}/${Date.now()}.mp4`

  const { error } = await supabase.storage.from('videos').upload(path, video, {
    contentType: 'video/mp4',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from('videos').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}
