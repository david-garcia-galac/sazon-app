import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary'

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const result = await uploadBuffer(buffer)
    return NextResponse.json({ url: result.secure_url, public_id: result.public_id })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
