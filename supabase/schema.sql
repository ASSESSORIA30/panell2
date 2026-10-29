-- ============================================================================
-- Assessoria 3.0 Intelligence · Esquema para Supabase (PostgreSQL)
-- NO activar el almacenamiento centralizado de datos personales hasta tener
-- configurada la autenticación (Supabase Auth) y asignados los roles.
-- ============================================================================

-- Roles de la aplicación -----------------------------------------------------
create type app_role as enum ('admin', 'gestor', 'lectura');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role app_role not null default 'lectura',
  created_at timestamptz not null default now()
);

create or replace function public.current_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Importaciones ---------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  mode text not null check (mode in ('replace', 'merge')),
  rows integer not null,
  added integer not null,
  updated integer not null,
  unchanged integer not null,
  errors integer not null,
  warnings integer not null,
  imported_by uuid references auth.users (id),
  imported_at timestamptz not null default now()
);

-- Contratos (datos no sensibles) ------------------------------------------------
create table public.contracts (
  id text primary key,                 -- clave de deduplicación generada en la importación
  base_key text not null,
  client_key text not null,            -- CIF normalizado (hash) o nombre
  nombre text not null,
  poblacion text,
  provincia text,
  provincia_code char(2),
  cp char(5),
  tipo text not null,
  comercializadora text not null,
  tarifa text not null,
  producto text,
  cups text,
  consumo numeric,
  potencia numeric,
  p_contratada numeric[],
  f_carterizacion date,
  f_tramitacion date,
  f_activacion date,
  f_baja date,
  f_traspaso date,
  comision_venta numeric(12,2),
  comision_subdominio numeric(12,2),
  estado text not null,
  estado_raw text,
  observaciones text,
  flags jsonb not null default '{}',
  owners text[] not null,
  issues text[] not null default '{}',
  source_file text,
  source_row integer,
  import_id uuid references public.imports (id),
  updated_at timestamptz not null default now()
);
create index on public.contracts (f_tramitacion);
create index on public.contracts (comercializadora);
create index on public.contracts (estado);
create index on public.contracts using gin (owners);

-- Datos sensibles separados: solo administradores ------------------------------
create table public.contract_pii (
  contract_id text primary key references public.contracts (id) on delete cascade,
  cif text,
  direccion text,
  iban text,
  telefono text,
  email text
);

-- Preparado para liquidaciones y costes reales ---------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  contract_id text references public.contracts (id),
  concept text not null check (concept in ('venta', 'subdominio', 'otro')),
  amount numeric(12,2) not null,
  status text not null check (status in ('pendiente', 'cobrado', 'anulado')),
  settled_at date,
  reference text,
  created_at timestamptz not null default now()
);
create table public.costs (
  id uuid primary key default gen_random_uuid(),
  contract_id text references public.contracts (id),
  owner_email text,
  amount numeric(12,2) not null,
  description text,
  incurred_at date
);

-- Perfiles de usuarios propietarios del CRM -----------------------------------
create table public.owner_profiles (
  email text primary key,
  name text,
  category text not null default 'sin_clasificar'
);

-- Seguridad a nivel de fila ----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.imports enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_pii enable row level security;
alter table public.settlements enable row level security;
alter table public.costs enable row level security;
alter table public.owner_profiles enable row level security;

create policy "perfil propio" on public.profiles for select using (id = auth.uid() or public.current_role() = 'admin');
create policy "lectura autenticada" on public.contracts for select using (auth.uid() is not null);
create policy "escritura gestores" on public.contracts for all using (public.current_role() in ('admin', 'gestor')) with check (public.current_role() in ('admin', 'gestor'));
create policy "pii solo admin" on public.contract_pii for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "imports lectura" on public.imports for select using (auth.uid() is not null);
create policy "imports escritura" on public.imports for insert with check (public.current_role() in ('admin', 'gestor'));
create policy "liquidaciones admin" on public.settlements for all using (public.current_role() = 'admin');
create policy "costes admin" on public.costs for all using (public.current_role() = 'admin');
create policy "owners lectura" on public.owner_profiles for select using (auth.uid() is not null);
create policy "owners escritura" on public.owner_profiles for all using (public.current_role() in ('admin', 'gestor'));
