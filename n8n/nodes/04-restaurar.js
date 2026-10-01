// Nó "Code" — RESTAURAR
// O Dedup devolve cada oferta nova dentro do campo "item"; aqui desembrulhamos.
return $input.all().map(i => ({ json: i.json.item }));
