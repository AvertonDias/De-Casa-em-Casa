import { ImageResponse } from 'next/og'
import path from 'path';
import { readFileSync } from 'fs';

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
  // Lê a imagem diretamente do sistema de arquivos na pasta public
  const imagePath = path.join(process.cwd(), 'public', 'images', 'Logo_v3.png');
  const imageData = readFileSync(imagePath);

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
