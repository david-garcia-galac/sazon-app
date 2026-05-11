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

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `La imagen supera el límite de 8 MB (recibida: ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 413 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const result = await uploadBuffer(buffer)
    return NextResponse.json({ url: result.secure_url, public_id: result.public_id })
  } catch (err) {
    console.error('[upload] Cloudinary error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
