import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'

type ReelVideoProps = {
  uri: string
  active: boolean
  preload: boolean
  lowGraphics: boolean
  muted?: boolean
}

export function ReelVideo({ uri, active, preload, lowGraphics, muted = true }: ReelVideoProps) {
  const shouldLoad = active || (preload && !lowGraphics)
  const player = useVideoPlayer(
    shouldLoad ? { uri, contentType: 'hls', useCaching: !lowGraphics } : null,
    instance => {
      instance.loop = true
      instance.muted = muted
      instance.timeUpdateEventInterval = 0
    },
  )

  useEffect(() => {
    if (active && shouldLoad) player.play()
    else player.pause()
    return () => player.pause()
  }, [active, player, shouldLoad])

  return (
    <View style={styles.container}>
      {shouldLoad ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}
      {active && player.status === 'loading' ? (
        <ActivityIndicator style={styles.loader} color="white" />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#08090c' },
  loader: { ...StyleSheet.absoluteFill },
})
