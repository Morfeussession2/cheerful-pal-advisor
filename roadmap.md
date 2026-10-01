# Roadmap

## Concluído
- [x] Estudar backend enviado (src.zip — token realtime fal.ai para `decart/lucy2-vton/realtime`)
- [x] Vitrine "Mais vendidos" com produtos reais, 4 fotos cada, preços e links
- [x] Botões Comprar/Experimentar responsivos (empilham em telas pequenas, textos ajustados)
- [x] Janela Experimentar: até 3 fotos (contador, remover, adicionar), vídeo ou gravação de 5s
- [x] iOS: botão "Compartilhar ou salvar vídeo" via Web Share API com fallback de download
- [x] Testado em 390px e 1280px, sem erros

## Próxima etapa (aguardando)
- [ ] Integrar IA: backend emite token em POST /api/fal/realtime-token; frontend conecta via fal.realtime com VITE_LUCY_BACKEND_URL

## Alerta
- O `.env.example` do backend enviado contém uma FAL_KEY real exposta — usuário deve revogar/rotacionar a chave no painel da fal.ai.
