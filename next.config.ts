import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Desactiva el router cache para que dashboard y configuracion
    // siempre lean datos frescos al navegar entre páginas.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
}

export default nextConfig
