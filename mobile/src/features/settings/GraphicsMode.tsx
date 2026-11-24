import { Switch, Text, View } from 'react-native'

type GraphicsModeProps = {
  lowGraphics: boolean
  onChange: (enabled: boolean) => void
}

export function GraphicsMode({ lowGraphics, onChange }: GraphicsModeProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Low graphics</Text>
        <Text style={{ color: '#a5a8b1', fontSize: 13, marginTop: 4 }}>
          Turns off blur, video preloading, and local video caching.
        </Text>
      </View>
      <Switch value={lowGraphics} onValueChange={onChange} accessibilityLabel="Low graphics mode" />
    </View>
  )
}
