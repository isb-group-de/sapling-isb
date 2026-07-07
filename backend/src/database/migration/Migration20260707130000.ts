import { Migration } from '@mikro-orm/migrations';

export class Migration20260707130000 extends Migration {
  override up(): void {
    const dialingCode = this.getDefaultDialingCode();

    this.addSql(`
      create or replace function sapling_normalize_phone(value text, default_dialing_code text)
      returns text
      language plpgsql
      immutable
      as $$
      declare
        raw text := btrim(value);
        digits text;
        candidate text;
        national text;
        formatted text;
        position int;
      begin
        if raw is null or raw = '' then
          return null;
        end if;

        digits := regexp_replace(raw, '\\D', '', 'g');
        if digits = '' then
          return null;
        end if;

        if left(raw, 1) = '+' then
          candidate := '+' || digits;
        elsif left(digits, 2) = '00' then
          candidate := '+' || substring(digits from 3);
        elsif default_dialing_code <> '' and left(digits, 1) = '0' then
          candidate := '+' || default_dialing_code || substring(digits from 2);
        elsif default_dialing_code <> '' and left(digits, length(default_dialing_code)) = default_dialing_code then
          candidate := '+' || digits;
        else
          candidate := digits;
        end if;

        if left(candidate, 1) <> '+' then
          return candidate;
        end if;

        if default_dialing_code <> '' and left(candidate, length(default_dialing_code) + 1) = '+' || default_dialing_code then
          national := substring(candidate from length(default_dialing_code) + 2);

          formatted := '+' || default_dialing_code;
          position := 1;
          while position <= length(national) loop
            formatted := formatted || ' ' || substring(national from position for 3);
            position := position + 3;
          end loop;

          return formatted;
        end if;

        return candidate;
      end;
      $$;
    `);

    this.normalizeNullableColumn('person_item', 'phone', dialingCode);
    this.normalizeNullableColumn('person_item', 'mobile', dialingCode);
    this.normalizeNullableColumn('company_item', 'phone', dialingCode);
    this.normalizeNullableColumn('company_item', 'mobile', dialingCode);
    this.normalizeNullableColumn('address_item', 'phone', dialingCode);
    this.normalizeNullableColumn('address_item', 'mobile', dialingCode);
    this.normalizeRequiredColumn(
      'phone_call_item',
      'phone_number',
      dialingCode,
    );

    this.addSql(`drop function if exists sapling_normalize_phone(text, text);`);
  }

  override down(): void {
    this.addSql(`drop function if exists sapling_normalize_phone(text, text);`);
  }

  private normalizeNullableColumn(
    tableName: string,
    columnName: string,
    dialingCode: string,
  ): void {
    this.addSql(`
      update "${tableName}"
      set "${columnName}" = sapling_normalize_phone("${columnName}", '${dialingCode}')
      where "${columnName}" is not null
        and "${columnName}" is distinct from sapling_normalize_phone("${columnName}", '${dialingCode}');
    `);
  }

  private normalizeRequiredColumn(
    tableName: string,
    columnName: string,
    dialingCode: string,
  ): void {
    this.addSql(`
      update "${tableName}"
      set "${columnName}" = sapling_normalize_phone("${columnName}", '${dialingCode}')
      where sapling_normalize_phone("${columnName}", '${dialingCode}') is not null
        and "${columnName}" is distinct from sapling_normalize_phone("${columnName}", '${dialingCode}');
    `);
  }

  private getDefaultDialingCode(): string {
    return (process.env.SAPLING_DEFAULT_PHONE_DIALING_CODE || '49').replace(
      /\D/g,
      '',
    );
  }
}
