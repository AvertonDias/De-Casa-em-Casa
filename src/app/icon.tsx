import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 24,
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <img
          width="32"
          height="32"
          src={`data:image/png;base64,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`}
        />
      </div>
    ),
    // ...other options
  )
}
