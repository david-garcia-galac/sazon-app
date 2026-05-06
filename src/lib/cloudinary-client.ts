export async function uploadFoto(file: File): Promise<{ url: string; public_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Error al subir la foto')
  return res.json()
}
