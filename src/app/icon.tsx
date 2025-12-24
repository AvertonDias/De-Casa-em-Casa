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
  // A imagem está na pasta /public, então o Next.js a serve na raiz.
  // Construímos a URL absoluta para a imagem.
  const imageUrl = `${process.env.VERCEL_URL ? 'https' : 'http'}://${process.env.VERCEL_URL || 'localhost:3000'}/images/Logo_v3.png`;
  
  const imageData = await fetch(imageUrl).then((res) => res.arrayBuffer());

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
