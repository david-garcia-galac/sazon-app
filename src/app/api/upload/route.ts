import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  return new Promise((resolve) => {
    cloudinary.uploader.upload_stream(
      { folder: 'sazon-amparo', resource_type: 'image' },
      (err, result) => {
        if (err || !result) {
          resolve(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
        } else {
          resolve(NextResponse.json({ url: result.secure_url, public_id: result.public_id }))
        }
      }
    ).end(buffer)
  })
}
