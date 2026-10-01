# Roadmap

## Em andamento
- [ ] Estudar alterações do usuário no projeto e o backend enviado (src.zip — fal.ai realtime token)
- [ ] Corrigir layout quebrado dos botões "Experimentar" e "Comprar" em telas pequenas (responsividade + tamanhos de texto)
- [ ] iOS: trocar "baixar vídeo" por compartilhamento (Web Share API) para permitir salvar o vídeo no iPhone
- [ ] Permitir escolher até 3 imagens por produto ao clicar em "Experimentar" (para geração do vídeo)
- [ ] Adicionar mais imagens em cada produto da vitrine

## Observações
- Backend (Express) emite token temporário para `decart/lucy2-vton/realtime` da fal.ai; frontend usa `VITE_LUCY_BACKEND_URL`. Integração real fica para etapa futura.
- O `.env.example` enviado contém uma chave de API real — avisar o usuário para revogá-la/rotacioná-la.
