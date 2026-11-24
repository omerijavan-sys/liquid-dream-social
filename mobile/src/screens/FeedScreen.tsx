import { useCallback, useRef, useState } from 'react'
import { FlatList, View, useWindowDimensions, type FlatListProps } from 'react-native'
import { ReelVideo } from '../components/ReelVideo'

export type Reel = { id: string; hlsUrl: string; posterUrl?: string }

type FeedScreenProps = {
  reels: Reel[]
  lowGraphics: boolean
}

export function FeedScreen({ reels, lowGraphics }: FeedScreenProps) {
  const { height } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)

  const onViewableItemsChanged = useRef<NonNullable<FlatListProps<Reel>['onViewableItemsChanged']>>(({ viewableItems }) => {
    const visible = viewableItems.find(item => item.isViewable && typeof item.index === 'number')
    if (typeof visible?.index === 'number') {
      setActiveIndex(visible.index)
    }
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current

  const renderItem = useCallback(({ item, index }: { item: Reel; index: number }) => {
    const active = index === activeIndex
    const preload = !lowGraphics && index === activeIndex + 1
    return (
      <View style={{ height, backgroundColor: '#08090c' }}>
        <ReelVideo
          uri={item.hlsUrl}
          active={active}
          preload={preload}
          lowGraphics={lowGraphics}
        />
      </View>
    )
  }, [activeIndex, height, lowGraphics])

  return (
    <FlatList
      data={reels}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      pagingEnabled
      decelerationRate="fast"
      snapToInterval={height}
      snapToAlignment="start"
      disableIntervalMomentum
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
    />
  )
}
