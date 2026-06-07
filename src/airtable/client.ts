const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime: string;
}

interface AirtableListResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

async function airtableRequest(
  pat: string,
  baseId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${AIRTABLE_API_URL}/${baseId}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

export async function listRecords<T>(
  pat: string,
  baseId: string,
  tableName: string
): Promise<AirtableRecord<T>[]> {
  const allRecords: AirtableRecord<T>[] = [];
  let offset: string | undefined;

  do {
    const query = offset ? `?offset=${offset}` : '';
    const res = await airtableRequest(pat, baseId, `${encodeURIComponent(tableName)}${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Airtable list error: ${JSON.stringify(err)}`);
    }
    const data: AirtableListResponse<T> = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

export async function createRecord<T>(
  pat: string,
  baseId: string,
  tableName: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const res = await airtableRequest(pat, baseId, encodeURIComponent(tableName), {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable create error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function updateRecord<T>(
  pat: string,
  baseId: string,
  tableName: string,
  recordId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const res = await airtableRequest(
    pat,
    baseId,
    `${encodeURIComponent(tableName)}/${recordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable update error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function deleteRecord(
  pat: string,
  baseId: string,
  tableName: string,
  recordId: string
): Promise<void> {
  const res = await airtableRequest(
    pat,
    baseId,
    `${encodeURIComponent(tableName)}/${recordId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable delete error: ${JSON.stringify(err)}`);
  }
}

export async function createTable(
  pat: string,
  baseId: string,
  name: string,
  fields: { name: string; type: string; options?: Record<string, unknown> }[]
): Promise<void> {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      fields,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    const errType = err?.error?.type ?? '';
    const errMsg: string = (err?.error?.message ?? '').toLowerCase();
    if (errType === 'DUPLICATE_TABLE_NAME' || errMsg.includes('already exist')) {
      return; // Table already exists
    }
    throw new Error(`Airtable createTable error: ${JSON.stringify(err)}`);
  }
}

export async function listTables(
  pat: string,
  baseId: string
): Promise<{ id: string; name: string }[]> {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable listTables error: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.tables.map((t: { id: string; name: string }) => ({
    id: t.id,
    name: t.name,
  }));
}
