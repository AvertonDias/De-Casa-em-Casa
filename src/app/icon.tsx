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
export default async function Icon() {
  // Busca a imagem da pasta public usando fetch
  const imageResponse = await fetch(new URL('/images/Logo_v3.png', 'https://de-casa-em-casa.vercel.app'));
  const imageData = await imageResponse.arrayBuffer();

  return new ImageResponse(
    (
      <img
        src={imageData as any}
        width="32"
        height="32"
        alt="Favicon"
        style={{
          borderRadius: '4px',
        }}
      />
    ),
    {
      ...size,
    }
  )
}
