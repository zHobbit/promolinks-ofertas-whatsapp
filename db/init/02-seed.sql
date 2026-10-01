-- ==========================================================
--  Seed inicial: 6 nichos + keywords de classificação
--  Ajuste desconto_minimo por nicho conforme sua estratégia.
-- ==========================================================

INSERT INTO nichos (slug, nome, desconto_minimo, max_msgs_dia) VALUES
    ('auto',        'Auto (Carros/Moto)',                30.00, 10),
    ('fit',         'Fit (Fitness/Suplementos)',         30.00, 10),
    ('tech',        'Tech (Eletrônicos/Games)',          25.00, 15),
    ('casa',        'Casa (Cozinha/Eletrodomésticos)',   25.00, 15),
    ('moda-beleza', 'Moda & Beleza',                     30.00, 12),
    ('imperdiveis', 'Imperdíveis (>60% off)',            60.00, 20)
ON CONFLICT (slug) DO NOTHING;

-- Keywords por nicho (minúsculas, sem acento). Lista inicial — vamos refinando.
INSERT INTO keywords_nicho (nicho_id, palavra, peso)
SELECT n.id, k.palavra, k.peso
FROM (VALUES
    -- AUTO
    ('auto','pneu',2),('auto','oleo motor',2),('auto','farol',1),('auto','cambio',1),
    ('auto','capacete',2),('auto','moto',2),('auto','carro',1),('auto','automotivo',2),
    ('auto','bateria automotiva',2),('auto','som automotivo',2),('auto','limpador',1),
    -- FIT
    ('fit','whey',2),('fit','creatina',2),('fit','suplemento',2),('fit','halter',2),
    ('fit','esteira',2),('fit','bicicleta ergometrica',2),('fit','academia',1),
    ('fit','proteina',1),('fit','barra fixa',2),('fit','luva treino',1),('fit','colchonete',1),
    -- TECH
    ('tech','ssd',2),('tech','notebook',2),('tech','monitor',2),('tech','placa de video',2),
    ('tech','smartphone',2),('tech','celular',1),('tech','fone',1),('tech','headset',2),
    ('tech','teclado',1),('tech','mouse',1),('tech','console',2),('tech','playstation',2),
    ('tech','xbox',2),('tech','nintendo',2),('tech','memoria ram',2),('tech','processador',2),
    ('tech','smartwatch',2),('tech','tv',1),('tech','tablet',2),('tech','roteador',2),
    -- CASA
    ('casa','air fryer',2),('casa','fritadeira',2),('casa','panela',2),('casa','geladeira',2),
    ('casa','fogao',2),('casa','microondas',2),('casa','liquidificador',2),('casa','aspirador',2),
    ('casa','cafeteira',2),('casa','jogo de cama',1),('casa','toalha',1),('casa','colchao',1),
    ('casa','ventilador',1),('casa','ar condicionado',2),('casa','maquina de lavar',2),
    -- MODA & BELEZA
    ('moda-beleza','tenis',2),('moda-beleza','camiseta',1),('moda-beleza','calca',1),
    ('moda-beleza','vestido',2),('moda-beleza','perfume',2),('moda-beleza','batom',2),
    ('moda-beleza','maquiagem',2),('moda-beleza','shampoo',1),('moda-beleza','relogio',1),
    ('moda-beleza','oculos',1),('moda-beleza','bolsa',2),('moda-beleza','sapato',2),
    ('moda-beleza','secador',2),('moda-beleza','prancha cabelo',2)
) AS k(slug, palavra, peso)
JOIN nichos n ON n.slug = k.slug
ON CONFLICT (nicho_id, palavra) DO NOTHING;
