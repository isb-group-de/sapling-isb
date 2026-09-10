select key, value from (
  select 'column:' || c.relname || ':' || a.attname as key,
    concat_ws('|', format_type(a.atttypid, a.atttypmod), a.attnotnull::text,
      coalesce(pg_get_expr(d.adbin, d.adrelid), ''), a.attidentity, a.attgenerated) as value
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'mikro_orm_migrations'
  union all
  select 'constraint:' || c.relname || ':' || k.conname, pg_get_constraintdef(k.oid)
  from pg_constraint k join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname <> 'mikro_orm_migrations'
  union all
  select 'index:' || tablename || ':' || indexname, indexdef
  from pg_indexes where schemaname = 'public' and tablename <> 'mikro_orm_migrations'
  union all
  select 'trigger:' || c.relname || ':' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  select distinct 'function:' || p.proname, pg_get_functiondef(p.oid)
  from pg_proc p join pg_trigger t on t.tgfoid = p.oid
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  select 'extension:' || extname, extname from pg_extension where extname in ('vector', 'pg_trgm')
  union all
  select 'enum:' || t.typname || ':' || e.enumsortorder::text, e.enumlabel
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'
) catalog order by key collate "C", value collate "C";
