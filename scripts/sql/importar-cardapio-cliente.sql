-- Pede Aqui: importação do cardápio do cliente, compatível com PostgreSQL 18.
-- Destino: banco da aplicação no serviço cardapio-postgres (não evolution-db).
-- Confira v_slug e v_tenant_id abaixo antes de executar.
-- 3 categorias / 41 produtos. Valores em centavos inteiros.
-- Reexecução atualiza textos/preços equivalentes; preserva IDs, imagens e estados.
-- Execute o bloco inteiro: qualquer erro desfaz todas as alterações desta execução.

DO $pede_aqui_import$
DECLARE
  v_slug text := 'renan-lanches';
  v_restaurant_id uuid;
  v_tenant_id uuid := '3e6521f9-b2c5-4187-ab90-75f2958bcdbe';
  v_revision integer;
  v_category jsonb;
  v_product jsonb;
  v_matches uuid[];
  v_category_id uuid;
  v_product_id uuid;
  v_rows integer;
  v_categories_created integer := 0;
  v_categories_updated integer := 0;
  v_products_created integer := 0;
  v_products_updated integer := 0;
  v_catalog constant jsonb := $catalog$
[
  {
    "name": "Pizzas Grandes (8 Fatias)",
    "normalizedName": "pizzas grandes (8 fatias)",
    "matchKeys": [
      "pizzasg8fatias",
      "pizzasgrandes8fatias"
    ],
    "products": [
      {
        "name": "Muçarela",
        "description": "Molho, muçarela, tomate, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "mussarela",
          "mucarela"
        ]
      },
      {
        "name": "Presunto",
        "description": "Molho, muçarela, presunto, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "presunto"
        ]
      },
      {
        "name": "Calabresa",
        "description": "Molho, muçarela, calabresa, cebola, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "calabresa"
        ]
      },
      {
        "name": "Frango",
        "description": "Molho, muçarela, frango, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "frango"
        ]
      },
      {
        "name": "Três Queijos",
        "description": "Molho, muçarela, Catupiry, cheddar, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "tresqueijos"
        ]
      },
      {
        "name": "Bacon",
        "description": "Molho, muçarela, bacon, cebola, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4000,
        "matchKeys": [
          "bacon"
        ]
      },
      {
        "name": "Calabresa com Catupiry",
        "description": "Molho, muçarela, calabresa, Catupiry, milho, azeitona e orégano.",
        "price": 4800,
        "matchKeys": [
          "calabresacomcatupiry"
        ]
      },
      {
        "name": "Frango com Catupiry",
        "description": "Molho, muçarela, frango, Catupiry, milho, azeitona e orégano.",
        "price": 4800,
        "matchKeys": [
          "frangocomcatupiry"
        ]
      },
      {
        "name": "Frango Crocante",
        "description": "Molho, muçarela, frango, batata palha, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4500,
        "matchKeys": [
          "frangocrocante"
        ]
      },
      {
        "name": "Calabacon",
        "description": "Molho, muçarela, calabresa, bacon, cebola, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4800,
        "matchKeys": [
          "calabacon"
        ]
      },
      {
        "name": "Frambacon",
        "description": "Molho, muçarela, frango, bacon, milho, pimentão, tomate, azeitona e orégano.",
        "price": 4800,
        "matchKeys": [
          "frambacon"
        ]
      },
      {
        "name": "Da Casa",
        "description": "Molho, muçarela, frango, calabresa, bacon, cebola, milho, pimentão, tomate, azeitona e orégano.",
        "price": 6000,
        "matchKeys": [
          "dacasa"
        ]
      }
    ]
  },
  {
    "name": "Hambúrgueres Tradicionais",
    "normalizedName": "hamburgueres tradicionais",
    "matchKeys": [
      "hamburguerstradicionais",
      "hamburguerestradicionais"
    ],
    "products": [
      {
        "name": "Hambúrguer",
        "description": "Pão de hambúrguer, carne, salada e batata.",
        "price": 1560,
        "matchKeys": [
          "hamburguer"
        ]
      },
      {
        "name": "X-Burger",
        "description": "Pão de hambúrguer, carne, queijo, salada e batata.",
        "price": 1820,
        "matchKeys": [
          "xburger"
        ]
      },
      {
        "name": "X-Calabresa",
        "description": "Pão de hambúrguer, carne, calabresa, queijo, salada e batata.",
        "price": 2080,
        "matchKeys": [
          "xcalabresa"
        ]
      },
      {
        "name": "X-Salada",
        "description": "Pão de hambúrguer, carne, queijo, presunto, salada e batata.",
        "price": 2080,
        "matchKeys": [
          "xsalada"
        ]
      },
      {
        "name": "X-Bacon",
        "description": "Pão de hambúrguer, carne, bacon, queijo, salada e batata.",
        "price": 2100,
        "matchKeys": [
          "xbacon"
        ]
      },
      {
        "name": "X-Frango",
        "description": "Pão de hambúrguer, frango, queijo, salada e batata.",
        "price": 2080,
        "matchKeys": [
          "xfrango"
        ]
      },
      {
        "name": "X-Double",
        "description": "3 fatias de pão, 2 carnes, 2 queijos, salada e batata.",
        "price": 2500,
        "matchKeys": [
          "xdouble"
        ]
      },
      {
        "name": "X-Double-Calabacon",
        "description": "3 fatias de pão, 2 carnes, 2 queijos, bacon, calabresa, salada e batata.",
        "price": 3380,
        "matchKeys": [
          "xdoublecalabacon"
        ]
      },
      {
        "name": "X-Double-Bacon",
        "description": "3 fatias de pão, 2 carnes, 2 queijos, 2 porções de bacon, salada e batata.",
        "price": 3380,
        "matchKeys": [
          "xdoublebacon"
        ]
      },
      {
        "name": "X-Double-Salsicha",
        "description": "3 fatias de pão, 2 carnes, 2 queijos, 2 salsichas, salada e batata.",
        "price": 3120,
        "matchKeys": [
          "xdoublesalsicha"
        ]
      },
      {
        "name": "X-Double-Calabresa",
        "description": "3 fatias de pão, 2 carnes, 2 queijos, 2 porções de calabresa, salada e batata.",
        "price": 3120,
        "matchKeys": [
          "xdoublecalabresa"
        ]
      },
      {
        "name": "X-Calabacon",
        "description": "Pão de hambúrguer, carne, queijo, calabresa, bacon, salada e batata palha.",
        "price": 3200,
        "matchKeys": [
          "xcalabacon"
        ]
      },
      {
        "name": "Egg-Burger",
        "description": "Pão de hambúrguer, carne, queijo, ovo, salada e batata.",
        "price": 2080,
        "matchKeys": [
          "eggburgue",
          "eggburger"
        ]
      },
      {
        "name": "Eggs-Salada",
        "description": "Pão de hambúrguer, carne, queijo, presunto, ovo, salada e batata palha.",
        "price": 2340,
        "matchKeys": [
          "eggssalada"
        ]
      },
      {
        "name": "Eggs-Calabresa",
        "description": "Pão de hambúrguer, carne, queijo, calabresa, ovo, salada e batata palha.",
        "price": 2340,
        "matchKeys": [
          "eggscalabresa"
        ]
      },
      {
        "name": "Eggs-Bacon",
        "description": "Pão de hambúrguer, carne, queijo, bacon, ovo, salada e batata palha.",
        "price": 2340,
        "matchKeys": [
          "eggsbacon"
        ]
      },
      {
        "name": "Eggs-Frango",
        "description": "Pão de hambúrguer, frango, queijo, ovo, salada e batata palha.",
        "price": 2340,
        "matchKeys": [
          "eggsfrango"
        ]
      },
      {
        "name": "Eggs-Calabacon",
        "description": "Pão de hambúrguer, carne, queijo, ovo, calabresa, bacon, salada e batata palha.",
        "price": 2500,
        "matchKeys": [
          "eggscalabacon"
        ]
      },
      {
        "name": "Eggs-Double",
        "description": "3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 ovos, salada e batata palha.",
        "price": 3120,
        "matchKeys": [
          "eggsdouble"
        ]
      },
      {
        "name": "Eggs-Double-Bacon",
        "description": "3 fatias de pão de hambúrguer, 2 carnes, 2 porções de bacon, 2 queijos, 2 ovos, salada e batata palha.",
        "price": 3500,
        "matchKeys": [
          "eggsdoublebacon"
        ]
      },
      {
        "name": "Eggs-Double-Calabresa",
        "description": "3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 porções de calabresa, 2 ovos, salada e batata palha.",
        "price": 3500,
        "matchKeys": [
          "eggsdoublecalabresa"
        ]
      },
      {
        "name": "Eggs-Double-Salsicha",
        "description": "3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 salsichas, 2 ovos, salada e batata palha.",
        "price": 3500,
        "matchKeys": [
          "eggsdoublesalcisha",
          "eggsdoublesalsicha"
        ]
      },
      {
        "name": "Eggs-Double-Calabacon",
        "description": "3 fatias de pão de hambúrguer, 2 carnes, 1 porção de calabresa, 1 porção de bacon, 2 queijos, 2 ovos, salada e batata palha.",
        "price": 3500,
        "matchKeys": [
          "eggsdoublecalabacon"
        ]
      },
      {
        "name": "Americano",
        "description": "3 fatias de pão de hambúrguer, carne, queijo, presunto, ovo, salada e batata palha.",
        "price": 2340,
        "matchKeys": [
          "americano"
        ]
      },
      {
        "name": "Bauru",
        "description": "3 fatias de pão de hambúrguer, carne, queijo, presunto, bacon, ovo, salada e batata palha.",
        "price": 2500,
        "matchKeys": [
          "bauru"
        ]
      }
    ]
  },
  {
    "name": "Bebidas",
    "normalizedName": "bebidas",
    "matchKeys": [
      "bebidas"
    ],
    "products": [
      {
        "name": "Tuchaua Champ 350 ml",
        "description": "Lata de 350 ml.",
        "price": 700,
        "matchKeys": [
          "tuchauachamplata350ml",
          "tuchauachamp350ml"
        ]
      },
      {
        "name": "Coca-Cola Original 600 ml",
        "description": "Garrafa de 600 ml.",
        "price": 1000,
        "matchKeys": [
          "cocacolaoriginal600ml"
        ]
      },
      {
        "name": "Coca-Cola Original 1 L",
        "description": "Garrafa de 1 L.",
        "price": 1200,
        "matchKeys": [
          "refrigerantecocacolaoriginal1litro",
          "cocacolaoriginal1l"
        ]
      },
      {
        "name": "Coca-Cola 350 ml",
        "description": "Porção de 350 ml. Serve 1 pessoa.",
        "price": 700,
        "matchKeys": [
          "cocacola350ml"
        ]
      }
    ]
  }
]
$catalog$::jsonb;
BEGIN
  IF v_slug IS NULL OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Preencha v_slug com o slug exato da loja antes de executar.';
  END IF;

  -- Bloqueio local à transação, com espera limitada; não bloqueia outras lojas.
  PERFORM pg_catalog.set_config('lock_timeout', '10s', true);
  SELECT r.id, r.revision
  INTO v_restaurant_id, v_revision
  FROM public."Restaurant" AS r
  JOIN public."Tenant" AS t ON t.id = r."tenantId"
  WHERE r.slug = v_slug AND r."tenantId" = v_tenant_id AND t.active
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja não encontrada para o tenant informado ou organização inativa. Confira v_slug, v_tenant_id e o banco selecionado.';
  END IF;

  FOR v_category IN SELECT value FROM jsonb_array_elements(v_catalog)
  LOOP
    -- A chave de comparação reconhece a grafia original e a padronizada.
    -- normalize(..., NFD) + remoção dos caracteres não ASCII ignora acentos.
    SELECT array_agg(c.id ORDER BY c.id)
    INTO v_matches
    FROM public."Category" AS c
    WHERE c."tenantId" = v_tenant_id
      AND c."restaurantId" = v_restaurant_id
      AND (
        (v_category -> 'matchKeys') ? regexp_replace(lower(normalize(c.name, NFD)), '[^a-z0-9]', '', 'g')
        OR (v_category -> 'matchKeys') ? regexp_replace(lower(normalize(c."normalizedName", NFD)), '[^a-z0-9]', '', 'g')
      );

    IF coalesce(cardinality(v_matches), 0) > 1 THEN
      RAISE EXCEPTION 'Há categorias equivalentes a "%". Revise os cadastros existentes e execute novamente.', v_category ->> 'name';
    END IF;

    IF coalesce(cardinality(v_matches), 0) = 0 THEN
      v_category_id := gen_random_uuid();
      INSERT INTO public."Category" (id, "tenantId", "restaurantId", name, "normalizedName")
      VALUES (v_category_id, v_tenant_id, v_restaurant_id, v_category ->> 'name', v_category ->> 'normalizedName');
      v_categories_created := v_categories_created + 1;
    ELSE
      v_category_id := v_matches[1];
      UPDATE public."Category"
      SET name = v_category ->> 'name', "normalizedName" = v_category ->> 'normalizedName'
      WHERE id = v_category_id AND "tenantId" = v_tenant_id AND "restaurantId" = v_restaurant_id
        AND (name, "normalizedName") IS DISTINCT FROM (v_category ->> 'name', v_category ->> 'normalizedName');
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_categories_updated := v_categories_updated + v_rows;
    END IF;

    FOR v_product IN SELECT value FROM jsonb_array_elements(v_category -> 'products')
    LOOP
      SELECT array_agg(p.id ORDER BY p.id)
      INTO v_matches
      FROM public."Product" AS p
      WHERE p."tenantId" = v_tenant_id
        AND p."restaurantId" = v_restaurant_id
        AND p."categoryId" = v_category_id
        AND (v_product -> 'matchKeys') ? regexp_replace(lower(normalize(p.name, NFD)), '[^a-z0-9]', '', 'g');

      IF coalesce(cardinality(v_matches), 0) > 1 THEN
        RAISE EXCEPTION 'Há produtos equivalentes a "%" na categoria "%". Revise os cadastros existentes e execute novamente.', v_product ->> 'name', v_category ->> 'name';
      END IF;

      IF coalesce(cardinality(v_matches), 0) = 0 THEN
        v_product_id := gen_random_uuid();
        INSERT INTO public."Product" (
          id, "tenantId", "restaurantId", "categoryId", name, description, price, "imageUrl", available, popular
        ) VALUES (
          v_product_id, v_tenant_id, v_restaurant_id, v_category_id,
          v_product ->> 'name', v_product ->> 'description', (v_product ->> 'price')::integer,
          '', true, false
        );
        v_products_created := v_products_created + 1;
      ELSE
        v_product_id := v_matches[1];
        UPDATE public."Product"
        SET name = v_product ->> 'name',
            description = v_product ->> 'description',
            price = (v_product ->> 'price')::integer
        WHERE id = v_product_id AND "tenantId" = v_tenant_id AND "restaurantId" = v_restaurant_id
          AND "categoryId" = v_category_id
          AND (name, description, price) IS DISTINCT FROM (
            v_product ->> 'name', v_product ->> 'description', (v_product ->> 'price')::integer
          );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_products_updated := v_products_updated + v_rows;
      END IF;
    END LOOP;
  END LOOP;

  IF v_categories_created + v_categories_updated + v_products_created + v_products_updated > 0 THEN
    UPDATE public."Restaurant"
    SET revision = revision + 1
    WHERE id = v_restaurant_id AND "tenantId" = v_tenant_id
    RETURNING revision INTO v_revision;
  END IF;

  RAISE NOTICE 'Importação concluída. Categorias: % criadas, % atualizadas. Produtos: % criados, % atualizados, % sem alterações. Revisão: %.',
    v_categories_created, v_categories_updated, v_products_created, v_products_updated,
    41 - v_products_created - v_products_updated, v_revision;
END
$pede_aqui_import$ LANGUAGE plpgsql;
