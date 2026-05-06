import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
export default sql

// ─── Schema SQL ───────────────────────────────────────────────────────────────
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS ingresos (
  id          TEXT PRIMARY KEY,
  fecha       DATE NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('desayuno','almuerzo')),
  bebida      TEXT,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  monto       NUMERIC(12,2) NOT NULL,
  moneda      TEXT NOT NULL DEFAULT 'BS',
  tasa        NUMERIC(10,2),
  monto_usd   NUMERIC(12,2),
  forma_pago  TEXT NOT NULL CHECK (forma_pago IN ('efectivo','pago_movil')),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS egresos (
  id            TEXT PRIMARY KEY,
  fecha         DATE NOT NULL,
  categoria     TEXT NOT NULL,
  proveedor     TEXT,
  descripcion   TEXT,
  monto         NUMERIC(12,2) NOT NULL,
  moneda        TEXT NOT NULL DEFAULT 'BS',
  tasa          NUMERIC(10,2),
  monto_bs      NUMERIC(12,2),
  forma_pago    TEXT NOT NULL,
  foto_url      TEXT,
  foto_public_id TEXT,
  proveedor_id  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proveedores (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  categoria   TEXT,
  telefono    TEXT,
  tiene_credito BOOLEAN DEFAULT FALSE,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deudas_proveedor (
  id              TEXT PRIMARY KEY,
  proveedor_id    TEXT NOT NULL REFERENCES proveedores(id),
  egreso_id       TEXT REFERENCES egresos(id),
  monto_total     NUMERIC(12,2) NOT NULL,
  monto_pagado    NUMERIC(12,2) DEFAULT 0,
  moneda          TEXT DEFAULT 'BS',
  fecha_compra    DATE NOT NULL,
  fecha_vencimiento DATE,
  estado          TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagado')),
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id          TEXT PRIMARY KEY,
  deuda_id    TEXT NOT NULL REFERENCES deudas_proveedor(id),
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL,
  forma_pago  TEXT NOT NULL,
  comprobante_url TEXT,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventario (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  categoria   TEXT NOT NULL CHECK (categoria IN ('desayuno','almuerzo','general')),
  unidad      TEXT NOT NULL DEFAULT 'unidad',
  stock_actual NUMERIC(10,2) DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 0,
  notas       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id            TEXT PRIMARY KEY,
  inventario_id TEXT NOT NULL REFERENCES inventario(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('compra','consumo','ajuste')),
  cantidad      NUMERIC(10,2) NOT NULL,
  fecha         DATE NOT NULL,
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasa_cambio (
  id        TEXT PRIMARY KEY,
  fecha     DATE NOT NULL,
  tasa_bs   NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingresos_fecha    ON ingresos(fecha);
CREATE INDEX IF NOT EXISTS idx_egresos_fecha     ON egresos(fecha);
CREATE INDEX IF NOT EXISTS idx_egresos_categoria ON egresos(categoria);
CREATE INDEX IF NOT EXISTS idx_deudas_proveedor  ON deudas_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_deudas_estado     ON deudas_proveedor(estado);
`

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS ingresos (
      id          TEXT PRIMARY KEY,
      fecha       DATE NOT NULL,
      tipo        TEXT NOT NULL,
      bebida      TEXT,
      cantidad    INTEGER NOT NULL DEFAULT 1,
      monto       NUMERIC(12,2) NOT NULL,
      moneda      TEXT NOT NULL DEFAULT 'BS',
      tasa        NUMERIC(10,2),
      monto_usd   NUMERIC(12,2),
      forma_pago  TEXT NOT NULL,
      notas       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS egresos (
      id            TEXT PRIMARY KEY,
      fecha         DATE NOT NULL,
      categoria     TEXT NOT NULL,
      proveedor     TEXT,
      descripcion   TEXT,
      monto         NUMERIC(12,2) NOT NULL,
      moneda        TEXT NOT NULL DEFAULT 'BS',
      tasa          NUMERIC(10,2),
      monto_bs      NUMERIC(12,2),
      forma_pago    TEXT NOT NULL,
      foto_url      TEXT,
      foto_public_id TEXT,
      proveedor_id  TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS proveedores (
      id            TEXT PRIMARY KEY,
      nombre        TEXT NOT NULL,
      categoria     TEXT,
      telefono      TEXT,
      tiene_credito BOOLEAN DEFAULT FALSE,
      notas         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS deudas_proveedor (
      id                TEXT PRIMARY KEY,
      proveedor_id      TEXT NOT NULL,
      egreso_id         TEXT,
      monto_total       NUMERIC(12,2) NOT NULL,
      monto_pagado      NUMERIC(12,2) DEFAULT 0,
      moneda            TEXT DEFAULT 'BS',
      fecha_compra      DATE NOT NULL,
      fecha_vencimiento DATE,
      estado            TEXT DEFAULT 'pendiente',
      notas             TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS pagos_proveedor (
      id              TEXT PRIMARY KEY,
      deuda_id        TEXT NOT NULL,
      monto           NUMERIC(12,2) NOT NULL,
      fecha           DATE NOT NULL,
      forma_pago      TEXT NOT NULL,
      comprobante_url TEXT,
      notas           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS inventario (
      id           TEXT PRIMARY KEY,
      nombre       TEXT NOT NULL,
      categoria    TEXT NOT NULL,
      unidad       TEXT NOT NULL DEFAULT 'unidad',
      stock_actual NUMERIC(10,2) DEFAULT 0,
      stock_minimo NUMERIC(10,2) DEFAULT 0,
      notas        TEXT,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id            TEXT PRIMARY KEY,
      inventario_id TEXT NOT NULL,
      tipo          TEXT NOT NULL,
      cantidad      NUMERIC(10,2) NOT NULL,
      fecha         DATE NOT NULL,
      notas         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS tasa_cambio (
      id         TEXT PRIMARY KEY,
      fecha      DATE NOT NULL,
      tasa_bs    NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}
