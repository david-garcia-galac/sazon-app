import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary'
import { logDbFail, logDbOk } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  })
}

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB (Vercel Hobby request limit ~4.5 MB)

function uploadBuffer(buffer: Buffer, publicId: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: 'sazon-amparo/reportes',
          resource_type: 'raw',
          public_id: publicId,
          format: 'pdf',
          overwrite: true,
          // type:'upload' por defecto → URL pública, ideal para link en WhatsApp.
        },
        (err: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (err || !result) reject(err ?? new Error('Upload failed'))
          else resolve(result)
        }
      )
      .end(buffer)
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    logDbFail('reportes', 'upload', new Error('Cloudinary env incompleto'))
    return jsonNoStore({ error: 'Configuración de Cloudinary incompleta' }, { status: 500 })
  }

  let filename = 'reporte.pdf'
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const fnIn = formData.get('filename')
    if (typeof fnIn === 'string' && fnIn.endsWith('.pdf')) filename = fnIn

    if (!file) return jsonNoStore({ error: 'No file' }, { status: 400 })
    if (file.size > MAX_BYTES)
      return jsonNoStore(
        {
          error: `PDF demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo 4 MB.`,
        },
        { status: 413 }
      )

    const buffer = Buffer.from(await file.arrayBuffer())
    const publicId = filename.replace(/\.pdf$/i, '')

    const result = await uploadBuffer(buffer, publicId)
    logDbOk('reportes', 'upload', {
      filename,
      bytes: file.size,
      public_id: result.public_id,
    })

    return jsonNoStore({
      url: result.secure_url,
      public_id: result.public_id,
      bytes: file.size,
      filename,
    })
  } catch (err: any) {
    logDbFail('reportes', 'upload', err, { filename })
    return jsonNoStore(
      { error: typeof err?.message === 'string' ? err.message : 'Error al subir el PDF' },
      { status: 500 }
    )
  }
}
