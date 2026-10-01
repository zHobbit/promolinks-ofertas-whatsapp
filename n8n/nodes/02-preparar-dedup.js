// Nó "Code" — PREPARAR DEDUP
// Junta todas as ofertas detectadas num único payload JSON (1 item),
// que o nó Postgres usa de uma vez via jsonb_to_recordset.
const arr = $input.all().map(i => ({ ...i.json, raw: i.json }));
return [{ json: { payload: JSON.stringify(arr) } }];
