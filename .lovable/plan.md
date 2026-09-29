# Experimentação virtual no produto

## Objetivo
Adicionar, ao lado de “Comprar” nos produtos exibidos, o botão “Experimentar” e deixar pronto todo o fluxo visual de captura da pessoa para futura integração com IA.

## O que será construído
- Exibir as ações “Comprar” e “Experimentar” nos itens da vitrine.
- Abrir uma janela de experimentação sem sair da loja.
- Solicitar acesso à câmera somente dentro desse fluxo e mostrar estados claros para permissão negada ou câmera indisponível.
- Permitir três entradas: enviar foto, enviar vídeo ou gravar 5 segundos em tempo real.
- Exibir a câmera ao vivo, contagem regressiva, progresso e controles para cancelar/refazer.
- Mostrar uma prévia da foto ou vídeo escolhido/gravação concluída.
- Finalizar em uma tela de “mídia pronta”, deixando explícito que o processamento da roupa será conectado depois.
- Liberar câmera e URLs temporárias ao fechar ou trocar a mídia.

## Detalhes técnicos
- Implementação somente no navegador, sem upload para servidor e sem persistência.
- Uso das APIs nativas `getUserMedia` e `MediaRecorder`, com fallback para navegadores sem gravação compatível.
- Tipos de arquivo aceitos e tamanho máximo validados no próprio seletor.
- Acessibilidade por teclado, rótulos, foco da janela e layout adaptado para celular e desktop.
- Componente de experimentação isolado e reutilizável para futura conexão com a IA.

## Validação
- Verificar abertura e fechamento da janela, seleção de foto/vídeo e estados de câmera.
- Confirmar o fluxo de gravação de 5 segundos em navegador real.
- Conferir desktop e celular, além do estado final sem erros na página.
