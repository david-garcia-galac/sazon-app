import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary'

export const dynamic = 'force-dynamic'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function uploadBuffer(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'sazon-amparo', resource_type: 'image' },
      (err: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (err || !result) reject(err ?? new Error('Upload failed'))
        else resolve(result)
      }
    ).end(buffer)
  })
}

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB (Vercel Hobby limit is 4.5 MB)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Imagen demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo 4 MB.` },
      { status: 413 }
    )
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('[upload] Faltan variables de entorno de Cloudinary')
    return NextResponse.json({ error: 'Configuración de Cloudinary incompleta' }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const result = await uploadBuffer(buffer)
    return NextResponse.json({ url: result.secure_url, public_id: result.public_id })
  } catch (err: any) {
    console.error('[upload] Cloudinary error:', err?.message ?? err)
    const msg = typeof err?.message === 'string' ? err.message : 'Error al subir la imagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
