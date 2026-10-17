SELECT 
    name, 
    LEFT("imageUrl", 50) AS inicio_da_imagem, 
    LENGTH("imageUrl") AS tamanho_caracteres
FROM public.products
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';